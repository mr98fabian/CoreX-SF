/**
 * Debt calendar series — turns the engine's MONTHLY projection
 * (GET /api/velocity/freedom-path → timeline[].total_balance at each month's
 * close) into per-day values for the calendar.
 *
 * TECH DEBT (Fase 6 report): the engine has no daily series, so days are
 * linearly interpolated between month closes, and the exact $0 day inside the
 * freedom month is estimated from the previous month's pace. Calibrating the
 * engine (daily series, real payday effects) is a separate mission.
 */
import type { RecurringSub } from '@/features/subscriptions/subscriptionText';
import { subsOn } from '@/lib/subscriptionOccurrences';

export interface TimelinePoint { date: string; total_balance: number }

export interface CalendarMonth {
    year: number;
    month: number;          // 0-11
    start: number;          // projected total debt on day 1
    end: number;            // projected total debt at month close
    zeroDay: number | null; // day the debt reaches $0 (freedom month only)
}

const key = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
export const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

/** Months from `today`'s month to the freedom month, plus one all-green month after it. */
export function buildMonths(timeline: TimelinePoint[], currentDebt: number, today: Date = new Date()): CalendarMonth[] {
    const closes = new Map<string, number>();
    for (const p of timeline) {
        const [y, m] = p.date.split('-').map(Number);
        closes.set(key(y, m - 1), Math.max(0, Number(p.total_balance) || 0));
    }
    const out: CalendarMonth[] = [];
    let y = today.getFullYear();
    let m = today.getMonth();
    let start = Math.max(0, currentDebt);
    let prevPace = 0;
    for (let guard = 0; guard < 600; guard++) {
        const end = closes.has(key(y, m)) ? closes.get(key(y, m))! : (out.length === 0 ? start : 0);
        let zeroDay: number | null = null;
        if (start > 0 && end <= 0) {
            // Estimate the $0 day from last month's pace (falls back to month end)
            const pace = prevPace > 0 ? prevPace : start;
            zeroDay = Math.min(daysIn(y, m), Math.max(1, Math.ceil((start / pace) * daysIn(y, m))));
        }
        out.push({ year: y, month: m, start, end, zeroDay });
        if (start <= 0 && end <= 0) break; // the all-green month after freedom
        prevPace = Math.max(0, start - end);
        start = end;
        m += 1;
        if (m > 11) { m = 0; y += 1; }
    }
    return out;
}

/** Projected total debt on `day` (1-based) of `mo`. */
export function debtOn(mo: CalendarMonth, day: number): number {
    const n = daysIn(mo.year, mo.month);
    if (mo.zeroDay) {
        if (day >= mo.zeroDay) return 0;
        return mo.start * (1 - (day - 1) / Math.max(1, mo.zeroDay - 1));
    }
    if (mo.start === mo.end) return mo.start;
    return mo.start + (mo.end - mo.start) * ((day - 1) / Math.max(1, n - 1));
}

/** Red (high debt) → orange → yellow → green ($0), as in the approved preview. */
export function debtColor(debt: number, maxDebt: number): { background: string; color: string; fontWeight: number } {
    const t = maxDebt > 0 ? Math.max(0, Math.min(1, debt / maxDebt)) : 0;
    const stops: [number, number, number, number][] = [
        [0, 52, 211, 153], [0.3, 251, 191, 36], [0.55, 249, 115, 22], [0.8, 248, 113, 113], [1, 220, 38, 38],
    ];
    let rgb = [220, 38, 38];
    for (let i = 0; i < stops.length - 1; i++) {
        if (t <= stops[i + 1][0]) {
            const f = (t - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
            rgb = [1, 2, 3].map((k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f));
            break;
        }
    }
    const [r, g, b] = rgb;
    if (t <= 0.12) return { background: `rgb(${r},${g},${b})`, color: '#052E1B', fontWeight: 700 };
    if (t <= 0.38) return { background: `rgb(${r},${g},${b})`, color: '#3A2A02', fontWeight: 600 };
    return { background: `rgba(${r},${g},${b},${(0.3 + 0.62 * t).toFixed(2)})`, color: '#F8FAFC', fontWeight: 500 };
}

export interface IncomeItem {
    frequency: string; day_of_month?: number | null; day_of_week?: number | null;
    date_specific_1?: number | null; date_specific_2?: number | null; month_of_year?: number | null;
    is_income?: boolean; category?: string; name?: string; amount?: number | string; is_debt_virtual?: boolean;
}

// Same biweekly epoch as the backend (_item_triggers): Monday 2024-01-01.
// Pure calendar days in UTC, so daylight-saving shifts never flip the parity.
const BIWEEKLY_EPOCH_UTC = Date.UTC(2024, 0, 1);
const calendarDaysSinceEpoch = (date: Date) =>
    Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - BIWEEKLY_EPOCH_UTC) / 864e5);

/** Does a recurring cashflow item fall on `date`? Mirrors backend cashflow._item_triggers
 *  (day_of_week: 0 = Monday). */
export function occursOn(it: IncomeItem, date: Date): boolean {
    const d = date.getDate();
    const n = daysIn(date.getFullYear(), date.getMonth());
    const mondayFirst = (date.getDay() + 6) % 7;
    switch (it.frequency) {
        case 'monthly': return d === Math.min(it.day_of_month || 1, n);
        case 'semi_monthly': return d === Math.min(it.date_specific_1 || 15, n) || d === Math.min(it.date_specific_2 || 30, n);
        case 'weekly': return mondayFirst === (it.day_of_week ?? 4);
        case 'biweekly': return mondayFirst === (it.day_of_week ?? 4)
            && Math.floor(calendarDaysSinceEpoch(date) / 7) % 2 === 0;
        case 'annually': return date.getMonth() + 1 === (it.month_of_year || 1) && d === (it.day_of_month || 1);
        default: return false;
    }
}

const isIncome = (it: IncomeItem) => !!(it.is_income || it.category === 'income');

/** Paydays in a month from the user's income cashflow. */
export function paydaysIn(year: number, month: number, income: IncomeItem[]): Set<number> {
    const days = new Set<number>();
    for (const it of income) {
        if (!isIncome(it)) continue;
        for (let d = 1; d <= daysIn(year, month); d++) if (occursOn(it, new Date(year, month, d))) days.add(d);
    }
    return days;
}

// ── Day detail (the popup when you tap a day) ────────────────

export interface DayLine { name: string; amount: number }
export interface DayCut { name: string; balance: number }
export interface DayDebt { name: string; type: string; balance: number | string; min_payment: number | string; due_day?: number | null; closing_day?: number | null }

export interface DaySub { id: number; name: string; amount: number; logo_url: string | null; account_name: string | null }
type SubLike = Pick<RecurringSub, 'id' | 'name' | 'amount' | 'logo_url' | 'account_name' | 'status' | 'frequency' | 'next_charge_date'>;

export interface DayDetail {
    date: Date;
    projected: number;      // interpolated projection (label it "Proyección")
    incoming: DayLine[];    // COBRAS: income that lands that day
    expenses: DayLine[];    // TE COBRAN: bills that day
    minimums: DayLine[];    // TE COBRAN: minimum payments due that day
    subscriptions: DaySub[]; // TE COBRAN: active subscriptions charged that day (real charges)
    cuts: DayCut[];         // TE COBRAN: cards that close that day (target: report $0)
    totalIn: number;        // = Σ incoming
    totalOut: number;       // = Σ expenses + Σ minimums + Σ subscriptions (a cut is a target, not a charge)
}

const num = (v: unknown) => Number(v) || 0;
const dayMatches = (day: number | null | undefined, date: Date) =>
    !!day && date.getDate() === Math.min(day, daysIn(date.getFullYear(), date.getMonth()));

/** Everything that happens on one day, from the same summary the screens use. */
export function buildDayDetail(date: Date, months: CalendarMonth[], cashflow: IncomeItem[], debts: DayDebt[], subs: SubLike[] = []): DayDetail {
    const mo = months.find((m) => m.year === date.getFullYear() && m.month === date.getMonth());
    const real = cashflow.filter((it) => !it.is_debt_virtual); // virtual debt rows are the minimums below
    const incoming = real.filter((it) => isIncome(it) && occursOn(it, date)).map((it) => ({ name: it.name ?? '', amount: num(it.amount) }));
    const expenses = real.filter((it) => !isIncome(it) && occursOn(it, date)).map((it) => ({ name: it.name ?? '', amount: num(it.amount) }));
    const open = debts.filter((a) => a.type === 'debt' && num(a.balance) > 0);
    const minimums = open.filter((a) => dayMatches(a.due_day, date) && num(a.min_payment) > 0)
        .map((a) => ({ name: a.name, amount: num(a.min_payment) }));
    const cuts = open.filter((a) => dayMatches(a.closing_day, date)).map((a) => ({ name: a.name, balance: num(a.balance) }));
    const subscriptions = subsOn(subs, date).map((x) => ({ id: x.id, name: x.name, amount: num(x.amount), logo_url: x.logo_url, account_name: x.account_name }));
    const sum = (xs: DayLine[]) => Math.round(xs.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    return {
        date, projected: mo ? debtOn(mo, date.getDate()) : 0,
        incoming, expenses, minimums, subscriptions, cuts,
        totalIn: sum(incoming), totalOut: sum([...expenses, ...minimums, ...subscriptions]),
    };
}
