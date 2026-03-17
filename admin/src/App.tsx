import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './Layout.tsx';
import Dashboard from './pages/Dashboard.tsx';
import Subscriptions from './pages/Subscriptions.tsx';
import BillingPlans from './pages/BillingPlans.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Every page lives inside Layout (sidebar + topbar) */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"     element={<Dashboard />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="billing-plans" element={<BillingPlans />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}