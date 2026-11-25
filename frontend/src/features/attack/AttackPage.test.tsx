import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({
        loading: false, error: null, reload: vi.fn(),
        // misión 19: the axis places each debt by the server timeline's own payoff event
        path: { timeline: [{ date: '2027-03-01', total_balance: 0, events: ['Visa Paid Off'] }] },
        freedom: { year: 2027, month: 2 },
        debts: [{ name: 'Visa', stage: 'debt', bal: 3000 }],
        staged: [{ name: 'Checking', type: 'checking', bal: 2000 }],
    }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u' } }) }));
// a fresh cache per mount (useCommandCenter is React Query)
const qc = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

import { apiFetch } from '@/lib/api';
import AttackPage from './AttackPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<QueryClientProvider client={qc()}><MemoryRouter><AttackPage /></MemoryRouter></QueryClientProvider>));
    await act(async () => { for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const METER = { confidence_meter: { debts_ranked: [{ name: 'Visa', apr: 24, balance: 3000, is_target: true, daily_cost: 1.97 }], strategy: 'avalanche' } };

describe('Plan de ataque', () => {
    it('falls back to "Hoy no hay ataque" when morning_briefing is null', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ morning_briefing: null, ...METER });
        const el = await render();
        expect(el.textContent).toContain('Hoy no hay ataque');
        expect(el.textContent).not.toContain('No pudimos cargar');
    });

    it('still renders the attack when the briefing has a recommendation', async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            morning_briefing: {
                recommended_action: { amount: 500, destination: 'Visa', destination_balance: 3000, destination_apr: 24, reason: 'Highest APR' },
                impact: { interest_saved_monthly: 10 },
            },
            ...METER,
        });
        const el = await render();
        expect(el.textContent).not.toContain('Hoy no hay ataque');
        expect(el.textContent).toContain('Visa');
    });

    it('the route is the plan line: each debt ends on its month, with its daily cost from the command center (misión 19)', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ morning_briefing: null, ...METER });
        const el = await render();
        const mark = [...el.querySelectorAll('[data-testid="axis-mark"]')].map((m) => m.textContent).find((t) => t?.includes('Visa'));
        expect(mark).toBe('mar 2027 Visa en $0 · te cobra $1.97/día');
        expect(el.querySelector('[data-testid="hero"] .kx-hero-number')!.textContent).toBe('marzo de 2027');
    });
});
