import React, { useEffect, useState } from "react";
import { billingPlansApi } from "../api.js";
import type {
  BillingPlan,
  CreateBillingPlanForm,
  IntervalUnit,
  DiscountType,
} from "../types/index.js";

// ── Plan form ──────────────────────────────────────────────────────────────

interface PlanFormProps {
  initial?: Partial<CreateBillingPlanForm>;
  onSave: (data: CreateBillingPlanForm) => Promise<void>;
  onCancel: () => void;
}

const EMPTY_FORM: CreateBillingPlanForm = {
  name: "",
  description: "",
  intervalCount: 1,
  intervalUnit: "MONTH",
  discountType: "PERCENTAGE",
  discountValue: 0,
};

const PlanForm: React.FC<PlanFormProps> = ({ initial, onSave, onCancel }) => {
  const [form, setForm] = useState<CreateBillingPlanForm>({
    ...EMPTY_FORM,
    ...initial,
  });
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof CreateBillingPlanForm>(
    key: K,
    value: CreateBillingPlanForm[K],
  ): void {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {error && (
        <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Plan name *
          </label>
          <input
            required
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Monthly Plan"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Shown to customers on the product page"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Billing interval
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={12}
              required
              value={form.intervalCount}
              onChange={(e) =>
                set("intervalCount", parseInt(e.target.value, 10))
              }
              className="w-16 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
            />
            <select
              value={form.intervalUnit}
              onChange={(e) =>
                set("intervalUnit", e.target.value as IntervalUnit)
              }
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
            >
              <option value="WEEK">Week(s)</option>
              <option value="MONTH">Month(s)</option>
              <option value="YEAR">Year(s)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Discount
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              step={0.01}
              value={form.discountValue}
              onChange={(e) =>
                set("discountValue", parseFloat(e.target.value) || 0)
              }
              className="w-20 px-2 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
            />
            <select
              value={form.discountType}
              onChange={(e) =>
                set("discountType", e.target.value as DiscountType)
              }
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-shopify-500"
            >
              <option value="PERCENTAGE">% off</option>
              <option value="FIXED">$ off</option>
            </select>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 bg-shopify-600 hover:bg-shopify-700 disabled:opacity-50 text-white text-sm rounded-lg"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Create plan"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ── Plan card ──────────────────────────────────────────────────────────────

interface PlanCardProps {
  plan: BillingPlan;
  onDeactivate: (id: string) => void;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onDeactivate }) => {
  const plural = plan.intervalCount > 1 ? "s" : "";
  const interval = `Every ${plan.intervalCount} ${plan.intervalUnit.toLowerCase()}${plural}`;
  const discount =
    plan.discountValue > 0
      ? `${plan.discountValue}${plan.discountType === "PERCENTAGE" ? "%" : "$"} off`
      : "No discount";

  return (
    <div
      className={`bg-white border rounded-xl p-5 flex items-start justify-between ${
        plan.isActive ? "border-gray-200" : "border-gray-100 opacity-60"
      }`}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-gray-900 text-sm">{plan.name}</h3>
          {!plan.isActive && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              Inactive
            </span>
          )}
        </div>
        {plan.description && (
          <p className="text-xs text-gray-500 mb-2">{plan.description}</p>
        )}
        <div className="flex gap-3 text-xs text-gray-400">
          <span>{interval}</span>
          <span>·</span>
          <span>{discount}</span>
          <span>·</span>
          <span>{plan.activeSubscriberCount ?? 0} active subscribers</span>
        </div>
      </div>

      {plan.isActive && (
        <button
          onClick={() => onDeactivate(plan.id)}
          className="text-xs text-red-500 hover:text-red-700 px-2 py-1 hover:bg-red-50 rounded ml-4 shrink-0"
        >
          Deactivate
        </button>
      )}
    </div>
  );
};

// ── Page ───────────────────────────────────────────────────────────────────

const BillingPlans: React.FC = () => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState<boolean>(false);

  async function load(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const data = await billingPlansApi.list();
      setPlans(data.plans);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleCreate(formData: CreateBillingPlanForm): Promise<void> {
    await billingPlansApi.create(formData);
    setShowForm(false);
    await load();
  }

  async function handleDeactivate(id: string): Promise<void> {
    await billingPlansApi.deactivate(id);
    await load();
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Plans define billing frequency and discount. Customers choose a plan
          on the product page.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-shopify-600 hover:bg-shopify-700 text-white text-sm rounded-lg shrink-0"
          >
            + New plan
          </button>
        )}
      </div>

      {showForm && (
        <div className="bg-white border border-shopify-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 text-sm mb-4">
            New billing plan
          </h2>
          <PlanForm onSave={handleCreate} onCancel={() => setShowForm(false)} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-6 h-6 border-2 border-shopify-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-5">
          {error}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm bg-white border border-gray-200 rounded-xl">
          No billing plans yet. Create your first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              onDeactivate={(id) => void handleDeactivate(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BillingPlans;
