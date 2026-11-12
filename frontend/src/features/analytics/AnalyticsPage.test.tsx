import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import pageSrc from './AnalyticsPage.tsx?raw';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import AnalyticsPage, { type AnalyticsV2 } from './AnalyticsPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Owner-like v2 response (recurring + subscriptions + debts, zero transactions), as the
// backend contract test produces it: hero = living 1909.88 + subscriptions 49.11
const OWNER: AnalyticsV2 = {
    estado: 'ok', motivo: null, etiqueta: 'estimado',
    heroe: { sale_de_tu_bolsillo: 1958.99 },
    bloque: { entra: 4300, gastos_de_vida: 1909.88, suscripciones: 49.11, pagos_a_deudas: 976.12, te_quedan: 1364.89 },
    en_que_se_va: [
        { nombre: 'Renta', monto: 1200, tipo: 'gasto', pct: 61.3 },
        { nombre: 'Súper', monto: 378.95, tipo: 'gasto', pct: 19.3 },
        { nombre: 'Gasolina', monto: 89.05, tipo: 'gasto', pct: 4.5 },
        { nombre: 'Luz', monto: 93.37, tipo: 'gasto', pct: 4.8 },
        { nombre: 'Celular', monto: 65, tipo: 'gasto', pct: 3.3 },
        { nombre: 'Seguro', monto: 53.52, tipo: 'gasto', pct: 2.7 },
        { nombre: 'Otros', monto: 79.10, tipo: 'otros', pct: 4.0 },
    ],
    deudas: { interes_por_dia: 18.84, objetivo: { nombre: 'Fortiva', apr: 36 }, pagado_este_mes: 420 },
    suscripciones: { activas: 4, total_mensual: 49.11, top_3: [{ nombre: 'Netflix', monto: 15.49 }, { nombre: 'Dominio', monto: 10 }, { nombre: 'iCloud', monto: 2.99 }] },
    duplicados: { cantidad: 0, monto_mensual: 0, servicios: [] },
};

let host: HTMLDivElement | null = null;
let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><AnalyticsPage /></MemoryRouter>));
    await flush();
    return host;
}
const $ = (id: string) => host!.querySelector(`[data-testid="${id}"]`);
const cents = (n: number) => Math.round(n * 100);

beforeEach(() => vi.mocked(apiFetch).mockReset());
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Análisis v2', () => {
    it('reads ONLY /api/analytics/v2 (no transaction endpoints, no engine surplus)', async () => {
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await render();
        expect(vi.mocked(apiFetch).mock.calls.map((c) => c[0])).toEqual(['/api/analytics/v2']);
        const code = pageSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, ''); // comments may name what is NOT used
        expect(code).not.toMatch(/\/api\/analytics\/(summary|spending-by-category|monthly-trend)|surplus/);
    });

    it('hero = living + subscriptions, once, with the estimate chip', async () => {
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await render();
        expect(cents(OWNER.bloque.gastos_de_vida + OWNER.bloque.suscripciones)).toBe(cents(OWNER.heroe.sale_de_tu_bolsillo));
        expect($('analytics-hero')!.textContent).toContain('Sale de tu bolsillo');
        expect($('estimate-chip')!.textContent).toBe('estimado');
        expect($('line-vida')!.textContent).toContain('$1909.88');
        expect($('line-subs')!.textContent).toContain('$49.11');
        // "Te quedan" is the arithmetic of the lines shown
        const b = OWNER.bloque;
        expect(cents(b.entra - b.gastos_de_vida - b.suscripciones - b.pagos_a_deudas)).toBe(cents(b.te_quedan));
        expect($('line-quedan')!.textContent).toContain('$1364.89');
    });

    it('bars are by concept (+ Otros) and add up to the hero exactly', async () => {
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await render();
        const bars = [...host!.querySelectorAll('[data-testid="bar"]')];
        expect(bars.map((b) => b.textContent!.split('$')[0])).toEqual(['Renta', 'Súper', 'Gasolina', 'Luz', 'Celular', 'Seguro', 'Otros']);
        const sum = bars.reduce((s, b) => s + cents(Number(b.getAttribute('data-monto'))), 0);
        expect(sum).toBe(cents(OWNER.heroe.sale_de_tu_bolsillo));
    });

    it('debts: monthly minimums, daily interest, avalanche target, paid this month; subscriptions link', async () => {
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await render();
        expect($('debt-min')!.textContent).toContain('$976.12');
        expect($('debt-daily')!.textContent).toContain('$18.84');
        expect($('debt-target')!.textContent).toContain('Fortiva');
        expect($('debt-paid')!.textContent).toBe('Este mes ya pagaste $420.00 a tus deudas.');
        expect($('analytics-subs')!.textContent).toBe('4 activas · $49.11 al mes');
        expect($('subs-link')!.getAttribute('href')).toBe('/dashboard/subscriptions');
    });

    it('subscriptions show the top 3 by amount; the duplicates note appears only when there is overlap', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ ...OWNER, duplicados: { cantidad: 7, monto_mensual: 1213.86, servicios: [] } });
        await render();
        const top = [...host!.querySelectorAll('[data-testid="subs-top3"] li')].map((li) => li.textContent);
        expect(top).toEqual(['Netflix$15.49', 'Dominio$10.00', 'iCloud$2.99']);
        expect($('dupes-note')!.textContent).toBe('Contamos una sola vez 7 servicios que tienes como gasto y como suscripción ($1213.86 al mes).');
    });

    it('no duplicates note without overlap', async () => {
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await render();
        expect($('dupes-note')).toBeNull();
    });

    it.each([['sin_recurrentes', 'Cargar mis recurrentes'], ['sin_ingresos', 'Agregar mi ingreso'], ['sin_gastos', 'Agregar mis gastos']])(
        'empty (%s): guided state with CTA, never a $0.00', async (motivo, cta) => {
            vi.mocked(apiFetch).mockResolvedValue({ ...OWNER, estado: 'vacio', motivo });
            const el = await render();
            expect($('analytics-empty')).not.toBeNull();
            expect($('analytics-cta')!.textContent).toContain(cta);
            expect($('analytics-cta')!.getAttribute('href')).toBe('/dashboard/accounts/manage');
            expect(el.textContent).not.toContain('$');
        });

    it('endpoint error: retry state, no silent zeros; Reintentar reloads', async () => {
        vi.mocked(apiFetch).mockRejectedValueOnce(new Error('500'));
        const el = await render();
        expect($('analytics-error')).not.toBeNull();
        expect(el.textContent).not.toContain('$');
        vi.mocked(apiFetch).mockResolvedValue(OWNER);
        await act(async () => ($('analytics-retry') as HTMLButtonElement).click());
        await flush();
        expect($('analytics-hero')).not.toBeNull();
        expect(vi.mocked(apiFetch)).toHaveBeenCalledTimes(2);
    });
});
