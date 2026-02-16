import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

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
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
