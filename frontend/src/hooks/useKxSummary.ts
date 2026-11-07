/**
 * Canonical data for the Fase 6 screens (rule 7: one source, same numbers
 * everywhere). Inicio, Calendario and Cuentas all read from here:
 *   /api/dashboard               total_debt, liquid_cash, daily interest
 *   /api/accounts                per-account balances and cut days
 *   /api/velocity/freedom-path   monthly projection → calendar + freedom date
 *   /api/cashflow                income items → paydays
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
import { ACTIVITY_KEY } from '@/hooks/useActivityData';
import { buildDayDetail, buildMonths, paydaysIn, type CalendarMonth, type IncomeItem, type TimelinePoint } from '@/lib/calendarSeries';
import { paidFraction, stageOf, type Stage } from '@/lib/stage';
import type { SubsResponse } from '@/features/subscriptions/subscriptionText';

export interface KxAccount {
    logo_url?: string | null;
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

export const KX_SUMMARY_KEY = 'kx-summary';
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
    // A payment or a confirmed attack changes Actividad too: same events, same refresh
    const load = useCallback(() => Promise.all([
        queryClient.invalidateQueries({ queryKey: [KX_SUMMARY_KEY] }),
        queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }),
    ]), [queryClient]);

    // Active subscriptions are real dated charges: same cache as the Suscripciones section
    const subsQ = useQuery({
        queryKey: ['recurring-subscriptions'],
        queryFn: () => apiFetch<SubsResponse>('/api/subscriptions'),
        staleTime: KX_SUMMARY_STALE_MS,
        enabled: !!q.data,
    });
    const subs = subsQ.data?.items;

    const data = q.data;
    const derived = useMemo(() => {
        const totalDebt = Number(data?.dashboard?.total_debt ?? 0);
        const staged: StagedAccount[] = (data?.accounts ?? []).map((a) => ({
            ...a, stage: stageOf(a), paid: paidFraction(a), bal: Number(a.balance) || 0,
        }));
        const debts = staged.filter((a) => a.type === 'debt');
        const counts = { debt: 0, almost: 0, paid: 0 } as Record<'debt' | 'almost' | 'paid', number>;
        for (const a of debts) if (a.stage !== 'support') counts[a.stage] += 1;
        const months: CalendarMonth[] = buildMonths(data?.path?.timeline ?? [], totalDebt);
        const freedom = months.find((m) => m.zeroDay) ?? null;
        const paydays = (y: number, m: number) => paydaysIn(y, m, (data?.income ?? []));
        const cutDays = (y: number, m: number) => {
            const map = new Map<number, string>();
            const n = new Date(y, m + 1, 0).getDate();
            for (const a of debts) if (a.closing_day && a.bal > 0) map.set(Math.min(a.closing_day, n), 'C');
            return map;
        };
        // Tap a calendar day → COBRAS / TE COBRAN, from this same summary (no extra calls)
        const dayDetail = (date: Date) => buildDayDetail(date, months, data?.income ?? [], staged, subs ?? []);
        // What leaves on each day of a month (bills + minimums + subscriptions): calendar mark + month total
        const chargesIn = (y: number, m: number) => {
            const map = new Map<number, number>();
            const n = new Date(y, m + 1, 0).getDate();
            for (let d = 1; d <= n; d++) {
                const out = dayDetail(new Date(y, m, d, 12)).totalOut;
                if (out > 0) map.set(d, out);
            }
            return map;
        };
        return { totalDebt, liquid: Number(data?.dashboard?.liquid_cash ?? 0), daily: Number(data?.dashboard?.total_daily_interest ?? 0),
            staged, debts, counts, months, freedom, paydays, cutDays, dayDetail, chargesIn };
    }, [data, subs]);

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
