import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import langSrc from '@/contexts/LanguageContext.tsx?raw';

let native = false;
let build = '2';
let version = '1.1';
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('@capacitor/app', () => ({ App: { getInfo: async () => ({ build, version }) } }));
// Real Spanish strings, read from the dictionary itself
const ES: Record<string, string> = {};
for (const m of langSrc.matchAll(/"(app\.[a-zA-Z]+)": \{ en: "[^"]*", es: "([^"]*)" \}/g)) ES[m[1]] = m[2];
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => ES[k] ?? k }) }));

import { AppMenuSection } from './AppMenuSection';
import { MUTE_KEY, LAST_KEY, isIOS } from '@/lib/apkUpdate';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const manifest = (code: number, name: string, url = `https://github.com/x/releases/download/v${name}/korex.apk`) =>
    ({ version_code: code, version_name: name, apk_url: url, notas: 'Barra de navegación ahora se funde con el fondo' });

let fetchMock: ReturnType<typeof vi.fn>;
const serve = (body: unknown) => fetchMock.mockResolvedValue({ ok: true, json: async () => body });
let host: HTMLDivElement | null = null;
let root: Root;
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
async function render() {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<AppMenuSection />));
    await flush();
    return host;
}
const $ = (id: string) => document.querySelector(`[data-testid="${id}"]`);
function setUA(ua: string) { Object.defineProperty(navigator, 'userAgent', { value: ua, configurable: true }); }
let hrefSet: string | null;

beforeEach(() => {
    localStorage.clear();
    native = false; build = '2'; version = '1.1'; hrefSet = null;
    setUA(ANDROID_UA);
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('location', { ...window.location, set href(v: string) { hrefSet = v; }, get href() { return hrefSet ?? 'http://localhost/'; } });
});
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } vi.unstubAllGlobals(); });

describe('Más › App — visibility matrix', () => {
    it('native → only "Buscar actualización" + version footer from App.getInfo', async () => {
        native = true;
        await render();
        expect($('app-check')).not.toBeNull();
        expect($('app-download')).toBeNull();
        expect($('app-version')!.textContent).toBe('KoreX v1.1 (2)');
        expect(fetchMock).not.toHaveBeenCalled(); // no automatic fetch: the check is manual
    });

    it('web Android with a real apk_url → only "Descargar la app"; tapping opens the fresh URL', async () => {
        serve(manifest(2, '1.1'));
        await render();
        expect($('app-download')!.textContent).toBe('Descargar la appAndroid · APK oficial');
        expect($('app-check')).toBeNull();
        serve(manifest(3, '1.2'));
        await act(async () => ($('app-download') as HTMLButtonElement).click());
        await flush();
        expect(hrefSet).toBe('https://github.com/x/releases/download/v1.2/korex.apk');
    });

    it('web iOS → nothing at all (iOS waits for the App Store)', async () => {
        setUA(IPHONE_UA);
        serve(manifest(2, '1.1'));
        const el = await render();
        expect(el.innerHTML).toBe('');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true); // iPadOS
        expect(isIOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false); // a real Mac
    });

    it('web with an empty apk_url, or a failed fetch → nothing (never a dead button)', async () => {
        serve({ version_code: 1, version_name: '1.0', apk_url: '', notas: '' });
        let el = await render();
        expect(el.innerHTML).toBe('');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        fetchMock.mockRejectedValue(new Error('offline'));
        el = await render();
        expect(el.innerHTML).toBe('');
    });
});

describe('Más › App — manual check (native)', () => {
    beforeEach(() => { native = true; });

    it('newer version → "Actualizar a v1.2" + notes; tapping downloads like the banner', async () => {
        await render();
        let resolve!: (v: unknown) => void;
        fetchMock.mockReturnValue(new Promise((r) => { resolve = r; }));
        await act(async () => ($('app-check') as HTMLButtonElement).click());
        expect($('app-check')!.getAttribute('data-state')).toBe('checking');
        expect($('app-check-label')!.textContent).toBe('Buscando…');
        await act(async () => resolve({ ok: true, json: async () => manifest(3, '1.2') }));
        await flush();
        expect($('app-check-label')!.textContent).toBe('Actualizar a v1.2');
        expect($('app-check-sub')!.textContent).toBe('Barra de navegación ahora se funde con el fondo');
        await act(async () => ($('app-check') as HTMLButtonElement).click());
        expect(hrefSet).toBe('https://github.com/x/releases/download/v1.2/korex.apk');
    });

    it('up to date → "Ya tienes la última versión (v1.1)"', async () => {
        serve(manifest(2, '1.1'));
        await render();
        await act(async () => ($('app-check') as HTMLButtonElement).click());
        await flush();
        expect($('app-check')!.getAttribute('data-state')).toBe('current');
        expect($('app-check-sub')!.textContent).toBe('Ya tienes la última versión (v1.1)');
    });

    it('fetch fails → "No se pudo comprobar. Revisa tu conexión."', async () => {
        fetchMock.mockRejectedValue(new Error('offline'));
        await render();
        await act(async () => ($('app-check') as HTMLButtonElement).click());
        await flush();
        expect($('app-check-sub')!.textContent).toBe('No se pudo comprobar. Revisa tu conexión.');
    });

    it('ignores the banner mute and the 6 h cache: always a fresh fetch', async () => {
        localStorage.setItem(MUTE_KEY, JSON.stringify({ version_code: 3, until: Date.now() + 3_600_000 }));
        localStorage.setItem(LAST_KEY, JSON.stringify({ at: Date.now(), manifest: manifest(2, '1.1') }));
        serve(manifest(3, '1.2'));
        await render();
        await act(async () => ($('app-check') as HTMLButtonElement).click());
        await flush();
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect($('app-check-label')!.textContent).toBe('Actualizar a v1.2');
    });
});
