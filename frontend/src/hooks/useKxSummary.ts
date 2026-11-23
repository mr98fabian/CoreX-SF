/**
 * Canonical data for the Fase 6 screens (rule 7: one source, same numbers
 * everywhere). Inicio, Calendario and Cuentas all read from here:
 *   /api/dashboard               total_debt, liquid_cash, daily interest
 *   /api/accounts                per-account balances and cut days
 *   /api/velocity/freedom-path   monthly projection → calendar + freedom date
 *   /api/cashflow                income items
 * Calendar EVENTS (paydays, charges, cuts) come from the server, per month:
 * hooks/useCalendarEvents → GET /api/calendar/events (same functions as the mission).
 * Debt totals shown to the user come from /api/dashboard only.
 *
 * Perf 2026-11-05: ONE React Query entry shared by Inicio / Calendario /
 * Cuentas / Ataque (staleTime 45 s). Returning to a visited screen paints from
 * cache instantly and refetches in the background; reload() invalidates the
 * entry (payments and confirmed attacks still refresh everything). The key
 * includes the signed-in user, so a different session never sees this data.
 */
import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { buildMonths, type CalendarMonth, type IncomeItem, type TimelinePoint } from '@/lib/calendarSeries';
import { KX_SUMMARY_KEY, invalidatePlanData } from '@/lib/planSync';
import { paidFraction, stageOf, type Stage } from '@/lib/stage';
import type { MissionResult } from '@/components/kx/MissionCard';

export interface KxAccount {
    logo_url?: string | null;
    id: number;
    name: string;
    type: string;
    balance: number | string;
    interest_rate: number | string;
    min_payment: number | string;
    /** server: velocity_engine.plan_minimum capped at the balance (what screens charge) */
    plan_minimum?: number | string;
    credit_limit?: number | string | null;
    original_amount?: number | string | null;
    closing_day?: number | null;
    due_day?: number | null;
    debt_subtype?: string;
    interest_type?: string;
}

interface Dashboard { total_debt: number; liquid_cash: number; total_daily_interest?: number; mision?: MissionResult;
    interes_diario?: { periodos: Record<'dia' | 'semana' | 'mes' | 'anio', number> } }
/** daily_series: the engine's daily step series (calendar band + exact $0 day); missing on an older server. */
interface FreedomPath { timeline: TimelinePoint[]; freedom_date: string; total_months: number; daily_series?: TimelinePoint[] }

export interface StagedAccount extends KxAccount { stage: Stage; paid: number | null; bal: number }

export { KX_SUMMARY_KEY };
export const KX_SUMMARY_STALE_MS = 45_000;

interface Summary { dashboard: Dashboard; accounts: KxAccount[]; path: FreedomPath; income: IncomeItem[] }

export async function fetchKxSummary(): Promise<Summary> {
    const [dashboard, accounts, path, income] = await Promise.all([
        apiFetch<Dashboard>('/api/dashboard'),
        apiFetch<KxAccount[]>('/api/accounts'),
        apiFetch<FreedomPath>('/api/velocity/freedom-path'),
        apiFetch<IncomeItem[]>('/api/cashflow').catch(() => [] as IncomeItem[]),
    ]);
    return { dashboard, accounts, path, income };
}

export function useKxSummary() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const q = useQuery({
        queryKey: [KX_SUMMARY_KEY, user?.id ?? 'anon'],
        queryFn: fetchKxSummary,
        staleTime: KX_SUMMARY_STALE_MS,
    });
    const state = {
        loading: q.isPending,
        error: q.isError ? (q.error instanceof Error ? q.error.message : 'error') : null,
        dashboard: q.data?.dashboard,
        accounts: q.data?.accounts ?? [],
        path: q.data?.path,
        income: q.data?.income ?? [],
    };
    // The same set every plan write refreshes (lib/planSync): summary, Actividad, calendar, chart…
    const load = useCallback(() => invalidatePlanData(queryClient), [queryClient]);


    const data = q.data;
    const derived = useMemo(() => {
        const totalDebt = Number(data?.dashboard?.total_debt ?? 0);
        const staged: StagedAccount[] = (data?.accounts ?? []).map((a) => ({
            ...a, stage: stageOf(a), paid: paidFraction(a), bal: Number(a.balance) || 0,
        }));
        const debts = staged.filter((a) => a.type === 'debt');
        const counts = { debt: 0, almost: 0, paid: 0 } as Record<'debt' | 'almost' | 'paid', number>;
        for (const a of debts) if (a.stage !== 'support') counts[a.stage] += 1;
        const months: CalendarMonth[] = buildMonths(data?.path?.timeline ?? [], totalDebt, new Date(), data?.path?.daily_series);
        const freedom = months.find((m) => m.zeroDay) ?? null;
        return { totalDebt, liquid: Number(data?.dashboard?.liquid_cash ?? 0), daily: Number(data?.dashboard?.total_daily_interest ?? 0), dailyPeriods: data?.dashboard?.interes_diario?.periodos,
            mission: data?.dashboard?.mision?.mision ?? null,
            faltante: data?.dashboard?.mision?.faltante ?? null,
            staged, debts, counts, months, freedom };
    }, [data]);

    return { ...state, ...derived, reload: load };
}

/** The next statement cut among open debts (today counts). Visual data only:
 *  the "único pendiente" is the server's mission (useKxSummary().mission). */
export function nextCut(debts: StagedAccount[], today = new Date()) {
    let best: { acc: StagedAccount; date: Date } | null = null;
    for (const a of debts) {
        if (!a.closing_day || a.bal <= 0) continue;
        const y = today.getFullYear(); const m = today.getMonth();
        const thisMonth = new Date(y, m, Math.min(a.closing_day, new Date(y, m + 1, 0).getDate()), 12);
        const date = thisMonth.getDate() >= today.getDate() ? thisMonth
            : new Date(y, m + 1, Math.min(a.closing_day, new Date(y, m + 2, 0).getDate()), 12);
        if (!best || date < best.date) best = { acc: a, date };
    }
    return best;
}
