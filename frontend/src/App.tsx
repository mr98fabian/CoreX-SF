import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import LandingGate from "@/features/landing/LandingGate";
import ErrorBoundary from "@/features/error/ErrorBoundary";

// Route-level code splitting: visitors on the landing page don't download
// the dashboard bundle (recharts, forms, etc.) and vice versa.
const DashboardLayout = lazy(() => import("@/layouts/DashboardLayout"));
const AccountsPage = lazy(() => import("@/features/accounts/AccountsPage"));
const ActionPlanPage = lazy(() => import("@/features/actionplan/ActionPlanPage"));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage"));
const RankingsPage = lazy(() => import("@/features/rankings/RankingsPage"));
const HomePage = lazy(() => import("@/features/home/HomePage"));
const CalendarPage = lazy(() => import("@/features/home/CalendarPage"));
const AccountsStagePage = lazy(() => import("@/features/accounts/AccountsStagePage"));
const ActivityPage = lazy(() => import("@/features/activity/ActivityPage"));
const SubscriptionsPage = lazy(() => import("@/features/subscriptions/SubscriptionsPage"));
const AttackPage = lazy(() => import("@/features/attack/AttackPage"));
const SettingsHome = lazy(() => import("@/features/settings/SettingsHome"));
const PlansPage = lazy(() => import("@/features/settings/PlansPage"));
const SettingsPage = lazy(() => import("@/features/settings/SettingsPage"));
const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const TermsOfServicePage = lazy(() => import("@/features/legal/TermsOfServicePage"));
const PrivacyPolicyPage = lazy(() => import("@/features/legal/PrivacyPolicyPage"));
const NotFoundPage = lazy(() => import("@/features/error/NotFoundPage"));
import LoadingScreen from "@/components/LoadingScreen";
import { AuthProvider } from "@/features/auth/AuthContext";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { NotificationProvider } from "@/contexts/NotificationContext";

import { Toaster } from "@/components/ui/toaster";
import { useCapacitor } from "@/hooks/useCapacitor";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { ApkUpdateBanner } from "@/components/ApkUpdateBanner";

/** Inner shell — lives inside BrowserRouter so hooks like useNavigate work */
function AppShell() {
  // Initialize native Capacitor behavior (no-op on web)
  useCapacitor();

  // Poll for new app versions and prompt reload when stale (prod only)
  useVersionCheck();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Landing page — web only, redirects native/auth users */}
                <Route path="/" element={<LandingGate />} />

                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />

                {/* Protected dashboard routes */}
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<HomePage />} />
                  <Route path="calendar" element={<CalendarPage />} />
                  <Route path="panel" element={<Navigate to="/dashboard" replace />} />
                  <Route path="action-plan" element={<AttackPage />} />
                  <Route path="action-plan/full" element={<ActionPlanPage />} />
                  <Route path="accounts" element={<AccountsStagePage />} />
                  <Route path="accounts/manage" element={<AccountsPage />} />
                  <Route path="subscriptions" element={<SubscriptionsPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="rankings" element={<RankingsPage />} />
                  <Route path="settings" element={<SettingsHome />} />
                  <Route path="settings/plans" element={<PlansPage />} />
                  <Route path="settings/advanced" element={<SettingsPage />} />
                </Route>

                {/* 404 — Raccoon says hi 🦝 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <Toaster />
            <ApkUpdateBanner />
          </NotificationProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
