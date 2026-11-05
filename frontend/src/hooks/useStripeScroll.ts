import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * The living stripe: writes --kx-scroll (0→1, page scroll progress) on the
 * element so its light travels as you scroll. Reads whichever scrolled last:
 * the nearest scrolling ancestor or the window/document. One rAF per frame,
 * no React re-renders. Reduced motion, or a device that can't keep up (≤ 2
 * cores), keeps the stripe static — no errors.
 */
function scrollParent(el: HTMLElement | null): HTMLElement | null {
    for (let n = el?.parentElement; n; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY;
        if (oy === 'auto' || oy === 'scroll') return n; // the scroller may not overflow yet (content still loading)
    }
    return null;
}

export function useStripeScroll<T extends HTMLElement>() {
    const ref = useRef<T>(null);
    useEffect(() => {
        const el = ref.current;
        if (!el || prefersReducedMotion() || (navigator.hardwareConcurrency || 4) <= 2) return;
        try {
            // Listen where the scroll really happens: the nearest scrolling ancestor
            // if it scrolls, and the document as a fallback (on mobile Chrome the
            // page often scrolls the window even when a div is overflow:auto).
            const box = scrollParent(el);
            const doc = () => document.scrollingElement ?? document.documentElement;
            let source: HTMLElement | null = box;
            let frame = 0;
            const update = () => {
                frame = 0;
                const s = source ?? doc();
                const max = s.scrollHeight - s.clientHeight;
                el.style.setProperty('--kx-scroll', (max > 0 ? Math.min(1, Math.max(0, s.scrollTop / max)) : 0).toFixed(3));
            };
            const fromBox = () => { source = box; if (!frame) frame = requestAnimationFrame(update); };
            const fromWindow = () => { source = null; if (!frame) frame = requestAnimationFrame(update); };
            update();
            box?.addEventListener('scroll', fromBox, { passive: true });
            window.addEventListener('scroll', fromWindow, { passive: true });
            return () => {
                box?.removeEventListener('scroll', fromBox);
                window.removeEventListener('scroll', fromWindow);
                if (frame) cancelAnimationFrame(frame);
            };
        } catch {
            return undefined; // static stripe
        }
    }, []);
    return ref;
}
