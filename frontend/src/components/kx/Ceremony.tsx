/**
 * The $0 ceremony (misión 19, direccion-de-arte §4.6), inside the row: the funda goes
 * entirely (480 ms), the copper glints (460–700 ms, the M18 line), the PAGADA stamp lands at
 * 700 ms; the balance counts to $0 on its own (MoneyCount). 1.3 s at most, never blocks a
 * tap, no confetti, no mascot, no sound. Reduced motion: the final state, still.
 */
import { useEffect, useState } from 'react';
import { CopperLine } from './CopperLine';
import { StampDrop } from './motion';
import { PaidStamp } from './index';
import { useReducedMotion } from '@/lib/motion';

export const STAMP_AT_MS = 700;

export function PaidLine({ label, ceremony }: { label: string; ceremony: boolean }) {
    const reduced = useReducedMotion();
    const run = ceremony && !reduced;
    const [done, setDone] = useState(run ? 0 : 1);
    const [stamp, setStamp] = useState(!run);
    useEffect(() => {
        if (!run) return;
        const raf = requestAnimationFrame(() => setDone(1)); // next frame: the funda goes (480 ms)
        const t = window.setTimeout(() => setStamp(true), STAMP_AT_MS);
        return () => { cancelAnimationFrame(raf); window.clearTimeout(t); };
    }, [run]);
    return (
        <span className="mt-2 flex items-center gap-3" data-testid="paid-line">
            <span className="min-w-0 flex-1"><CopperLine done={done} label={label} /></span>
            <span className="flex-none" data-testid="paid-stamp-slot">{stamp && <StampDrop drop={run}><PaidStamp /></StampDrop>}</span>
        </span>
    );
}
