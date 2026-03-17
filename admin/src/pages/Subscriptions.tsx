import React, { useEffect, useState, useCallback } from "react";
import { subscriptionsApi } from "../api.js";
import { StatusBadge } from "../Layout.js";
import type { Subscription, SubscriptionStatus } from "../types/index.js";

// ── Sub-components ─────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
}) => (
  <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
    <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
      <p className="text-gray-900 text-sm mb-5">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
);

type ActionVariant = "default" | "danger" | "success";

interface ActionButtonProps {
  onClick: () => void;
  children: React.ReactNode;
  variant?: ActionVariant;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  children,
  variant = "default",
}) => {
  const styles: Record<ActionVariant, string> = {
    default: "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
    danger: "text-red-500  hover:text-red-700  hover:bg-red-50",
    success: "text-green-600 hover:text-green-800 hover:bg-green-50",
  };
  return (
    <button
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded transition-colors ${styles[variant]}`}
    >
      {children}
    </button>
  );
};

// ── Confirm helper type ────────────────────────────────────────────────────

interface ConfirmState {
  message: string;
  onConfirm: () => void;
}

// ── Page ───────────────────────────────────────────────────────────────────

const Subscriptions: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<SubscriptionStatus | "ALL">(
    "ALL",
  );
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(
    async (page: number = 1): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: 20,
          ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
        };
        const data = await subscriptionsApi.list(params);
        setSubs(data.subscriptions);
        setPagination(data.pagination);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  async function doAction(fn: () => Promise<unknown>): Promise<void> {
    setActionError(null);
    try {
      await fn();
      await load(pagination.page);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    }
  }

  const filtered = subs.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.customer?.email?.toLowerCase().includes(q) ||
      s.billingPlan?.name?.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by email, plan, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg
                       focus:outline-none focus:ring-2 focus:ring-shopify-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as SubscriptionStatus | "ALL")
          }
          className="py-2 pl-3 pr-8 text-sm border border-gray-200 rounded-lg
                     focus:outline-none focus:ring-2 focus:ring-shopify-500"
        >
          <option value="ALL">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="CANCELLED">Cancelled</option>
        </select>

        <span className="text-xs text-gray-400">{pagination.total} total</span>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {actionError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-6 h-6 border-2 border-shopify-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600 text-sm">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">
            {search
              ? "No subscriptions match your search"
              : "No subscriptions yet"}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  "Customer",
                  "Plan",
                  "Total",
                  "Next billing",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {sub.customer?.firstName} {sub.customer?.lastName}
                    </div>
                    <div className="text-xs text-gray-400">
                      {sub.customer?.email}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="text-gray-900">
                      {sub.billingPlan?.name ?? "—"}
                    </div>
                    <div className="text-xs text-gray-400">
                      every {sub.billingPlan?.intervalCount}{" "}
                      {sub.billingPlan?.intervalUnit?.toLowerCase()}
                    </div>
                  </td>

                  <td className="px-4 py-3 font-medium text-gray-900">
                    ${sub.total.toFixed(2)}
                  </td>

                  <td className="px-4 py-3 text-gray-500">
                    {sub.nextBillingDate
                      ? new Date(sub.nextBillingDate).toLocaleDateString()
                      : "—"}
                  </td>

                  <td className="px-4 py-3">
                    <StatusBadge status={sub.status} />
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {sub.status === "ACTIVE" && (
                        <>
                          <ActionButton
                            onClick={() =>
                              void doAction(() => subscriptionsApi.skip(sub.id))
                            }
                          >
                            Skip
                          </ActionButton>
                          <ActionButton
                            onClick={() =>
                              void doAction(() =>
                                subscriptionsApi.pause(sub.id),
                              )
                            }
                          >
                            Pause
                          </ActionButton>
                          <ActionButton
                            variant="danger"
                            onClick={() =>
                              setConfirm({
                                message: `Cancel ${sub.customer?.email ?? "this"}'s subscription?`,
                                onConfirm: () => {
                                  void doAction(() =>
                                    subscriptionsApi.cancel(
                                      sub.id,
                                      "cancelled_by_admin",
                                    ),
                                  );
                                  setConfirm(null);
                                },
                              })
                            }
                          >
                            Cancel
                          </ActionButton>
                        </>
                      )}
                      {sub.status === "PAUSED" && (
                        <ActionButton
                          variant="success"
                          onClick={() =>
                            void doAction(() => subscriptionsApi.resume(sub.id))
                          }
                        >
                          Resume
                        </ActionButton>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">
            Page {pagination.page} of {pagination.pages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => void load(pagination.page - 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => void load(pagination.page + 1)}
              className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
};

export default Subscriptions;
