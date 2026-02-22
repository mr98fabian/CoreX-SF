import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

/**
 * Recurring Confirmation System — Hook
 *
 * Fetches recurring cashflow items due today that haven't been confirmed.
 * Provides confirm (with actual amount) and snooze actions.
 * Confirming an item counts as a registered transaction for streak purposes.
 */

export interface DueItem {
    id: number;
    name: string;
    expected_amount: number;
    category: string;
    is_income: boolean;
    frequency: string;
    account_id: number | null;
    account_name: string | null;
    is_variable: boolean;
}

export interface ConfirmResult {
    ok: boolean;
    already_confirmed: boolean;
    transaction_id?: number;
    item_name: string;
    expected_amount: number;
    actual_amount: number;
    variance: number;
    variance_pct: number;
    is_income: boolean;
}

interface DueTodayState {
    /** Items still pending confirmation */
    items: DueItem[];
    /** Whether the initial fetch is loading */
    loading: boolean;
    /** Total count of items due today (before any confirmations) */
    totalDueCount: number;
    /** Number of items confirmed this session */
    confirmedCount: number;
    /** Last confirm result (for variance display) */
    lastConfirmResult: ConfirmResult | null;
    /** Whether modal should be visible */
    showModal: boolean;
    /** Confirm an item with actual amount */
    confirmItem: (itemId: number, actualAmount: number, accountId?: number | null) => Promise<ConfirmResult | null>;
    /** Snooze an item */
    snoozeItem: (itemId: number, mode: '2h' | 'tomorrow' | 'skip_month') => Promise<boolean>;
    /** Dismiss the modal */
    dismiss: () => void;
    /** Re-fetch due items */
    refresh: () => void;
}

export function useRecurringDueToday(): DueTodayState {
    const [items, setItems] = useState<DueItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [totalDueCount, setTotalDueCount] = useState(0);
    const [confirmedCount, setConfirmedCount] = useState(0);
    const [lastConfirmResult, setLastConfirmResult] = useState<ConfirmResult | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    const fetchDueToday = useCallback(async () => {
        try {
            const res = await apiFetch<{ date: string; due_count: number; items: DueItem[] }>(
                '/api/cashflow/due-today'
            );
            setItems(res.items);
            setTotalDueCount(res.due_count);
            // Only show modal if there are items and user hasn't dismissed
            if (res.items.length > 0 && !dismissed) {
                setShowModal(true);
            }
        } catch (err) {
            console.error('Failed to fetch due-today items:', err);
        } finally {
            setLoading(false);
        }
    }, [dismissed]);

    useEffect(() => {
        fetchDueToday();
    }, [fetchDueToday]);

    const confirmItem = useCallback(async (itemId: number, actualAmount: number, accountId?: number | null): Promise<ConfirmResult | null> => {
        try {
            const payload: Record<string, unknown> = { actual_amount: actualAmount };
            if (accountId != null) payload.account_id = accountId;

            const result = await apiFetch<ConfirmResult>(`/api/cashflow/${itemId}/confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (result.ok && !result.already_confirmed) {
                // Remove confirmed item from the list
                setItems(prev => prev.filter(i => i.id !== itemId));
                setConfirmedCount(prev => prev + 1);
                setLastConfirmResult(result);
            }

            return result;
        } catch (err: unknown) {
            // Re-throw INSUFFICIENT_FUNDS so the caller can show a popup
            let isInsufficientFunds = false;
            try {
                const errObj = err as Record<string, unknown>;
                // Try .detail directly (plain object)
                const directDetail = errObj?.detail as Record<string, unknown> | undefined;
                if (directDetail?.code === "INSUFFICIENT_FUNDS") {
                    isInsufficientFunds = true;
                } else if (errObj?.message && typeof errObj.message === 'string') {
                    // ApiError: parse JSON body from .message
                    const parsed = JSON.parse(errObj.message);
                    if (parsed?.detail?.code === "INSUFFICIENT_FUNDS") {
                        isInsufficientFunds = true;
                    }
                }
            } catch { /* not parseable */ }
            if (isInsufficientFunds) {
                throw err;
            }
            console.error('Failed to confirm recurring item:', err);
            return null;
        }
    }, []);

    const snoozeItem = useCallback(async (itemId: number, mode: '2h' | 'tomorrow' | 'skip_month'): Promise<boolean> => {
        try {
            await apiFetch(`/api/cashflow/${itemId}/snooze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ mode }),
            });

            // Remove snoozed item from the list
            setItems(prev => prev.filter(i => i.id !== itemId));
            return true;
        } catch (err) {
            console.error('Failed to snooze recurring item:', err);
            return false;
        }
    }, []);

    const dismiss = useCallback(() => {
        setShowModal(false);
        setDismissed(true);
    }, []);

    const refresh = useCallback(() => {
        setDismissed(false);
        setLoading(true);
        fetchDueToday();
    }, [fetchDueToday]);

    return {
        items,
        loading,
        totalDueCount,
        confirmedCount,
        lastConfirmResult,
        showModal: showModal && items.length > 0,
        confirmItem,
        snoozeItem,
        dismiss,
        refresh,
    };
}
