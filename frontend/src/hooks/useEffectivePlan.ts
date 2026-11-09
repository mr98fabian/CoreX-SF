import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { PAID_KEYS } from '@/lib/pricing';
import type { SubStatus } from '@/lib/planLimits';

export interface EffectivePlan {
    /** Still asking the server */
    loading: boolean;
    /** Server-resolved plan id (founder, grants, Lemon, demo); null until it answers */
    plan: string | null;
    /** Founder account */
    founder: boolean;
    /** Paid AND allowed to connect an AI. Only ever true on the server's word. */
    paid: boolean;
    /** localStorage hint, ONLY to shape the loading state. Never grants access. */
    cachedPlan: string | null;
}

/** The access decision, pure so it can be tested: the server's status or nothing. */
export function resolvePaid(status: SubStatus | null | undefined): boolean {
    if (!status) return false;
    if (status.source === 'demo') return false; // the shared sandbox never connects an AI (plan_guard)
    return status.plan === 'founder' || PAID_KEYS.has(status.plan);
}

function readCache(): string | null {
    try { return localStorage.getItem('korex-plan'); } catch { return null; }
}

/**
 * The effective plan for paid-only screens, from GET /api/subscriptions/status (the
 * same resolver the backend uses: founder, code grants, subscriptions, demo).
 * A failed or missing status means locked — the local cache can't open anything.
 */
export function useEffectivePlan(): EffectivePlan {
    const { data, isLoading } = useQuery({
        queryKey: ['subscription-status'],
        queryFn: () => apiFetch<SubStatus>('/api/subscriptions/status'),
        staleTime: 60_000,
        retry: false,
    });
    return {
        loading: isLoading,
        plan: data?.plan ?? null,
        founder: data?.plan === 'founder',
        paid: resolvePaid(data),
        cachedPlan: readCache(),
    };
}
