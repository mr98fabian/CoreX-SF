import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import layoutSrc from './DashboardLayout.tsx?raw';
import kxSrc from '@/components/kx/index.tsx?raw';
import capConfig from '../../capacitor.config.ts?raw';
import indexHtml from '../../index.html?raw';
import kxCss from '@/styles/kx.css?raw';
import authSrc from '@/features/auth/AuthContext.tsx?raw';
import capHookSrc from '@/hooks/useCapacitor.ts?raw';

/**
 * Shell móvil parte 3 (2026-11-12). The APK "split in half" because the Keyboard
 * plugin (resizeOnFullScreen) shrank the whole view and didn't always restore it.
 * Now: no plugin touches the view height, the tab bar lives in the shell's flex
 * column (not fixed), and the keyboard is dismissed with focus before leaving.
 */
const pages = import.meta.glob('/src/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('Shell architecture', () => {
    it('no plugin resizes the view: resizeOnFullScreen false, no iOS-only resize, viewport resizes-content', () => {
        expect(capConfig).toMatch(/resizeOnFullScreen:\s*false/);
        expect(capConfig).not.toMatch(/resize:\s*'body'/);
        expect(indexHtml).toContain('viewport-fit=cover, interactive-widget=resizes-content');
    });

    it('the tab bar is in the flow (last child of the <main> column), never fixed', () => {
        const tabSrc = kxSrc.slice(kxSrc.indexOf('export function TabBar'), kxSrc.indexOf('export function TabBar') + 1600);
        expect(tabSrc).not.toMatch(/\bfixed\b/);
        expect(tabSrc).toContain('shrink-0');
        const pane = layoutSrc.indexOf('overflow-y-auto');
        const tab = layoutSrc.indexOf('<TabBar />');
        expect(pane).toBeGreaterThan(0);
        expect(tab).toBeGreaterThan(pane);
        expect(tab).toBeLessThan(layoutSrc.indexOf('</main>'));
        expect(layoutSrc).toMatch(/<main className="flex-1 flex flex-col min-w-0 min-h-0/);
    });

    it('only the content pane scrolls: shell 100dvh, document locked, pane flex-1 min-h-0 overflow-y-auto', () => {
        expect(layoutSrc).toContain('h-[100dvh]');
        expect(kxCss).toMatch(/html\.kx-app-shell, html\.kx-app-shell body \{ height: 100%; overflow: hidden;/);
        expect(layoutSrc).toMatch(/className="flex-1 min-h-0 overflow-y-auto/);
    });

    it('no page keeps the old pb-28 patch for a fixed tab bar', () => {
        const offenders = Object.entries(pages).filter(([path, src]) => !path.includes('.test.') && /\bpb-28\b/.test(src)).map(([p]) => p);
        expect(offenders).toEqual([]);
    });

    it('safe areas and colours untouched', () => {
        expect(indexHtml).toContain('viewport-fit=cover');
        expect(kxCss).toContain('--kx-safe-top: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px));');
        expect(kxSrc).toContain('pb-[max(18px,var(--kx-safe-bottom))]');
    });

    it('self-repair: the keyboard is dismissed on pause and before the Google redirect', () => {
        expect(capHookSrc).toMatch(/addListener\('pause', \(\) => dismissKeyboard\(\)\)/);
        const google = authSrc.slice(authSrc.indexOf('skipBrowserRedirect: true'));
        expect(google.indexOf('dismissKeyboard()')).toBeGreaterThan(0);
        expect(google.indexOf('dismissKeyboard()')).toBeLessThan(google.indexOf('window.location.href = data.url'));
    });
});

// ── Behaviour: tab bar hides with the keyboard; dismissKeyboard blurs ──

let native = false;
const listeners: Record<string, () => void> = {};
const hide = vi.fn(async () => undefined);
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native } }));
vi.mock('@capacitor/keyboard', () => ({
    Keyboard: {
        hide: () => hide(),
        addListener: (ev: string, fn: () => void) => { listeners[ev] = fn; return Promise.resolve({ remove: () => undefined }); },
    },
}));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', t: (k: string) => k }) }));

import { TabBar } from '@/components/kx';
import { dismissKeyboard } from '@/lib/keyboard';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
    await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
    return host;
}
beforeEach(() => { native = false; hide.mockClear(); for (const k of Object.keys(listeners)) delete listeners[k]; });
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Shell behaviour', () => {
    it('APK: the tab bar hides while the keyboard is open and comes back when it closes; keeps 5 items', async () => {
        native = true;
        const el = await render(<TabBar />);
        const bar = () => el.querySelector('[data-testid="tabbar"]')!;
        expect(bar().querySelectorAll('a')).toHaveLength(5);
        expect(bar().className).toContain('flex');
        await act(async () => listeners.keyboardWillShow());
        expect(bar().getAttribute('data-keyboard')).toBe('open');
        expect(bar().className.split(' ')).toContain('hidden');
        await act(async () => listeners.keyboardWillHide());
        expect(bar().getAttribute('data-keyboard')).toBe('closed');
        expect(bar().className.split(' ')).not.toContain('hidden');
    });

    it('dismissKeyboard blurs the focused field and, in the APK, closes the keyboard', () => {
        native = true;
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();
        expect(document.activeElement).toBe(input);
        dismissKeyboard();
        expect(document.activeElement).not.toBe(input);
        expect(hide).toHaveBeenCalledTimes(1);
        input.remove();
    });

    it('closing a sheet leaves no residual styles on body', async () => {
        const Demo = ({ open }: { open: boolean }) => (
            <Sheet open={open}><SheetContent side="bottom"><SheetTitle>t</SheetTitle><SheetDescription>d</SheetDescription><input /></SheetContent></Sheet>
        );
        await render(<Demo open />);
        await act(async () => root.render(<MemoryRouter><Demo open={false} /></MemoryRouter>));
        await act(async () => { await new Promise((r) => setTimeout(r, 50)); });
        expect(document.body.style.pointerEvents).toBe('');
        expect(document.body.style.overflow).toBe('');
        expect(document.body.style.paddingRight).toBe('');
    });
});
