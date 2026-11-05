/**
 * Canonical data for the Fase 6 screens (rule 7: one source, same numbers
 * everywhere). Inicio, Calendario and Cuentas all read from here:
 *   /api/dashboard               total_debt, liquid_cash, daily interest
 *   /api/accounts                per-account balances and cut days
 *   /api/velocity/freedom-path   monthly projection → calendar + freedom date
 *   /api/cashflow                income items → paydays
 * Debt totals shown to the user come from /api/dashboard only.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { buildMonths, paydaysIn, type CalendarMonth, type IncomeItem, type TimelinePoint } from '@/lib/calendarSeries';
import { paidFraction, stageOf, type Stage } from '@/lib/stage';

export interface KxAccount {
    id: number;
    name: string;
    type: string;
    balance: number | string;
    interest_rate: number | string;
    min_payment: number | string;
    credit_limit?: number | string | null;
    original_amount?: number | string | null;
    closing_day?: number | null;
    due_day?: number | null;
    debt_subtype?: string;
    interest_type?: string;
}

interface Dashboard { total_debt: number; liquid_cash: number; total_daily_interest?: number }
interface FreedomPath { timeline: TimelinePoint[]; freedom_date: string; total_months: number }

export interface StagedAccount extends KxAccount { stage: Stage; paid: number | null; bal: number }

export function useKxSummary() {
    const [state, setState] = useState<{
        loading: boolean; error: string | null;
        dashboard?: Dashboard; accounts: KxAccount[]; path?: FreedomPath; income: IncomeItem[];
    }>({ loading: true, error: null, accounts: [], income: [] });

    const load = useCallback(async () => {
        setState((s) => ({ ...s, loading: true, error: null }));
        try {
            const [dashboard, accounts, path, cashflow] = await Promise.all([
                apiFetch<Dashboard>('/api/dashboard'),
                apiFetch<KxAccount[]>('/api/accounts'),
                apiFetch<FreedomPath>('/api/velocity/freedom-path'),
                apiFetch<IncomeItem[]>('/api/cashflow').catch(() => [] as IncomeItem[]),
            ]);
            setState({ loading: false, error: null, dashboard, accounts, path, income: cashflow });
        } catch (e) {
            setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'error' }));
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const derived = useMemo(() => {
        const totalDebt = Number(state.dashboard?.total_debt ?? 0);
        const staged: StagedAccount[] = state.accounts.map((a) => ({
            ...a, stage: stageOf(a), paid: paidFraction(a), bal: Number(a.balance) || 0,
        }));
        const debts = staged.filter((a) => a.type === 'debt');
        const counts = { debt: 0, almost: 0, paid: 0 } as Record<'debt' | 'almost' | 'paid', number>;
        for (const a of debts) if (a.stage !== 'support') counts[a.stage] += 1;
        const months: CalendarMonth[] = buildMonths(state.path?.timeline ?? [], totalDebt);
        const freedom = months.find((m) => m.zeroDay) ?? null;
        const paydays = (y: number, m: number) => paydaysIn(y, m, state.income);
        const cutDays = (y: number, m: number) => {
            const map = new Map<number, string>();
            const n = new Date(y, m + 1, 0).getDate();
            for (const a of debts) if (a.closing_day && a.bal > 0) map.set(Math.min(a.closing_day, n), 'C');
            return map;
        };
        return { totalDebt, liquid: Number(state.dashboard?.liquid_cash ?? 0), daily: Number(state.dashboard?.total_daily_interest ?? 0),
            staged, debts, counts, months, freedom, paydays, cutDays };
    }, [state]);

    return { ...state, ...derived, reload: load };
}

/** The next statement cut among open debts (today counts), with days left. */
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
