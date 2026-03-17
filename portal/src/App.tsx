/**
 * App.tsx — portal routing.
 *
 * HOW THE PORTAL GETS THE SHOP ID:
 * The Shopify storefront widget adds ?shopId=xxx to the portal URL when
 * it redirects the customer here. We read it from the URL and store it
 * in the auth store so every API call knows which shop to query.
 *
 * ROUTE STRUCTURE:
 *   /auth/verify?token=...   magic link landing page
 *   /login                   email entry form
 *   /                        my subscriptions (requires auth)
 */

import React, { useEffect } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { useAuth } from "./store/useAuth.js";
import { authApi } from "./api.js";
import Login from "./pages/Login.tsx";
import MySubscriptions from "./pages/MySubscriptions.tsx";

// ── Magic link verify page ─────────────────────────────────────────────────
// Customer lands here from the email link: /auth/verify?token=xxx

const VerifyPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  useEffect(() => {
    const token = params.get("token");
    const shopId =
      params.get("shopId") ?? localStorage.getItem("portalShopId") ?? "";

    if (!token) {
      setError("Missing token in URL. Please request a new login link.");
      return;
    }

    authApi
      .verify(token)
      .then(({ sessionToken, customer }) => {
        login(customer, sessionToken, shopId);
        navigate("/", { replace: true });
      })
      .catch((err: Error) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-red-200 p-6 max-w-sm w-full text-center">
          <p className="text-red-600 font-medium mb-2">Login failed</p>
          <p className="text-gray-500 text-sm mb-4">{error}</p>
          <a href="/login" className="text-blue-600 text-sm hover:underline">
            Request a new link
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-gray-800 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">Logging you in…</p>
      </div>
    </div>
  );
};

// ── Protected route wrapper ────────────────────────────────────────────────

const RequireAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// ── App ────────────────────────────────────────────────────────────────────

const App: React.FC = () => {
  // Store shopId from URL query param so it survives navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shopId = params.get("shopId");
    if (shopId) localStorage.setItem("portalShopId", shopId);
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/verify" element={<VerifyPage />} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <MySubscriptions />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
