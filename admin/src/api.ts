/**
 * api.ts — typed API client.
 *
 * TypeScript note: the generic request<T> function means callers declare
 * what shape they expect back, and TypeScript enforces that every call
 * site uses the response correctly.
 *
 *   const data = await get<SubscriptionsResponse>('/subscriptions?shopId=x');
 *   data.subscriptions  // ✓ TypeScript knows this exists
 *   data.xyz            // ✗ TypeScript error — property does not exist
 */

import type {
  BillingPlansResponse,
  BillingPlanResponse,
  SubscriptionsResponse,
  SubscriptionResponse,
  BillingHistoryResponse,
  BillingRunResponse,
  CreateBillingPlanForm,
} from "./types/index.js";

// ── Shop ID ────────────────────────────────────────────────────────────────

function getShopId(): string {
  const id = localStorage.getItem("shopId");
  if (!id) {
    throw new Error(
      "No shopId set. Open the browser console and run:\n" +
        "localStorage.setItem('shopId', 'YOUR_SHOP_ID')",
    );
  }
  return id;
}

// ── Core fetch wrapper ─────────────────────────────────────────────────────

// __API_URL__ is injected by Vite from VITE_API_URL in production.
// In dev it's an empty string so /api is proxied to localhost:3000 by Vite.
declare const __API_URL__: string;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const base = (typeof __API_URL__ !== "undefined" ? __API_URL__ : "") + "/api";
  const opts: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };

  if (body !== undefined) opts.body = JSON.stringify(body);

  const res = await fetch(`${base}${path}`, opts);
  const data = (await res.json()) as T & { error?: string };

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }

  return data;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) =>
  request<T>("POST", path, body);
const patch = <T>(path: string, body?: unknown) =>
  request<T>("PATCH", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

// ── Billing Plans ──────────────────────────────────────────────────────────

export const billingPlansApi = {
  list: () => get<BillingPlansResponse>(`/billing-plans?shopId=${getShopId()}`),

  get: (id: string) =>
    get<BillingPlanResponse>(`/billing-plans/${id}?shopId=${getShopId()}`),

  create: (data: CreateBillingPlanForm) =>
    post<BillingPlanResponse>(`/billing-plans`, {
      ...data,
      shopId: getShopId(),
    }),

  update: (id: string, data: Partial<CreateBillingPlanForm>) =>
    patch<BillingPlanResponse>(`/billing-plans/${id}`, {
      ...data,
      shopId: getShopId(),
    }),

  deactivate: (id: string) =>
    del<BillingPlanResponse>(`/billing-plans/${id}?shopId=${getShopId()}`),
};

// ── Subscriptions ──────────────────────────────────────────────────────────

export interface ListSubscriptionsParams {
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
}

export const subscriptionsApi = {
  list: (params: ListSubscriptionsParams = {}) => {
    const qs = new URLSearchParams({
      shopId: getShopId(),
      ...Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
    }).toString();
    return get<SubscriptionsResponse>(`/subscriptions?${qs}`);
  },

  get: (id: string) =>
    get<SubscriptionResponse>(`/subscriptions/${id}?shopId=${getShopId()}`),

  pause: (id: string, resumeDate?: string) =>
    post<SubscriptionResponse>(`/subscriptions/${id}/pause`, {
      shopId: getShopId(),
      resumeDate,
    }),

  resume: (id: string) =>
    post<SubscriptionResponse>(`/subscriptions/${id}/resume`, {
      shopId: getShopId(),
    }),

  cancel: (id: string, reason?: string) =>
    post<SubscriptionResponse>(`/subscriptions/${id}/cancel`, {
      shopId: getShopId(),
      reason,
    }),

  skip: (id: string) =>
    post<SubscriptionResponse>(`/subscriptions/${id}/skip`, {
      shopId: getShopId(),
    }),
};

// ── Billing ────────────────────────────────────────────────────────────────

export const billingApi = {
  history: (
    subscriptionId: string,
    params: { page?: number; limit?: number } = {},
  ) => {
    const qs = new URLSearchParams(
      Object.fromEntries(
        Object.entries(params)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)]),
      ),
    ).toString();
    return get<BillingHistoryResponse>(`/billing/${subscriptionId}?${qs}`);
  },

  refund: (billingId: string, amount?: number) =>
    post<{ billing: unknown; message: string }>(
      `/billing/${billingId}/refund`,
      { amount },
    ),

  processDue: () => post<BillingRunResponse>(`/billing/process-due`),
};
