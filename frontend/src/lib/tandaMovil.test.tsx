import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import indexHtml from '../../index.html?raw';
import kxCss from '@/styles/kx.css?raw';
import layoutSrc from '@/layouts/DashboardLayout.tsx?raw';
import kxSrc from '@/components/kx/index.tsx?raw';
import manifest from '../../android/app/src/main/AndroidManifest.xml?raw';
import authSrc from '@/features/auth/AuthContext.tsx?raw';
import { NATIVE_AUTH_REDIRECT, completeNativeOAuth, parseAuthCallback } from './nativeAuth';

// ── 1 · Google sign-in in the APK ────────────────────────────

describe('Google sign-in returns to the app (deep link)', () => {
    it('parses PKCE code, implicit tokens and errors; ignores foreign links', () => {
        expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}?code=abc123`)).toEqual({ kind: 'code', code: 'abc123' });
        expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#access_token=AT&refresh_token=RT&token_type=bearer`))
            .toEqual({ kind: 'tokens', access_token: 'AT', refresh_token: 'RT' });
        expect(parseAuthCallback(`${NATIVE_AUTH_REDIRECT}#error=access_denied&error_description=User%20cancelled`))
            .toEqual({ kind: 'error', message: 'User cancelled' });
        expect(parseAuthCallback('https://korexf.com/?code=abc')).toBeNull();
        expect(parseAuthCallback('korex://otra-cosa?code=x')).toBeNull();
    });

    it('finishes the session: code → exchangeCodeForSession, tokens → setSession', async () => {
        const auth = { exchangeCodeForSession: vi.fn(async () => ({ error: null })), setSession: vi.fn(async () => ({ error: null })) };
        expect(await completeNativeOAuth(`${NATIVE_AUTH_REDIRECT}?code=C1`, auth)).toBe(true);
        expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('C1');
        expect(await completeNativeOAuth(`${NATIVE_AUTH_REDIRECT}#access_token=A&refresh_token=R`, auth)).toBe(true);
        expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'A', refresh_token: 'R' });
        expect(await completeNativeOAuth('https://elsewhere', auth)).toBe(false);
    });

    it('native uses the korex:// redirect + appUrlOpen; web keeps window.location.origin; manifest has the scheme', () => {
        expect(authSrc).toContain('redirectTo: NATIVE_AUTH_REDIRECT, skipBrowserRedirect: true');
        expect(authSrc).toContain("addListener('appUrlOpen'");
        expect(authSrc).toContain('redirectTo: window.location.origin');
        expect(authSrc).toContain('signInWithPassword({ email, password })'); // email login untouched
        expect(manifest).toMatch(/<data android:scheme="korex" android:host="auth-callback" \/>/);
        expect(manifest).toContain('android.intent.category.BROWSABLE');
    });
});

// ── 2 · 3 · Safe areas and a tab bar that stays at the bottom ──

describe('Safe areas', () => {
    it('viewport-fit=cover is on, so env(safe-area-inset-*) and Capacitor insets are real', () => {
        expect(indexHtml).toContain('viewport-fit=cover');
        expect(kxCss).toMatch(/--kx-safe-top: max\(env\(safe-area-inset-top, 0px\), var\(--safe-area-inset-top, 0px\)\)/);
        expect(kxCss).toMatch(/--kx-safe-bottom: max\(env\(safe-area-inset-bottom, 0px\), var\(--safe-area-inset-bottom, 0px\)\)/);
    });

    it('the fixed header and the drawer pad the top inset; the tab bar pads the bottom one', () => {
        expect(layoutSrc).toContain("paddingTop: 'var(--kx-safe-top)', height: 'calc(3.5rem + var(--kx-safe-top))'");
        expect(layoutSrc).toMatch(/paddingTop: 'var\(--kx-safe-top\)',\s+paddingBottom: 'var\(--kx-safe-bottom\)'/);
        expect(kxSrc).toContain('pb-[max(18px,var(--kx-safe-bottom))]');
    });

    it('the shell is 100dvh, the document never scrolls, and the tab bar is not under a transform', () => {
        expect(layoutSrc).toContain('h-[100dvh]');
        expect(layoutSrc).toContain("classList.add('kx-app-shell')");
        expect(kxCss).toMatch(/html\.kx-app-shell, html\.kx-app-shell body \{ height: 100%; overflow: hidden;/);
        // <TabBar /> is a direct child of the shell root, outside the animated .kx-page
        const page = layoutSrc.indexOf('className="kx-page');
        const pageClose = layoutSrc.indexOf('</main>');
        expect(layoutSrc.indexOf('<TabBar />')).toBeGreaterThan(pageClose);
        expect(page).toBeGreaterThan(0);
    });
});

// ── 4 · Install offer: persistent in Más, muted only by an explicit "no" ──

vi.mock('@/hooks/useMediaQuery', () => ({ useIsMobile: () => true }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));
const toastSpy = vi.fn((props: unknown) => { void props; return { dismiss: vi.fn() }; });
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }));

import InstallPrompt from '@/components/InstallPrompt';
import { DISMISS_KEY, captureInstallEvent, isInstallMuted, promptInstall, resetInstallState } from './installPrompt';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: Root;
const fakeEvent = (outcome: 'accepted' | 'dismissed') => Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn(async () => undefined), userChoice: Promise.resolve({ outcome }),
});

describe('InstallPrompt', () => {
    beforeEach(() => { localStorage.clear(); toastSpy.mockClear(); resetInstallState(); });
    afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

    async function mount() {
        host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
        await act(async () => root.render(<InstallPrompt />));
    }

    it('showing the toast does NOT write the mute', async () => {
        await mount();
        await act(async () => captureInstallEvent(fakeEvent('accepted')));
        expect(toastSpy).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem(DISMISS_KEY)).toBeNull();
    });

    it('only an explicit "no" mutes: "Ahora no" in the toast, or Cancel in the browser dialog', async () => {
        await mount();
        await act(async () => captureInstallEvent(fakeEvent('dismissed')));
        // "Ahora no" lives in the toast description
        const desc = (toastSpy.mock.calls[0][0] as { description: React.ReactElement }).description;
        const probe = document.createElement('div'); document.body.appendChild(probe);
        const r2 = createRoot(probe);
        await act(async () => r2.render(desc));
        await act(async () => (probe.querySelector('[data-testid="install-not-now"]') as HTMLButtonElement).click());
        expect(isInstallMuted()).toBe(true);
        act(() => r2.unmount()); probe.remove();

        localStorage.clear();
        captureInstallEvent(fakeEvent('dismissed'));
        expect(await promptInstall()).toBe('dismissed');
        expect(isInstallMuted()).toBe(true);
    });

    it('a muted toast stays silent', async () => {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
        await mount();
        await act(async () => captureInstallEvent(fakeEvent('accepted')));
        expect(toastSpy).not.toHaveBeenCalled();
    });
});
