/**
 * KoreX motion system (Fase 6.1) — the ONLY source of durations and curves.
 * Screens never write their own: they import from here (JS) or use the
 * matching CSS tokens in styles/kx.css (--kx-dur-*, --kx-ease-*).
 *
 * Rules: nothing lasts more than 700 ms, nothing blocks an action, only
 * transform / opacity / colors / background-position are animated (no layout
 * properties), and prefers-reduced-motion turns everything static.
 */
import { useEffect, useState } from 'react';

export const DURATION = {
    fast: 0.12,        // presses, hovers
    base: 0.24,        // tab changes, small reveals
    slow: 0.48,        // calendar month, stage color, stripe sweep
    celebration: 0.7,  // PAGADA stamp — the longest anything runs
} as const;

/** Soft exponential ease-out: quick start, long gentle landing. */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];
export const EASE_OUT_CSS = 'cubic-bezier(0.16, 1, 0.3, 1)';

/** The one spring in the system — only for the PAGADA stamp's landing bounce. */
export const STAMP_SPRING = { type: 'spring', stiffness: 520, damping: 22, mass: 0.9 } as const;

/** Hero number count after a payment (must finish within 600 ms). */
export const COUNT_MS = 560;

export const MAX_MS = 700;

const QUERY = '(prefers-reduced-motion: reduce)';

export function prefersReducedMotion(): boolean {
    try {
        return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(QUERY).matches;
    } catch {
        return false;
    }
}

/** Live reduced-motion flag (updates if the user flips the OS setting). */
export function useReducedMotion(): boolean {
    const [reduced, setReduced] = useState(prefersReducedMotion);
    useEffect(() => {
        if (!window.matchMedia) return;
        const mq = window.matchMedia(QUERY);
        const on = () => setReduced(mq.matches);
        mq.addEventListener?.('change', on);
        return () => mq.removeEventListener?.('change', on);
    }, []);
    return reduced;
}

/** framer-motion transition built from the tokens (instant when reduced). */
export function tx(name: keyof typeof DURATION, reduced = false) {
    return reduced ? { duration: 0 } : { duration: DURATION[name], ease: EASE_OUT };
}
