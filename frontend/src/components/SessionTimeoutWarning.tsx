/**
 * SessionTimeoutWarning — Warns users before their auth token expires.
 *
 * Monitors the Supabase auth session and shows a toast notification
 * 5 minutes before expiration. The toast action refreshes the token;
 * when the session expires, the user is signed out automatically.
 *
 * Security rationale:
 * - Prevents data loss from mid-workflow logouts
 * - Encourages explicit session renewal vs. silent token refresh
 * - Logs session events for audit trail
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/features/auth/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';

const WARNING_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes before expiry
const CHECK_INTERVAL_MS = 30 * 1000; // Check every 30 seconds

export function SessionTimeoutWarning() {
    const { user, signOut } = useAuth();
    const { language } = useLanguage();
    const { toast } = useToast();
    const [timeLeft, setTimeLeft] = useState('');
    const [warningActive, setWarningActive] = useState(false);
    const toastRef = useRef<ReturnType<typeof toast> | null>(null);

    const isEs = language === 'es';

    const dismissWarning = useCallback(() => {
        toastRef.current?.dismiss();
        toastRef.current = null;
    }, []);

    const handleRefresh = useCallback(async () => {
        try {
            const { error } = await supabase.auth.refreshSession();
            if (error) {
                console.error('[Session] Refresh failed:', error.message);
                dismissWarning();
                signOut();
            } else {
                console.info('[Session] Token refreshed successfully');
                setWarningActive(false);
                dismissWarning();
            }
        } catch (err) {
            console.error('[Session] Refresh error:', err);
        }
    }, [signOut, dismissWarning]);

    const checkSession = useCallback(async () => {
        if (!user) return;

        const { data } = await supabase.auth.getSession();
        const session = data?.session;
        if (!session?.expires_at) return;

        const remaining = session.expires_at * 1000 - Date.now();

        if (remaining <= 0) {
            // Session expired — force signOut
            console.warn('[Session] Token expired, redirecting to login');
            dismissWarning();
            signOut();
            return;
        }

        if (remaining <= WARNING_THRESHOLD_MS) {
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            setTimeLeft(`${mins}:${secs.toString().padStart(2, '0')}`);
            setWarningActive(true);
        } else {
            setWarningActive(false);
        }
    }, [user, signOut, dismissWarning]);

    useEffect(() => {
        if (!user) return;

        // Deferred to a callback — avoids synchronous setState in the effect body
        const initial = setTimeout(checkSession, 0);
        const interval = setInterval(checkSession, CHECK_INTERVAL_MS);
        return () => {
            clearTimeout(initial);
            clearInterval(interval);
        };
    }, [user, checkSession]);

    // Drive the toast from warning state — create once, update the countdown
    useEffect(() => {
        if (!warningActive) return;

        const title = isEs ? 'Sesión por expirar' : 'Session Expiring';
        const description = isEs
            ? `Tu sesión expira en ${timeLeft}`
            : `Your session expires in ${timeLeft}`;
        const action = (
            <ToastAction
                altText={isEs ? 'Seguir conectado' : 'Stay Logged In'}
                onClick={handleRefresh}
            >
                {isEs ? 'Seguir conectado' : 'Stay Logged In'}
            </ToastAction>
        );

        if (toastRef.current) {
            toastRef.current.update({
                id: toastRef.current.id,
                title,
                description,
                action,
                duration: WARNING_THRESHOLD_MS,
            });
        } else {
            toastRef.current = toast({
                title,
                description,
                action,
                duration: WARNING_THRESHOLD_MS,
            });
        }
    }, [warningActive, timeLeft, isEs, handleRefresh, toast]);

    // Dismiss the toast if the warning clears or the component unmounts
    useEffect(() => {
        if (!warningActive) dismissWarning();
    }, [warningActive, dismissWarning]);

    useEffect(() => dismissWarning, [dismissWarning]);

    // Renders nothing — notification is delivered via the toast system
    return null;
}
