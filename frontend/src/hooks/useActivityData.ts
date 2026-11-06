/**
 * Actividad's data on React Query (perf 2026-11-05), same pattern as
 * useKxSummary: ONE shared entry per signed-in user, staleTime 45 s.
 * Re-entering Actividad paints from cache instantly and revalidates behind;
 * reload() invalidates the entry.
 *   /api/transactions/all?limit=100   applied movements
 *   /api/strategy/executed-logs        plan moves
 *   /api/tokens/audit                  what your AI did with a token
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';

export const ACTIVITY_KEY = 'kx-activity';
export const ACTIVITY_STALE_MS = 45_000;

export interface ActivityTx { id: number; date: string; amount: number; description: string; category: string; account_id: number | null; account_name: string }
export interface ActivityMove { id: number; title: string; amount: number | string; date_executed: string; status: string }
export interface ActivityAiEvent { id: number; token_name: string | null; action: string; scope: string; summary?: string | null; note?: string | null; created_at: string }

interface ActivityData { txs: ActivityTx[]; moves: ActivityMove[]; ai: ActivityAiEvent[] }

export async function fetchActivity(): Promise<ActivityData> {
    const [t, moves, ai] = await Promise.all([
        apiFetch<{ transactions: ActivityTx[] }>('/api/transactions/all?limit=100'),
        apiFetch<ActivityMove[]>('/api/strategy/executed-logs').catch(() => [] as ActivityMove[]),
        apiFetch<ActivityAiEvent[]>('/api/tokens/audit').catch(() => [] as ActivityAiEvent[]),
    ]);
    return { txs: t.transactions, moves, ai };
}

export function useActivityData() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const q = useQuery({ queryKey: [ACTIVITY_KEY, user?.id ?? 'anon'], queryFn: fetchActivity, staleTime: ACTIVITY_STALE_MS });
    const reload = useCallback(() => queryClient.invalidateQueries({ queryKey: [ACTIVITY_KEY] }), [queryClient]);
    return {
        loading: q.isPending,
        error: q.isError,
        txs: q.data?.txs ?? [],
        moves: q.data?.moves ?? [],
        ai: q.data?.ai ?? [],
        reload,
    };
}
