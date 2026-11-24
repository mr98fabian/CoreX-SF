/**
 * Notice e-mails in Ajustes: the switch reads and saves the preference (GET/PUT /api/push/email),
 * and the app reports its language + time zone to the server (PUT /api/push/profile) on sign-in
 * and on every language switch. Real LanguageProvider (Spanish first).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));

import { LanguageProvider, useLanguage } from '@/contexts/LanguageContext';
import { EmailToggleRow } from './EmailToggleRow';
import { syncNoticeProfile } from '@/lib/noticeProfile';

let root: Root | null = null;
let host: HTMLDivElement | null = null;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function mount(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root!.render(<LanguageProvider>{node}</LanguageProvider>));
}

beforeEach(() => {
    localStorage.clear();
    apiFetch.mockReset();
});
afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = host = null;
});

describe('EmailToggleRow', () => {
    it('shows the saved preference in Spanish and saves the change', async () => {
        apiFetch.mockImplementation(async (_url: string, init?: { method?: string; body?: string }) =>
            init?.method === 'PUT' ? JSON.parse(init.body!) : { enabled: true });
        mount(<EmailToggleRow />);
        await flush();
        expect(host!.textContent).toContain('Correos de notificación');
        const sw = host!.querySelector('[data-testid="email-toggle"]') as HTMLButtonElement;
        expect(sw.getAttribute('aria-checked')).toBe('true');
        await act(async () => { sw.click(); });
        await flush();
        expect(apiFetch).toHaveBeenCalledWith('/api/push/email', { method: 'PUT', body: JSON.stringify({ enabled: false }) });
        expect(sw.getAttribute('aria-checked')).toBe('false');
    });

    it('stays hidden when the server cannot answer', async () => {
        apiFetch.mockRejectedValue(new Error('offline'));
        mount(<EmailToggleRow />);
        await flush();
        expect(host!.querySelector('[data-testid="email-toggle-row"]')).toBeNull();
    });
});

describe('syncNoticeProfile', () => {
    it('reports the app language and a time zone', async () => {
        apiFetch.mockResolvedValue({});
        localStorage.setItem('korex-language', 'en');
        await syncNoticeProfile();
        const [url, init] = apiFetch.mock.calls[0];
        expect(url).toBe('/api/push/profile');
        const body = JSON.parse(init.body);
        expect(body.language).toBe('en');
        expect(typeof body.timezone).toBe('string');
        expect(body.timezone.length).toBeGreaterThan(0);
    });

    it('never throws when the server fails', async () => {
        apiFetch.mockRejectedValue(new Error('500'));
        await expect(syncNoticeProfile()).resolves.toBeUndefined();
    });

    it('a language switch syncs the profile in the new language', async () => {
        apiFetch.mockResolvedValue({});
        function Switcher() {
            const { setLanguage } = useLanguage();
            return <button data-testid="to-en" onClick={() => setLanguage('en')}>en</button>;
        }
        mount(<Switcher />);
        await act(async () => { (host!.querySelector('[data-testid="to-en"]') as HTMLButtonElement).click(); });
        await flush();
        await flush();
        const call = apiFetch.mock.calls.find(([url]) => url === '/api/push/profile');
        expect(call).toBeTruthy();
        expect(JSON.parse(call![1].body).language).toBe('en');
    });
});
