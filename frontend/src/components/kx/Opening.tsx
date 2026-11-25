/**
 * The opening (misión 18, direccion-de-arte §4.4): the logo, a closed line that opens by
 * itself from the centre, one glint, and an iris on #root that reveals the app — mounted
 * underneath from ms 0, so the opening never delays anything. All timing is CSS (kx.css);
 * this only decides whether it runs and removes it. 1000 ms; a tap ends it at once; once
 * per session, only on a cold start into the app. Reduced motion: a 150 ms fade.
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { OPENING_MS, prefersReducedMotion } from '@/lib/motion';
import { shouldOpen } from '@/lib/opening';

const REDUCED_MS = 150;

export function Opening({ pathname }: { pathname: string }) {
    const [on, setOn] = useState(() => shouldOpen(pathname));

    // Before the first paint: clip #root so the iris can open it
    useLayoutEffect(() => {
        if (!on) return;
        const html = document.documentElement;
        html.classList.add('kx-opening');
        return () => html.classList.remove('kx-opening');
    }, [on]);

    useEffect(() => {
        if (!on) return;
        const end = () => setOn(false);
        const t = window.setTimeout(end, prefersReducedMotion() ? REDUCED_MS : OPENING_MS);
        window.addEventListener('pointerdown', end, { capture: true, once: true });
        return () => { window.clearTimeout(t); window.removeEventListener('pointerdown', end, { capture: true }); };
    }, [on]);

    if (!on) return null;
    return createPortal(
        <div className="kx-open" aria-hidden="true" data-testid="opening">
            <span className="kx-open__logo" />
            <span className="kx-line">
                <span className="kx-line__track">
                    <span className="kx-line__copper" />
                    <span className="kx-line__glint" />
                    <span className="kx-line__funda" />
                    <span className="kx-line__funda" />
                </span>
                <span className="kx-line__cut" />
                <span className="kx-line__cut" />
            </span>
        </div>,
        document.body,
    );
}
