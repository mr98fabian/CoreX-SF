import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/components/kx/motion', () => ({ MoneyCount: ({ value }: { value: number }) => <b>${value.toFixed(2)}</b> }));

import { DailyInterestLine, type InterestPeriods } from './DailyInterestLine';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const P: InterestPeriods = { dia: 18.47, semana: 129.29, mes: 561.8, anio: 6741.55 };
let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(node));
    return host;
}
beforeEach(() => localStorage.clear());
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });
const state = (el: HTMLElement) => el.querySelector('[data-testid="daily-interest"]')?.getAttribute('data-state') ?? null;

describe('Interés diario en Inicio', () => {
    it('does not exist without debt accounts', async () => {
        expect(state(await render(<DailyInterestLine es periods={P} debtBalances={[]} />))).toBeNull();
    });

    it('charging: shows the daily figure, the labels and "baja con cada pago"', async () => {
        const el = await render(<DailyInterestLine es periods={P} debtBalances={[5000, 0]} />);
        expect(state(el)).toBe('charging');
        expect(el.textContent).toContain('Hoy tu deuda te cobra $18.47');
        expect(el.textContent).toContain('estimado, al ritmo de hoy');
        expect(el.textContent).toContain('baja con cada pago');
    });

    it('promo 0%: neutral line, never a celebration while owing', async () => {
        const el = await render(<DailyInterestLine es periods={{ dia: 0, semana: 0, mes: 0, anio: 0 }} debtBalances={[3000]} />);
        expect(state(el)).toBe('promo');
        expect(el.textContent).toContain('Hoy tu deuda no te cobra interés');
        expect(el.textContent).toContain('Tus saldos están al 0% por ahora');
        expect(el.textContent).not.toContain('ya no te cobra nada');
    });

    it('all debt accounts at $0: celebration', async () => {
        const el = await render(<DailyInterestLine es periods={{ dia: 0, semana: 0, mes: 0, anio: 0 }} debtBalances={[0, 0]} />);
        expect(state(el)).toBe('free');
        expect(el.textContent).toContain('Tu deuda ya no te cobra nada al día');
    });

    it('the selector shows the engine period and remembers it', async () => {
        const el = await render(<DailyInterestLine es periods={P} debtBalances={[5000]} />);
        const week = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Semana')!;
        await act(async () => week.click());
        expect(el.textContent).toContain('Esta semana tu deuda te cobra $129.29');
        expect(localStorage.getItem('kx-interest-period')).toBe('semana');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        const again = await render(<DailyInterestLine es periods={P} debtBalances={[5000]} />);
        expect(again.textContent).toContain('Esta semana');
    });
});
