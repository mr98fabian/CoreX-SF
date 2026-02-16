import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardPage from "@/features/dashboard/DashboardPage";
import AccountsPage from "@/features/accounts/AccountsPage";
import ActionPlanPage from "@/features/actionplan/ActionPlanPage";
import AnalyticsPage from "@/features/analytics/AnalyticsPage";


import SettingsPage from "@/features/settings/SettingsPage";
import LoginPage from "@/features/auth/LoginPage";
import TermsOfServicePage from "@/features/legal/TermsOfServicePage";
import PrivacyPolicyPage from "@/features/legal/PrivacyPolicyPage";
import NotFoundPage from "@/features/error/NotFoundPage";
import LoadingScreen from "@/components/LoadingScreen";
import { AuthProvider } from "@/features/auth/AuthContext";
import ProtectedRoute from "@/features/auth/ProtectedRoute";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <LanguageProvider>
          <AuthProvider>
            <Suspense fallback={<LoadingScreen />}>
              <Routes>
                {/* Public routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/terms" element={<TermsOfServicePage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />

                {/* Protected routes */}
                <Route
                  path="/"
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

                  <Route path="settings" element={<SettingsPage />} />
                </Route>

                {/* 404 — Raccoon says hi 🦝 */}
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
            <Toaster />
          </AuthProvider>
        </LanguageProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;

