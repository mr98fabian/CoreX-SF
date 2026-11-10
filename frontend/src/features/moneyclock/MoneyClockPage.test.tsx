import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import pageSrc from './MoneyClockPage.tsx?raw';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));

import MoneyClockPage from './MoneyClockPage';
import { perHour, perPeriod } from '@/lib/moneyClock';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={qc}><MemoryRouter><MoneyClockPage /></MemoryRouter></QueryClientProvider>));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
beforeEach(() => apiFetch.mockReset());
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

// The mission's example: earn 9,500 · spend 4,500 · left 5,000 a month
const EXAMPLE = { income_monthly: 9500, expenses_monthly: 4000, debt_payments_monthly: 500, outflow_monthly: 4500, surplus_monthly: 5000, balance_monthly: 5000, has_income: true };
const row = (el: Element, k: string) => el.querySelector(`[data-testid="row-${k}"]`)!.textContent;

describe('Reloj de dinero', () => {
    it('conversions are pinned: per day ≈ 312/148/164, per hour ≈ 13.01/6.16/6.85', () => {
        expect(perPeriod(9500, 'day')).toBeCloseTo(312.33, 2);
        expect(perPeriod(4500, 'day')).toBeCloseTo(147.95, 2);
        expect(perPeriod(5000, 'day')).toBeCloseTo(164.38, 2);
        expect(perHour(9500)).toBeCloseTo(13.01, 2);
        expect(perHour(4500)).toBeCloseTo(6.16, 2);
        expect(perHour(5000)).toBeCloseTo(6.85, 2);
        expect(perPeriod(5000, 'week')).toBeCloseTo(1153.85, 2);
        expect(perPeriod(5000, 'year')).toBe(60000);
    });

    it('reads only /api/cashflow/summary; the hero says what is left per day, in amber', async () => {
        apiFetch.mockResolvedValue(EXAMPLE);
        const el = await render();
        expect(apiFetch.mock.calls.map((c) => c[0])).toEqual(['/api/cashflow/summary']);
        expect(el.querySelector('[data-testid="clock-hero"]')!.textContent).toBe('Te sobran');
        expect(el.textContent).toContain('$164.38');
        expect(el.textContent).toContain('al ritmo de este mes');
        expect(row(el, 'earn')).toContain('$312.33');
        expect(row(el, 'spend')).toContain('$147.95');
        expect(row(el, 'left')).toContain('$164.38');
        const hour = el.querySelector('[data-testid="clock-hour"]')!.textContent;
        expect(hour).toContain('$13.01');
        expect(hour).toContain('$6.16');
        expect(hour).toContain('$6.85');
    });

    it('the selector changes the three numbers together', async () => {
        apiFetch.mockResolvedValue(EXAMPLE);
        const el = await render();
        for (const [p, earn, spend, left] of [['week', '$2192.31', '$1038.46', '$1153.85'], ['month', '$9500.00', '$4500.00', '$5000.00'], ['year', '$114000.00', '$54000.00', '$60000.00']]) {
            await act(async () => el.querySelector<HTMLButtonElement>(`[data-testid="period-${p}"]`)!.click());
            expect([row(el, 'earn'), row(el, 'spend'), row(el, 'left')].map((t) => t!.replace(/^[^$]*/, ''))).toEqual([earn, spend, left]);
        }
    });

    it('a short month says "Te falta" from the unfloored balance, in debt red', async () => {
        apiFetch.mockResolvedValue({ ...EXAMPLE, outflow_monthly: 10100, surplus_monthly: 0, balance_monthly: -600 });
        const el = await render();
        expect(el.querySelector('[data-testid="clock-hero"]')!.textContent).toBe('Te falta');
        expect(el.querySelector('[data-testid="clock-hero"]')!.className).toContain('text-kx-debt');
        expect(row(el, 'left')).toContain('Te falta');
        expect(row(el, 'left')).toContain(`$${(600 * 12 / 365).toFixed(2)}`);
    });

    it('no income: honest empty state that leads to Cuentas → Gestionar, no invented figures', async () => {
        apiFetch.mockResolvedValue({ income_monthly: 0, expenses_monthly: 900, debt_payments_monthly: 0, outflow_monthly: 900, surplus_monthly: null, balance_monthly: -900, has_income: false });
        const el = await render();
        expect(el.querySelector('[data-testid="clock-empty"]')).not.toBeNull();
        expect(el.querySelector('[data-testid="clock"]')).toBeNull();
        expect(el.querySelector('a[href="/dashboard/accounts/manage"]')).not.toBeNull();
        expect(el.textContent).not.toMatch(/\$-|Te falta|\$0\.00/);
    });

    it('green (kx-paid) is not used on this screen', () => {
        expect(pageSrc.replace(/^\s*\*.*$/gm, '')).not.toContain('kx-paid');
    });
});
