import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import AnalyticsPage from './AnalyticsPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Análisis', () => {
    it('speaks Spanish and shows the data the three endpoints return', async () => {
        vi.mocked(apiFetch).mockImplementation(async (url: string) => {
            if (url.endsWith('/summary')) return { avg_monthly_spending: 166.83, total_3m_spending: 500.5, top_category: 'Uncategorized', top_category_amount: 300, transaction_count: 3 };
            if (url.endsWith('/spending-by-category')) return { categories: [{ name: 'rent', amount: 300 }] };
            return { trend: [{ month: '2026-11', income: 2400, expense: 120.5, net: 2279.5 }] };
        });
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => root.render(<AnalyticsPage />));
        await act(async () => { await Promise.resolve(); });
        const text = host.textContent!;
        for (const s of ['Análisis', 'Gasto mensual promedio', 'Gasto total (3 meses)', 'Categoría principal', 'Sin categoría',
            'Gasto por categoría', 'Ingresos vs. gastos por mes', 'Ingresos', 'Gastos', '$2279.50 neto', '$500.50']) {
            expect(text).toContain(s);
        }
        expect(text).not.toMatch(/Avg Monthly Spending|Spending by Category|Top Category/);
    });
});
