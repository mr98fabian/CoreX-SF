/**
 * KoreX moments (Fase 6.1). Every duration/curve comes from lib/motion.
 * With prefers-reduced-motion each one renders its final state, static.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { COUNT_MS, DURATION, EASE_OUT, STAMP_SPRING, useReducedMotion } from '@/lib/motion';
import { useFormatMoney } from '@/hooks/useFormatMoney';

/**
 * Counts a number from its previous value to the new one (≤ 600 ms) — e.g.
 * the total debt after a payment. The final value is always the real one
 * from the server; while counting, the moving digits are aria-hidden and the
 * real value is what assistive tech reads (no intermediate value is "real").
 */
export function CountUp({ value, format, label, className }: { value: number; format: (n: number) => ReactNode; label: (n: number) => string; className?: string }) {
    const reduced = useReducedMotion();
    const [shown, setShown] = useState(value);
    const [counting, setCounting] = useState(false);
    const from = useRef(value);

    useEffect(() => {
        const start = from.current;
        from.current = value;
        if (reduced || start === value) return; // display falls back to the real value
        let raf = 0;
        let t0 = 0;
        const step = (t: number) => {
            if (!t0) { t0 = t; setCounting(true); }
            const p = Math.min(1, (t - t0) / COUNT_MS);
            const eased = 1 - Math.pow(1 - p, 4); // expo-like ease-out, same feel as EASE_OUT
            setShown(start + (value - start) * eased);
            if (p < 1) raf = requestAnimationFrame(step);
            else { setShown(value); setCounting(false); }
        };
        raf = requestAnimationFrame(step);
        return () => cancelAnimationFrame(raf);
    }, [value, reduced]);

    return (
        <span className={className} data-counting={counting || undefined}>
            <span aria-hidden="true">{format(counting ? shown : value)}</span>
            <span className="sr-only">{label(value)}</span>
        </span>
    );
}

/** A check that draws itself (payment confirmed). */
export function DrawnCheck({ className = 'h-4 w-4' }: { className?: string }) {
    const reduced = useReducedMotion();
    return (
        <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <motion.path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round"
                initial={reduced ? false : { pathLength: 0 }} animate={{ pathLength: 1 }}
                transition={reduced ? { duration: 0 } : { duration: DURATION.base, ease: EASE_OUT }} />
        </svg>
    );
}

/** Wraps the PAGADA stamp so it drops in with a small bounce when `drop` is set. */
export function StampDrop({ drop, children }: { drop: boolean; children: React.ReactNode }) {
    const reduced = useReducedMotion();
    if (!drop || reduced) return <>{children}</>;
    return (
        <motion.span className="inline-block" data-kx-motion="stamp"
            initial={{ y: -26, rotate: -10, scale: 1.18, opacity: 0 }}
            animate={{ y: 0, rotate: 0, scale: 1, opacity: 1 }}
            transition={STAMP_SPRING}>
            {children}
        </motion.span>
    );
}

/** A money figure that never changes abruptly: counts to the new value (CountUp + the user's currency). */
export function MoneyCount({ value, className }: { value: number; className?: string }) {
    const { formatMoney } = useFormatMoney();
    return <CountUp value={value} format={(n) => formatMoney(n)} label={(n) => formatMoney(n)} className={className} />;
}
