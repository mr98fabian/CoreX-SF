import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/features/auth/AuthContext', () => ({ useAuth: () => ({ signOut: vi.fn(async () => undefined) }) }));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { AppLock, LockScreen } from './AppLock';
import { FingerprintLockRow } from '@/features/settings/FingerprintLockRow';
import { lockedOnOpen, lockedOnReturn, type LockSettings } from '@/lib/appLock';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(node));
    return host;
}
const setMotion = (reduce: boolean) => {
    window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};
const ON: LockSettings = { enabled: true, relock: 60, credentialId: 'cred-1' };

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setMotion(false); });
afterEach(() => {
    if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; }
    vi.unstubAllGlobals();
});

describe('Bloqueo con huella', () => {
    it('hides the settings row when the device has no platform authenticator', async () => {
        vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => false });
        const el = await render(<FingerprintLockRow es />);
        expect(el.querySelector('[data-testid="fingerprint-row"]')).toBeNull();
    });

    it('hides it too when WebAuthn does not exist at all', async () => {
        vi.stubGlobal('PublicKeyCredential', undefined);
        const el = await render(<FingerprintLockRow es />);
        expect(el.textContent).toBe('');
    });

    it('shows the row when a platform authenticator is available', async () => {
        vi.stubGlobal('PublicKeyCredential', { isUserVerifyingPlatformAuthenticatorAvailable: async () => true });
        const el = await render(<FingerprintLockRow es />);
        expect(el.textContent).toContain('Bloqueo con huella');
        expect(el.textContent).toContain('Tu sesión sigue abierta');
    });

    it('opens locked once the interval has passed, and not within it', async () => {
        const now = 1_000_000;
        sessionStorage.setItem('kx-lock-seen', String(now - 61_000));
        expect(lockedOnOpen(ON, now)).toBe(true);
        sessionStorage.setItem('kx-lock-seen', String(now - 30_000));
        expect(lockedOnOpen(ON, now)).toBe(false);
        expect(lockedOnOpen({ ...ON, relock: 'exit' }, now)).toBe(true); // "Al salir": never remembered
        expect(lockedOnOpen({ ...ON, enabled: false }, now)).toBe(false);
        expect(lockedOnReturn(ON, 61_000)).toBe(true);
        expect(lockedOnReturn(ON, 10_000)).toBe(false);
    });

    it('renders the full-screen lock with the password exit when the interval expired', async () => {
        localStorage.setItem('kx-lock', JSON.stringify(ON));
        sessionStorage.setItem('kx-lock-seen', String(Date.now() - 120_000));
        const el = await render(<AppLock />);
        const lock = document.querySelector('[data-testid="app-lock"]'); expect(el.contains(lock)).toBe(false); // portaled to body
        expect(lock).not.toBeNull();
        expect(lock?.textContent).toContain('Usar huella');
        expect(lock?.textContent).toContain('Usar mi contraseña');
    });

    it('stays out of the way when the lock is off', async () => {
        const el = await render(<AppLock />);
        expect(el.textContent).toBe(''); expect(document.querySelector('[data-testid="app-lock"]')).toBeNull();
    });

    it('respects reduced motion (no fade-in)', async () => {
        setMotion(true);
        const el = await render(<LockScreen es onUnlock={async () => {}} onPassword={() => {}} />);
        expect(el.querySelector('[data-testid="app-lock-body"]')?.className).not.toContain('animate-in');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        setMotion(false);
        const el2 = await render(<LockScreen es onUnlock={async () => {}} onPassword={() => {}} />);
        expect(el2.querySelector('[data-testid="app-lock-body"]')?.className).toContain('animate-in');
    });
});
