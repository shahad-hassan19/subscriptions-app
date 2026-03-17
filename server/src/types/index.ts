/**
 * types/index.ts — shared TypeScript types for the entire server.
 *
 * WHY A SEPARATE TYPES FILE:
 * When you define a type like `Subscription` in one place and import it
 * everywhere, TypeScript guarantees that every part of your app agrees on
 * what a Subscription looks like. If you change the shape, every broken
 * usage becomes a compile error — caught before you ship.
 */

// ── Enums ──────────────────────────────────────────────────────────────────
// These mirror the Prisma schema enums. Keeping them here lets us use them
// in application code without importing Prisma everywhere.

export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type BillingStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
export type IntervalUnit = "WEEK" | "MONTH" | "YEAR";
export type DiscountType = "PERCENTAGE" | "FIXED";

// ── Domain types ───────────────────────────────────────────────────────────

export interface Shop {
  id: string;
  domain: string;
  accessToken: string;
  scope: string;
  email: string | null;
  name: string | null;
  installedAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  shopId: string;
  shopifyCustomerId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  acceptsMarketing: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BillingPlan {
  id: string;
  shopId: string;
  name: string;
  description: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  discountType: DiscountType;
  discountValue: number; // Prisma Decimal becomes number after serialisation
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  // Included when fetching with _count
  activeSubscriberCount?: number;
}

export interface SubscriptionProduct {
  variantId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Subscription {
  id: string;
  shopId: string;
  customerId: string;
  billingPlanId: string;
  status: SubscriptionStatus;
  products: SubscriptionProduct[];
  subtotal: number;
  discountAmount: number;
  total: number;
  nextBillingDate: Date;
  lastBilledAt: Date | null;
  trialEndsAt: Date | null;
  pausedAt: Date | null;
  pauseUntil: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  shippingAddressId: string | null;
  stripeCustomerId: string | null;
  stripePaymentMethodId: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Relations (included in some queries)
  customer?: Customer;
  billingPlan?: BillingPlan;
  billings?: Billing[];
}

export interface Billing {
  id: string;
  subscriptionId: string;
  amount: number;
  currency: string;
  status: BillingStatus;
  stripePaymentIntentId: string | null;
  stripeInvoiceId: string | null;
  shopifyOrderId: string | null;
  failureReason: string | null;
  retryCount: number;
  nextRetryAt: Date | null;
  billedAt: Date;
  succeededAt: Date | null;
  refundedAt: Date | null;
  refundAmount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Request / Response shapes ──────────────────────────────────────────────

export interface CreateBillingPlanInput {
  name: string;
  description?: string;
  intervalUnit: IntervalUnit;
  intervalCount?: number;
  discountType?: DiscountType;
  discountValue?: number;
  sortOrder?: number;
}

export interface UpdateBillingPlanInput {
  name?: string;
  description?: string;
  intervalUnit?: IntervalUnit;
  intervalCount?: number;
  discountType?: DiscountType;
  discountValue?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface CreateSubscriptionInput {
  customerId: string;
  billingPlanId: string;
  products: SubscriptionProduct[];
  stripeCustomerId?: string;
  stripePaymentMethodId?: string;
  shippingAddressId?: string;
  trialDays?: number;
}

export interface PriceCalculation {
  subtotal: number;
  discountAmount: number;
  total: number;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

// ── Express augmentation ───────────────────────────────────────────────────
// This tells TypeScript that req.customer exists after requireAuth runs.
// Without this, TypeScript would say "Property 'customer' does not exist on Request".

declare global {
  namespace Express {
    interface Request {
      customer?: {
        id: string;
        email: string;
        shopId: string;
      };
      rawBody?: Buffer;
    }
  }
}
