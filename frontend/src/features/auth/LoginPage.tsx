import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Premium login screen — glassmorphism dark theme with gold accents.
 * Only shows "Sign in with Google" (sole auth method).
 */
export default function LoginPage() {
    const { user, loading, signInWithGoogle } = useAuth();
    const [isSigningIn, setIsSigningIn] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // If already authenticated, go to dashboard
    if (!loading && user) {
        return <Navigate to="/" replace />;
    }

    const handleGoogleSignIn = async () => {
        setError(null);
        setIsSigningIn(true);
        try {
            await signInWithGoogle();
        } catch (err: any) {
            setError(err?.message || 'Sign-in failed. Please try again.');
            setIsSigningIn(false);
        }
    };

    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950">
            {/* Ambient gradient orbs */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px] animate-pulse" />
                <div className="absolute -right-32 bottom-0 h-[400px] w-[400px] rounded-full bg-indigo-500/10 blur-[100px] animate-pulse" style={{ animationDelay: '1s' }} />
                <div className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-500/5 blur-[80px]" />
            </div>

            {/* Grid pattern overlay */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '60px 60px',
                }}
            />

            {/* Login card */}
            <div className="relative z-10 w-full max-w-md px-6">
                <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl">
                    {/* Logo / Branding */}
                    <div className="mb-8 text-center">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/20">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">
                            CoreX <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">System</span>
                        </h1>
                        <p className="mt-2 text-sm text-slate-400">
                            Velocity Banking Intelligence Platform
                        </p>
                    </div>

                    {/* Divider */}
                    <div className="mb-6 flex items-center gap-3">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                        <span className="text-xs uppercase tracking-widest text-slate-500">Sign In</span>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    </div>

                    {/* Error message */}
                    {error && (
                        <div className="mb-4 rounded-lg border border-rose-500/20 bg-rose-950/30 px-4 py-3 text-sm text-rose-400">
                            {error}
                        </div>
                    )}

                    {/* Google Sign-In Button */}
                    <button
                        onClick={handleGoogleSignIn}
                        disabled={isSigningIn || loading}
                        className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 px-6 py-3.5 text-sm font-medium text-white transition-all duration-300 hover:border-amber-400/30 hover:bg-white/10 hover:shadow-lg hover:shadow-amber-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {/* Google icon */}
                        {isSigningIn ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
                        ) : (
                            <svg width="20" height="20" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {isSigningIn ? 'Connecting...' : 'Continue with Google'}

                        {/* Hover glow */}
                        <div className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-r from-amber-500/0 via-amber-500/5 to-amber-500/0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </button>

                    {/* Security note */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                        Secured by Supabase Auth + Google OAuth 2.0
                    </div>
                </div>

                {/* Footer */}
                <p className="mt-6 text-center text-xs text-slate-600">
                    CoreX Financial System v1.0 — Your data stays private.
                </p>
            </div>
        </div>
    );
}
