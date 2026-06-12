import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense, lazy } from "react";
import LandingGate from "@/features/landing/LandingGate";
import ErrorBoundary from "@/features/error/ErrorBoundary";

// Route-level code splitting: visitors on the landing page don't download
// the dashboard bundle (recharts, forms, etc.) and vice versa.
const DashboardLayout = lazy(() => import("@/layouts/DashboardLayout"));
const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage"));
const AccountsPage = lazy(() => import("@/features/accounts/AccountsPage"));
const ActionPlanPage = lazy(() => import("@/features/actionplan/ActionPlanPage"));
const AnalyticsPage = lazy(() => import("@/features/analytics/AnalyticsPage"));
const RankingsPage = lazy(() => import("@/features/rankings/RankingsPage"));
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
                  <Route index element={<DashboardPage />} />
                  <Route path="action-plan" element={<ActionPlanPage />} />
                  <Route path="accounts" element={<AccountsPage />} />
                  <Route path="analytics" element={<AnalyticsPage />} />
                  <Route path="rankings" element={<RankingsPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* 404 — Raccoon says hi 🦝 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <Toaster />
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
