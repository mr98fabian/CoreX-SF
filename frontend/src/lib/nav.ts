/**
 * The ONE navigation source (misión "Navegación top-5").
 * PRIMARY = the mobile tab bar (exactly these 5, in this order) and the top of the
 * sidebar/hamburger. MORE = only in the sidebar/hamburger, under "Más".
 * No section appears in both groups. Panel de Crédito has no entry: it lives in Cuentas.
 */
import type { ComponentType } from 'react';
import { Activity, Gavel, Clock, Target, BarChart3, Trophy, Settings } from 'lucide-react';
import { KxAccounts, KxCalendar, KxHome, KxPlan, KxSubscriptions } from '@/components/kx/icons';

export interface NavItem {
    to: string;
    /** LanguageContext key */
    labelKey: string;
    /** Primary: the kx «trazo de cable» icons (copper tip when `lit`). More: lucide. */
    icon: ComponentType<{ className?: string; size?: number; strokeWidth?: number; lit?: boolean; 'aria-hidden'?: boolean | 'true' | 'false' }>;
}

export const NAV_PRIMARY: readonly NavItem[] = [
    { to: '/dashboard', labelKey: 'nav.home', icon: KxHome },
    { to: '/dashboard/calendar', labelKey: 'nav.calendar', icon: KxCalendar },
    { to: '/dashboard/action-plan', labelKey: 'nav.plan', icon: KxPlan },
    { to: '/dashboard/accounts', labelKey: 'nav.accountsShort', icon: KxAccounts },
    { to: '/dashboard/subscriptions', labelKey: 'nav.subscriptions', icon: KxSubscriptions },
];

export const NAV_MORE: readonly NavItem[] = [
    { to: '/dashboard/activity', labelKey: 'nav.activity', icon: Activity },
    { to: '/dashboard/judge', labelKey: 'nav.judge', icon: Gavel },
    { to: '/dashboard/money-clock', labelKey: 'nav.moneyClock', icon: Clock },
    { to: '/dashboard/goals', labelKey: 'nav.goals', icon: Target },
    { to: '/dashboard/analytics', labelKey: 'nav.analysis', icon: BarChart3 },
    { to: '/dashboard/rankings', labelKey: 'nav.rankings', icon: Trophy },
    { to: '/dashboard/settings', labelKey: 'nav.settingsShort', icon: Settings },
];

/**
 * The ONE active rule, for the tab bar and the sidebar alike: route-prefix match
 * (segment-aware), except Inicio, which is exact — /dashboard does not light up on
 * /dashboard/calendar. So action-plan/full → Plan, accounts/manage → Cuentas,
 * settings/* → Ajustes.
 */
export function isNavActive(pathname: string, to: string): boolean {
    const path = pathname.replace(/\/+$/, '') || '/';
    if (to === '/dashboard') return path === '/dashboard';
    return path === to || path.startsWith(`${to}/`);
}
