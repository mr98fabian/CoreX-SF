import { useState, useEffect } from "react";
import { apiFetch } from '@/lib/api';

export interface CashflowItem {
    id: number;
    name: string;
    amount: number;
    category: 'income' | 'expense';
    day_of_month: number | null;
    frequency: string;
    is_variable: boolean;
    day_of_week?: number;
    date_specific_1?: number;
    date_specific_2?: number;
    month_of_year?: number;
    // Virtual debt item fields (injected by backend for active debts)
    is_debt_virtual?: boolean;
    source_account_id?: number;
    debt_balance?: number;
    interest_rate?: number;
}

export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'annually';

export function useCashflowStats(refreshKey: number = 0) {
    const [items, setItems] = useState<CashflowItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCashflow = async () => {
        setLoading(true);
        try {
            const data = await apiFetch<CashflowItem[]>('/api/cashflow');
            setItems(data);
            setError(null);
        } catch (e) {
            console.error("Failed to fetch cashflow", e);
            setError("Failed to fetch cashflow data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchCashflow(); }, [refreshKey]);

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(val) ? 0 : val);
    };

    return {
        items,
        loading,
        error,
        fetchCashflow,
        formatMoney
    };
}
