import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

let native = true;
let build = '2';
let pluginFails = false;
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => { if (pluginFails) throw new Error('not implemented'); return { build }; } } }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));

import { ApkUpdateBanner } from './ApkUpdateBanner';
import { LAST_KEY } from '@/lib/apkUpdate';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const manifest = (code: number, name = `1.${code - 1}`) => ({ version_code: code, version_name: name, apk_url: `https://github.com/x/releases/download/v${name}/korex.apk`, notas: '' });
let fetchMock: ReturnType<typeof vi.fn>;
const serve = (body: unknown) => fetchMock.mockResolvedValue({ ok: true, json: async () => body });

let host: HTMLDivElement | null = null;
let root: Root;
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<ApkUpdateBanner />));
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    return host;
}
function unmount() { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } }
const banner = () => document.querySelector('[data-testid="apk-update"]');

beforeEach(() => {
    localStorage.clear();
    native = true; build = '2'; pluginFails = false;
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Aviso de actualización del APK', () => {
    it('announced version above the installed one → banner with the version name', async () => {
        serve(manifest(3, '1.2'));
        await render();
        expect(banner()!.textContent).toContain('Hay una versión nueva de KoreX (v1.2)');
        expect(String(fetchMock.mock.calls[0][0])).toMatch(/^https:\/\/korexf\.com\/apk\.json\?_t=\d+$/);
    });

    it('equal or lower announced version → nothing', async () => {
        serve(manifest(2));
        await render();
        expect(banner()).toBeNull();
        unmount(); localStorage.clear();
        serve(manifest(1));
        await render();
        expect(banner()).toBeNull();
    });

    it('fetch failure, invalid JSON, empty apk_url or missing plugin → silence, no errors', async () => {
        const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        for (const setup of [
            () => fetchMock.mockRejectedValue(new TypeError('offline')),
            () => fetchMock.mockResolvedValue({ ok: true, json: async () => { throw new SyntaxError('bad'); } }),
            () => fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) }),
            () => serve({ version_code: 9, version_name: '9', apk_url: '' }),
            () => { pluginFails = true; serve(manifest(9)); },
        ]) {
            localStorage.clear(); pluginFails = false; setup();
            await render();
            expect(banner()).toBeNull();
            unmount();
        }
        expect(errors).not.toHaveBeenCalled();
        errors.mockRestore();
    });

    it('"Ahora no" silences that version until tomorrow; a higher one asks again', async () => {
        serve(manifest(3));
        await render();
        const notNow = [...host!.querySelectorAll('button')].find((b) => b.textContent === 'Ahora no')!;
        await act(async () => notNow.click());
        expect(banner()).toBeNull();
        unmount();

        await render(); // same version, same day → silent
        expect(banner()).toBeNull();
        unmount();

        localStorage.removeItem(LAST_KEY); // past the 6 h window, a newer release is out
        serve(manifest(4, '1.3'));
        await render();
        expect(banner()!.textContent).toContain('v1.3');
    });

    it('checks at most once every 6 hours but keeps showing a pending update', async () => {
        serve(manifest(3));
        await render();
        unmount();
        await render();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(banner()).not.toBeNull();
    });

    it('does not run on web', async () => {
        native = false;
        serve(manifest(9));
        await render();
        expect(fetchMock).not.toHaveBeenCalled();
        expect(banner()).toBeNull();
    });
});
