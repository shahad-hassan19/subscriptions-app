import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { SubscriptionStatus } from "./types/index";

// ── Nav config ────────────────────────────────────────────────────────────

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactElement;
}

const NAV: NavItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0h6"
        />
      </svg>
    ),
  },
  {
    to: "/subscriptions",
    label: "Subscriptions",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    ),
  },
  {
    to: "/billing-plans",
    label: "Billing Plans",
    icon: (
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
];

// ── StatusBadge ───────────────────────────────────────────────────────────
// TypeScript: typing the `status` prop as `SubscriptionStatus` means passing
// a typo like "active" (lowercase) is a compile error, not a runtime bug.

interface StatusBadgeProps {
  status: SubscriptionStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<SubscriptionStatus, string> = {
    ACTIVE: "bg-green-100  text-green-800",
    PAUSED: "bg-yellow-100 text-yellow-800",
    CANCELLED: "bg-red-100    text-red-800",
    EXPIRED: "bg-gray-100   text-gray-600",
  };

  return (
    <span
      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};

// ── Layout ────────────────────────────────────────────────────────────────

const Layout: React.FC = () => {
  const location = useLocation();
  const pageTitle =
    NAV.find((n) => location.pathname.startsWith(n.to))?.label ?? "Admin";
  const shopId = localStorage.getItem("shopId");

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-shopify-600 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M15.5 2.1L14.9 2c-.1 0-1.3-.2-2.7-.2-3 0-4.4 1.5-4.4 1.5L6.5 5.5H4.1L3 12.5l8.9 2 .4-2.2.5 8.7h8.1L22 4.3l-6.5-2.2z" />
              </svg>
            </div>
            <span className="font-semibold text-gray-900 text-sm">SubsApp</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? "bg-shopify-50 text-shopify-700 font-medium"
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`
              }
            >
              {icon}
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-gray-200">
          <a
            href="https://shopify.dev/docs/apps/build/purchase-options/subscriptions"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            Shopify Docs
          </a>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-base font-semibold text-gray-900">{pageTitle}</h1>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-1 rounded font-mono">
            {shopId ? `${shopId.slice(0, 8)}…` : "no shop set"}
          </span>
        </header>

        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
