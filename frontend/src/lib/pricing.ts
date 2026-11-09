/**
 * The ONLY commercial source: what KoreX sells, with names and prices. Every surface that
 * shows a price (landing, Plans page, upgrade modal, legacy settings) reads from here.
 * Must match the Lemon Squeezy variant behind LS_VARIANT_FREEDOM_ANNUAL and backend
 * PLAN_COSTS. Internal plan keys (velocity, accelerator…) still exist for limits and
 * existing subscribers, but are never sold or priced.
 */
export type CommercialPlanId = 'starter' | 'freedom';

export interface CommercialPlan {
    id: CommercialPlanId;
    name: { es: string; en: string };
    annual: number;      // USD per year; 0 = free
    trialDays: number;   // free trial before the first charge
    ai: boolean;         // AI connection (tokens/MCP), enforced by the server
}

/** Sold only as an annual plan. Backend plan key: freedom. */
export const PAID_PLAN_ID: CommercialPlanId = 'freedom';
export const ANNUAL_PRICE = 100;
export const TRIAL_DAYS = 30;

export const COMMERCIAL_PLANS: Record<CommercialPlanId, CommercialPlan> = {
    starter: { id: 'starter', name: { es: 'Gratis', en: 'Free' }, annual: 0, trialDays: 0, ai: false },
    freedom: { id: 'freedom', name: { es: 'KoreX Anual', en: 'KoreX Annual' }, annual: ANNUAL_PRICE, trialDays: TRIAL_DAYS, ai: true },
};

export const COMMERCIAL_ORDER: CommercialPlanId[] = ['starter', 'freedom'];

/** Internal keys that mean the user already has paid access. */
export const PAID_KEYS = new Set(['velocity', 'accelerator', 'freedom', 'freedom-dev', 'founder']);
