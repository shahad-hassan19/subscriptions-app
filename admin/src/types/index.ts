/**
 * types/index.ts — shared types for the admin React app.
 *
 * These mirror the server types. Every component that renders a
 * subscription, billing plan, or billing record imports from here —
 * so if the API shape changes, TypeScript tells you every broken UI spot.
 */

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED';
export type BillingStatus      = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'REFUNDED';
export type IntervalUnit       = 'WEEK' | 'MONTH' | 'YEAR';
export type DiscountType       = 'PERCENTAGE' | 'FIXED';

export interface BillingPlan {
  id:                   string;
  shopId:               string;
  name:                 string;
  description:          string | null;
  intervalUnit:         IntervalUnit;
  intervalCount:        number;
  discountType:         DiscountType;
  discountValue:        number;
  isActive:             boolean;
  sortOrder:            number;
  activeSubscriberCount?: number;
  createdAt:            string;   // dates come from JSON as strings
  updatedAt:            string;
}

export interface SubscriptionProduct {
  variantId: string;
  title:     string;
  price:     number;
  quantity:  number;
  imageUrl?: string;
}

export interface CustomerSummary {
  id:        string;
  email:     string;
  firstName: string | null;
  lastName:  string | null;
}

export interface BillingPlanSummary {
  id:            string;
  name:          string;
  intervalUnit:  IntervalUnit;
  intervalCount: number;
}

export interface Subscription {
  id:              string;
  shopId:          string;
  customerId:      string;
  billingPlanId:   string;
  status:          SubscriptionStatus;
  products:        SubscriptionProduct[];
  subtotal:        number;
  discountAmount:  number;
  total:           number;
  nextBillingDate: string;
  lastBilledAt:    string | null;
  cancelledAt:     string | null;
  cancelReason:    string | null;
  pausedAt:        string | null;
  createdAt:       string;
  updatedAt:       string;
  // Relations included by list/get endpoints
  customer?:    CustomerSummary;
  billingPlan?: BillingPlanSummary;
  billings?:    Billing[];
}

export interface Billing {
  id:                    string;
  subscriptionId:        string;
  amount:                number;
  currency:              string;
  status:                BillingStatus;
  stripePaymentIntentId: string | null;
  failureReason:         string | null;
  retryCount:            number;
  billedAt:              string;
  succeededAt:           string | null;
  refundedAt:            string | null;
  refundAmount:          number | null;
}

export interface Pagination {
  page:  number;
  limit: number;
  total: number;
  pages: number;
}

// ── API response wrappers ──────────────────────────────────────────────────
// These match exactly what the Express routes return.

export interface BillingPlansResponse  { plans: BillingPlan[] }
export interface BillingPlanResponse   { plan:  BillingPlan }

export interface SubscriptionsResponse {
  subscriptions: Subscription[];
  pagination:    Pagination;
}
export interface SubscriptionResponse  { subscription: Subscription }

export interface BillingHistoryResponse {
  billings:   Billing[];
  pagination: Pagination;
}

export interface BillingRunResponse {
  message:   string;
  succeeded: number;
  failed:    number;
  errors:    Array<{ subscriptionId: string; error: string }>;
}

// ── Form input types ───────────────────────────────────────────────────────

export interface CreateBillingPlanForm {
  name:          string;
  description:   string;
  intervalCount: number;
  intervalUnit:  IntervalUnit;
  discountType:  DiscountType;
  discountValue: number;
}