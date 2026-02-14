import { useState, useEffect } from "react";
import { apiFetch } from '@/lib/api';

export interface CashflowItem {
    id: number;
    name: string;
    amount: number;
    category: 'income' | 'expense';
    day_of_month: number;
    frequency: string;
    is_variable: boolean;
    day_of_week?: number;
    date_specific_1?: number;
    date_specific_2?: number;
    month_of_year?: number;
}

export type Timeframe = 'daily' | 'weekly' | 'monthly' | 'annually';

export function useCashflowStats() {
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

    useEffect(() => { fetchCashflow(); }, []);

    // 1. Normalize everything to MONTHLY first (Base Unit)
    const getMonthlyAmount = (item: CashflowItem) => {
        const amt = Number(item.amount);
        switch (item.frequency) {
            case 'weekly': return amt * 4.345; // 52.14 weeks / 12 months
            case 'biweekly': return amt * 2.17; // 26.07 fortnights / 12 months
            case 'semi_monthly': return amt * 2; // Exactly 24 payments / 12 months
            case 'monthly': return amt;
            case 'annually': return amt / 12;
            default: return amt;
        }
    };

    // 2. Calculator for dynamic timeframes
    const calculateStats = (timeframe: Timeframe) => {
        const factor = getFactor(timeframe); // Multiplier from Monthly -> Target Timeframe

        const incomeItems = items.filter(i => i.category === 'income');
        const expenseItems = items.filter(i => i.category === 'expense');

        const totalIncomeMonthly = incomeItems.reduce((acc, i) => acc + getMonthlyAmount(i), 0);
        const totalExpensesMonthly = expenseItems.reduce((acc, i) => acc + getMonthlyAmount(i), 0);

        return {
            income: totalIncomeMonthly * factor,
            expenses: totalExpensesMonthly * factor,
            surplus: (totalIncomeMonthly - totalExpensesMonthly) * factor,
            // Raw monthly values for Peace Shield reference
            monthlyExpenses: totalExpensesMonthly
        };
    };

    // Helper: Convert Monthly -> Target Timeframe
    const getFactor = (timeframe: Timeframe) => {
        switch (timeframe) {
            case 'daily': return 1 / 30.44; // Avg days in month
            case 'weekly': return 1 / 4.345;
            case 'monthly': return 1;
            case 'annually': return 12;
            default: return 1;
        }
    };

    const formatMoney = (val: number) => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(val) ? 0 : val);
    };

    return {
        items,
        loading,
        error,
        fetchCashflow,
        calculateStats,
        formatMoney
    };
}
