import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import calSrc from './DebtCalendar.tsx?raw';
import seriesSrc from '@/lib/calendarSeries.ts?raw';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { DebtCalendar } from './DebtCalendar';
import { buildMonths } from '@/lib/calendarSeries';
import { toDayDetail, type CalendarDay, type CalendarMonthEvents } from '@/lib/calendarEvents';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = new Date();
const Y = NOW.getFullYear(), M = NOW.getMonth();
const months = buildMonths([{ date: `${Y}-${String(M + 1).padStart(2, '0')}-01`, total_balance: 30000 }], 30000, NOW);
const iso = (d: number) => `${Y}-${String(M + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const n = new Date(Y, M + 1, 0).getDate();

function day(d: number, over: Partial<CalendarDay> = {}): CalendarDay {
    return { dia: d, fecha: iso(d), marcas: { payday: false, cobro: false, corte: false }, ingresos: [], cobros: [], cortes: [], total_entra: 0, total_sale: 0, ...over };
}
// Day 7: payday + charge (AT&T once, as a subscription) + cut with its pay-by date
const busy = day(7, {
    marcas: { payday: true, cobro: true, corte: true },
    ingresos: [{ nombre: 'Nómina', monto: 4500 }],
    cobros: [{ nombre: 'AT&T', monto: 1035.99, tipo: 'suscripcion', id: 3, logo_url: null, cuenta: 'Chase' },
             { nombre: 'Toyota', monto: 641.12, tipo: 'minimo' }],
    cortes: [{ nombre: 'Amex Gold', saldo: 1679.27, pagar_antes_de: iso(5) }],
    total_entra: 4500, total_sale: 1677.11,
});
const EVENTS: CalendarMonthEvents = {
    mes: iso(1).slice(0, 7), dias: Array.from({ length: n }, (_, i) => (i + 1 === 7 ? busy : day(i + 1))),
    total_mes_sale: 1677.11, total_mes_entra: 4500, vacio: false, suscripciones_sin_fecha: 2, deudas_sin_fecha: [], etiqueta: 'estimado',
};

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
beforeEach(() => vi.mocked(apiFetch).mockReset());
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });
const cell = (el: HTMLElement, d: number) => el.querySelector(`[data-day="${d}"]`)!;

describe('Calendario de eventos', () => {
    it('reads the month from the server and paints payday + charge + cut in their fixed places', async () => {
        vi.mocked(apiFetch).mockResolvedValue(EVENTS);
        const el = await render(<DebtCalendar live months={months} maxDebt={30000} />);
        expect(vi.mocked(apiFetch).mock.calls[0][0]).toBe(`/api/calendar/events?month=${EVENTS.mes}`);
        const c = cell(el, 7);
        expect(c.querySelector('[data-testid="payday-mark"]')!.className).toContain('bottom-[4px] left-1/2');
        expect(c.querySelector('[data-testid="charge-mark"]')!.className).toContain('bottom-[5px] right-1.5');
        expect(c.querySelector('[data-testid="cut-mark"]')!.className).toContain('left-1 top-0.5');
        expect(c.querySelector('[data-testid="cut-mark"]')!.textContent).toBe('◆');
        expect(c.getAttribute('aria-label')).toMatch(/día de nómina, día de corte, día de cobro/);
        expect(cell(el, 8).querySelectorAll('[data-testid$="-mark"]')).toHaveLength(0);
    });

    it('month total is the server sum of charges; undated subscriptions are counted with a link', async () => {
        vi.mocked(apiFetch).mockResolvedValue(EVENTS);
        const el = await render(<DebtCalendar live months={months} maxDebt={30000} />);
        expect(el.querySelector('[data-testid="month-charges"]')!.textContent).toContain('$1677.11');
        const sum = busy.cobros.reduce((s, x) => s + Math.round(x.monto * 100), 0);
        expect(sum).toBe(Math.round(EVENTS.total_mes_sale * 100));
        expect(el.querySelector('[data-testid="cal-undated"]')!.textContent).toContain('2 suscripciones sin fecha de cobro · ponles fecha');
    });

    it('tap → the day sheet lists everything, the subscription once, and the cut pay-by date', async () => {
        vi.mocked(apiFetch).mockResolvedValue(EVENTS);
        const el = await render(<DebtCalendar live months={months} maxDebt={30000} />);
        await act(async () => (cell(el, 7) as HTMLButtonElement).click());
        const sheet = document.body.textContent!;
        expect(sheet.match(/AT&T/g)).toHaveLength(1);
        expect(sheet).toContain('Toyota');
        expect(sheet).toContain(`Paga a más tardar el 5 de`);
    });

    it('empty month: no marks, a line and the CTA', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ ...EVENTS, dias: Array.from({ length: n }, (_, i) => day(i + 1)), vacio: true, suscripciones_sin_fecha: 0 });
        const el = await render(<DebtCalendar live months={months} maxDebt={30000} />);
        expect(el.querySelectorAll('[data-testid$="-mark"]')).toHaveLength(0);
        expect(el.querySelector('[data-testid="cal-empty"]')!.textContent).toContain('Aún no hay cobros ni ingresos cargados para este mes');
        expect(el.querySelector('[data-testid="cal-empty"] a')!.getAttribute('href')).toBe('/dashboard/accounts/manage');
    });

    it('compact (Inicio): only payday and ◆, no charge dash', async () => {
        vi.mocked(apiFetch).mockResolvedValue(EVENTS);
        const el = await render(<DebtCalendar compact live months={months} maxDebt={30000} />);
        const c = el.querySelector('[data-day="7"]')!;
        expect(c.querySelector('[data-testid="payday-mark"]')).not.toBeNull();
        expect(c.querySelector('[data-testid="cut-mark"]')).not.toBeNull();
        expect(c.querySelector('[data-testid="charge-mark"]')).toBeNull();
    });

    it('toDayDetail maps the server day to the sheet (subscription kept as such)', () => {
        const d = toDayDetail(busy, 29000);
        expect(d.subscriptions).toEqual([{ id: 3, name: 'AT&T', amount: 1035.99, logo_url: null, account_name: 'Chase' }]);
        expect(d.minimums).toEqual([{ name: 'Toyota', amount: 641.12 }]);
        expect(d.cuts[0].payBy).toBe(iso(5));
        expect(d.totalOut).toBe(1677.11);
    });

    it('guards: no green or red on event marks; the client no longer computes occurrences', () => {
        const marks = calSrc.split('\n').filter((l) => /data-testid="(cut|charge|payday)-mark"/.test(l)).join('\n');
        expect(marks).not.toMatch(/kx-paid|kx-debt|emerald|green|red-|#DC2626|#34D399/);
        expect(seriesSrc).not.toMatch(/export function buildDayDetail|subsOn/);
        expect(calSrc).not.toMatch(/cutDays|chargesIn|dayDetail\?/);
    });
});
