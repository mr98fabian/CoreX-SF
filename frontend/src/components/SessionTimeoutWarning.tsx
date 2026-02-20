/**
 * SessionTimeoutWarning — Warns users before their auth token expires.
 *
 * Monitors the Supabase auth session and shows a non-intrusive warning
 * 5 minutes before expiration. Offers "Stay Logged In" (refreshes token)
 * or auto-redirects to login when expired.
 *
 * Security rationale:
 * - Prevents data loss from mid-workflow logouts
 * - Encourages explicit session renewal vs. silent token refresh
 * - Logs session events for audit trail
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export function SessionTimeoutWarning() {
    const { user, signOut } = useAuth();
    const { language } = useLanguage();
    const [showWarning, setShowWarning] = useState(false);
    const [timeLeft, setTimeLeft] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const isEs = language === 'es';

    const checkSession = useCallback(async () => {
        if (!user) return;

        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session?.expires_at) return;

        const expiresAt = session.expires_at * 1000; // Convert to ms
        const remaining = expiresAt - Date.now();

        if (remaining <= 0) {
            // Session expired — force signOut
            console.warn('[Session] Token expired, redirecting to login');
            signOut();
            return;
        }

        if (remaining <= WARNING_THRESHOLD_MS) {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
            setShowWarning(true);
        } else {
            setShowWarning(false);
        }
    }, [user, signOut]);

    useEffect(() => {
        if (!user) return;

        checkSession();
        intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);

        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [user, checkSession]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const { error } = await supabase.auth.refreshSession();
            if (error) {
                console.error('[Session] Refresh failed:', error.message);
                signOut();
            } else {
                console.info('[Session] Token refreshed successfully');
                setShowWarning(false);
            }
        } catch (err) {
            console.error('[Session] Refresh error:', err);
        } finally {
            setRefreshing(false);
        }
    }, [signOut]);

    if (!showWarning || !user) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm">
            <div className="rounded-2xl border border-amber-500/30 bg-slate-900/95 backdrop-blur-xl shadow-2xl shadow-amber-500/10 p-4 space-y-3">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400 animate-pulse">
                        <Clock size={20} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white">
                            {isEs ? 'Sesión por expirar' : 'Session Expiring'}
                        </p>
                        <p className="text-xs text-amber-400/80">
                            {isEs
                                ? `Tu sesión expira en ${timeLeft}`
                                : `Your session expires in ${timeLeft}`}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 text-xs font-bold transition-all disabled:opacity-50"
                    >
                        <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
                        {isEs ? 'Seguir conectado' : 'Stay Logged In'}
                    </button>
                    <button
                        onClick={signOut}
                        className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 text-xs font-medium transition-all"
                    >
                        <LogOut size={14} />
                        {isEs ? 'Salir' : 'Logout'}
                    </button>
                </div>
            </div>
        </div>
    );
}
