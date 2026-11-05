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

export interface IncomeItem { frequency: string; day_of_month?: number | null; day_of_week?: number | null; is_income?: boolean; category?: string }

/** Paydays in a month from the user's income cashflow (day_of_week: 0 = Monday). */
export function paydaysIn(year: number, month: number, income: IncomeItem[]): Set<number> {
    const days = new Set<number>();
    const n = daysIn(year, month);
    const epoch = new Date(2024, 0, 1); // same biweekly epoch as the backend
    for (const it of income) {
        if (!(it.is_income || it.category === 'income')) continue;
        for (let d = 1; d <= n; d++) {
            const date = new Date(year, month, d);
            const mondayFirst = (date.getDay() + 6) % 7;
            if (it.frequency === 'monthly' && d === Math.min(it.day_of_month || 1, n)) days.add(d);
            if (it.frequency === 'weekly' && mondayFirst === (it.day_of_week ?? 4)) days.add(d);
            if (it.frequency === 'biweekly' && mondayFirst === (it.day_of_week ?? 4)
                && Math.floor((date.getTime() - epoch.getTime()) / (7 * 864e5)) % 2 === 0) days.add(d);
        }
    }
    return days;
}
