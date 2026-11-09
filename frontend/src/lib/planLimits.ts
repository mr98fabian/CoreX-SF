/**
 * Subscription Plan Limits — Single source of truth for the entire app.
 *
 * All plan → limit mappings live HERE.  Import from this file everywhere
 * instead of hardcoding limits in individual components.
 */

import { apiFetch } from '@/lib/api';

// ─── Canonical Plan Limits (accounts allowed) ──────────────────
export const PLAN_LIMITS: Record<string, number> = {
    starter: 2, // keep in sync with backend plan_guard.PLAN_LIMITS
    velocity: 15,
    accelerator: Infinity,
    freedom: Infinity,
    'freedom-dev': Infinity,
    founder: Infinity, // access code: permanent, AI included, never sold
};

export const PLAN_NAMES: Record<string, string> = {
    starter: 'Starter',
    velocity: 'Velocity',
    accelerator: 'Accelerator',
    freedom: 'Freedom',
    'freedom-dev': 'Freedom (Developer)',
    founder: 'Founder',
};

/** Plan label in the user's language (only Founder has a Spanish name). */
export function planLabel(plan: string | null | undefined, es: boolean): string {
    if (plan === 'founder') return es ? 'Fundador' : 'Founder';
    return PLAN_NAMES[plan ?? 'starter'] ?? 'Starter';
}

// ─── Helpers ────────────────────────────────────────────────────

/** Read the current plan from localStorage. Defaults to 'starter'. */
export function getUserPlan(): string {
    return localStorage.getItem('korex-plan') || 'starter';
}

/** Get the debt-account limit for the current (or given) plan. */
export function getPlanLimit(plan?: string | null): number {
    const currentPlan = plan || getUserPlan();
    return PLAN_LIMITS[currentPlan] ?? 2;
}

/** Get the display name for the current (or given) plan. */
export function getPlanName(plan?: string | null): string {
    const currentPlan = plan || getUserPlan();
    return PLAN_NAMES[currentPlan] ?? 'Starter';
}

/**
 * Build the `?plan_limit=X` query string suffix.
 * Returns empty string for unlimited plans.
 */
export function getPlanLimitParam(): string {
    const limit = getPlanLimit();
    return limit !== Infinity && limit !== undefined ? `plan_limit=${limit}` : '';
}

/**
 * Append plan_limit query param to an existing URL path.
 * Handles both paths with and without existing query params.
 */
export function withPlanLimit(url: string): string {
    const param = getPlanLimitParam();
    if (!param) return url;
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${param}`;
}

// ─── Backend Sync ───────────────────────────────────────────────

export interface SubStatus {
    plan: string;
    status: string;
    accounts_limit: number;
    source?: 'demo' | 'grant' | 'subscription' | 'none';
    grant_plan?: string | null;
    grant_ends_at?: string | null;
    checkout_hidden?: boolean;
    current_period_end?: string | null;
}

/** GET /api/subscriptions/status — the server's resolver (code grants, Lemon, demo). */
export async function fetchSubStatus(): Promise<SubStatus | null> {
    try {
        const data = await apiFetch<SubStatus>('/api/subscriptions/status');
        localStorage.setItem('korex-plan', data.plan || 'starter');
        return data;
    } catch {
        return null;
    }
}

/**
 * Fetch the real subscription plan from the backend and persist
 * it into localStorage.  Call this on app mount / after login.
 *
 * Silently no-ops if the fetch fails (user stays on cached plan).
 */
export async function syncPlanFromBackend(): Promise<string> {
    const data = await fetchSubStatus();
    return data ? data.plan || 'starter' : getUserPlan();
}

/** "8 de mayo de 2027" from an ISO datetime. */
export function longDate(iso: string, es: boolean): string {
    return new Date(iso).toLocaleDateString(es ? 'es-ES' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}
