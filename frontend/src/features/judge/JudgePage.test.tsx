import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const apiFetch = vi.fn();
// Swappable so a rejection can bypass the spy (its result tracking re-raises rejections)
let impl: (...a: unknown[]) => unknown = (...a) => apiFetch(...a);
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => impl(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));

import JudgePage from './JudgePage';
import { verdictOf } from './verdict';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
beforeEach(() => { apiFetch.mockReset(); impl = (...a) => apiFetch(...a); });
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

async function judge(amount: string, label = '') {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<JudgePage />));
    const set = (sel: string, v: string) => {
        const el = host!.querySelector<HTMLInputElement>(sel)!;
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
        el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    await act(async () => { set('[data-testid="judge-amount"]', amount); set('[data-testid="judge-label"]', label); });
    await act(async () => { host!.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
const base = { message: 'English message that must never show', debug: { baseline_months: 20 } };

describe('Juez de compras — veredicto', () => {
    it('delay: hero in months, days + estimated interest, freedom month → month, "Tú decides."', async () => {
        apiFetch.mockResolvedValue({ ...base, days_delayed: 60, months_delayed: 2, cost_in_interest: 84.5, freedom_date_baseline: '2027-06-01', freedom_date_impact: '2027-08-01' });
        const el = await judge('1500', 'Laptop');
        expect(apiFetch).toHaveBeenCalledWith('/api/simulator/time-cost', { method: 'POST', body: JSON.stringify({ amount: 1500 }) });
        const v = el.querySelector('[data-testid="verdict-delay"]')!;
        expect(v.textContent).toContain('+2 meses');
        expect(v.textContent).toContain('≈ +60 días · $84.50 más de interés (estimado)');
        expect(v.textContent).toMatch(/Tu libertad: junio de 2027 → agosto de 2027/);
        expect(v.textContent).toContain('Laptop · $1500.00');
        expect(v.textContent).toContain('Tú decides.');
        expect(el.textContent).not.toContain('English message');
    });

    it('singular: "+1 mes"', async () => {
        apiFetch.mockResolvedValue({ ...base, days_delayed: 30, months_delayed: 1, cost_in_interest: 1, freedom_date_baseline: '2027-01-01', freedom_date_impact: '2027-02-01' });
        const el = await judge('100');
        expect(el.querySelector('[data-testid="verdict-delay"]')!.textContent).toMatch(/\+1 mes(?!es)/);
    });

    it('absorbed: delay 0 with debts', async () => {
        apiFetch.mockResolvedValue({ ...base, days_delayed: 0, months_delayed: 0, cost_in_interest: 3, freedom_date_baseline: '2027-06-01', freedom_date_impact: '2027-06-01' });
        const el = await judge('20');
        expect(el.querySelector('[data-testid="verdict-absorbed"]')!.textContent).toContain('Tu plan lo absorbe: $0 días extra.');
        expect(el.textContent).toContain('Tú decides.');
    });

    it('free: no active debts', async () => {
        apiFetch.mockResolvedValue({ days_delayed: 0, cost_in_interest: 0, freedom_date_baseline: null, freedom_date_impact: null, message: 'No active debts' });
        const el = await judge('300');
        expect(el.querySelector('[data-testid="verdict-free"]')!.textContent).toContain('Compra libre: no tienes deudas que retrasar.');
    });

    it('out of scale: never paints +9999 days', async () => {
        apiFetch.mockResolvedValue({ ...base, days_delayed: 9999, months_delayed: 999, cost_in_interest: 5000, freedom_date_baseline: '2030-01-01', freedom_date_impact: '2076-01-01' });
        const el = await judge('90000');
        expect(el.querySelector('[data-testid="verdict-broken"]')!.textContent).toContain('Esta compra rompe tu plan');
        expect(el.textContent).not.toMatch(/9999|999 meses/);
        expect(verdictOf({ days_delayed: 0, months_delayed: 0, cost_in_interest: 0, freedom_date_baseline: '2076-01-01', freedom_date_impact: '2076-01-01', debug: { baseline_months: 600 } }).kind).toBe('broken');
    });

    it('a 400 from the server reads in plain Spanish', async () => {
        let calls = 0;
        impl = async () => { calls += 1; throw Object.assign(new Error('Amount must be positive.'), { status: 400 }); };
        const el = await judge('5');
        expect(el.querySelector('[data-testid="judge-error"]')!.textContent).toBe('Ese monto no se puede juzgar: tiene que ser mayor que $0.');
        expect(el.textContent).not.toContain('Amount must be positive');
        expect(calls).toBe(1);
    });

    it('amount ≤ 0 is stopped before calling the server', async () => {
        const el = await judge('0');
        expect(apiFetch).not.toHaveBeenCalled();
        expect(el.querySelector('[data-testid="judge-error"]')!.textContent).toContain('mayor que $0');
    });
});
