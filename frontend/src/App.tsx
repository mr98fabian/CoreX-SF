import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/layouts/DashboardLayout";
import DashboardPage from "@/features/dashboard/DashboardPage";
import AccountsPage from "@/features/accounts/AccountsPage";
import StrategyPage from "@/features/strategy/StrategyPage";
import SettingsPage from "@/features/settings/SettingsPage";
import LoginPage from "@/features/auth/LoginPage";
import { AuthProvider } from "@/features/auth/AuthContext";
import ProtectedRoute from "@/features/auth/ProtectedRoute";

import { Toaster } from "@/components/ui/toaster";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public route */}
          <Route path="/login" element={<LoginPage />} />

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
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="strategy" element={<StrategyPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
