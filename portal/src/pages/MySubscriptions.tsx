/**
 * MySubscriptions.tsx — the main customer portal page.
 *
 * Shows all of the customer's subscriptions with:
 * - Status badge (active / paused / cancelled)
 * - Products in the subscription
 * - Next billing date + amount
 * - Actions: skip, pause, resume, cancel
 * - Billing history (expandable per subscription)
 */

import React, { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { useAuth } from "../store/useAuth.js";
import { customerApi } from "../api.js";
import type {
  Subscription,
  SubscriptionStatus,
  Billing,
} from "../types/index.js";

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_STYLES: Record<SubscriptionStatus, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  PAUSED: "bg-yellow-100 text-yellow-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-500",
};

const StatusBadge: React.FC<{ status: SubscriptionStatus }> = ({ status }) => (
  <span
    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status]}`}
  >
    {status.charAt(0) + status.slice(1).toLowerCase()}
  </span>
);

// ── Billing history row ────────────────────────────────────────────────────

const BillingRow: React.FC<{ billing: Billing }> = ({ billing }) => {
  const statusColor =
    {
      SUCCEEDED: "text-green-600",
      FAILED: "text-red-600",
      REFUNDED: "text-gray-500",
      PENDING: "text-yellow-600",
    }[billing.status] ?? "text-gray-500";

  return (
    <div className="flex items-center justify-between py-2 text-sm">
      <div>
        <span className={`font-medium ${statusColor}`}>
          {billing.status.charAt(0) + billing.status.slice(1).toLowerCase()}
        </span>
        {billing.failureReason && (
          <span className="text-gray-400 text-xs ml-2">
            — {billing.failureReason}
          </span>
        )}
      </div>
      <div className="text-right">
        <div className="font-medium text-gray-900">
          ${billing.amount.toFixed(2)}
        </div>
        <div className="text-xs text-gray-400">
          {format(new Date(billing.billedAt), "MMM d, yyyy")}
        </div>
      </div>
    </div>
  );
};

// ── Subscription card ──────────────────────────────────────────────────────

interface SubCardProps {
  sub: Subscription;
  onAction: (action: () => Promise<unknown>) => Promise<void>;
}

const SubscriptionCard: React.FC<SubCardProps> = ({ sub, onAction }) => {
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showCancel, setShowCancel] = useState<boolean>(false);
  const [cancelReason, setCancelReason] = useState<string>("");

  const plan = sub.billingPlan;
  const interval = plan
    ? `Every ${plan.intervalCount} ${plan.intervalUnit.toLowerCase()}${plan.intervalCount > 1 ? "s" : ""}`
    : null;

  const discount =
    plan && plan.discountValue > 0
      ? `${plan.discountValue}${plan.discountType === "PERCENTAGE" ? "%" : "$"} off`
      : null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Card header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-gray-900 text-sm">
              {plan?.name ?? "Subscription"}
            </h3>
            <StatusBadge status={sub.status} />
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
            {interval && <span>{interval}</span>}
            {discount && (
              <>
                <span>·</span>
                <span className="text-green-600">{discount}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="font-semibold text-gray-900">
            ${sub.total.toFixed(2)}
          </div>
          {sub.discountAmount > 0 && (
            <div className="text-xs text-green-600">
              save ${sub.discountAmount.toFixed(2)}
            </div>
          )}
        </div>
      </div>

      {/* Products */}
      <div className="px-5 py-3 space-y-2">
        {sub.products.map((p, i) => (
          <div key={i} className="flex items-center gap-3">
            {p.imageUrl ? (
              <img
                src={p.imageUrl}
                alt={p.title}
                className="w-10 h-10 rounded-lg object-cover border border-gray-100 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <svg
                  className="w-5 h-5 text-gray-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm text-gray-900 truncate">{p.title}</div>
              <div className="text-xs text-gray-400">
                Qty {p.quantity} · ${p.price.toFixed(2)} each
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Next billing */}
      {sub.status === "ACTIVE" && sub.nextBillingDate && (
        <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Next billing</span>
          <span className="text-xs font-medium text-gray-900">
            {format(new Date(sub.nextBillingDate), "MMMM d, yyyy")}
          </span>
        </div>
      )}

      {sub.status === "PAUSED" && (
        <div className="px-5 py-3 bg-yellow-50 border-t border-yellow-100 flex items-center justify-between">
          <span className="text-xs text-yellow-700">Paused</span>
          {sub.pauseUntil && (
            <span className="text-xs font-medium text-yellow-800">
              Resumes {format(new Date(sub.pauseUntil), "MMM d, yyyy")}
            </span>
          )}
        </div>
      )}

      {/* Actions */}
      {(sub.status === "ACTIVE" || sub.status === "PAUSED") && (
        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap gap-2">
          {sub.status === "ACTIVE" && (
            <>
              <button
                onClick={() => void onAction(() => customerApi.skip(sub.id))}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Skip next
              </button>
              <button
                onClick={() => void onAction(() => customerApi.pause(sub.id))}
                className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
              >
                Pause
              </button>
            </>
          )}

          {sub.status === "PAUSED" && (
            <button
              onClick={() => void onAction(() => customerApi.resume(sub.id))}
              className="px-3 py-1.5 text-xs text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100"
            >
              Resume
            </button>
          )}

          {!showCancel ? (
            <button
              onClick={() => setShowCancel(true)}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded-lg hover:bg-red-50 ml-auto"
            >
              Cancel
            </button>
          ) : (
            <div className="w-full mt-1 space-y-2">
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select a reason (optional)</option>
                <option value="too_expensive">Too expensive</option>
                <option value="not_using">Not using it enough</option>
                <option value="switching">Switching to something else</option>
                <option value="other">Other</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    void onAction(() =>
                      customerApi.cancel(sub.id, cancelReason || undefined),
                    )
                  }
                  className="flex-1 py-2 text-xs text-white bg-red-600 hover:bg-red-700 rounded-lg"
                >
                  Confirm cancellation
                </button>
                <button
                  onClick={() => {
                    setShowCancel(false);
                    setCancelReason("");
                  }}
                  className="px-3 py-2 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Keep
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Billing history toggle */}
      {sub.billings && sub.billings.length > 0 && (
        <div className="border-t border-gray-100">
          <button
            onClick={() => setShowHistory((h) => !h)}
            className="w-full px-5 py-3 text-left flex items-center justify-between text-xs text-gray-500 hover:bg-gray-50"
          >
            <span>Billing history</span>
            <svg
              className={`w-4 h-4 transition-transform ${showHistory ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showHistory && (
            <div className="px-5 pb-4 divide-y divide-gray-50">
              {sub.billings.map((b) => (
                <BillingRow key={b.id} billing={b} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const MySubscriptions: React.FC = () => {
  const { customer, logout } = useAuth();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const data = await customerApi.subscriptions();
      setSubs(data.subscriptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleAction(action: () => Promise<unknown>): Promise<void> {
    setActionError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const active = subs.filter((s) => s.status === "ACTIVE").length;
  const inactive = subs.filter((s) => s.status !== "ACTIVE").length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900">My Subscriptions</h1>
            {customer && (
              <p className="text-xs text-gray-400 mt-0.5">{customer.email}</p>
            )}
          </div>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-700 px-3 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Action error */}
        {actionError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
            {actionError}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-gray-800 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
            <p className="text-red-700 text-sm font-medium">{error}</p>
            <button
              onClick={() => void load()}
              className="text-red-500 text-xs mt-2 hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && subs.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
            <p className="text-gray-400 text-sm">
              You have no subscriptions yet.
            </p>
          </div>
        )}

        {/* Summary */}
        {!loading && subs.length > 0 && (
          <div className="flex gap-3 text-sm text-gray-500">
            <span>{active} active</span>
            {inactive > 0 && (
              <>
                <span>·</span>
                <span>{inactive} inactive</span>
              </>
            )}
          </div>
        )}

        {/* Subscription cards */}
        {!loading &&
          subs.map((sub) => (
            <SubscriptionCard key={sub.id} sub={sub} onAction={handleAction} />
          ))}
      </main>
    </div>
  );
};

export default MySubscriptions;
