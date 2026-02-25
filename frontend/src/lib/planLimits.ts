/**
 * Subscription Plan Limits — Single source of truth for the entire app.
 *
 * All plan → limit mappings live HERE.  Import from this file everywhere
 * instead of hardcoding limits in individual components.
 */

import { apiFetch } from '@/lib/api';

// ─── Canonical Plan Limits (accounts allowed) ──────────────────
export const PLAN_LIMITS: Record<string, number> = {
    starter: 12,
    velocity: 6,
    accelerator: 12,
    freedom: Infinity,
    'freedom-dev': Infinity,
};

export const PLAN_NAMES: Record<string, string> = {
    starter: 'Starter',
    velocity: 'Velocity',
    accelerator: 'Accelerator',
    freedom: 'Freedom',
    'freedom-dev': 'Freedom (Developer)',
};

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

interface SubStatus {
    plan: string;
    status: string;
    accounts_limit: number;
}

/**
 * Fetch the real subscription plan from the backend and persist
 * it into localStorage.  Call this on app mount / after login.
 *
 * Silently no-ops if the fetch fails (user stays on cached plan).
 */
export async function syncPlanFromBackend(): Promise<string> {
    try {
        const data = await apiFetch<SubStatus>('/api/subscriptions/status');
        const plan = data.plan || 'starter';
        localStorage.setItem('korex-plan', plan);
        return plan;
    } catch {
        // Network error / not authenticated — keep cached value
        return getUserPlan();
    }
}
