import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardPage from "@/features/dashboard/DashboardPage";
import AccountsPage from "@/features/accounts/AccountsPage";
import ActionPlanPage from "@/features/actionplan/ActionPlanPage";
import AnalyticsPage from "@/features/analytics/AnalyticsPage";
import RankingsPage from "@/features/rankings/RankingsPage";

import SettingsPage from "@/features/settings/SettingsPage";
import LoginPage from "@/features/auth/LoginPage";
import LandingGate from "@/features/landing/LandingGate";
import TermsOfServicePage from "@/features/legal/TermsOfServicePage";
import PrivacyPolicyPage from "@/features/legal/PrivacyPolicyPage";
import NotFoundPage from "@/features/error/NotFoundPage";
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
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
