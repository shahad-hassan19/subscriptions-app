/**
 * Login.tsx — magic link email entry page.
 *
 * STATES:
 *   idle      → show email form
 *   sending   → show spinner
 *   sent      → show "check your email" message (+ dev link if in dev mode)
 *   error     → show error with retry
 */

import React, { useState } from "react";
import { authApi } from "../api.js";

type LoginState = "idle" | "sending" | "sent" | "error";

const Login: React.FC = () => {
  const [email, setEmail] = useState<string>("");
  const [state, setState] = useState<LoginState>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [devLink, setDevLink] = useState<string | null>(null);

  const shopId = localStorage.getItem("portalShopId") ?? "ef6b87f6-46c9-4e23-8bc2-1e81362834da";

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim()) return;

    setState("sending");
    setErrorMsg("");

    try {
      const res = await authApi.sendMagicLink(email.trim(), shopId);
      setState("sent");

      // In dev, the API returns the magic link directly so you can test without email
      if (res._devMagicLink) setDevLink(res._devMagicLink);
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  // ── Sent state ─────────────────────────────────────────────────────────

  if (state === "sent") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full text-center shadow-sm">
          {/* Check icon */}
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-green-600"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>

          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Check your email
          </h2>
          <p className="text-gray-500 text-sm mb-2">
            We sent a login link to{" "}
            <strong className="text-gray-700">{email}</strong>.
          </p>
          <p className="text-gray-400 text-xs mb-6">
            The link expires in 15 minutes.
          </p>

          {/* Dev-only: show the link directly so you can test without email */}
          {devLink && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs font-medium text-amber-800 mb-1">
                Dev mode — magic link:
              </p>
              <a
                href={devLink}
                className="text-xs text-amber-700 break-all hover:underline"
              >
                {devLink}
              </a>
            </div>
          )}

          <button
            onClick={() => {
              setState("idle");
              setDevLink(null);
            }}
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  // ── Idle / sending / error state ───────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-8 max-w-sm w-full shadow-sm">
        {/* Logo placeholder */}
        <div className="text-center mb-7">
          <div className="w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-5 h-5 text-white"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M15.5 2.1L14.9 2c-.1 0-1.3-.2-2.7-.2-3 0-4.4 1.5-4.4 1.5L6.5 5.5H4.1L3 12.5l8.9 2 .4-2.2.5 8.7h8.1L22 4.3l-6.5-2.2z" />
            </svg>
          </div>
          <h1 className="text-lg font-semibold text-gray-900">
            My Subscriptions
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Enter your email to log in
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Email address
            </label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg
                         focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                         disabled:opacity-50 disabled:bg-gray-50"
              disabled={state === "sending"}
            />
          </div>

          {state === "error" && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
              {errorMsg}
            </p>
          )}

          <button
            type="submit"
            disabled={state === "sending" || !email.trim()}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50
                       text-white text-sm font-medium rounded-lg transition-colors
                       flex items-center justify-center gap-2"
          >
            {state === "sending" ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending…
              </>
            ) : (
              "Send login link"
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-5">
          No password needed — we'll email you a one-click login link.
        </p>
      </div>
    </div>
  );
};

export default Login;
