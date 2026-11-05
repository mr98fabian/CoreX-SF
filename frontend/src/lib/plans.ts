/**
 * Plans as shown to people: debt limits come from the server
 * (GET /api/public/plans → plan_guard.PLAN_LIMITS, the same values it
 * enforces), prices from lib/pricing.ts (the billing config). Nothing about
 * limits is hardcoded here.
 */
import { useEffect, useState } from 'react';
import { API_BASE } from '@/lib/api';
import { PLAN_PRICES } from '@/lib/pricing';

export type PlanId = 'starter' | 'velocity' | 'accelerator' | 'freedom';

export interface PlanView {
    id: PlanId;
    name: string;
    monthly: number;
    annual: number;
    debtLimit: number | null; // null = unlimited
    ai: boolean;              // AI connection (tokens/MCP) — paid plans only, enforced by the server
    prioritySupport: boolean;
}

const NAMES: Record<PlanId, string> = { starter: 'Gratis', velocity: 'Velocity', accelerator: 'Accelerator', freedom: 'Freedom' };
const ORDER: PlanId[] = ['starter', 'velocity', 'accelerator', 'freedom'];

export function usePlans() {
    const [plans, setPlans] = useState<PlanView[] | null>(null);
    const [error, setError] = useState(false);
    useEffect(() => {
        // Public, no auth: plain fetch so the landing can use it too
        fetch(`${API_BASE}/api/public/plans`)
            .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
            .then((rows: { plan: string; debt_limit: number | null }[]) => {
                const limits = new Map(rows.map((r) => [r.plan, r.debt_limit]));
                setPlans(ORDER.filter((id) => limits.has(id)).map((id) => ({
                    id, name: NAMES[id], monthly: PLAN_PRICES[id].monthly, annual: PLAN_PRICES[id].annual,
                    debtLimit: limits.get(id) ?? null, ai: id !== 'starter', prioritySupport: id === 'freedom',
                })));
            })
            .catch(() => setError(true));
    }, []);
    return { plans, error };
}
