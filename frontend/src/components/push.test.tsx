/**
 * Push on the Android app: our screen before the system dialog (once; "Ahora no" is final),
 * token registration, the Ajustes switch (permission + preference, denied → system settings),
 * sign-out cleanup and tap destinations. Real LanguageProvider (Spanish first).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

const env = vi.hoisted(() => ({ native: true, platform: 'android' }));
const appSettings = vi.hoisted(() => ({ openNotificationSettings: vi.fn(async () => undefined) }));
vi.mock('@capacitor/core', () => ({
    Capacitor: { isNativePlatform: () => env.native, getPlatform: () => env.platform },
    registerPlugin: () => appSettings,
}));
const push = vi.hoisted(() => {
    const listeners: Record<string, (arg: unknown) => unknown> = {};
    return {
        listeners,
        permission: 'prompt' as 'prompt' | 'granted' | 'denied',
        answer: 'granted' as 'granted' | 'denied',
        api: {
            checkPermissions: vi.fn(async () => ({ receive: push.permission })),
            requestPermissions: vi.fn(async () => ({ receive: push.answer })),
            register: vi.fn(async () => { await listeners.registration?.({ value: 'fcm-token-xyz' }); }),
            addListener: vi.fn(async (event: string, fn: (arg: unknown) => unknown) => { listeners[event] = fn; return { remove: async () => undefined }; }),
        },
    };
});
vi.mock('@capacitor/push-notifications', () => ({ PushNotifications: push.api }));
const apiFetch = vi.fn();
vi.mock('@/lib/api', () => ({ apiFetch: (...a: unknown[]) => apiFetch(...a) }));
const auth = vi.hoisted(() => ({ user: { id: 'u1' } as { id: string } | null, isDemo: false }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => auth }));

import { LanguageProvider } from '@/contexts/LanguageContext';
import { PushSetup } from './PushSetup';
import { PushToggleRow } from './PushToggleRow';
import { clearPushToken, routeFor, syncPushLanguage } from '@/lib/push';
import langSrc from '@/contexts/LanguageContext.tsx?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
let serverEnabled = true;
let preference = true;
const settle = async () => { for (let i = 0; i < 5; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const byId = (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<LanguageProvider><MemoryRouter>{node}</MemoryRouter></LanguageProvider>));
    await settle();
}
function unmount() { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } }
const posts = () => apiFetch.mock.calls.filter((c) => c[0] === '/api/push/devices' && c[1]?.method === 'POST');

beforeEach(() => {
    env.native = true; env.platform = 'android';
    auth.user = { id: 'u1' }; auth.isDemo = false;
    push.permission = 'prompt'; push.answer = 'granted';
    serverEnabled = true; preference = true;
    localStorage.clear();
    Object.values(push.api).forEach((f) => f.mockClear());
    appSettings.openNotificationSettings.mockClear();
    apiFetch.mockReset();
    apiFetch.mockImplementation(async (url: string, opts?: { method?: string; body?: string }) => {
        if (url === '/api/push/config') return { enabled: serverEnabled };
        if (url === '/api/push/preferences' && opts?.method === 'PUT') { preference = JSON.parse(opts.body!).enabled; return { enabled: preference }; }
        if (url === '/api/push/preferences') return { enabled: preference };
        return {};
    });
});
afterEach(unmount);

describe('pre-permission screen', () => {
    it('explains the benefit before the system dialog, in Spanish', async () => {
        await render(<PushSetup />);
        expect(byId('push-pre')!.textContent).toContain('Te avisamos antes de cada corte y con tu misión del día. Nada de spam.');
        expect(push.api.requestPermissions).not.toHaveBeenCalled(); // the system dialog comes after OUR screen
    });

    it('"Ahora no" is final: never asked automatically again', async () => {
        await render(<PushSetup />);
        await act(async () => byId('push-pre-no')!.click());
        expect(byId('push-pre')).toBeNull();
        expect(push.api.requestPermissions).not.toHaveBeenCalled();
        unmount();
        await render(<PushSetup />);
        expect(byId('push-pre')).toBeNull();
    });

    it('the app language travels with the token, and switching it re-registers the phone', async () => {
        localStorage.setItem('korex-language', 'en');
        await render(<PushSetup />);
        await act(async () => byId('push-pre-yes')!.click());
        await settle();
        expect(JSON.parse(posts()[0][1].body).language).toBe('en');
        localStorage.setItem('korex-language', 'es');
        await act(async () => { await syncPushLanguage(); });
        const last = posts()[posts().length - 1];
        expect(JSON.parse(last[1].body)).toMatchObject({ token: 'fcm-token-xyz', language: 'es' });
        localStorage.removeItem('korex-language');
    });

    it('"Activar avisos" asks the system and registers the token with the phone\'s time zone', async () => {
        await render(<PushSetup />);
        await act(async () => byId('push-pre-yes')!.click());
        await settle();
        expect(push.api.requestPermissions).toHaveBeenCalledTimes(1);
        expect(push.api.register).toHaveBeenCalled();
        const body = JSON.parse(posts()[0][1].body);
        expect(body.token).toBe('fcm-token-xyz');
        expect(body.platform).toBe('android');
        expect(typeof body.timezone).toBe('string');
        expect(body.language).toBe('es'); // Spanish unless the app is in English
        unmount();
        await render(<PushSetup />); // answered once: no second screen
        expect(byId('push-pre')).toBeNull();
    });

    it('permission already granted: no screen, the token is re-registered on every start', async () => {
        push.permission = 'granted';
        await render(<PushSetup />);
        expect(byId('push-pre')).toBeNull();
        expect(push.api.register).toHaveBeenCalled();
        expect(posts()).toHaveLength(1);
    });

    it('nothing on the web, in the demo or when the server cannot send', async () => {
        env.native = false; env.platform = 'web';
        await render(<PushSetup />);
        expect(byId('push-pre')).toBeNull();
        unmount();
        env.native = true; env.platform = 'android'; auth.isDemo = true;
        await render(<PushSetup />);
        expect(byId('push-pre')).toBeNull();
        unmount();
        auth.isDemo = false; serverEnabled = false;
        await render(<PushSetup />);
        expect(byId('push-pre')).toBeNull();
        expect(push.api.register).not.toHaveBeenCalled();
    });
});

describe('Ajustes → Notificaciones switch', () => {
    it('reflects permission AND preference; off saves the preference', async () => {
        push.permission = 'granted';
        await render(<PushToggleRow />);
        const sw = byId('push-toggle')!;
        expect(sw.getAttribute('aria-checked')).toBe('true');
        expect(byId('push-toggle-row')!.textContent).toContain('Avisos en el teléfono');
        await act(async () => sw.click());
        await settle();
        expect(apiFetch).toHaveBeenCalledWith('/api/push/preferences', { method: 'PUT', body: JSON.stringify({ enabled: false }) });
        expect(byId('push-toggle')!.getAttribute('aria-checked')).toBe('false');
    });

    it('denied in the system: the switch opens the phone\'s settings', async () => {
        push.permission = 'denied';
        await render(<PushToggleRow />);
        expect(byId('push-toggle')!.getAttribute('aria-checked')).toBe('false');
        expect(byId('push-toggle-row')!.textContent).toContain('bloqueados en el sistema');
        await act(async () => byId('push-toggle')!.click());
        await settle();
        expect(appSettings.openNotificationSettings).toHaveBeenCalled();
        expect(push.api.requestPermissions).not.toHaveBeenCalled();
    });

    it('not asked yet: turning it on asks, registers and saves', async () => {
        await render(<PushToggleRow />);
        await act(async () => byId('push-toggle')!.click());
        await settle();
        expect(push.api.requestPermissions).toHaveBeenCalled();
        expect(posts().length).toBeGreaterThan(0);
        expect(apiFetch).toHaveBeenCalledWith('/api/push/preferences', { method: 'PUT', body: JSON.stringify({ enabled: true }) });
        expect(byId('push-toggle')!.getAttribute('aria-checked')).toBe('true');
    });

    it('is not shown on the web', async () => {
        env.native = false; env.platform = 'web';
        await render(<PushToggleRow />);
        expect(byId('push-toggle-row')).toBeNull();
    });
});

describe('token lifecycle and destinations', () => {
    it('sign-out removes this phone\'s token', async () => {
        localStorage.setItem('korex-push-token', 'fcm-token-xyz');
        await clearPushToken();
        expect(apiFetch).toHaveBeenCalledWith('/api/push/devices', { method: 'DELETE', body: JSON.stringify({ token: 'fcm-token-xyz' }) });
        expect(localStorage.getItem('korex-push-token')).toBeNull();
    });

    it('tapping a notice goes to its destination; nothing outside the app', () => {
        expect(routeFor({ route: '/dashboard' })).toBe('/dashboard');
        expect(routeFor({ route: '/dashboard/accounts/manage', account_id: '12' })).toBe('/dashboard/accounts/manage?account=12');
        expect(routeFor({ route: '/dashboard/action-plan' })).toBe('/dashboard/action-plan');
        expect(routeFor({ route: 'https://evil.example' })).toBeNull();
        expect(routeFor(undefined)).toBeNull();
    });
});

describe('copy', () => {
    it('push.* keys in both languages, tú, no assistant brand', () => {
        const lines = langSrc.split('\n').filter((l) => /^\s*"push\./.test(l));
        expect(lines.length).toBe(7);
        for (const l of lines) expect(l, l).toMatch(/es: "[^"]+", en: "[^"]+"/);
        const text = lines.join('\n');
        expect(text).not.toMatch(/\b(Activá|Tocá|tenés|podés)\b/);
        expect(text).not.toMatch(/claude|chatgpt|gemini|copilot|\bmuse\b/i);
    });
});
