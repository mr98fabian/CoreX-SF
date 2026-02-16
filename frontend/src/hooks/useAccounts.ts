import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';

// ─── Types ─────────────────────────────────────────────────
export interface Account {
    id: number;
    name: string;
    type: string;
    balance: number;
    interest_rate: number;
    min_payment: number;
    due_day?: number;
    closing_day?: number;
    payment_frequency: string;
    plaid_account_id?: string;
    interest_type?: string;
    debt_subtype?: string;
    original_amount?: number;
    loan_term_months?: number;
    remaining_months?: number;
}

// ─── Hooks ─────────────────────────────────────────────────

/** Fetches all accounts with caching + safe number coercion */
export function useAccounts() {
    return useQuery<Account[]>({
        queryKey: ['accounts'],
        queryFn: async () => {
            const data = await apiFetch<any[]>('/api/accounts');
            return data.map((acc: any) => ({
                ...acc,
                balance: Number(acc.balance),
                interest_rate: Number(acc.interest_rate),
                min_payment: Number(acc.min_payment),
            }));
        },
    });
}

/** Mutation to create an account — invalidates cache on success */
export function useCreateAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: Record<string, unknown>) =>
            apiFetch('/api/accounts', { method: 'POST', body: JSON.stringify(payload) }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}

/** Mutation to delete an account — invalidates cache on success */
export function useDeleteAccount() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) =>
            apiFetch(`/api/accounts/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['accounts'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        },
    });
}
