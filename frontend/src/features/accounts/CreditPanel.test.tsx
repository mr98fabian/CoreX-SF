import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n}`, formatDateShort: (d: string) => d }) }));
vi.mock('@/hooks/useJustPaid', () => ({ useJustPaid: () => new Set() }));
const debt = (id: number, name: string, extra: object) => ({
    id, name, type: 'debt', debt_subtype: 'credit_card', bal: 1000, balance: 1000, interest_rate: 20, min_payment: 50,
    stage: 'debt', paid: null, ...extra,
});
const STAGED = [debt(1, 'Chase', { credit_limit: '8000.00' }), debt(2, 'Amex Gold', { credit_limit: '0.00' })];
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({ loading: false, error: null, reload: vi.fn(), staged: STAGED, debts: STAGED, totalDebt: 2000, liquid: 500, accounts: [], counts: { debt: 2, almost: 0, paid: 0 } }),
}));
let panel: object = {};
vi.mock('@/lib/api', () => ({
    apiFetch: vi.fn(async (p: string) => {
        if (p === '/api/accounts/credit-panel') return panel;
        if (p === '/api/cuts') return { streaks: {} };
        return { transactions: [] };
    }),
}));

import AccountsStagePage from './AccountsStagePage';
import { UsageBar } from './CreditPanel';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ACTIVE = {
    active: true, limite_total: 8000, usado: 1000, disponible: 7000, utilizacion_global: 12.5, banda_global: 'mid',
    por_tarjeta: { 1: { pct: 12.5, banda: 'mid' } }, sin_limite: [2],
    nota: 'Utilización actual estimada; el buró ve el saldo que tu tarjeta reporta, normalmente el del corte.',
};

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Panel de crédito en Cuentas', () => {
    it('shows "Tu crédito" with the engine figures, the honest note and per-card usage', async () => {
        panel = ACTIVE;
        const el = await render(<AccountsStagePage />);
        const block = el.querySelector('[data-testid="credit-panel"]')!;
        expect(block.textContent).toContain('$7000');
        expect(block.textContent).toContain('$8000');
        expect(block.textContent).toContain('12.5%');
        expect(block.textContent).toContain('el buró ve el saldo que tu tarjeta reporta');
        expect(el.querySelectorAll('[data-testid="usage-bar"]')).toHaveLength(2); // global + Chase
        expect(el.textContent).toContain('Sin límite preestablecido'); // Amex row
    });

    it('has no block when there is no card with a limit', async () => {
        panel = { ...ACTIVE, active: false, por_tarjeta: {}, utilizacion_global: null, banda_global: null };
        const el = await render(<AccountsStagePage />);
        expect(el.querySelector('[data-testid="credit-panel"]')).toBeNull();
    });

    it('over 100% fills the bar in the high band without overflowing', async () => {
        const el = await render(<UsageBar pct={120} band="high" es />);
        const fill = el.querySelector('[data-testid="usage-bar"] span span') as HTMLElement;
        expect(fill.style.width).toBe('100%');
        expect(el.querySelector('[data-band="high"]')).not.toBeNull();
        expect(el.textContent).toContain('120%');
    });

    it('the detail sheet never shows "Límite $0"', async () => {
        panel = ACTIVE;
        const el = await render(<AccountsStagePage />);
        const amex = [...el.querySelectorAll('button, [role="button"]')].find((b) => b.textContent?.includes('Amex Gold')) as HTMLElement;
        await act(async () => { amex.click(); await new Promise((r) => setTimeout(r, 0)); });
        expect(document.body.textContent).not.toContain('$0.00');
        expect(document.body.textContent).not.toMatch(/Límite\s*\$0/);
        expect(document.body.textContent).toContain('Sin límite preestablecido');
    });
});
