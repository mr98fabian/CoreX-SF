import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import type { CashflowSummary } from '@/lib/moneyClock';

/** GET /api/cashflow/summary — monthly totals from the engine (Reloj de dinero, Cuentas). */
export function useCashflowSummary(refreshKey: number = 0) {
    return useQuery({
        queryKey: ['cashflow-summary', refreshKey],
        queryFn: () => apiFetch<CashflowSummary>('/api/cashflow/summary'),
        staleTime: 30_000,
    });
}
