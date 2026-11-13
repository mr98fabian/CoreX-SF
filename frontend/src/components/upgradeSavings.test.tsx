import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), API_BASE: '', ApiError: class extends Error {} }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k, setLanguage: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}`, formatMoneyShort: (n: number) => `$${Math.round(n)}` }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false, user: { id: 'u1', email: 'a@b.c', user_metadata: {} }, signOut: vi.fn() }) }));
vi.mock('@/hooks/useOnboarding', () => ({ useOnboarding: () => ({ restart: vi.fn() }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser: vi.fn() } } }));
vi.mock('@/components/ReferralProgram', () => ({ ReferralProgram: () => null }));
vi.mock('@/components/ConnectAI', () => ({ ConnectAI: () => null }));
vi.mock('@/components/kx/PlanCards', () => ({ PlanCards: () => <div data-testid="plan-cards" /> }));

import UpgradeModal from './UpgradeModal';
import SettingsPage from '@/features/settings/SettingsPage';
import { planSavingsOf } from '@/hooks/usePlanSavings';
import type { VelocityCompare } from '@/hooks/useVelocityCompare';
import upgradeSrc from './UpgradeModal.tsx?raw';
import settingsSrc from '@/features/settings/SettingsPage.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('__APP_VERSION__', 'test'); // Vite define, absent under vitest

const COMPARE: VelocityCompare = {
    estado: 'ok', etiqueta: 'estimado', deuda_hoy: 12000, dominio_meses: 48,
    plan: { meses: 24, anios: 2, fecha_libre: '2028-11-01', tope_simulador: false, interes_total: 2100.5, aporte_mensual: 600, fuente_aporte: 'excedente', puntos: [] },
    minimos: { meses: 140, anios: 11.7, fecha_libre: '2038-07-01', anio_libre: 2038, tope_simulador: false, cortado: false, interes_total: 9850.25, puntos: [] },
    ahorro: { intereses: 7749.75, meses: 116, anios: 9.7, es_minimo: false },
};
const SAVINGS_EST = { has_data: true, total_debt: 12000, daily_interest_all: 7.89, plans: {}, social_proof: { total_accounts_monitored: 3, total_debt_tracked: 12000 } };

let host: HTMLDivElement | null = null;
let root: Root | null = null;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root!.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return document.body;
}
function cleanup() {
    if (root) act(() => root!.unmount());
    root = null;
    host = null;
    document.body.replaceChildren();
}
function serve(compare: VelocityCompare | Error) {
    apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/velocity/compare') {
            if (compare instanceof Error) throw compare;
            return compare;
        }
        if (url === '/api/subscriptions/savings-estimate') return SAVINGS_EST;
        if (url.startsWith('/api/subscriptions/status')) return { plan: 'starter', status: 'free', accounts_limit: 2, source: 'none', checkout_hidden: false };
        return {};
    });
}
beforeEach(() => { apiFetch.mockReset(); window.history.replaceState(null, '', '/'); });
afterEach(cleanup);

describe('planSavingsOf: only real, comparable numbers', () => {
    it('ok → the compare figures as they come', () => {
        expect(planSavingsOf(COMPARE)).toEqual({ interest: 7749.75, planInterest: 2100.5, minimumsInterest: 9850.25, planYears: 2, minimumsYears: 11.7, minimumsCapped: false });
    });
    it('nothing to compare → null (never an invented figure)', () => {
        expect(planSavingsOf(null)).toBeNull();
        expect(planSavingsOf({ ...COMPARE, estado: 'sin_ahorro' })).toBeNull();
        expect(planSavingsOf({ ...COMPARE, estado: 'sin_deudas', plan: null, minimos: null })).toBeNull();
        expect(planSavingsOf({ ...COMPARE, plan: { ...COMPARE.plan!, tope_simulador: true } })).toBeNull();
        expect(planSavingsOf({ ...COMPARE, ahorro: { ...COMPARE.ahorro, intereses: 0 } })).toBeNull();
    });
});

describe('UpgradeModal sells with GET /api/velocity/compare', () => {
    it('with compare data: the real interest saved, labelled estimate', async () => {
        serve(COMPARE);
        const el = await render(<UpgradeModal open onOpenChange={() => undefined} />);
        expect(apiFetch).toHaveBeenCalledWith('/api/velocity/compare');
        expect(apiFetch).not.toHaveBeenCalledWith('/api/subscriptions/savings-estimate');
        expect(el.querySelector('[data-testid="upgrade-estimate"]')!.textContent).toBe('Con tu plan pagas $7749.75 menos de interés que pagando solo el mínimo. Estimado.');
    });
    it('without compare data (sin_ahorro or an error): no savings figure at all', async () => {
        for (const c of [{ ...COMPARE, estado: 'sin_ahorro' as const }, new Error('500')]) {
            serve(c);
            const el = await render(<UpgradeModal open onOpenChange={() => undefined} />);
            expect(el.querySelector('[data-testid="upgrade-paid"]')).not.toBeNull();
            expect(el.querySelector('[data-testid="upgrade-estimate"]')).toBeNull();
            cleanup();
        }
    });
    it('source: no savings-estimate, no annual_savings', () => {
        expect(upgradeSrc).not.toMatch(/savings-estimate|annual_savings|roi_days/);
    });
});

describe('SettingsPage → Suscripción', () => {
    it('with compare data: the daily-interest ticker AND the real minimums-vs-plan card', async () => {
        window.history.replaceState(null, '', '/?section=subscription');
        serve(COMPARE);
        const el = await render(<SettingsPage />);
        expect(el.textContent).toContain('sub.interestBurning');
        expect(el.textContent).toContain('$7.89'); // daily_interest_all, unchanged
        const card = el.querySelector('[data-testid="sub-compare"]')!;
        expect(card.textContent).toContain('Solo mínimos');
        expect(card.textContent).toContain('$9850.25');
        expect(card.textContent).toContain('$2100.50');
        expect(card.textContent).toContain('$7749.75');
    });
    it('without compare data: the ticker stays, no comparison card', async () => {
        window.history.replaceState(null, '', '/?section=subscription');
        serve({ ...COMPARE, estado: 'sin_ahorro' });
        const el = await render(<SettingsPage />);
        expect(el.textContent).toContain('sub.interestBurning');
        expect(el.querySelector('[data-testid="sub-compare"]')).toBeNull();
    });
    it('source: nothing reads the dead fields', () => {
        expect(settingsSrc).not.toMatch(/annual_savings|monthly_savings|roi_days|years_without|years_with|total_interest_without|total_interest_with/);
    });
});
