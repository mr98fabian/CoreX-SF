/**
 * Canonical plan prices — the single source for every surface that shows a
 * price (landing, upgrade modal, settings). Must match Lemon Squeezy and
 * backend PLAN_COSTS. The only discount is the real annual one (~2 months free).
 */
export const PLAN_PRICES = {
    starter: { monthly: 0, annual: 0 },
    velocity: { monthly: 9.99, annual: 99.99 },
    accelerator: { monthly: 19.99, annual: 199.99 },
    freedom: { monthly: 29.99, annual: 299.99 },
} as const;
