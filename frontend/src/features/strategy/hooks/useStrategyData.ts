import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { withPlanLimit } from '@/lib/planLimits';

// --- Type Definitions ---

interface ShieldStatus {
    percentage: number;
    is_active: boolean;
    health: string;
}

interface RecommendedAction {
    amount: number;
    destination: string;
    destination_apr: number;
    destination_balance: number;
    daily_cost: number;
    reason: string;
    gap_coverage?: {
        total_cost: number;
        debts: { name: string; shortfall: number; apr: number }[];
    } | null;
}

interface Impact {
    days_accelerated: number;
    interest_saved_monthly: number;
    freedom_hours_earned: number;
}

export interface MorningBriefingData {
    available_cash: number;
    attack_amount: number;
    shield_status: ShieldStatus;
    recommended_action: RecommendedAction;
    impact: Impact;
}

export interface DebtRanked {
    name: string;
    apr: number;
    balance: number;
    daily_cost: number;
    is_target: boolean;
}

export interface ConfidenceMeterData {
    debts_ranked: DebtRanked[];
    strategy: string;
    explanation: string;
}

export interface FreedomCounterData {
    current_freedom_date: string;
    standard_freedom_date: string;
    months_saved: number;
    interest_saved: number;
    total_days_recovered: number;
    velocity_power: number;
}

export interface StreakData {
    current: number;
    total_attacks: number;
}

export interface DecisionOption {
    id: string;
    label: string;
    amount: number;
    impact: string;
    description: string;
}

export interface DecisionOptionsData {
    options: DecisionOption[];
    recommended: string;
}

export interface DebtAlert {
    severity: 'critical' | 'warning' | 'caution';
    debt_name: string;
    title: string;
    message: string;
    details: Record<string, number>;
    recommendation: string;
}

export interface StrategyCommandData {
    morning_briefing: MorningBriefingData | null;
    confidence_meter: ConfidenceMeterData;
    freedom_counter: FreedomCounterData;
    streak: StreakData;
    decision_options: DecisionOptionsData | null;
    debt_alerts: DebtAlert[];
}

// --- Hook ---

export function useStrategyData() {
    const [data, setData] = useState<StrategyCommandData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await apiFetch<StrategyCommandData>(withPlanLimit('/api/strategy/command-center'));
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load strategy data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refresh: fetchData };
}
