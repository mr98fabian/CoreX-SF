import { useEffect, useRef } from 'react';
import { prefersReducedMotion } from '@/lib/motion';

/**
 * The living stripe: writes --kx-scroll (0→1, page scroll progress) on the
 * element so its light travels as you scroll. Reads the nearest scrolling
 * ancestor (the app scrolls a div, the landing the window), one rAF per frame,
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
            const box = scrollParent(el);
            const target: HTMLElement | Window = box ?? window;
            let frame = 0;
            const update = () => {
                frame = 0;
                const top = box ? box.scrollTop : window.scrollY;
                const max = box ? box.scrollHeight - box.clientHeight : document.documentElement.scrollHeight - window.innerHeight;
                el.style.setProperty('--kx-scroll', (max > 0 ? Math.min(1, Math.max(0, top / max)) : 0).toFixed(3));
            };
            const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
            update();
            target.addEventListener('scroll', onScroll, { passive: true });
            return () => { target.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
        } catch {
            return undefined; // static stripe
        }
    }, []);
    return ref;
}
