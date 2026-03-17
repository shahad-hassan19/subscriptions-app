/**
 * subscriptionService.ts — subscription lifecycle management.
 */

import prisma from "../db.js";
import { getBillingPlan, calculatePrice } from "./billingPlanService.js";
import { SubscriptionStatus, type Prisma } from "@prisma/client";
import {
  sendSubscriptionPaused,
  sendSubscriptionResumed,
  sendSubscriptionCancelled,
} from "./emailService.js";
import type {
  Subscription,
  CreateSubscriptionInput,
  BillingPlan,
  Pagination,
} from "../types/index.js";

function parseSubscriptionStatus(
  status?: string,
): SubscriptionStatus | undefined {
  if (!status) return undefined;
  const normalized = status.toUpperCase();
  if ((Object.values(SubscriptionStatus) as string[]).includes(normalized)) {
    return normalized as SubscriptionStatus;
  }
  throw Object.assign(new Error(`Invalid subscription status: ${status}`), {
    status: 400,
  });
}

// ── Create ─────────────────────────────────────────────────────────────────

export async function createSubscription(
  shopId: string,
  data: CreateSubscriptionInput,
): Promise<Subscription> {
  const {
    customerId,
    billingPlanId,
    products,
    stripeCustomerId = null,
    stripePaymentMethodId = null,
    shippingAddressId = null,
    trialDays = 0,
  } = data;

  if (!customerId)
    throw Object.assign(new Error("customerId is required"), { status: 400 });
  if (!billingPlanId)
    throw Object.assign(new Error("billingPlanId is required"), {
      status: 400,
    });

  if (!Array.isArray(products) || products.length === 0) {
    throw Object.assign(new Error("products must be a non-empty array"), {
      status: 400,
    });
  }

  for (const p of products) {
    if (!p.variantId || !p.title || p.price === undefined || !p.quantity) {
      throw Object.assign(
        new Error("Each product needs: variantId, title, price, quantity"),
        { status: 400 },
      );
    }
  }

  const plan = await getBillingPlan(shopId, billingPlanId);

  if (!plan.isActive) {
    throw Object.assign(new Error("This billing plan is no longer available"), {
      status: 400,
    });
  }

  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const { discountAmount, total } = calculatePrice(subtotal, plan);
  const trialEndsAt = trialDays > 0 ? addDays(new Date(), trialDays) : null;
  const nextBillingDate = trialEndsAt ?? calcNextDate(plan);

  const sub = await prisma.subscription.create({
    data: {
      shopId,
      customerId,
      billingPlanId,
      status: "ACTIVE",
      products: products as object[],
      subtotal,
      discountAmount,
      total,
      nextBillingDate,
      trialEndsAt,
      stripeCustomerId,
      stripePaymentMethodId,
      shippingAddressId,
    },
    include: { customer: true, billingPlan: true },
  });

  return normalise(sub);
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getSubscription(
  shopId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const sub = await prisma.subscription.findFirst({
    where: { id: subscriptionId, shopId },
    include: {
      customer: true,
      billingPlan: true,
      billings: { orderBy: { billedAt: "desc" }, take: 10 },
    },
  });

  if (!sub) {
    throw Object.assign(new Error("Subscription not found"), { status: 404 });
  }

  return normalise(sub);
}

export async function listSubscriptions(
  shopId: string,
  options: {
    status?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  } = {},
): Promise<{ subscriptions: Subscription[]; pagination: Pagination }> {
  const { status, customerId, page = 1, limit = 20 } = options;
  const parsedStatus = parseSubscriptionStatus(status);

  const where: Prisma.SubscriptionWhereInput = {
    shopId,
    ...(parsedStatus ? { status: parsedStatus } : {}),
    ...(customerId ? { customerId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: {
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        billingPlan: {
          select: {
            id: true,
            name: true,
            intervalUnit: true,
            intervalCount: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  return {
    subscriptions: rows.map(normalise),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

export async function getCustomerSubscriptions(
  customerId: string,
): Promise<Subscription[]> {
  const rows = await prisma.subscription.findMany({
    where: { customerId },
    include: {
      billingPlan: true,
      billings: { orderBy: { billedAt: "desc" }, take: 5 },
    },
    orderBy: { createdAt: "desc" },
  });

  return rows.map(normalise);
}

// ── Pause ──────────────────────────────────────────────────────────────────

export async function pauseSubscription(
  shopId: string,
  subscriptionId: string,
  resumeDate: Date | null = null,
): Promise<Subscription> {
  const sub = await getSubscription(shopId, subscriptionId);

  if (sub.status !== "ACTIVE") {
    throw Object.assign(
      new Error(`Cannot pause a subscription with status: ${sub.status}`),
      { status: 400 },
    );
  }

  if (resumeDate && resumeDate <= new Date()) {
    throw Object.assign(new Error("resumeDate must be in the future"), {
      status: 400,
    });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { status: "PAUSED", pausedAt: new Date(), pauseUntil: resumeDate },
  });

  // Fire-and-forget — don't let email failure break the pause action
  sendSubscriptionPaused({
    to: sub.customer?.email ?? "",
    planName: sub.billingPlan?.name ?? "your subscription",
    nextDate: resumeDate?.toISOString(),
  }).catch((e: Error) => console.error("[email] pause:", e.message));

  return normalise(updated);
}

// ── Resume ─────────────────────────────────────────────────────────────────

export async function resumeSubscription(
  shopId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const sub = await getSubscription(shopId, subscriptionId);

  if (sub.status !== "PAUSED") {
    throw Object.assign(
      new Error(`Cannot resume a subscription with status: ${sub.status}`),
      { status: 400 },
    );
  }

  const nextBillingDate = calcNextDate(sub.billingPlan!);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      pausedAt: null,
      pauseUntil: null,
      nextBillingDate,
    },
  });

  sendSubscriptionResumed({
    to: sub.customer?.email ?? "",
    planName: sub.billingPlan?.name ?? "your subscription",
    nextDate: nextBillingDate.toISOString(),
    amount: sub.total,
  }).catch((e: Error) => console.error("[email] resume:", e.message));

  return normalise(updated);
}

// ── Cancel ─────────────────────────────────────────────────────────────────

export async function cancelSubscription(
  shopId: string,
  subscriptionId: string,
  cancelReason: string | null = null,
): Promise<Subscription> {
  const sub = await getSubscription(shopId, subscriptionId);

  if (sub.status === "CANCELLED") {
    throw Object.assign(new Error("Subscription is already cancelled"), {
      status: 400,
    });
  }

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: cancelReason ?? null,
    },
  });

  sendSubscriptionCancelled({
    to: sub.customer?.email ?? "",
    planName: sub.billingPlan?.name ?? "your subscription",
    reason: cancelReason ?? undefined,
  }).catch((e: Error) => console.error("[email] cancel:", e.message));

  return normalise(updated);
}

// ── Skip ───────────────────────────────────────────────────────────────────

export async function skipNextDelivery(
  shopId: string,
  subscriptionId: string,
): Promise<Subscription> {
  const sub = await getSubscription(shopId, subscriptionId);

  if (sub.status !== "ACTIVE") {
    throw Object.assign(
      new Error(`Cannot skip a subscription with status: ${sub.status}`),
      { status: 400 },
    );
  }

  const newNextBillingDate = calcNextDate(
    sub.billingPlan!,
    sub.nextBillingDate,
  );

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { nextBillingDate: newNextBillingDate },
  });

  return normalise(updated);
}

// ── Update products ────────────────────────────────────────────────────────

export async function updateSubscriptionProducts(
  shopId: string,
  subscriptionId: string,
  products: Subscription["products"],
): Promise<Subscription> {
  if (!Array.isArray(products) || products.length === 0) {
    throw Object.assign(new Error("products must be a non-empty array"), {
      status: 400,
    });
  }

  const sub = await getSubscription(shopId, subscriptionId);
  const subtotal = products.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const { discountAmount, total } = calculatePrice(subtotal, sub.billingPlan!);

  const updated = await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { products: products as object[], subtotal, discountAmount, total },
  });

  return normalise(updated);
}

// ── Date helpers ───────────────────────────────────────────────────────────

export function calcNextDate(
  plan: Pick<BillingPlan, "intervalUnit" | "intervalCount">,
  fromDate: Date = new Date(),
): Date {
  const date = new Date(fromDate);

  switch (plan.intervalUnit) {
    case "WEEK":
      date.setDate(date.getDate() + 7 * plan.intervalCount);
      break;
    case "MONTH":
      date.setMonth(date.getMonth() + plan.intervalCount);
      break;
    case "YEAR":
      date.setFullYear(date.getFullYear() + plan.intervalCount);
      break;
    default:
      date.setMonth(date.getMonth() + 1);
  }

  return date;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Normalise Prisma result ────────────────────────────────────────────────
// Converts Decimal fields to number and casts JSON products to typed array.

function normalise(row: Record<string, unknown>): Subscription {
  return {
    ...row,
    subtotal: Number(row.subtotal),
    discountAmount: Number(row.discountAmount),
    total: Number(row.total),
    products: row.products as Subscription["products"],
  } as Subscription;
}
