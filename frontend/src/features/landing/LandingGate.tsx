/**
 * LandingGate — Route guard for the landing page.
 *
 * Web browser → show LandingPage (scrollytelling)
 * Capacitor native app → redirect to /login
 * Already authenticated → redirect to /dashboard
 */
import { Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { useAuth } from '@/features/auth/AuthContext';
import LandingPage from './LandingPage';

export default function LandingGate() {
    const { user, loading } = useAuth();

    // Native app → skip landing, go straight to login
    if (Capacitor.isNativePlatform()) {
        return <Navigate to="/login" replace />;
    }

    // Wait for auth check to complete before deciding
    if (loading) return null;

    // Already logged in → go to dashboard
    if (user) {
        return <Navigate to="/dashboard" replace />;
    }

    // Web + unauthenticated → show the scrollytelling
    return <LandingPage />;
}
