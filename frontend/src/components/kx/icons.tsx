/**
 * «Trazo de cable» icons (misión 18, direccion-de-arte §3). 24 grid, 2 px stroke, round
 * caps and joins, no fill. Each icon is exactly two strokes: the line (currentColor) and
 * ONE copper tip at its open end — lit in copper, or the line colour when not lit.
 * Utility glyphs (back, close, edit…) stay on lucide, without a tip.
 */
import type { ReactElement } from 'react';

export interface KxIconProps {
    className?: string;
    size?: number;
    /** Copper tip on (active tab, or any non-navigation use). Default: on. */
    lit?: boolean;
    /** Accepted for lucide compatibility; the stroke is always 2. */
    strokeWidth?: number;
    'aria-hidden'?: boolean | 'true' | 'false';
}

type KxIcon = ((p: KxIconProps) => ReactElement) & { displayName: string };

// [line, tip] per icon, in the order of the design document
export const GLYPHS = {
    Home: ['M17 20H4V10l8-6 8 6v4M10 20v-5h4v5', 'M20 14v3'],
    Calendar: ['M8 3v4M16 3v4M4 10h16M20 14V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12', 'M18 20h3'],
    Plan: ['M6 4h8a3.5 3.5 0 0 1 0 7h-4a3.5 3.5 0 0 0 0 7', 'M10 18h6'],
    Accounts: ['M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M21 10H5M7 15h3', 'M5 10H2'],
    Subscriptions: ['M8 3v4M12 3v4M6 7h8v3a4 4 0 0 1-8 0ZM10 14v2a3.5 3.5 0 0 0 7 0v-5', 'M17 11V8'],
    Mission: ['M5 8h15M12 13 9.5 4.5M12 13l2.5-8.5M12 13l-4 8M12 13l4 8', 'M2 8h3'],
    Shield: ['M14.5 4.3 20 6v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6l5.5-1.7', 'M12 3v3'],
    Cut: ['M2 12h17M7 6a2 2 0 1 1-4 0 2 2 0 0 1 4 0M7 18a2 2 0 1 1-4 0 2 2 0 0 1 4 0M6.6 7.2 19 18M6.6 16.8 19 6', 'M19 12h3'],
    Due: ['M12 6a7 7 0 1 1 0 14 7 7 0 0 1 0-14M12 10v3l2 2', 'M12 3v3'],
    Payday: ['M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4M12 6v7M8 9l4 4 4-4', 'M12 3v3'],
    Interest: ['M2 15h7M15 15h4M10.5 11 9.5 9M12 10.5V8M13.5 11l1-2', 'M19 15h3'],
    Bank: ['M3 9l9-5 9 5M3 9h18M6 12v5M12 12v5M18 12v5M3 20h16', 'M19 20h3'],
    Paid: ['M5 12.5 9.5 17l6-6', 'M15.5 11 19 7.5'],
    Free: ['M5 9h3a3 3 0 0 1 0 6H5ZM11 10.5h2M11 13.5h2M16 7h4v10h-4Z', 'M2 12h3'],
    Add: ['M12 5v14M5 12h11', 'M16 12h3'],
    Settings: ['M12 4a8 8 0 1 1 0 16 8 8 0 0 1 0-16M9 15h6', 'M12 8v4'],
    Alert: ['M6 16v-5a6 6 0 0 1 12 0v5l2 2H4l2-2M10 21h4', 'M12 2v3'],
    Explain: ['M9 18h6M10 21h4M9 15.5a6 6 0 1 1 6 0', 'M10 11l2 2 2-2'],
} as const satisfies Record<string, readonly [string, string]>;

export type KxIconName = keyof typeof GLYPHS;

function make(name: KxIconName): KxIcon {
    const [line, tip] = GLYPHS[name];
    const Icon = ({ className, size = 24, lit = true, 'aria-hidden': hidden = true }: KxIconProps) => (
        <svg viewBox="0 0 24 24" width={size} height={size} className={className} fill="none" strokeWidth={2}
            strokeLinecap="round" strokeLinejoin="round" aria-hidden={hidden} data-kx-icon={name}>
            <path d={line} stroke="currentColor" />
            <path d={tip} stroke={lit ? 'var(--kx-amber)' : 'currentColor'} data-tip="" />
        </svg>
    );
    Icon.displayName = `Kx${name}Icon`;
    return Icon as KxIcon;
}

export const KxHome = make('Home');
export const KxCalendar = make('Calendar');
export const KxPlan = make('Plan');
export const KxAccounts = make('Accounts');
export const KxSubscriptions = make('Subscriptions');
export const KxMission = make('Mission');
export const KxShield = make('Shield');
export const KxCut = make('Cut');
export const KxDue = make('Due');
export const KxPayday = make('Payday');
export const KxInterest = make('Interest');
export const KxBank = make('Bank');
export const KxPaid = make('Paid');
export const KxFree = make('Free');
export const KxAdd = make('Add');
export const KxSettings = make('Settings');
export const KxAlert = make('Alert');
export const KxExplain = make('Explain');
