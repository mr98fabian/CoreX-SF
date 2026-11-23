import { describe, it, expect } from 'vitest';
import { buildMonths, debtOn, debtColor, paydaysIn } from './calendarSeries';

const NOV = new Date(2026, 10, 4);
const timeline = [
    { date: '2026-11-01', total_balance: 24000 },
    { date: '2026-12-01', total_balance: 18000 },
    { date: '2027-01-01', total_balance: 12000 },
    { date: '2027-02-01', total_balance: 6000 },
    { date: '2027-03-01', total_balance: 0 },
];

describe('buildMonths', () => {
    it('runs from the current month to the freedom month plus one green month', () => {
        const months = buildMonths(timeline, 30000, NOV);
        expect(months.map((m) => `${m.year}-${m.month}`)).toEqual(['2026-10', '2026-11', '2027-0', '2027-1', '2027-2', '2027-3']);
        expect(months[0]).toMatchObject({ start: 30000, end: 24000, zeroDay: null });
        expect(months[1]).toMatchObject({ start: 24000, end: 18000 });
        expect(months.at(-1)).toMatchObject({ start: 0, end: 0, zeroDay: null });
    });

    it('estimates the $0 day inside the freedom month from the previous pace', () => {
        const march = buildMonths(timeline, 30000, NOV)[4];
        // 6000 left at a pace of 6000/month → whole month; day = 31
        expect(march.zeroDay).toBe(31);
        const fast = buildMonths([{ date: '2026-11-01', total_balance: 1000 }, { date: '2026-12-01', total_balance: 0 }], 5000, NOV)[1];
        expect(fast.zeroDay).toBe(Math.ceil((1000 / 4000) * 31)); // 8
    });

    it('handles no debt: a single green month', () => {
        expect(buildMonths([], 0, NOV)).toHaveLength(1);
    });
});

// The engine's own fixture (backend tests/test_daily_series.py::test_zero_day_is_first_zero):
// $1,000 at 0 %, $100 minimum on the 10th, $300 extra over paydays 1 and 15. Step series.
const DAILY = [
    { date: '2026-11-01', total_balance: 1000 }, { date: '2026-11-01', total_balance: 850 },
    { date: '2026-11-10', total_balance: 750 }, { date: '2026-11-15', total_balance: 600 }, { date: '2026-11-30', total_balance: 600 },
    { date: '2026-12-01', total_balance: 450 }, { date: '2026-12-10', total_balance: 350 }, { date: '2026-12-15', total_balance: 200 },
    { date: '2026-12-31', total_balance: 200 },
    { date: '2027-01-01', total_balance: 150 }, { date: '2027-01-10', total_balance: 50 }, { date: '2027-01-15', total_balance: 0 },
    { date: '2027-01-31', total_balance: 0 },
];
const CLOSES = [{ date: '2026-11', total_balance: 600 }, { date: '2026-12', total_balance: 200 }, { date: '2027-01', total_balance: 0 }];

describe('buildMonths with the daily series', () => {
    it('zero day comes from the daily series: the first day it reaches 0, not the pace', () => {
        const daily = buildMonths(CLOSES, 1000, new Date(2026, 10, 1), DAILY);
        const paced = buildMonths(CLOSES, 1000, new Date(2026, 10, 1));
        expect(daily.find((m) => m.zeroDay)).toMatchObject({ year: 2027, month: 0, zeroDay: 15 });
        expect(paced.find((m) => m.zeroDay)!.zeroDay).toBe(16); // what the old estimate said
        expect(daily.filter((m) => m.zeroDay)).toHaveLength(1);
    });

    it('each day is the engine value; month start/end chain and match the monthly closes', () => {
        const months = buildMonths(CLOSES, 1000, new Date(2026, 10, 1), DAILY);
        expect(months.map((m) => `${m.year}-${m.month}`)).toEqual(['2026-10', '2026-11', '2027-0', '2027-1']);
        expect([1, 9, 10, 14, 15, 30].map((d) => debtOn(months[0], d))).toEqual([850, 850, 750, 750, 600, 600]);
        expect(months.slice(0, 3).map((m) => m.end)).toEqual(CLOSES.map((c) => c.total_balance));
        expect(months[0].start).toBe(1000);
        expect(months[1].start).toBe(600);
        expect([1, 10, 14, 15, 31].map((d) => debtOn(months[2], d))).toEqual([150, 50, 50, 0, 0]);
        expect(months.at(-1)).toMatchObject({ start: 0, end: 0, zeroDay: null });
    });

    it('falls back to the interpolation when the series is missing or empty', () => {
        expect(buildMonths(timeline, 30000, NOV, [])).toEqual(buildMonths(timeline, 30000, NOV));
        expect(buildMonths(timeline, 30000, NOV, undefined)[0].days).toBeUndefined();
    });
});

describe('debtOn', () => {
    it('interpolates linearly and is 0 from the zero day on', () => {
        const months = buildMonths([{ date: '2026-11-01', total_balance: 1000 }, { date: '2026-12-01', total_balance: 0 }], 5000, NOV);
        expect(debtOn(months[0], 1)).toBe(5000);
        expect(debtOn(months[0], 30)).toBe(1000);
        expect(debtOn(months[1], months[1].zeroDay!)).toBe(0);
        expect(debtOn(months[1], 31)).toBe(0);
    });
});

describe('debtColor', () => {
    it('is green at $0 and red at the max', () => {
        expect(debtColor(0, 100).background).toBe('rgb(52,211,153)');
        expect(debtColor(100, 100).background).toContain('rgba(220,38,38');
    });
});

describe('paydaysIn', () => {
    it('marks Fridays for a weekly paycheck (day_of_week 4 = Friday)', () => {
        const days = paydaysIn(2026, 10, [{ frequency: 'weekly', day_of_week: 4, is_income: true }]);
        expect([...days]).toEqual([6, 13, 20, 27]);
    });
    it('ignores expenses', () => {
        expect(paydaysIn(2026, 10, [{ frequency: 'weekly', day_of_week: 4, category: 'expense' }]).size).toBe(0);
    });
});
