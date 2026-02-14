import { useState, useEffect, useCallback } from "react";
import { apiFetch } from '@/lib/api';

// --- Types ---
export interface CashflowEvent {
    name: string;
    amount: number;
    category: "income" | "expense";
}

export interface ProjectionDay {
    date: string;
    balance: number;
    events: CashflowEvent[];
    is_today: boolean;
    zone: "past" | "today" | "future";
    day_label: string;
    day_num: number;
}

export interface CashflowProjection {
    start_balance: number;
    today: string;
    total_days: number;
    days: ProjectionDay[];
}

export function useCashflowProjection(months = 3) {
    const [data, setData] = useState<CashflowProjection | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProjection = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const json = await apiFetch<CashflowProjection>(
                `/api/cashflow/projection?months=${months}`
            );
            setData(json);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Failed to load projection"
            );
        } finally {
            setLoading(false);
        }
    }, [months]);

    useEffect(() => {
        fetchProjection();
    }, [fetchProjection]);

    return { data, loading, error, refresh: fetchProjection };
}
