/**
 * portal/src/api.ts — typed API client for the customer portal.
 *
 * KEY DIFFERENCE FROM ADMIN API:
 * Every authenticated request includes the JWT session token in the
 * Authorization header. The server's requireAuth middleware reads it.
 *
 * HANDLING 401s:
 * If the server returns 401 (session expired), we call logout() so
 * the customer is redirected back to the login page automatically.
 */

import { useAuth } from "./store/useAuth.js";
import type {
  VerifyResponse,
  SubscriptionsResponse,
  SubscriptionResponse,
} from "./types/index.js";

// ── Core fetch wrapper ─────────────────────────────────────────────────────

declare const __API_URL__: string;

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<T> {
  const base = (typeof __API_URL__ !== "undefined" ? __API_URL__ : "") + "/api";
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const data = (await res.json()) as T & { error?: string };

  // If the session expired, log the customer out so they get redirected to login
  if (res.status === 401) {
    useAuth.getState().logout();
    throw new Error(data.error ?? "Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }

  return data;
}

// ── Helper to get current token ────────────────────────────────────────────

function getToken(): string {
  const token = useAuth.getState().sessionToken;
  if (!token) throw new Error("Not authenticated");
  return token;
}

// ── Auth ───────────────────────────────────────────────────────────────────

export const authApi = {
  /**
   * Step 1: request a magic link email
   */
  sendMagicLink: (
    email: string,
    shopId: string,
  ): Promise<{ message: string; _devMagicLink?: string }> =>
    request("POST", "/customer/auth/magic-link", { email, shopId }),

  /**
   * Step 2: exchange the token from the magic link for a session JWT
   */
  verify: (token: string): Promise<VerifyResponse> =>
    request("POST", "/customer/auth/verify", { token }),
};

// ── Customer ───────────────────────────────────────────────────────────────

export const customerApi = {
  me: () =>
    request<{
      customer: {
        id: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
      };
    }>("GET", "/customer/me", undefined, getToken()),

  subscriptions: (): Promise<SubscriptionsResponse> =>
    request("GET", "/customer/subscriptions", undefined, getToken()),

  pause: (id: string, resumeDate?: string): Promise<SubscriptionResponse> =>
    request(
      "POST",
      `/customer/subscriptions/${id}/pause`,
      { resumeDate },
      getToken(),
    ),

  resume: (id: string): Promise<SubscriptionResponse> =>
    request("POST", `/customer/subscriptions/${id}/resume`, {}, getToken()),

  cancel: (id: string, reason?: string): Promise<SubscriptionResponse> =>
    request(
      "POST",
      `/customer/subscriptions/${id}/cancel`,
      { reason },
      getToken(),
    ),

  skip: (id: string): Promise<SubscriptionResponse> =>
    request("POST", `/customer/subscriptions/${id}/skip`, {}, getToken()),
};
