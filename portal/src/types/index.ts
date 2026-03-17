/**
 * portal/src/types/index.ts — shared types for the customer portal.
 */

export type SubscriptionStatus = "ACTIVE" | "PAUSED" | "CANCELLED" | "EXPIRED";
export type IntervalUnit = "WEEK" | "MONTH" | "YEAR";
export type DiscountType = "PERCENTAGE" | "FIXED";

// ── Auth ───────────────────────────────────────────────────────────────────

export interface AuthCustomer {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface VerifyResponse {
  sessionToken: string;
  customer: AuthCustomer;
}

// ── Domain ─────────────────────────────────────────────────────────────────

export interface BillingPlan {
  id: string;
  name: string;
  description: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  discountType: DiscountType;
  discountValue: number;
}

export interface SubscriptionProduct {
  variantId: string;
  title: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

export interface Billing {
  id: string;
  amount: number;
  currency: string;
  status: "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";
  billedAt: string;
  failureReason: string | null;
}

export interface Subscription {
  id: string;
  status: SubscriptionStatus;
  products: SubscriptionProduct[];
  subtotal: number;
  discountAmount: number;
  total: number;
  nextBillingDate: string;
  lastBilledAt: string | null;
  pausedAt: string | null;
  pauseUntil: string | null;
  cancelledAt: string | null;
  createdAt: string;
  billingPlan?: BillingPlan;
  billings?: Billing[];
}

// ── API responses ──────────────────────────────────────────────────────────

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
}

export interface SubscriptionResponse {
  subscription: Subscription;
  message: string;
}

// ── Widget (Shopify storefront) ────────────────────────────────────────────

export interface WidgetBillingPlan {
  id: string;
  name: string;
  description: string | null;
  intervalUnit: IntervalUnit;
  intervalCount: number;
  discountType: DiscountType;
  discountValue: number;
}
