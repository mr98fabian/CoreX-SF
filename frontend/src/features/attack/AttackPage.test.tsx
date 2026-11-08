import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({
        loading: false, error: null, reload: vi.fn(), path: null,
        debts: [{ name: 'Visa', stage: 'debt' }],
        staged: [{ name: 'Checking', type: 'checking', bal: 2000 }],
    }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import AttackPage from './AttackPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter><AttackPage /></MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
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

    it('shows each debt daily cost from the command center next to its APR', async () => {
        vi.mocked(apiFetch).mockResolvedValue({ morning_briefing: null, ...METER });
        const el = await render();
        expect(el.querySelector('[data-testid="daily-cost"]')?.textContent).toBe(' · te cobra $1.97/día');
    });
});
