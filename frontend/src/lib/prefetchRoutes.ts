/**
 * Warm the bottom-bar sections while the app is idle (perf 2026-11-07):
 * their lazy chunks (same import() paths as App.tsx, so Vite reuses them) and
 * the shared React Query entries, so switching section paints from cache.
 * Runs once per mount of the signed-in layout, on requestIdleCallback
 * (setTimeout fallback for Safari/WebView), and never blocks a render.
 */
import type { QueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { ACTIVITY_KEY, ACTIVITY_STALE_MS, fetchActivity } from '@/hooks/useActivityData';
import { KX_SUMMARY_KEY, KX_SUMMARY_STALE_MS, fetchKxSummary } from '@/hooks/useKxSummary';

const CHUNKS = [
    () => import('@/features/home/HomePage'),
    () => import('@/features/accounts/AccountsStagePage'),
    () => import('@/features/subscriptions/SubscriptionsPage'),
    () => import('@/features/activity/ActivityPage'),
    () => import('@/features/settings/SettingsHome'),
    () => import('@/features/attack/AttackPage'),
];

export function prefetchSections(qc: QueryClient, userId: string): void {
    const quiet = (p: Promise<unknown>) => { p.catch(() => undefined); };
    for (const load of CHUNKS) quiet(load());
    quiet(qc.prefetchQuery({ queryKey: [KX_SUMMARY_KEY, userId], queryFn: fetchKxSummary, staleTime: KX_SUMMARY_STALE_MS }));
    quiet(qc.prefetchQuery({ queryKey: [ACTIVITY_KEY, userId], queryFn: fetchActivity, staleTime: ACTIVITY_STALE_MS }));
    quiet(qc.prefetchQuery({ queryKey: ['recurring-subscriptions'], queryFn: () => apiFetch('/api/subscriptions'), staleTime: KX_SUMMARY_STALE_MS }));
}

export function whenIdle(fn: () => void, timeout = 2000): () => void {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };
    if (w.requestIdleCallback) {
        const id = w.requestIdleCallback(fn, { timeout });
        return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(fn, 1200);
    return () => window.clearTimeout(id);
}
