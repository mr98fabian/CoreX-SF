/**
 * Reloj de dinero: the ONE place that turns a monthly figure into another period.
 * Monthly totals come from GET /api/cashflow/summary (the engine); these are just
 * calendar conversions. The hour uses the whole month (÷730), never working hours.
 */
export type Period = 'day' | 'week' | 'month' | 'year';

export const DAYS_PER_MONTH = 365 / 12;   // 30.4167
export const WEEKS_PER_MONTH = 52 / 12;   // 4.3333
export const HOURS_PER_MONTH = 730;       // 8,760 h a year / 12

const FACTOR: Record<Period, number> = {
    day: 1 / DAYS_PER_MONTH,
    week: 12 / 52,
    month: 1,
    year: 12,
};

/** Monthly → period. */
export function perPeriod(monthly: number, period: Period): number {
    return monthly * FACTOR[period];
}

/** Monthly → per hour of the whole month (÷730). */
export function perHour(monthly: number): number {
    return monthly / HOURS_PER_MONTH;
}

export interface CashflowSummary {
    income_monthly: number;
    expenses_monthly: number;
    debt_payments_monthly: number;
    outflow_monthly: number;
    surplus_monthly: number | null;
    balance_monthly: number;
    has_income: boolean;
}
