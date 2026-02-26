import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Wraps protected routes — redirects to /login if no active session.
 * Shows a centered loading spinner while checking auth state.
 */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { user, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center bg-gray-100 dark:bg-black">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-gold-400 border-t-transparent" />
                    <p className="text-sm text-gray-400 animate-pulse">Verifying session...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    return <>{children}</>;
}
