import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthContext';
import { apiFetch } from '@/lib/api';
import { KX_SUMMARY_STALE_MS } from '@/hooks/useKxSummary';

/** GET /api/velocity/compare — velocity_engine.compare_paths as-is. The client
 *  computes nothing: every number, state and label comes from here. */
export interface ComparePoint { mes: number; fecha: string; saldo: number }
export interface VelocityCompare {
    estado: 'ok' | 'sin_deudas' | 'sin_ahorro';
    etiqueta: 'estimado';
    deuda_hoy: number;
    dominio_meses: number;
    plan: null | {
        meses: number; anios: number; fecha_libre: string | null; tope_simulador: boolean;
        interes_total: number; aporte_mensual: number; fuente_aporte: 'excedente' | 'porcentaje_liquidez' | null;
        puntos: ComparePoint[];
    };
    minimos: null | {
        meses: number; anios: number; fecha_libre: string | null; anio_libre: number | null;
        tope_simulador: boolean; cortado: boolean; interes_total: number; puntos: ComparePoint[];
    };
    ahorro: { intereses: number; meses: number; anios: number; es_minimo: boolean };
}

export const COMPARE_KEY = 'velocity-compare';

export function useVelocityCompare(enabled = true) {
    const { user } = useAuth();
    const q = useQuery({
        queryKey: [COMPARE_KEY, user?.id ?? 'anon'],
        queryFn: () => apiFetch<VelocityCompare>('/api/velocity/compare'),
        staleTime: KX_SUMMARY_STALE_MS,
        enabled,
    });
    return { data: q.data ?? null, loading: q.isPending && enabled, error: q.isError };
}
