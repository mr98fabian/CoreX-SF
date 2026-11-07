import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';

vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));

import { MoneyCount } from './motion';
import LoadingScreen from '@/components/LoadingScreen';
import css from '@/styles/kx.css?raw';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
function render(node: ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    act(() => root.render(node));
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });
const setMotion = (reduce: boolean) => {
    window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {} })) as unknown as typeof window.matchMedia;
};

describe('pulido', () => {
    it('MoneyCount shows the real value and, with reduced motion, jumps straight to a new one', () => {
        setMotion(true);
        const el = render(<MoneyCount value={100} />);
        expect(el.textContent).toContain('$100.00');
        act(() => root.render(<MoneyCount value={250} />));
        expect(el.querySelector('[data-counting]')).toBeNull();
        expect(el.textContent).toContain('$250.00');
    });

    it('MoneyCount counts (not a hard swap) when motion is allowed', async () => {
        setMotion(false);
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length; });
        vi.stubGlobal('cancelAnimationFrame', () => undefined);
        const el = render(<MoneyCount value={100} />);
        act(() => root.render(<MoneyCount value={200} />));
        act(() => { frames.shift()?.(0); });
        act(() => { frames.shift()?.(120); });
        expect(el.querySelector('[data-counting]')).not.toBeNull();
        vi.unstubAllGlobals();
    });

    it('splash: the logo breathes once, no fake progress bar', () => {
        const el = render(<LoadingScreen />);
        expect(el.querySelector('[data-testid="splash-logo"]')?.className).toContain('kx-breathe');
        expect(el.textContent).toBe('');
    });

    it('every new motion is cancelled under prefers-reduced-motion and stays ≤ 900 ms', () => {
        const block = css.slice(css.indexOf('Pulido (2026-11)'));
        const reduced = block.slice(block.indexOf('@media (prefers-reduced-motion: reduce)'));
        for (const cls of ['.kx-page', '.kx-breathe', '.kx-shimmer', '.kx-stage-bar']) expect(reduced).toContain(cls);
        expect(block).toMatch(/kx-breathe 850ms/);
    });
});
