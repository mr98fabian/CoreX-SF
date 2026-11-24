/**
 * Sweep (Misión 9 → fix/precio-impuestos): every visible WEB price of the paid plan carries
 * "+ impuestos" / "+ tax" right after it (Stripe Managed Payments adds sales tax on top: $100 base,
 * $106.60 invoice). Google Play shows its own localized price and handles tax: never qualified.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const lang = vi.hoisted(() => ({ value: 'es' as 'es' | 'en' }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' }, registerPlugin: () => ({}) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn(async () => null), API_BASE: '', ApiError: class extends Error {} }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: lang.value, t: (k: string) => k, setLanguage: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}`, formatMoneyShort: (n: number) => `$${Math.round(n)}` }) }));
vi.mock('@/components/MoneyAmount', () => ({ MoneyAmount: ({ value }: { value: number }) => <span>${value.toFixed(2)}</span> }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ isDemo: false, user: { id: 'u1', email: 'a@b.c', user_metadata: {} }, signOut: vi.fn() }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/features/landing/VelocityCalculatorModal', () => ({ VelocityCalculatorModal: () => null }));

import { PlanCards } from '@/components/kx/PlanCards';
import UpgradeModal from '@/components/UpgradeModal';
import KxLanding from '@/features/landing/KxLanding';
import { TAX_QUALIFIER } from '@/lib/pricing';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal('__APP_VERSION__', 'test');

let host: HTMLDivElement | null = null;
let root: Root | null = null;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    await act(async () => root!.render(<QueryClientProvider client={qc}><MemoryRouter>{node}</MemoryRouter></QueryClientProvider>));
    for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}
beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => [{ plan: 'starter', debt_limit: 2 }, { plan: 'freedom', debt_limit: null }] })));
});
afterEach(() => {
    if (root) act(() => root!.unmount());
    if (host) document.body.removeChild(host);
    host = null; root = null;
    lang.value = 'es';
});

/** Every occurrence of the paid web price, with the text that follows it. */
const PRICE = /\$100(\.00)?\b|\b100 (dólares|dollars)\b/g;
function unqualified(text: string, es: boolean): string[] {
    const q = es ? TAX_QUALIFIER.es : TAX_QUALIFIER.en;
    const flat = text.replace(/\s+/g, ' ');
    const misses: string[] = [];
    for (const m of flat.matchAll(PRICE)) {
        const after = flat.slice(m.index! + m[0].length, m.index! + m[0].length + 24);
        if (!after.includes(q)) misses.push(flat.slice(Math.max(0, m.index! - 20), m.index! + m[0].length + 24));
    }
    return misses;
}

describe.each([['es', true], ['en', false]] as const)('Web price + tax (%s)', (code, es) => {
    beforeEach(() => { lang.value = code; });

    it('plan cards: hero price and trial line', async () => {
        await render(<PlanCards onChoose={() => undefined} />);
        const text = document.body.textContent ?? '';
        expect(text.match(PRICE)?.length).toBeGreaterThanOrEqual(2);
        expect(unqualified(text, es)).toEqual([]);
    });

    it('upgrade modal (web): hero price and trial line', async () => {
        await render(<UpgradeModal open onOpenChange={() => undefined} />);
        const card = document.querySelector('[data-testid="upgrade-paid"]')!.textContent ?? '';
        expect(card.match(PRICE)?.length).toBeGreaterThanOrEqual(2);
        expect(unqualified(card, es)).toEqual([]);
    });

    it('landing: every price mention, including the plan cards it embeds', async () => {
        await render(<KxLanding />);
        const text = document.body.textContent ?? '';
        expect(text.match(PRICE)?.length).toBeGreaterThanOrEqual(3);
        expect(unqualified(text, es)).toEqual([]);
    });
});

describe('Google Play route stays untouched', () => {
    it('a store price (Play) is shown as Play gives it, without the web tax qualifier', async () => {
        await render(<PlanCards onChoose={() => undefined} store={{ price: 'US$99.99', trialLine: '7 días gratis', footer: 'Google Play' }} />);
        const hero = document.querySelector('[data-testid="plan-freedom"]')!.textContent ?? '';
        expect(hero).toContain('US$99.99');
        expect(hero).not.toContain(TAX_QUALIFIER.es);
    });
});
