import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));

import { CashflowManager } from './CashflowManager';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('CashflowManager totals come from /api/cashflow/summary', () => {
    it('shows the engine totals, not a frontend frequency table', async () => {
        // An item that the old table would have turned into 300 × 4.345 = $1,303.50
        const items = [{ id: 1, name: 'Freelance', amount: 300, category: 'income', frequency: 'weekly', day_of_month: 1, is_variable: false }];
        const summary = { income_monthly: 1300, expenses_monthly: 200, debt_payments_monthly: 100, outflow_monthly: 300, surplus_monthly: 1000, balance_monthly: 1000, has_income: true };
        apiFetch.mockImplementation(async (url: string) => (url === '/api/cashflow/summary' ? summary : url === '/api/cashflow' ? items : null));
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
        await act(async () => root.render(<QueryClientProvider client={qc}><CashflowManager /></QueryClientProvider>));
        await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
        expect(apiFetch.mock.calls.map((c) => c[0])).toContain('/api/cashflow/summary');
        expect(host.querySelector('[data-testid="cf-income"]')!.textContent).toBe('$1,300.00');
        expect(host.querySelector('[data-testid="cf-expenses"]')!.textContent).toBe('$300.00');
        expect(host.querySelector('[data-testid="cf-surplus"]')!.textContent).toBe('$1,000.00');
        expect(host.textContent).not.toContain('1,303.50');
    });
});
