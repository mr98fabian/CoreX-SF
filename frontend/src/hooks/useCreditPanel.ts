/** Panel de crédito data from /api/accounts/credit-panel (math in the engine). */
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

export type UsageBand = 'low' | 'mid' | 'high';
export interface CreditPanelData {
    active: boolean; limite_total: number; usado: number; disponible: number;
    utilizacion_global: number | null; banda_global: UsageBand | null;
    por_tarjeta: Record<string, { pct: number; banda: UsageBand }>;
    sin_limite: number[]; nota: string;
}
export const CREDIT_PANEL_KEY = 'credit-panel';

export function useCreditPanel() {
    return useQuery({ queryKey: [CREDIT_PANEL_KEY], queryFn: () => apiFetch<CreditPanelData>('/api/accounts/credit-panel'), staleTime: 45_000 });
}

