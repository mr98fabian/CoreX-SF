import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import upgradeSrc from '@/components/UpgradeModal.tsx?raw';
import pricingSrc from '@/lib/pricing.ts?raw';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), API_BASE: '' }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false, user: { email: 'a@b.c' }, signOut: vi.fn() }) }));
vi.mock('@/components/ConnectAI', () => ({ ConnectAI: () => null }));
vi.mock('./FingerprintLockRow', () => ({ FingerprintLockRow: () => null }));
vi.mock('./SoundRow', () => ({ SoundRow: () => null }));
vi.mock('./CoachBlock', () => ({ CoachBlock: () => null }));
vi.mock('./HouseGoalRow', () => ({ HouseGoalRow: () => null }));
vi.mock('./OwnerCodesPanel', () => ({ OwnerCodesPanel: () => null }));

import SettingsHome from './SettingsHome';
import { ANNUAL_PRICE, COMMERCIAL_PLANS, TRIAL_DAYS } from '@/lib/pricing';
import { planLabel, PLAN_LIMITS } from '@/lib/planLimits';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
beforeEach(() => {
    apiFetch.mockReset();
    // the public list only has the two commercial plans
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ plan: 'starter', debt_limit: 2 }, { plan: 'freedom', debt_limit: null }] })));
});
afterEach(() => { vi.unstubAllGlobals(); if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Precios reales — 2 planes', () => {
    it('SettingsHome: a velocity user (not in the public list) reads "Plan pago activo", never the endless spinner', async () => {
        apiFetch.mockImplementation(async (url: string) => url === '/api/subscriptions/status'
            ? { plan: 'velocity', status: 'active', accounts_limit: 15, source: 'subscription', grant_plan: null, grant_ends_at: null, checkout_hidden: false }
            : null);
        const el = await render(<SettingsHome />);
        expect(el.textContent).toContain('Plan pago activo');
        expect(el.textContent).not.toContain('Cargando tu plan');
        expect(el.textContent).not.toMatch(/Velocity|Accelerator/);
    });

    it('commercial source: two plans, annual 100 with a 30-day trial', () => {
        expect(Object.keys(COMMERCIAL_PLANS)).toEqual(['starter', 'freedom']);
        expect(ANNUAL_PRICE).toBe(100);
        expect(COMMERCIAL_PLANS.freedom.annual).toBe(100);
        expect(TRIAL_DAYS).toBe(30);
        expect(pricingSrc).not.toMatch(/9\.99|19\.99|29\.99|velocity:|accelerator:/);
    });

    it('labels: retired tiers read as "Plan pago", founder stays, internal limits keep every key', () => {
        expect(planLabel('velocity', true)).toBe('Plan pago');
        expect(planLabel('accelerator', true)).toBe('Plan pago');
        expect(planLabel('founder', true)).toBe('Fundador');
        expect(planLabel('freedom', true)).toBe('KoreX Anual');
        for (const k of ['starter', 'velocity', 'accelerator', 'freedom', 'freedom-dev', 'founder']) expect(k in PLAN_LIMITS).toBe(true);
    });

    it('UpgradeModal no longer contains velocity/accelerator or their prices', () => {
        expect(upgradeSrc).not.toMatch(/velocity|accelerator/i);
        expect(upgradeSrc).not.toMatch(/9\.99|19\.99|29\.99|PLAN_PRICES/);
        expect(upgradeSrc).toContain("billing_cycle: 'annual'");
    });
});
