import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));

import { SubscriptionsView } from './SubscriptionsPage';
import { cardHint, whenInWords, type SubsResponse } from './subscriptionText';
import { AccountLogo } from '@/components/AccountLogo';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const DATA: SubsResponse = {
    monthly_total: '66.00', annual_total: '792.00',
    items: [
        { id: 1, name: 'Netflix', amount: '15.49', frequency: 'monthly', monthly_equivalent: '15.49', next_charge_date: '2026-11-09',
            account_id: 3, account_name: 'Amex Gold 4884', logo_url: 'https://plaid-merchant-logos.plaid.com/netflix.png', status: 'active' },
        { id: 2, name: 'gimnasio', amount: '30.00', frequency: 'monthly', monthly_equivalent: '30.00', next_charge_date: null,
            account_id: null, account_name: null, logo_url: null, status: 'active' },
        { id: 3, name: 'Spotify', amount: '11.99', frequency: 'monthly', monthly_equivalent: '11.99', next_charge_date: '2026-11-07',
            account_id: null, account_name: null, logo_url: null, status: 'cancelled' },
    ],
};

let host: HTMLDivElement | null = null;
let root: Root;
function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(node));
    return host;
}
afterEach(() => {
    if (!host) return;
    act(() => root.unmount());
    document.body.removeChild(host);
    host = null;
});

describe('Suscripciones', () => {
    it('renders ledger rows, card hint, cancelled block and the official logo', () => {
        const el = render(<SubscriptionsView data={DATA} es onAdd={() => {}} onEdit={() => {}} />);
        const text = el.textContent ?? '';
        expect(text).toContain('Netflix');
        expect(text).toContain('···4884');
        expect(text).toContain('Ya no pagas');
        expect(text).toContain('$792.00');
        expect(el.querySelector('img')?.getAttribute('src')).toContain('netflix.png');
        // no logo → monogram with the initial, never a broken <img>
        expect([...el.querySelectorAll('[data-testid="logo-monogram"]')].map((m) => m.textContent)).toEqual(['G', 'S']);
    });

    it('falls back to the monogram for an unsafe src', () => {
        const el = render(<AccountLogo name="Chase" src="http://evil.example/x.png" />);
        expect(el.querySelector('img')).toBeNull();
        expect(el.textContent).toBe('C');
    });

    it('says the next charge in words', () => {
        const today = new Date(2026, 10, 6, 9);
        expect(whenInWords('2026-11-09', true, today)).toBe('en 3 días · 9 nov');
        expect(whenInWords('2026-11-07', true, today)).toBe('mañana · 7 nov');
        expect(whenInWords('2026-11-06', true, today)).toBe('hoy · 6 nov');
        expect(cardHint('Chase Checking')).toBe('Chase Checking');
    });
});
