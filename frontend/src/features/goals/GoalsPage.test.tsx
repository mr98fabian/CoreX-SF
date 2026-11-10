import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import pageSrc from './GoalsPage.tsx?raw';
import houseSrc from '@/features/home/HouseModule.tsx?raw';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));

import GoalsPage from './GoalsPage';
import { HouseModule } from '@/features/home/HouseModule';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
const tick = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function render(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    await tick();
    return host;
}
beforeEach(() => apiFetch.mockReset());
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const goal = (over: object) => ({ id: 1, name: 'Viaje', target_amount: 1200, saved_amount: 300, monthly_saving: 150, deadline: null, pct: 25, remaining: 900, completed: false, eta_months: 6, eta_date: '2027-05-09', ...over });
const api = (goals: object[], house: object = { active: false }) => apiFetch.mockImplementation(async (url: string, opts?: { method?: string }) => {
    if (url === '/api/house-goal') return house;
    if (url === '/api/goals' && !opts) return { goals };
    return {};
});
const setValue = (el: HTMLInputElement, v: string) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
};

describe('Metas', () => {
    it('empty: invites to create the first goal; the house card invites to Ajustes #casa', async () => {
        api([]);
        const el = await render(<GoalsPage />);
        expect(el.querySelector('[data-testid="goals-empty"]')!.textContent).toContain('Crear mi primera meta');
        const house = el.querySelector<HTMLAnchorElement>('[data-testid="house-card"]')!;
        expect(house.getAttribute('href')).toBe('/dashboard/settings#casa');
        expect(house.textContent).toContain('Crea tu meta de casa');
    });

    it('with goals: house first with its GoalBar, then each goal with amount, bar and estimated date', async () => {
        api([goal({}), goal({ id: 2, name: 'Fondo', monthly_saving: null, eta_months: null, eta_date: null, pct: 10 })], { active: true, saved: 5000, target: 20000, pct: 25 });
        const el = await render(<GoalsPage />);
        expect(el.querySelector('[data-testid="house-card"]')!.textContent).toContain('$5000.00 de $20000.00');
        expect(el.querySelectorAll('[data-testid="goal-bar"]')).toHaveLength(3);
        const g1 = el.querySelector('[data-testid="goal-1"]')!.textContent;
        expect(g1).toContain('$300.00 de $1200.00');
        expect(g1).toMatch(/A este ritmo: mayo de 2027 \(estimado\)/);
        expect(el.querySelector('[data-testid="goal-2"]')!.textContent).toContain('Sin ritmo definido');
    });

    it('completed: "¡Meta cumplida!" without the savings button', async () => {
        api([goal({ saved_amount: 1200, pct: 100, remaining: 0, completed: true, eta_months: 0 })]);
        const el = await render(<GoalsPage />);
        const card = el.querySelector('[data-testid="goal-1"]')!;
        expect(card.querySelector('[data-testid="goal-done"]')!.textContent).toBe('¡Meta cumplida!');
        expect(card.querySelector('[data-testid="add-savings"]')).toBeNull();
    });

    it('"+ Registrar ahorro" posts to add-savings', async () => {
        api([goal({})]);
        const el = await render(<GoalsPage />);
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="add-savings"]')!.click());
        await act(async () => setValue(el.querySelector<HTMLInputElement>('[data-testid="savings-amount"]')!, '75'));
        await act(async () => { el.querySelector('[data-testid="goal-1"] form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
        await tick();
        expect(apiFetch).toHaveBeenCalledWith('/api/goals/1/add-savings', { method: 'POST', body: JSON.stringify({ amount: 75 }) });
    });

    it('delete asks for confirmation first', async () => {
        api([goal({})]);
        const el = await render(<GoalsPage />);
        await act(async () => el.querySelector<HTMLButtonElement>('[aria-label="Borrar meta"]')!.click());
        expect(apiFetch).not.toHaveBeenCalledWith('/api/goals/1', { method: 'DELETE' });
        expect(el.querySelector('[data-testid="confirm-delete"]')!.textContent).toContain('No se puede deshacer');
        await act(async () => el.querySelector<HTMLButtonElement>('[data-testid="confirm-delete-yes"]')!.click());
        await tick();
        expect(apiFetch).toHaveBeenCalledWith('/api/goals/1', { method: 'DELETE' });
    });

    it('no green on this screen, and the goal form has no "casa" option', () => {
        expect(pageSrc.replace(/^\s*\*.*$/gm, '')).not.toMatch(/kx-paid|StageBar|tone="paid"/);
        expect(pageSrc).not.toMatch(/<option[^>]*casa/i);
    });
});

describe('HouseModule (Inicio)', () => {
    it('uses the amber GoalBar, never StageBar (a savings goal does not paint green)', async () => {
        expect(houseSrc).not.toContain('StageBar');
        apiFetch.mockResolvedValue({ active: true, saved: 20000, target: 20000, pct: 100, missing: 0 });
        const el = await render(<HouseModule es />);
        const bar = el.querySelector('[data-testid="goal-bar"]')!;
        expect(bar.getAttribute('aria-valuenow')).toBe('100');
        expect(bar.innerHTML).toContain('bg-kx-amber');
        expect(el.innerHTML).not.toContain('kx-paid');
    });
});
