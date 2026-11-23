import { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { onPlanWrite } from '@/lib/planEvents';
import { invalidatePlanData } from '@/lib/planSync';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,       // 30s — data stays "fresh" and won't refetch
            retry: 2,               // Retry failed queries twice
            refetchOnWindowFocus: true, // Refetch when user returns to tab
        },
    },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
    // Any plan write (payment, attack, account, cashflow, subscription…) refreshes the plan's data
    useEffect(() => onPlanWrite(() => { void invalidatePlanData(queryClient); }), []);
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
