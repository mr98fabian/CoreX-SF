/**
 * GET /api/strategy/command-center through React Query (misión 2026-11-22-command-center-cache):
 * returning to the Plan de ataque paints the cached plan at once and refreshes it behind (same
 * staleTime as kx-summary). Freshness is NOT handled here: the key is in lib/planSync
 * PLAN_QUERY_KEYS, so every plan write (payment, attack, account, cashflow…) and
 * useKxSummary().reload invalidate it with the rest of the plan.
 */
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { COMMAND_CENTER_KEY } from '@/lib/planSync';
import type { MissionResult } from '@/components/kx/MissionCard';

export interface CommandCenter {
    excedente?: { mensual: number | null; suscripciones_mensuales: number; comido_por_suscripciones: boolean };
    mision?: MissionResult;
    morning_briefing: {
        recommended_action: { amount: number; destination: string; destination_balance: number; destination_apr: number; reason: string } | null;
        impact?: { interest_saved_monthly?: number };
    } | null;
    confidence_meter?: { debts_ranked?: { name: string; apr: number; balance: number; is_target: boolean; daily_cost?: number }[]; strategy?: string };
}

export const COMMAND_CENTER_STALE_MS = 45_000;

export function useCommandCenter() {
    const { user } = useAuth();
    return useQuery({
        queryKey: [COMMAND_CENTER_KEY, user?.id ?? 'anon'],
        queryFn: () => apiFetch<CommandCenter>('/api/strategy/command-center'),
        staleTime: COMMAND_CENTER_STALE_MS,
    });
}
