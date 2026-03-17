/**
 * billingPlanService.ts — manages subscription plan templates.
 *
 * TypeScript note: every function has explicit parameter types and return
 * types. `Promise<BillingPlan>` means: this async function resolves to a
 * BillingPlan — TypeScript verifies the returned object matches that shape.
 */

import prisma from '../db.js';
import type {
  BillingPlan,
  CreateBillingPlanInput,
  UpdateBillingPlanInput,
  PriceCalculation,
} from '../types/index.js';

// ── Create ─────────────────────────────────────────────────────────────────

export async function createBillingPlan(
  shopId: string,
  data:   CreateBillingPlanInput
): Promise<BillingPlan> {
  const {
    name,
    description   = null,
    intervalUnit,
    intervalCount = 1,
    discountType  = 'PERCENTAGE',
    discountValue = 0,
    sortOrder     = 0,
  } = data;

  if (!name?.trim()) {
    throw Object.assign(new Error('Plan name is required'), { status: 400 });
  }

  const validUnits = ['WEEK', 'MONTH', 'YEAR'] as const;
  if (!validUnits.includes(intervalUnit)) {
    throw Object.assign(
      new Error(`intervalUnit must be one of: ${validUnits.join(', ')}`),
      { status: 400 }
    );
  }

  if (intervalCount < 1) {
    throw Object.assign(new Error('intervalCount must be at least 1'), { status: 400 });
  }

  if (discountValue < 0) {
    throw Object.assign(new Error('discountValue cannot be negative'), { status: 400 });
  }

  if (discountType === 'PERCENTAGE' && discountValue > 100) {
    throw Object.assign(new Error('Percentage discount cannot exceed 100'), { status: 400 });
  }

  const plan = await prisma.billingPlan.create({
    data: {
      shopId,
      name:          name.trim(),
      description:   description ?? null,
      intervalUnit,
      intervalCount,
      discountType,
      discountValue,
      sortOrder,
      isActive:      true,
    },
  });

  return normalisePlan(plan);
}

// ── Read ───────────────────────────────────────────────────────────────────

export async function getBillingPlans(
  shopId:     string,
  options:    { activeOnly?: boolean } = {}
): Promise<BillingPlan[]> {
  const { activeOnly = false } = options;

  const plans = await prisma.billingPlan.findMany({
    where: {
      shopId,
      ...(activeOnly ? { isActive: true } : {}),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } },
    },
  });

  return plans.map((plan) => ({
    ...normalisePlan(plan),
    activeSubscriberCount: plan._count.subscriptions,
  }));
}

export async function getBillingPlan(
  shopId: string,
  planId: string
): Promise<BillingPlan> {
  const plan = await prisma.billingPlan.findFirst({
    where: { id: planId, shopId },
  });

  if (!plan) {
    throw Object.assign(new Error('Billing plan not found'), { status: 404 });
  }

  return normalisePlan(plan);
}

// ── Update ─────────────────────────────────────────────────────────────────

export async function updateBillingPlan(
  shopId:  string,
  planId:  string,
  data:    UpdateBillingPlanInput
): Promise<BillingPlan> {
  await getBillingPlan(shopId, planId); // verify ownership

  const allowed: (keyof UpdateBillingPlanInput)[] = [
    'name', 'description', 'intervalUnit', 'intervalCount',
    'discountType', 'discountValue', 'isActive', 'sortOrder',
  ];

  const updates: Partial<UpdateBillingPlanInput> = {};
  for (const key of allowed) {
    if (key in data) updates[key] = data[key] as never;
  }

  if (Object.keys(updates).length === 0) {
    throw Object.assign(new Error('No valid fields to update'), { status: 400 });
  }

  const plan = await prisma.billingPlan.update({
    where: { id: planId },
    data:  updates,
  });

  return normalisePlan(plan);
}

// ── Deactivate ─────────────────────────────────────────────────────────────

export async function deactivateBillingPlan(
  shopId:  string,
  planId:  string
): Promise<BillingPlan> {
  await getBillingPlan(shopId, planId);

  const plan = await prisma.billingPlan.update({
    where: { id: planId },
    data:  { isActive: false },
  });

  return normalisePlan(plan);
}

// ── Price calculation ──────────────────────────────────────────────────────

export function calculatePrice(
  subtotal: number,
  plan:     Pick<BillingPlan, 'discountType' | 'discountValue'>
): PriceCalculation {
  let discountAmount = 0;

  if (Number(plan.discountValue) > 0) {
    discountAmount =
      plan.discountType === 'PERCENTAGE'
        ? (subtotal * Number(plan.discountValue)) / 100
        : Math.min(Number(plan.discountValue), subtotal);
  }

  discountAmount = Math.round(discountAmount * 100) / 100;
  const total    = Math.round((subtotal - discountAmount) * 100) / 100;

  return { subtotal, discountAmount, total };
}

// ── Normalise Prisma Decimal → number ─────────────────────────────────────
// Prisma returns Decimal objects for numeric columns. We convert to plain
// numbers so the rest of the app doesn't have to deal with Decimal.

function normalisePlan(plan: {
  id: string; shopId: string; name: string; description: string | null;
  intervalUnit: string; intervalCount: number; discountType: string;
  discountValue: unknown; isActive: boolean; sortOrder: number;
  createdAt: Date; updatedAt: Date;
}): BillingPlan {
  return {
    ...plan,
    intervalUnit:  plan.intervalUnit  as BillingPlan['intervalUnit'],
    discountType:  plan.discountType  as BillingPlan['discountType'],
    discountValue: Number(plan.discountValue),
  };
}