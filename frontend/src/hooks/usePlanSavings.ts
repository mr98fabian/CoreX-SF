/**
 * The user's REAL savings for sales copy (UpgradeModal, Settings → Suscripción): their plan
 * vs paying only the minimums, straight from GET /api/velocity/compare (compare_paths, the
 * same numbers as Inicio's chart). Returns null whenever there is nothing honest to show
 * (no debts, no surplus, simulator cap, no saving): never an invented figure.
 */
import { useVelocityCompare, type VelocityCompare } from '@/hooks/useVelocityCompare';

export interface PlanSavings {
    /** total interest avoided: minimums-only interest − plan interest */
    interest: number;
    planInterest: number;
    minimumsInterest: number;
    planYears: number;
    minimumsYears: number;
    /** the minimums route hit the simulator cap: its years are a floor ("50+") */
    minimumsCapped: boolean;
}

export function planSavingsOf(c: VelocityCompare | null): PlanSavings | null {
    if (!c || c.estado !== 'ok' || !c.plan || !c.minimos) return null;
    if (c.plan.tope_simulador || c.ahorro.intereses <= 0) return null;
    return {
        interest: c.ahorro.intereses, planInterest: c.plan.interes_total, minimumsInterest: c.minimos.interes_total,
        planYears: c.plan.anios, minimumsYears: c.minimos.anios, minimumsCapped: c.minimos.tope_simulador,
    };
}

export function usePlanSavings(enabled = true): PlanSavings | null {
    return planSavingsOf(useVelocityCompare(enabled).data);
}
