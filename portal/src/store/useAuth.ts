/**
 * useAuth.ts — Zustand store for customer authentication state.
 *
 * WHY ZUSTAND INSTEAD OF CONTEXT:
 * React Context re-renders every consumer whenever the value changes.
 * Zustand uses subscriptions — components only re-render when the
 * specific piece of state they use changes. For auth state that's
 * read all over the app, this is meaningfully better.
 *
 * PERSISTENCE:
 * We persist the session to localStorage so the customer stays logged
 * in when they refresh the page. The JWT itself is the source of truth —
 * if it's expired, the API will return 401 and we clear the session.
 *
 * USAGE:
 *   const { customer, sessionToken, isAuthenticated } = useAuth();
 *   const { login, logout } = useAuth();
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthCustomer } from "../types/index.js";

// ── State shape ────────────────────────────────────────────────────────────

interface AuthState {
  // Data
  customer: AuthCustomer | null;
  sessionToken: string | null;
  shopId: string | null;

  // Derived
  isAuthenticated: boolean;

  // Actions
  login: (customer: AuthCustomer, sessionToken: string, shopId: string) => void;
  logout: () => void;
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useAuth = create<AuthState>()(
  // persist() wraps the store and saves/loads from localStorage automatically
  persist(
    (set) => ({
      customer: null,
      sessionToken: null,
      shopId: null,
      isAuthenticated: false,

      login: (customer, sessionToken, shopId) =>
        set({ customer, sessionToken, shopId, isAuthenticated: true }),

      logout: () =>
        set({
          customer: null,
          sessionToken: null,
          shopId: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "subs-portal-auth", // localStorage key
      // Only persist these fields — don't persist derived state
      partialize: (state) => ({
        customer: state.customer,
        sessionToken: state.sessionToken,
        shopId: state.shopId,
      }),
      // After hydrating from localStorage, recompute isAuthenticated
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.isAuthenticated = !!(state.sessionToken && state.customer);
        }
      },
    },
  ),
);
