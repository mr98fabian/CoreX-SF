import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────
interface VelocityTarget {
    name: string;
    balance: number;
    interest_rate: number;
    min_payment: number;
    action_date?: string;
    priority_reason?: string;
    justification?: string;
    shield_note?: string;
    daily_interest_saved?: number;
    next_payday?: string;
}

export interface DashboardData {
    total_debt: number;
    liquid_cash: number;
    chase_balance: number;
    shield_target: number;
    attack_equity: number;
    reserved_for_bills?: number;
    velocity_target: VelocityTarget | null;
    calendar?: any[];
}

export interface VelocityProjections {
    velocity_debt_free_date: string;
    standard_debt_free_date: string;
    months_saved: number;
    years_saved: number;
    interest_saved: number;
    velocity_power: number;
}

// ─── Hooks ─────────────────────────────────────────────────

/** Fetches dashboard overview data with caching */
export function useDashboardData() {
    return useQuery<DashboardData>({
        queryKey: ['dashboard'],
        queryFn: () => apiFetch<DashboardData>('/api/dashboard'),
    });
}

/** Fetches velocity projections with caching */
export function useVelocityProjections() {
    return useQuery<VelocityProjections>({
        queryKey: ['velocity', 'projections'],
        queryFn: () => apiFetch<VelocityProjections>('/api/velocity/projections'),
    });
}

/** Fetches velocity simulation with caching per extra_cash value */
export function useVelocitySimulation(extraCash: number) {
    return useQuery({
        queryKey: ['velocity', 'simulate', extraCash],
        queryFn: () => apiFetch(`/api/velocity/simulate?extra_cash=${extraCash}`),
    });
}
