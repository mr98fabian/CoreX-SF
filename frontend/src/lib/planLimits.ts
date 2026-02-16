/**
 * Subscription Plan Limits — Centralized plan → debt account limit mapping.
 *
 * Reads the current plan from localStorage ('corex-plan').
 * Returns the max number of active debt accounts for that plan,
 * or undefined for unlimited (freedom plan).
 */

const PLAN_LIMITS: Record<string, number | undefined> = {
    starter: 2,
    velocity: 5,
    accelerator: 10,
    freedom: undefined,       // unlimited
    'freedom-dev': undefined, // developer license
};

/**
 * Get the debt account limit for the current subscription plan.
 * Returns `undefined` if the plan is unlimited.
 */
export function getPlanLimit(): number | undefined {
    const plan = localStorage.getItem('corex-plan') || 'starter';
    return PLAN_LIMITS[plan];
}

/**
 * Build the `?plan_limit=X` query string suffix.
 * Returns empty string for unlimited plans.
 */
export function getPlanLimitParam(): string {
    const limit = getPlanLimit();
    return limit !== undefined ? `plan_limit=${limit}` : '';
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
