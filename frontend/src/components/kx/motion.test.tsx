import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { CountUp, DrawnCheck, StampDrop } from './motion';

// React's act() environment flag for a bare react-dom test
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mockReducedMotion(reduce: boolean) {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
        matches: reduce && q.includes('reduce'), media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
    })) as unknown as typeof window.matchMedia;
}

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});
afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(host);
});

const fmt = (n: number) => `$${n.toFixed(0)}`;

describe('reduced motion mounts no animation', () => {
    it('StampDrop renders the stamp without the animated wrapper', () => {
        mockReducedMotion(true);
        act(() => root.render(<StampDrop drop><span>PAGADA</span></StampDrop>));
        expect(host.textContent).toBe('PAGADA');
        expect(host.querySelector('[data-kx-motion="stamp"]')).toBeNull();
    });

    it('StampDrop animates when motion is allowed', () => {
        mockReducedMotion(false);
        act(() => root.render(<StampDrop drop><span>PAGADA</span></StampDrop>));
        expect(host.querySelector('[data-kx-motion="stamp"]')).not.toBeNull();
    });

    it('CountUp jumps straight to the real value, never counting', () => {
        mockReducedMotion(true);
        act(() => root.render(<CountUp value={1000} format={fmt} label={fmt} />));
        act(() => root.render(<CountUp value={800} format={fmt} label={fmt} />));
        const el = host.firstElementChild as HTMLElement;
        expect(el.dataset.counting).toBeUndefined();
        expect(host.querySelector('[aria-hidden="true"]')?.textContent).toBe('$800');
        expect(host.querySelector('.sr-only')?.textContent).toBe('$800');
    });

    it('DrawnCheck still renders the full check', () => {
        mockReducedMotion(true);
        act(() => root.render(<DrawnCheck />));
        expect(host.querySelector('path')).not.toBeNull();
    });
});

describe('CountUp never presents an intermediate value as real', () => {
    it('screen readers get the final value while the digits move', () => {
        mockReducedMotion(false);
        act(() => root.render(<CountUp value={1000} format={fmt} label={fmt} />));
        act(() => root.render(<CountUp value={800} format={fmt} label={fmt} />));
        expect(host.querySelector('.sr-only')?.textContent).toBe('$800');
    });
});
