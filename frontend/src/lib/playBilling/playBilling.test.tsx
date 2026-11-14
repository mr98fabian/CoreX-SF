/**
 * Google Play Billing in the Android build. GUARDIAN: in native Android no screen ever calls
 * /api/subscriptions/checkout, opens a window or renders a Lemon URL (Play policy: violating
 * this gets the app rejected). On the web the Lemon flow stays exactly as it was.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const env = vi.hoisted(() => ({ native: true, platform: 'android' }));
const plugin = vi.hoisted(() => ({
    getProductDetails: vi.fn(),
    purchase: vi.fn(),
    restorePurchases: vi.fn(),
    acknowledge: vi.fn(),
    addListener: vi.fn(async () => ({ remove: async () => undefined })),
}));
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => env.native, getPlatform: () => env.platform },
    registerPlugin: () => plugin,
}));
const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a), API_BASE: '', ApiError: class extends Error {} }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k, setLanguage: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}`, formatMoneyShort: (n: number) => `$${Math.round(n)}` }) }));
const toast = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false, user: { id: 'user-uuid-1', email: 'a@b.c', user_metadata: {} }, signOut: vi.fn() }) }));
vi.mock('@/hooks/useOnboarding', () => ({ useOnboarding: () => ({ restart: vi.fn() }) }));
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { updateUser: vi.fn() } } }));
vi.mock('@/components/ReferralProgram', () => ({ ReferralProgram: () => null }));
vi.mock('@/components/ConnectAI', () => ({ ConnectAI: () => null }));

import UpgradeModal from '@/components/UpgradeModal';
import PlansPage from '@/features/settings/PlansPage';
import SettingsPage from '@/features/settings/SettingsPage';
import { getBillingProvider } from '@/lib/billing';
import { PLAY_MANAGE_URL } from '@/lib/playBilling';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('__APP_VERSION__', 'test');

const PRODUCT = { productId: 'korex_annual', title: 'KoreX Anual', offerToken: 'offer-1', basePlanId: 'annual', offerId: 'trial30',
    formattedPrice: 'MX$1,799.00', billingPeriod: 'P1Y', trialPeriod: 'P30D', phases: [] };
const BOUGHT = { productId: 'korex_annual', purchaseToken: 'tok-1', packageName: 'com.korexf.app', acknowledged: false, state: 'purchased' };
let status: Record<string, unknown>;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
let qc: QueryClient;
async function settle() { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); }
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root!.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    await settle();
    return document.body;
}
const byTestId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
const buttonWith = (text: string) => [...document.querySelectorAll('button')].find((b) => b.textContent?.includes(text)) as HTMLButtonElement | undefined;
async function click(el: HTMLElement | undefined | null) { expect(el).toBeTruthy(); await act(async () => el!.click()); await settle(); }
const calls = (url: string) => apiFetch.mock.calls.filter((c) => c[0] === url);

beforeEach(() => {
    env.native = true; env.platform = 'android';
    status = { plan: 'starter', status: 'active', accounts_limit: 2, source: 'none', grant_plan: null, grant_ends_at: null, checkout_hidden: false, store_source: null };
    plugin.getProductDetails.mockResolvedValue(PRODUCT);
    plugin.purchase.mockResolvedValue(BOUGHT);
    plugin.restorePurchases.mockResolvedValue({ purchases: [] });
    plugin.acknowledge.mockResolvedValue({ acknowledged: true });
    apiFetch.mockImplementation(async (url: string) => {
        if (url === '/api/subscriptions/status') return status;
        if (url === '/api/subscriptions/google/verify') return { granted: true, status: 'active', plan: 'freedom', current_period_end: null, acknowledged: true, store_source: 'google_play' };
        if (url === '/api/subscriptions/checkout') return { checkout_url: 'https://korex.lemonsqueezy.com/checkout/x' };
        if (url === '/api/subscriptions/savings-estimate') return { has_data: false, total_debt: 0, daily_interest_all: 0, plans: {}, social_proof: { total_accounts_monitored: 0, total_debt_tracked: 0 } };
        if (url === '/api/velocity/compare') throw new Error('none');
        return {};
    });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ plan: 'starter', debt_limit: 2 }, { plan: 'freedom', debt_limit: null }] })));
    vi.spyOn(window, 'open').mockImplementation(() => null);
});
afterEach(() => {
    if (root) act(() => root!.unmount());
    root = null; host = null;
    document.body.replaceChildren();
    vi.clearAllMocks();
    window.history.pushState({}, '', '/');
});

function expectNoLemonPath() {
    expect(calls('/api/subscriptions/checkout')).toHaveLength(0);
    expect(window.open).not.toHaveBeenCalled();
    expect(document.body.innerHTML.toLowerCase()).not.toMatch(/lemonsqueezy|lemon squeezy/);
}

describe('getBillingProvider', () => {
    it('is google_play only in the native Android build', () => {
        expect(getBillingProvider()).toBe('google_play');
        env.platform = 'ios';
        expect(getBillingProvider()).toBe('lemon');
        env.native = false; env.platform = 'web';
        expect(getBillingProvider()).toBe('lemon');
    });
});

describe('Android build: Play Billing', () => {
    it('UpgradeModal shows Play\'s localized price, buys with the user id and verifies on the server', async () => {
        await render(<UpgradeModal open onOpenChange={() => undefined} />);
        const card = byTestId('upgrade-paid')!;
        expect(card.textContent).toContain('MX$1,799.00');
        expect(card.textContent).not.toContain('$100');
        await click(buttonWith('billing.start'));
        expect(plugin.purchase).toHaveBeenCalledWith({ productId: 'korex_annual', accountId: 'user-uuid-1' });
        const verify = calls('/api/subscriptions/google/verify');
        expect(verify).toHaveLength(1);
        expect(JSON.parse(verify[0][1].body)).toEqual({ product_id: 'korex_annual', purchase_token: 'tok-1', package_name: 'com.korexf.app' });
        expect(calls('/api/subscriptions/status').length).toBeGreaterThan(0); // refetched after granting
        expect(toast).toHaveBeenCalledWith({ title: 'billing.active' });
        expect(plugin.acknowledge).not.toHaveBeenCalled(); // the server acknowledged
        expectNoLemonPath();
    });

    it('the app acknowledges only as backup, when the server granted but could not', async () => {
        apiFetch.mockImplementation(async (url: string) => url === '/api/subscriptions/google/verify'
            ? { granted: true, status: 'active', plan: 'freedom', current_period_end: null, acknowledged: false, store_source: 'google_play' }
            : status);
        await render(<UpgradeModal open onOpenChange={() => undefined} />);
        await click(buttonWith('billing.start'));
        expect(plugin.acknowledge).toHaveBeenCalledWith({ purchaseToken: 'tok-1' });
    });

    it('a canceled purchase is not an error and verifies nothing', async () => {
        plugin.purchase.mockRejectedValue(Object.assign(new Error('canceled'), { code: 'USER_CANCELED' }));
        await render(<UpgradeModal open onOpenChange={() => undefined} />);
        await click(buttonWith('billing.start'));
        expect(toast).toHaveBeenCalledWith({ title: 'billing.canceled', description: 'billing.canceledDesc' });
        expect(calls('/api/subscriptions/google/verify')).toHaveLength(0);
        expectNoLemonPath();
    });

    it('Restaurar compras verifies every active token and refetches the status', async () => {
        plugin.restorePurchases.mockResolvedValue({ purchases: [BOUGHT, { ...BOUGHT, purchaseToken: 'tok-2' }] });
        await render(<PlansPage />);
        await click(byTestId('play-restore'));
        const tokens = calls('/api/subscriptions/google/verify').map((c) => JSON.parse(c[1].body).purchase_token);
        expect(tokens).toEqual(['tok-1', 'tok-2']);
        expect(toast).toHaveBeenCalledWith({ title: 'billing.restored' });
        expect(calls('/api/subscriptions/status').length).toBeGreaterThanOrEqual(2);
        expectNoLemonPath();
    });

    it('a Google Play subscription shows "Gestionar en Google Play" (Play\'s page), never a Lemon portal', async () => {
        status = { ...status, plan: 'freedom', source: 'subscription', store_source: 'google_play' };
        await render(<PlansPage />);
        const manage = byTestId('play-manage') as HTMLAnchorElement;
        expect(manage.textContent).toBe('billing.manage');
        expect(manage.href).toBe(PLAY_MANAGE_URL);
        expect(PLAY_MANAGE_URL).toBe('https://play.google.com/store/account/subscriptions?package=com.korexf.app&sku=korex_annual');
        expectNoLemonPath();
    });

    it('GUARDIAN: PlansPage and the Settings subscription tab buy through Play, never the Lemon checkout', async () => {
        await render(<PlansPage />);
        expect(document.body.textContent).toContain('MX$1,799.00');
        expect(document.body.textContent).not.toContain('Precios en USD');
        await click(buttonWith('billing.start'));
        expect(plugin.purchase).toHaveBeenCalledTimes(1);
        expectNoLemonPath();
        act(() => root!.unmount()); root = null; document.body.replaceChildren();

        window.history.pushState({}, '', '/dashboard/settings?section=subscription');
        await render(<SettingsPage />);
        expect(byTestId('play-store-actions')).toBeTruthy();
        await click(buttonWith('billing.start'));
        expect(plugin.purchase).toHaveBeenCalledTimes(2);
        expectNoLemonPath();
    });

    it('founder / gift (checkout_hidden): nothing is sold, not even through Play', async () => {
        status = { ...status, plan: 'founder', source: 'grant', checkout_hidden: true };
        await render(<PlansPage />);
        expect(buttonWith('billing.start')).toBeUndefined();
        expect(byTestId('play-store-actions')).toBeNull();
    });
});

describe('Web: Lemon unchanged', () => {
    beforeEach(() => { env.native = false; env.platform = 'web'; });

    it('UpgradeModal keeps the USD price and opens the Lemon checkout; Play is never touched', async () => {
        await render(<UpgradeModal open onOpenChange={() => undefined} />);
        const card = byTestId('upgrade-paid')!;
        expect(card.textContent).toContain('$100.00');
        expect(card.textContent).toContain('1 mes gratis, luego $100.00/año');
        expect(document.body.textContent).toContain('Cancela durante el mes gratis y no se cobra nada. Precios en USD.');
        expect(byTestId('play-store-actions')).toBeNull();
        await click(buttonWith('Empezar mes gratis'));
        expect(calls('/api/subscriptions/checkout')).toHaveLength(1);
        expect(window.open).toHaveBeenCalledWith('https://korex.lemonsqueezy.com/checkout/x', '_blank');
        expect(plugin.getProductDetails).not.toHaveBeenCalled();
        expect(plugin.purchase).not.toHaveBeenCalled();
    });

    it('PlansPage on the web has no Play buttons and keeps the Lemon checkout', async () => {
        await render(<PlansPage />);
        expect(byTestId('play-store-actions')).toBeNull();
        expect(document.body.textContent).toContain('Precios en USD');
        expect(plugin.getProductDetails).not.toHaveBeenCalled();
    });
});
