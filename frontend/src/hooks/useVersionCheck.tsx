import { useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { ToastAction } from '@/components/ui/toast';
import React from 'react';

// ─── Build‑time version injected by Vite (vite.config.ts → define) ──
declare const __APP_VERSION__: string;

// Interval between version checks (ms)
const CHECK_INTERVAL_MS = 60_000; // every 60 seconds

/**
 * Polls `/version.json` in the background and shows a toast when
 * the deployed version differs from the build embedded in the client.
 *
 * ──── How it works ────
 * 1. Vite plugin writes `{ "version": "1.0.3", "buildTime": "..." }`
 *    into `dist/version.json` on every production build.
 * 2. This hook fetches that file periodically.
 * 3. If the fetched version ≠ `__APP_VERSION__`, we surface a
 *    persistent toast prompting the user to reload.
 * 4. Clicking "Actualizar" does `location.reload()` (Vercel/CDN will
 *    serve the fresh assets because Vite uses content‑hashed filenames).
 */
export function useVersionCheck() {
    const { toast } = useToast();
    const hasNotified = useRef(false);

    const handleUpdate = useCallback(() => {
        // Clear service worker cache if registered
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
                regs.forEach((r) => r.unregister());
            });
        }
        // Hard reload — bypasses browser disk cache
        window.location.reload();
    }, []);

    const checkVersion = useCallback(async () => {
        // Skip in development — version.json doesn't exist
        if (import.meta.env.DEV) return;
        // Only notify once per session
        if (hasNotified.current) return;

        try {
            // Cache‑bust the fetch so proxies/CDNs don't serve stale JSON
            const res = await fetch(`/version.json?_t=${Date.now()}`, {
                cache: 'no-store',
            });

            if (!res.ok) return; // version.json not deployed yet — skip silently

            const data = await res.json();
            const serverVersion = data.version;

            if (!serverVersion) return;

            // Compare embedded version vs. deployed version
            if (serverVersion !== __APP_VERSION__) {
                hasNotified.current = true;
                toast({
                    title: '🚀 Nueva Versión Disponible',
                    description: `v${serverVersion} está lista. Actualiza para obtener las últimas mejoras.`,
                    duration: Infinity, // persist until user acts
                    action: React.createElement(
                        ToastAction,
                        {
                            altText: 'Actualizar ahora',
                            onClick: handleUpdate,
                            className: 'bg-emerald-600 hover:bg-emerald-500 text-white border-0',
                        },
                        'Actualizar'
                    ),
                });
            }
        } catch {
            // Network error — not critical, skip silently
        }
    }, [toast, handleUpdate]);

    useEffect(() => {
        // Initial check after a short delay (let the app boot first)
        const initialTimer = setTimeout(checkVersion, 5_000);

        // Periodic polling
        const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

        // Also check when the tab regains focus (user switches back)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkVersion();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            clearTimeout(initialTimer);
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [checkVersion]);
}
