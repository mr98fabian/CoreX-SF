/**
 * The copper line (misión 18, direccion-de-arte §4.3). Copper is a fixed track; the funda
 * (what is still owed) sits on top and shrinks with transform only — never width.
 * `done` is 0…1 of TIME travelled (decisión b de Fabian: months of the plan, see
 * lib/lineProgress) — never a money subtraction on the screen.
 * Mount: still. Moves forward: 480 ms + one 240 ms glint. Moves back: 240 ms, no glint.
 */
import { useState } from 'react';

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

export function CopperLine({ done, label, className }: { done: number; label: string; className?: string }) {
    const d = clamp01(done);
    // Previous value kept in state (React's "adjust state on prop change" pattern)
    const [prev, setPrev] = useState(d);
    const [dir, setDir] = useState<'up' | 'down' | null>(null);
    const [glint, setGlint] = useState(0);
    if (d !== prev) {
        setPrev(d);
        setDir(d > prev ? 'down' : 'up'); // more travelled = less debt ahead
        if (d > prev) setGlint(glint + 1);
    }
    const pct = Math.round(d * 100);
    return (
        <div className={['kx-line', className].filter(Boolean).join(' ')} role="progressbar" aria-label={label}
            aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} data-testid="copper-line"
            data-dir={dir ?? undefined} data-flash={dir === 'down' && glint > 0 ? '' : undefined}
            data-edge={d <= 0 || d >= 1 ? '' : undefined}
            style={{ '--kx-done': d } as React.CSSProperties}>
            <span className="kx-line__track" aria-hidden="true">
                <span className="kx-line__copper" />
                <span key={glint} className="kx-line__glint" />
                <span className="kx-line__funda" />
            </span>
            <span className="kx-line__cut" aria-hidden="true" />
        </div>
    );
}
