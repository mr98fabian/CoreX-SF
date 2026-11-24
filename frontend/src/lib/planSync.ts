/**
 * The plan's cached data, refreshed together (rule 7: one source, same numbers).
 * Every plan write (lib/planEvents) and useKxSummary().reload invalidate the same
 * keys, so Inicio, the calendar (its daily series rides in kx-summary), Actividad
 * and Cuentas move as one after a payment, an attack or an account/cashflow change.
 */
import type { QueryClient } from '@tanstack/react-query';
import { ACTIVITY_KEY } from '@/hooks/useActivityData';
import { CALENDAR_KEY } from '@/lib/calendarEvents';

export const KX_SUMMARY_KEY = 'kx-summary';
export const COMMAND_CENTER_KEY = 'command-center'; // hooks/useCommandCenter (Plan de ataque)

export const PLAN_QUERY_KEYS: readonly string[] = [
    KX_SUMMARY_KEY,     // dashboard + accounts + freedom-path (timeline + daily_series) + cashflow
    COMMAND_CENTER_KEY, // today's attack, the avalanche route, the surplus line
    ACTIVITY_KEY,
    'credit-panel',
    CALENDAR_KEY,       // the calendar's events (server)
    'velocity-compare', // Inicio's chart (hooks/useVelocityCompare COMPARE_KEY)
    'accounts',         // hooks/useAccounts
    'dashboard',
    'cuts',
];

export function invalidatePlanData(qc: QueryClient) {
    return Promise.all(PLAN_QUERY_KEYS.map((k) => qc.invalidateQueries({ queryKey: [k] })));
}
