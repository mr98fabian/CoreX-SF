import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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

import IAGuidePage from './IAGuidePage';
import SettingsHome from './SettingsHome';
import { resolvePaid } from '@/hooks/useEffectivePlan';
import type { SubStatus } from '@/lib/planLimits';

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
const status = (plan: string, source: SubStatus['source'] = 'subscription'): SubStatus => ({ plan, status: 'active', accounts_limit: 2, source, grant_plan: null, grant_ends_at: null, checkout_hidden: false });

beforeEach(() => {
    apiFetch.mockReset();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [] })));
});
afterEach(() => { vi.unstubAllGlobals(); if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Tutorial pago — useEffectivePlan gate', () => {
    it.each([['founder'], ['freedom']])('%s sees the AI Pack guide', async (plan) => {
        apiFetch.mockImplementation(async (url: string) => (url === '/api/subscriptions/status' ? status(plan) : null));
        const el = await render(<IAGuidePage />);
        expect(el.querySelector('[data-testid="ia-guide"]')).not.toBeNull();
        expect(el.querySelector('[data-testid="ia-locked"]')).toBeNull();
        expect(el.textContent).toContain('La IA nunca mueve dinero');
        expect(el.textContent).toContain('kx_');
    });

    it('starter sees it locked, with what it includes and a CTA to Planes', async () => {
        apiFetch.mockImplementation(async (url: string) => (url === '/api/subscriptions/status' ? status('starter', 'none') : null));
        const el = await render(<IAGuidePage />);
        expect(el.querySelector('[data-testid="ia-locked"]')).not.toBeNull();
        expect(el.querySelector('[data-testid="ia-guide"]')).toBeNull();
        expect(el.querySelector('a[href="/dashboard/settings/plans"]')).not.toBeNull();
    });

    it('a cache tampered to "freedom" does not open it while the server says starter', async () => {
        localStorage.setItem('korex-plan', 'freedom');
        apiFetch.mockImplementation(async (url: string) => (url === '/api/subscriptions/status' ? status('starter', 'none') : null));
        const el = await render(<IAGuidePage />);
        expect(el.querySelector('[data-testid="ia-locked"]')).not.toBeNull();
        expect(el.querySelector('[data-testid="ia-guide"]')).toBeNull();
    });

    it('a failed status keeps it locked, even with a paid cache', async () => {
        localStorage.setItem('korex-plan', 'founder');
        apiFetch.mockRejectedValue(new Error('offline'));
        const el = await render(<IAGuidePage />);
        expect(el.querySelector('[data-testid="ia-guide"]')).toBeNull();
        expect(el.querySelector('[data-testid="ia-locked"]')).not.toBeNull();
    });

    it('resolvePaid: server word only; the demo sandbox never connects an AI', () => {
        expect(resolvePaid(null)).toBe(false);
        expect(resolvePaid(status('starter', 'none'))).toBe(false);
        expect(resolvePaid(status('freedom'))).toBe(true);
        expect(resolvePaid(status('founder', 'grant'))).toBe(true);
        expect(resolvePaid(status('freedom', 'demo'))).toBe(false);
    });
});

describe('Tutorial gratis — replay from Ajustes', () => {
    it('"Ver el tutorial" fires korex:restart-onboarding (DashboardLayout → useOnboarding.restart)', async () => {
        apiFetch.mockResolvedValue(null);
        const heard = vi.fn();
        window.addEventListener('korex:restart-onboarding', heard);
        const el = await render(<SettingsHome />);
        const btn = el.querySelector<HTMLButtonElement>('[data-testid="replay-tutorial"]')!;
        expect(btn.textContent).toContain('Ver el tutorial');
        await act(async () => btn.click());
        expect(heard).toHaveBeenCalledTimes(1);
        window.removeEventListener('korex:restart-onboarding', heard);
        expect(el.querySelector('a[href="/dashboard/settings/ia"]')?.textContent).toContain('KoreX con tu IA');
    });
});
