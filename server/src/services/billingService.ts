/**
 * billingService.ts — recurring charge processing engine.
 */

import Stripe    from 'stripe';
import prisma    from '../db.js';
import config    from '../config.js';
import { calcNextDate } from './subscriptionService.js';
import type { Billing } from '../types/index.js';

const stripe: Stripe | null = config.stripe.secretKey
  ? new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' })
  : null;

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_DAYS  = [3, 5, 7];

// ── Process due subscriptions ──────────────────────────────────────────────

interface BillingRunResult {
  succeeded: number;
  failed:    number;
  errors:    Array<{ subscriptionId: string; error: string }>;
}

export async function processDueSubscriptions(): Promise<BillingRunResult> {
  const now = new Date();

  const dueSubscriptions = await prisma.subscription.findMany({
    where: {
      status:                'ACTIVE',
      nextBillingDate:       { lte: now },
      stripeCustomerId:      { not: null },
      stripePaymentMethodId: { not: null },
    },
    include: { customer: true, billingPlan: true },
  });

  console.log(`[billing] ${dueSubscriptions.length} subscriptions due`);

  const results: BillingRunResult = { succeeded: 0, failed: 0, errors: [] };

  for (const sub of dueSubscriptions) {
    try {
      await chargeSubscription(sub as Parameters<typeof chargeSubscription>[0]);
      results.succeeded++;
    } catch (err) {
      results.failed++;
      results.errors.push({
        subscriptionId: sub.id,
        error:          err instanceof Error ? err.message : 'unknown',
      });
    }
  }

  return results;
}

// ── Charge single subscription ─────────────────────────────────────────────

type SubWithPlan = {
  id:                    string;
  total:                 unknown;       // Prisma Decimal
  stripeCustomerId:      string | null;
  stripePaymentMethodId: string | null;
  billingPlan: {
    intervalUnit:  string;
    intervalCount: number;
  };
};

export async function chargeSubscription(subscription: SubWithPlan): Promise<Billing> {
  const { id: subscriptionId, stripeCustomerId, stripePaymentMethodId } = subscription;
  const total = Number(subscription.total);

  const billing = await prisma.billing.create({
    data: { subscriptionId, amount: total, currency: 'USD', status: 'PENDING' },
  });

  if (!stripe) {
    console.log(`[billing] SIMULATED charge $${total} for subscription ${subscriptionId}`);
    await handleSuccess(billing.id, subscriptionId, subscription.billingPlan, 'sim_' + Date.now());
    return normalise(billing);
  }

  try {
    const pi = await stripe.paymentIntents.create({
      amount:         Math.round(total * 100),
      currency:       'usd',
      customer:       stripeCustomerId!,
      payment_method: stripePaymentMethodId!,
      confirm:        true,
      off_session:    true,
      return_url:     config.portalUrl,
      metadata:       { billingId: billing.id, subscriptionId },
    });

    if (pi.status === 'succeeded') {
      await handleSuccess(billing.id, subscriptionId, subscription.billingPlan, pi.id);
    } else {
      await handleFailure(billing.id, subscriptionId, `Unexpected status: ${pi.status}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown';
    await handleFailure(billing.id, subscriptionId, message);
    throw err;
  }

  return normalise(billing);
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleSuccess(
  billingId:             string,
  subscriptionId:        string,
  billingPlan:           { intervalUnit: string; intervalCount: number },
  stripePaymentIntentId: string
): Promise<void> {
  const now = new Date();

  await prisma.billing.update({
    where: { id: billingId },
    data:  { status: 'SUCCEEDED', succeededAt: now, stripePaymentIntentId },
  });

  const nextBillingDate = calcNextDate(billingPlan as { intervalUnit: 'WEEK' | 'MONTH' | 'YEAR'; intervalCount: number });

  await prisma.subscription.update({
    where: { id: subscriptionId },
    data:  { nextBillingDate, lastBilledAt: now },
  });

  console.log(`[billing] ✓ ${subscriptionId} — next: ${nextBillingDate.toDateString()}`);
}

async function handleFailure(
  billingId:      string,
  subscriptionId: string,
  reason:         string
): Promise<void> {
  const failedCount = await prisma.billing.count({
    where: { subscriptionId, status: 'FAILED' },
  });

  await prisma.billing.update({
    where: { id: billingId },
    data:  { status: 'FAILED', failureReason: reason, retryCount: failedCount + 1 },
  });

  if (failedCount < MAX_RETRY_ATTEMPTS) {
    const delayDays  = RETRY_DELAYS_DAYS[failedCount] ?? 7;
    const nextRetry  = addDays(new Date(), delayDays);

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data:  { nextBillingDate: nextRetry },
    });

    console.log(`[billing] ✗ ${subscriptionId} — retry ${failedCount + 1}/${MAX_RETRY_ATTEMPTS} on ${nextRetry.toDateString()}`);
  } else {
    await prisma.subscription.update({
      where: { id: subscriptionId },
      data:  { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: 'payment_failed_max_retries' },
    });

    console.log(`[billing] ✗ ${subscriptionId} cancelled after max retries`);
  }
}

// ── Refund ─────────────────────────────────────────────────────────────────

export async function refundBilling(
  billingId: string,
  amount:    number | null = null
): Promise<Billing> {
  const billing = await prisma.billing.findUnique({ where: { id: billingId } });

  if (!billing) {
    throw Object.assign(new Error('Billing record not found'), { status: 404 });
  }

  if (billing.status !== 'SUCCEEDED') {
    throw Object.assign(new Error('Can only refund a succeeded billing record'), { status: 400 });
  }

  const refundAmount = amount ?? Number(billing.amount);

  if (stripe && billing.stripePaymentIntentId) {
    await stripe.refunds.create({
      payment_intent: billing.stripePaymentIntentId,
      amount:         Math.round(refundAmount * 100),
    });
  } else {
    console.log(`[billing] SIMULATED refund $${refundAmount} for ${billingId}`);
  }

  const updated = await prisma.billing.update({
    where: { id: billingId },
    data:  { status: 'REFUNDED', refundedAt: new Date(), refundAmount },
  });

  return normalise(updated);
}

// ── History ────────────────────────────────────────────────────────────────

export async function getBillingHistory(
  subscriptionId: string,
  options:        { page?: number; limit?: number } = {}
): Promise<{ billings: Billing[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const { page = 1, limit = 20 } = options;

  const [rows, total] = await Promise.all([
    prisma.billing.findMany({
      where:   { subscriptionId },
      orderBy: { billedAt: 'desc' },
      skip:    (page - 1) * limit,
      take:    limit,
    }),
    prisma.billing.count({ where: { subscriptionId } }),
  ]);

  return {
    billings:   rows.map(normalise),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function normalise(row: Record<string, unknown>): Billing {
  return {
    ...row,
    amount:       Number(row.amount),
    refundAmount: row.refundAmount != null ? Number(row.refundAmount) : null,
  } as Billing;
}