/**
 * Plans as shown to people: debt limits come from the server
 * (GET /api/public/plans → plan_guard.PLAN_LIMITS, the same values it enforces),
 * names and prices from lib/pricing.ts (the only commercial source).
 */
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { COMMERCIAL_ORDER, COMMERCIAL_PLANS, type CommercialPlanId } from '@/lib/pricing';

export type PlanId = CommercialPlanId;

export interface PlanView {
    id: PlanId;
    name: string;
    annual: number;
    trialDays: number;
    debtLimit: number | null; // null = unlimited
    ai: boolean;
}

export function usePlans(es = true) {
    const [plans, setPlans] = useState<PlanView[] | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        // Public, no auth: plain fetch so the landing can use it too
        fetch(`${API_BASE}/api/public/plans`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((rows: { plan: string; debt_limit: number | null }[]) => {
                const limits = new Map(rows.map((r) => [r.plan, r.debt_limit]));
                setPlans(COMMERCIAL_ORDER.filter((id) => limits.has(id)).map((id) => {
                    const c = COMMERCIAL_PLANS[id];
                    return { id, name: es ? c.name.es : c.name.en, annual: c.annual, trialDays: c.trialDays, debtLimit: limits.get(id) ?? null, ai: c.ai };
                }));
            })
            .catch(() => setError(true));
    }, [es]);
    return { plans, error };
}
