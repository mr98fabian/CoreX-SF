import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({ loading: false, error: null, reload: vi.fn(), path: null, debts: [{ name: 'Visa', stage: 'debt' }], staged: [] }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import AttackPage from './AttackPage';
import { AssumptionsBreakdown } from '@/components/AssumptionsBreakdown';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Suscripciones en el motor — UI', () => {
    it('Plan says so when subscriptions eat the whole surplus (never a silent minimums-only plan)', async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            excedente: { mensual: 0, suscripciones_mensuales: 1500, comido_por_suscripciones: true },
            mision: { mision: null, reserva: 0, ataque: 0, objetivo: 'Visa' }, morning_briefing: null, confidence_meter: { debts_ranked: [] },
        });
        const el = await render(<AttackPage />);
        expect(el.textContent).toContain('Tus suscripciones se comen todo tu excedente');
        expect(el.querySelector('[data-testid="subs-eat-surplus"]')!.textContent).toContain('$1500.00');
    });

    it('no warning when there is surplus left', async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            excedente: { mensual: 300, suscripciones_mensuales: 50, comido_por_suscripciones: false },
            mision: { mision: null, reserva: 0, ataque: 0, objetivo: 'Visa' }, morning_briefing: null, confidence_meter: { debts_ranked: [] },
        });
        const el = await render(<AttackPage />);
        expect(el.querySelector('[data-testid="subs-eat-surplus"]')).toBeNull();
    });

    it('the assumptions panel shows the subscriptions line with the server figure', async () => {
        const el = await render(<AssumptionsBreakdown assumptions={{ extra_monthly_payment: 1350.9, subscriptions_monthly: 63.1 }} />);
        await act(async () => (el.querySelector('button') as HTMLButtonElement).click());
        expect(el.querySelector('[data-testid="assumption-subs"]')!.textContent).toContain('Suscripciones / mes (ya restadas)');
    });
});
