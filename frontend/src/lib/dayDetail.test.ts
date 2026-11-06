import { describe, it, expect } from 'vitest';
import { buildDayDetail, buildMonths, occursOn, type IncomeItem, type DayDebt } from './calendarSeries';

const NOV = new Date(2026, 10, 4);
const months = buildMonths([{ date: '2026-11-01', total_balance: 34000 }, { date: '2026-12-01', total_balance: 33000 }], 35050, NOV);

// María's world: biweekly paycheck on Fridays, rent on the 1st, weekly groceries on Saturdays
const cashflow: IncomeItem[] = [
    { name: 'Nómina quincenal', amount: 1850, frequency: 'biweekly', day_of_week: 4, is_income: true, category: 'income' },
    { name: 'Renta', amount: 1350, frequency: 'monthly', day_of_month: 1, category: 'expense' },
    { name: 'Supermercado', amount: 120, frequency: 'weekly', day_of_week: 5, category: 'expense' },
    { name: 'Deuda: Tarjeta Visa', amount: 204, frequency: 'monthly', day_of_month: 15, category: 'expense', is_debt_virtual: true },
];
const debts: DayDebt[] = [
    { name: 'Tarjeta Visa', type: 'debt', balance: 6800, min_payment: 204, due_day: 15, closing_day: 8 },
    { name: 'Préstamo del auto', type: 'debt', balance: 16500, min_payment: 385, due_day: 10 },
    { name: 'Tarjeta pagada', type: 'debt', balance: 0, min_payment: 0, due_day: 8, closing_day: 8 },
    { name: 'Cheques', type: 'checking', balance: 2150, min_payment: 0 },
];
const sumOf = (xs: { amount: number }[]) => xs.reduce((s, x) => s + x.amount, 0);

describe('buildDayDetail', () => {
    it('a payroll Friday shows COBRAS with the paycheck', () => {
        const paydays = [6, 13, 20, 27].map((d) => new Date(2026, 10, d)).filter((d) => occursOn(cashflow[0], d));
        expect(paydays.length).toBe(2); // biweekly: two Fridays of the four
        const day = buildDayDetail(paydays[0], months, cashflow, debts);
        expect(day.incoming).toEqual([{ name: 'Nómina quincenal', amount: 1850 }]);
        expect(day.totalIn).toBe(1850);
    });

    it('day 8 shows the Visa cut with its current balance (and skips paid-off cards)', () => {
        const day = buildDayDetail(new Date(2026, 10, 8), months, cashflow, debts);
        expect(day.cuts).toEqual([{ name: 'Tarjeta Visa', balance: 6800 }]);
        expect(day.totalOut).toBe(0); // a cut is a target to report $0, not a charge
    });

    it('a due day shows the minimum — counted once, not again from the virtual cashflow row', () => {
        const day = buildDayDetail(new Date(2026, 10, 15), months, cashflow, debts);
        expect(day.minimums).toEqual([{ name: 'Tarjeta Visa', amount: 204 }]);
        expect(day.expenses).toEqual([]);
        expect(day.totalOut).toBe(204);
    });

    it('an empty day has nothing in and nothing out', () => {
        const day = buildDayDetail(new Date(2026, 10, 18), months, cashflow, debts);
        expect([day.incoming, day.expenses, day.minimums, day.cuts].every((l) => l.length === 0)).toBe(true);
        expect(day.totalIn).toBe(0);
        expect(day.totalOut).toBe(0);
    });

    it('totals always add up to the lists', () => {
        for (let d = 1; d <= 30; d++) {
            const day = buildDayDetail(new Date(2026, 10, d), months, cashflow, debts);
            expect(day.totalIn).toBeCloseTo(sumOf(day.incoming), 2);
            expect(day.totalOut).toBeCloseTo(sumOf(day.expenses) + sumOf(day.minimums), 2);
        }
    });

    it('rent on the 1st and the projection come from the same series', () => {
        const day = buildDayDetail(new Date(2026, 10, 1), months, cashflow, debts);
        expect(day.expenses).toEqual([{ name: 'Renta', amount: 1350 }]);
        expect(day.projected).toBe(35050);
    });
});

describe('biweekly parity across daylight saving', () => {
    it('a Friday biweekly paycheck still lands on Fridays in June 2026 (DST), in step with November', () => {
        const june = Array.from({ length: 30 }, (_, i) => new Date(2026, 5, i + 1)).filter((d) => occursOn(cashflow[0], d));
        expect(june.map((d) => d.getDate())).toEqual([5, 19]); // 14-day steps back from Nov 6
        expect(june.every((d) => d.getDay() === 5)).toBe(true);
    });
});
