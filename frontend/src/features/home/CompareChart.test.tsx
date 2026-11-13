import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useFormatMoney', () => ({
    useFormatMoney: () => ({ formatMoneyShort: (n: number) => `$${Math.round(n).toLocaleString('en-US')}`, formatMoney: (n: number) => `$${n.toFixed(2)}` }),
}));

import { CompareChart } from './CompareChart';
import type { VelocityCompare } from '@/hooks/useVelocityCompare';
import chartTsx from './CompareChart.tsx?raw';
import textSrc from './compareText.ts?raw';
import homeSrc from './HomePage.tsx?raw';
import hookSrc from '@/hooks/useVelocityCompare.ts?raw';
import rawCss from '@/styles/kx.css?raw';

const chartSrc = chartTsx + textSrc;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const pts = (fechas: string[], saldos: number[]) => saldos.map((saldo, mes) => ({ mes, fecha: mes ? fechas[mes - 1] : '2026-11-12', saldo }));
const months = (n: number) => Array.from({ length: n }, (_, i) => { const d = new Date(2026, 10 + i, 15); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });

function fixture(over: Partial<VelocityCompare> = {}): VelocityCompare {
    const f = months(60);
    return {
        estado: 'ok', etiqueta: 'estimado', deuda_hoy: 18652.61, dominio_meses: 40,
        plan: { meses: 20, anios: 1.7, fecha_libre: '2028-06-01', tope_simulador: false, interes_total: 3120.4, aporte_mensual: 700,
            fuente_aporte: 'excedente', puntos: pts(f, Array.from({ length: 21 }, (_, i) => 18652.61 * (1 - i / 20))) },
        minimos: { meses: 55, anios: 4.6, fecha_libre: '2031-05-01', anio_libre: 2031, tope_simulador: false, cortado: true, interes_total: 9871.12,
            puntos: pts(f, Array.from({ length: 41 }, (_, i) => 18652.61 * (1 - i / 55))) },
        ahorro: { intereses: 6750.72, meses: 35, anios: 2.9, es_minimo: false },
        ...over,
    };
}

let host: HTMLDivElement | null = null;
let root: Root;
async function render(c: VelocityCompare) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><CompareChart data={c} es /></MemoryRouter>));
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });
const q = (el: HTMLElement, id: string) => el.querySelector(`[data-testid="${id}"]`);

describe('Inicio · plan contra solo mínimos', () => {
    it('ok: title, phrase in years from the endpoint fields, two lines, star, note with the contribution', async () => {
        const el = await render(fixture());
        expect(el.textContent).toContain('Tu plan contra pagar solo el mínimo');
        expect(q(el, 'compare-phrase')!.textContent).toBe('Con tu plan sales ≈ 2,9 años antes y te ahorras ≈ $6,751 en intereses (estimado).');
        expect(q(el, 'compare-phrase')!.className).not.toMatch(/font-editorial/);
        expect(q(el, 'line-plan')).not.toBeNull();
        expect(q(el, 'line-minimos')!.getAttribute('stroke-dasharray')).toBeTruthy();
        expect(q(el, 'line-plan')!.getAttribute('stroke-width')).toBe('2.5');
        expect(q(el, 'line-minimos')!.getAttribute('stroke-width')).toBe('1.5');
        expect(el.querySelector('svg [fill]:not([fill="none"])')?.tagName.toLowerCase()).toBe('text'); // no area: only the ★ is filled
        expect(q(el, 'plan-star')).not.toBeNull();
        expect(q(el, 'compare-note')!.textContent).toBe('Solo mínimos: lo que el banco pide cada mes, que baja con el saldo. Plan: tu excedente de $700 al mes más los pagos que se liberan. Estimado.');
        expect(q(el, 'legend-minimos')!.textContent).toContain('sigue hasta 2031');
    });

    it('≤ 24 months saved → months, not years', async () => {
        const el = await render(fixture({ ahorro: { intereses: 812.3, meses: 7, anios: 0.6, es_minimo: false } }));
        expect(q(el, 'compare-phrase')!.textContent).toBe('Con tu plan sales ≈ 7 meses antes y te ahorras ≈ $812 en intereses (estimado).');
    });

    it('simulator cap: "más de X años", never an invented date', async () => {
        const c = fixture();
        c.minimos = { ...c.minimos!, meses: 600, anios: 50, fecha_libre: null, anio_libre: null, tope_simulador: true, cortado: true };
        c.ahorro = { intereses: 41000, meses: 580, anios: 48.3, es_minimo: true };
        const el = await render(c);
        expect(q(el, 'compare-phrase')!.textContent).toBe('Con tu plan sales más de 48,3 años antes y te ahorras más de $41,000 en intereses (estimado).');
        expect(q(el, 'legend-minimos')!.textContent).toContain('más de 50 años');
        expect(el.textContent).not.toMatch(/2076|2075/);
    });

    it('sin_ahorro: one line, same-day phrase, link to recurrentes, no saving phrase', async () => {
        const c = fixture({ estado: 'sin_ahorro', ahorro: { intereses: 0, meses: 0, anios: 0, es_minimo: false } });
        const el = await render(c);
        expect(q(el, 'line-minimos')).toBeNull();
        expect(q(el, 'compare-phrase')!.textContent).toBe('Hoy tu plan y pagar solo el mínimo llegan el mismo día: jun 2028. Si liberas excedente, se adelanta.');
        expect(el.querySelector('a[href="/dashboard/subscriptions"]')).not.toBeNull();
        expect(el.textContent).not.toMatch(/te ahorras/);
    });

    it('scrub: keyboard slider moves the guide and writes the month line', async () => {
        const el = await render(fixture());
        const slider = el.querySelector('[role="slider"]') as HTMLElement;
        expect(slider.style.touchAction).toBe('pan-y');
        expect(slider.getAttribute('aria-valuemax')).toBe('40');
        await act(async () => { slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
        await act(async () => { slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })); });
        expect(q(el, 'scrub-guide')).not.toBeNull();
        const c = fixture();
        expect(q(el, 'scrub-line')!.textContent).toBe(`dic 2026 · con plan ≈ $${Math.round(c.plan!.puntos[2].saldo).toLocaleString('en-US')} · solo mínimos ≈ $${Math.round(c.minimos!.puntos[2].saldo).toLocaleString('en-US')}`);
        await act(async () => { slider.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); });
        expect(slider.getAttribute('aria-valuenow')).toBe('40');
        expect(q(el, 'scrub-line')!.textContent).toContain('con plan ≈ $0');
    });
});

describe('Guardianes', () => {
    it('the client does no arithmetic on any endpoint money/time field', () => {
        const FIELDS = 'saldo|meses|anios|intereses|interes_total|deuda_hoy|aporte_mensual';
        expect(chartSrc).not.toMatch(new RegExp(`\\.(${FIELDS})\\s*[-+*/%]`));
        expect(chartSrc).not.toMatch(new RegExp(`[-+*/%]\\s*\\w+(\\.\\w+)*\\.(${FIELDS})\\b`));
        expect(chartSrc).not.toMatch(/\.reduce\(/);
    });

    it('Inicio no longer asks for the compact calendar; nothing here calls savings-estimate', () => {
        expect(homeSrc).not.toMatch(/DebtCalendar|useCalendarEvents|calendar\/events/);
        for (const src of [chartSrc, homeSrc, hookSrc]) expect(src).not.toContain('savings-estimate');
        expect(hookSrc).toContain("'/api/velocity/compare'");
    });

    it('strokes read ≥ 3:1 on the level-1 card in both themes', () => {
        const css = rawCss.split(String.fromCharCode(13) + String.fromCharCode(10)).join(String.fromCharCode(10));
        const lum = (hex: string) => {
            const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
            return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
        };
        const ratio = (a: string, b: string) => { const [h, l] = [lum(a), lum(b)].sort((x, y) => y - x); return (h + 0.05) / (l + 0.05); };
        const planDark = css.match(/\n\.kx-scope \{ --kx-plan-line: (#[0-9A-F]{6}); \}/)![1];
        const planLight = css.match(/:root:not\(\.dark\) \.kx-scope \{ --kx-plan-line: (#[0-9A-F]{6}); \}/)![1];
        expect([planDark, planLight]).toEqual(['#F59E0B', '#D97706']);
        const themes = [
            { card: '#111C33', strokes: [planDark, '#8C9AB0', '#34D399'] },   // dark: plan, minimums (ink-3), paid green
            { card: '#FFFFFF', strokes: [planLight, '#5F6876', '#047857'] },  // light
        ];
        for (const t of themes) for (const s of t.strokes) expect(ratio(s, t.card), `${s} on ${t.card}`).toBeGreaterThanOrEqual(3);
        // the tokens the chart uses really hold those values
        expect(css).toMatch(/--kx-ink-3: #8C9AB0;/);
        expect(css).toMatch(/--kx-ink-3: #5F6876;/);
        expect(chartSrc).toContain('stroke="var(--kx-ink-3)"');
        expect(chartSrc).toContain('stopColor="var(--kx-paid)"');
    });
});
