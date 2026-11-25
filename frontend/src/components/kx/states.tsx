/**
 * Composition pieces of «Cobre a la vista» (misión 19, direccion-de-arte §5.1 and §6):
 * the empty state, the error state, and the vertical line (the M18 copper line, turned).
 * Plain language, no mascot, no exclamations.
 */
import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CopperLine } from './CopperLine';
import { KxAlert, type KxIconProps } from './icons';

const BTN = 'kx-press inline-flex min-h-[44px] items-center justify-center rounded-xl border border-kx-line px-5 text-sm font-semibold text-kx-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-kx-amber';

/** Empty: the section's icon (40 px, ink-3), one line, one button. */
export function EmptyState({ icon: Icon, text, action, to, onAction }: {
    icon: ComponentType<KxIconProps>; text: string; action: string; to?: string; onAction?: () => void;
}) {
    return (
        <div data-testid="empty-state" className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-kx-ink3"><Icon size={40} lit={false} /></span>
            <p className="text-[15px] text-kx-ink2">{text}</p>
            {to ? <Link to={to} className={BTN}>{action}</Link> : <button type="button" onClick={onAction} className={BTN}>{action}</button>}
        </div>
    );
}

/** Error: icon 17, what happened, Reintentar. */
export function ErrorState({ text, retry, onRetry }: { text: string; retry: string; onRetry: () => void }) {
    return (
        <div data-testid="error-state" role="alert" className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="text-kx-ink3"><KxAlert size={40} lit={false} /></span>
            <p className="text-[15px] text-kx-ink2">{text}</p>
            <button type="button" onClick={onRetry} className={BTN}>{retry}</button>
        </div>
    );
}

/**
 * The copper line, vertical: the same M18 component turned 90° (top = travelled, copper;
 * bottom = what is left, funda). `height` in px; it sits 16 px from its container's left edge.
 */
export function VerticalLine({ done, height, label }: { done: number; height: number; label: string }) {
    return (
        <div aria-hidden={false} data-testid="vertical-line" className="pointer-events-none absolute top-0 overflow-hidden" style={{ left: 16, width: 14, height }}>
            <div style={{ width: height, transform: 'rotate(90deg) translateY(-14px)', transformOrigin: '0 0' }}>
                <CopperLine done={done} label={label} />
            </div>
        </div>
    );
}

/** A plain 10 px connector in the funda colour (Inicio: from the hero down to the mission). */
export function Connector({ children }: { children: ReactNode }) {
    return (
        <div className="relative pl-7" data-testid="connector">
            <span aria-hidden="true" className="absolute bottom-0 left-[6px] top-0 w-[10px] rounded-full bg-[var(--kx-funda)]" style={{ boxShadow: 'inset -1px 0 0 var(--kx-funda-sombra)' }} />
            {children}
        </div>
    );
}
