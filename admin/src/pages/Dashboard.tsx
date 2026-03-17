import React, { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import { subscriptionsApi, billingApi } from "../api.js";
import type { Subscription, BillingRunResponse } from "../types/index.js";

// ── Types ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

interface ChartDataPoint {
  month: string;
  revenue: number;
}

// ── Stat card ─────────────────────────────────────────────────────────────

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  color = "text-gray-900",
}) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5">
    <p className="text-sm text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-semibold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

// ── Custom chart tooltip ───────────────────────────────────────────────────

const ChartTooltip: React.FC<TooltipContentProps> = ({
  active,
  payload,
  label,
}) => {
  if (!active || !payload?.length) return null;
  const rawValue = payload[0]?.value;
  const value = typeof rawValue === "number" ? rawValue : Number(rawValue ?? 0);
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow text-sm">
      <p className="text-gray-500 mb-1">{label}</p>
      <p className="font-semibold text-gray-900">
        ${value.toLocaleString()}
      </p>
    </div>
  );
};

// ── Build chart data ───────────────────────────────────────────────────────

function buildChartData(subscriptions: Subscription[]): ChartDataPoint[] {
  const months: Record<string, ChartDataPoint> = {};

  for (const sub of subscriptions) {
    const d = new Date(sub.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });

    if (!months[key]) months[key] = { month: label, revenue: 0 };
    months[key].revenue += sub.total;
  }

  return Object.values(months)
    .slice(-6)
    .map((m) => ({ ...m, revenue: Math.round(m.revenue * 100) / 100 }));
}

// ── Calculate MRR ──────────────────────────────────────────────────────────

function calcMrr(subscriptions: Subscription[]): number {
  return subscriptions
    .filter((s) => s.status === "ACTIVE")
    .reduce((sum, s) => {
      let monthly = s.total;
      const unit = s.billingPlan?.intervalUnit;
      const count = s.billingPlan?.intervalCount ?? 1;
      if (unit === "WEEK") monthly = (monthly / count) * (52 / 12);
      if (unit === "YEAR") monthly = monthly / count / 12;
      if (unit === "MONTH") monthly = monthly / count;
      return sum + monthly;
    }, 0);
}

// ── Dashboard page ─────────────────────────────────────────────────────────

const Dashboard: React.FC = () => {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [running, setRunning] = useState<boolean>(false);

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        const data = await subscriptionsApi.list({ limit: 100 });
        setSubs(data.subscriptions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const active = subs.filter((s) => s.status === "ACTIVE").length;
  const paused = subs.filter((s) => s.status === "PAUSED").length;
  const cancelled = subs.filter((s) => s.status === "CANCELLED").length;
  const mrr = calcMrr(subs);
  const chartData = buildChartData(subs);

  async function handleBillingRun(): Promise<void> {
    setRunning(true);
    setRunResult(null);
    try {
      const result: BillingRunResponse = await billingApi.processDue();
      setRunResult(
        `✓ Done — ${result.succeeded} charged, ${result.failed} failed`,
      );
    } catch (err) {
      setRunResult(`Error: ${err instanceof Error ? err.message : "unknown"}`);
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-shopify-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5">
        <p className="text-red-700 font-medium">Failed to load dashboard</p>
        <p className="text-red-500 text-sm mt-1">{error}</p>
        <p className="text-red-400 text-xs mt-2">
          Set your shop ID in the console:&nbsp;
          <code className="bg-red-100 px-1 rounded">
            localStorage.setItem('shopId', 'YOUR_ID')
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Active subscriptions"
          value={active}
          color="text-shopify-700"
        />
        <StatCard
          label="MRR"
          value={`$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
          sub="normalised to monthly"
          color="text-shopify-700"
        />
        <StatCard label="Paused" value={paused} color="text-yellow-700" />
        <StatCard label="Cancelled" value={cancelled} color="text-red-600" />
      </div>

      {/* Revenue chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 text-sm mb-1">
          Revenue over time
        </h2>
        <p className="text-xs text-gray-400 mb-5">
          Based on subscription creation dates
        </p>

        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-400">
            No subscription data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart
              data={chartData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#9ca3af" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `$${v}`}
              />
              <Tooltip content={(props) => <ChartTooltip {...props} />} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#colorRevenue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Billing engine */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-gray-900 text-sm">
              Billing engine
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Manually trigger the recurring billing job
            </p>
          </div>
          <button
            onClick={() => void handleBillingRun()}
            disabled={running}
            className="px-4 py-2 bg-shopify-600 hover:bg-shopify-700 disabled:opacity-50
                       text-white text-sm rounded-lg transition-colors"
          >
            {running ? "Running…" : "Run billing now"}
          </button>
        </div>

        {runResult && (
          <p
            className={`mt-3 text-sm px-3 py-2 rounded-lg ${
              runResult.startsWith("Error")
                ? "bg-red-50 text-red-700"
                : "bg-green-50 text-green-700"
            }`}
          >
            {runResult}
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
