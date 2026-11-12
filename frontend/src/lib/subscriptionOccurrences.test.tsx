import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => null }));
vi.mock('react-router-dom', () => ({ Link: ({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) => <a href={to} className={className}>{children}</a> }));

import { subOccursOn, subsOn } from './subscriptionOccurrences';
import { toDayDetail } from './calendarEvents';
import { DaySheet } from '@/components/kx/DaySheet';
import type { RecurringSub } from '@/features/subscriptions/subscriptionText';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const sub = (over: Partial<RecurringSub>): RecurringSub => ({
    id: 1, name: 'Netflix', amount: '15.49', frequency: 'monthly', monthly_equivalent: '15.49', next_charge_date: '2026-01-31',
    account_id: 3, account_name: 'Amex Gold 4884', logo_url: null, status: 'active', ...over,
});
const day = (y: number, m: number, d: number) => new Date(y, m, d, 9);

describe('subscription occurrences', () => {
    it('monthly: same day every month, clamped to month end (31 → 28/29/30)', () => {
        const s = sub({ next_charge_date: '2026-01-31' });
        expect(subOccursOn(s, day(2026, 0, 31))).toBe(true);
        expect(subOccursOn(s, day(2026, 1, 28))).toBe(true);  // Feb 2026 (28 days)
        expect(subOccursOn(s, day(2028, 1, 29))).toBe(true);  // leap February
        expect(subOccursOn(s, day(2026, 3, 30))).toBe(true);  // April has 30
        expect(subOccursOn(s, day(2026, 3, 29))).toBe(false);
        expect(subOccursOn(s, day(2026, 4, 31))).toBe(true);
    });

    it('weekly: every 7 days, crossing into the next month', () => {
        const s = sub({ frequency: 'weekly', next_charge_date: '2026-11-24' });
        expect(subOccursOn(s, day(2026, 10, 24))).toBe(true);
        expect(subOccursOn(s, day(2026, 11, 1))).toBe(true);   // Dec 1
        expect(subOccursOn(s, day(2026, 11, 8))).toBe(true);
        expect(subOccursOn(s, day(2026, 10, 17))).toBe(true);  // and a week before
        expect(subOccursOn(s, day(2026, 10, 25))).toBe(false);
    });

    it('annual: only its own date', () => {
        const s = sub({ frequency: 'annual', next_charge_date: '2027-03-15' });
        expect(subOccursOn(s, day(2027, 2, 15))).toBe(true);
        expect(subOccursOn(s, day(2026, 2, 15))).toBe(false);
        expect(subOccursOn(s, day(2027, 3, 15))).toBe(false);
    });

    it('cancelled subscriptions (and undated ones) never appear', () => {
        const subs = [sub({ id: 1, status: 'cancelled' }), sub({ id: 2, next_charge_date: null }), sub({ id: 3, next_charge_date: '2026-01-10' })];
        expect(subsOn(subs, day(2026, 0, 31)).map((s) => s.id)).toEqual([]);
        expect(subsOn(subs, day(2026, 0, 10)).map((s) => s.id)).toEqual([3]);
    });
});

describe('DaySheet with subscriptions', () => {
    let host: HTMLDivElement | null = null;
    let root: Root;
    afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

    it('lists them under "Te cobran" (logo, name, amount, faint card) and adds them to "salen"', () => {
        const date = day(2026, 10, 9);
        // The day as the server sends it (GET /api/calendar/events): the cancelled Spotify never comes
        const n = sub({ id: 7, next_charge_date: '2026-11-09' });
        const detail = toDayDetail({
            dia: 9, fecha: '2026-11-09', marcas: { payday: false, cobro: true, corte: false }, ingresos: [], cortes: [],
            cobros: [{ nombre: 'Renta', monto: 100, tipo: 'gasto' },
                     { nombre: n.name, monto: Number(n.amount), tipo: 'suscripcion', id: n.id, logo_url: n.logo_url, cuenta: n.account_name }],
            total_entra: 0, total_sale: 115.49,
        }, 0);
        expect(date.getDate()).toBe(9);
        expect(detail.subscriptions.map((s) => s.name)).toEqual(['Netflix']);
        expect(detail.totalOut).toBe(115.49);

        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        act(() => root.render(<DaySheet detail={detail} onClose={() => {}} today={date} />));
        const text = document.body.textContent ?? '';
        expect(text).toContain('Te cobran');
        expect(text).toContain('Netflix');
        expect(text).toContain('−$15.49');
        expect(text).toContain('···4884');
        expect(text).not.toContain('Spotify');
        expect(text).toContain('$115.49'); // "salen"
        expect(document.querySelector('a[href="/dashboard/subscriptions"]')).not.toBeNull();
    });
});
