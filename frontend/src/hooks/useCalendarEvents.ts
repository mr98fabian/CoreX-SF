import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { CALENDAR_KEY, monthKey, type CalendarMonthEvents } from '@/lib/calendarEvents';
import { KX_SUMMARY_STALE_MS } from '@/hooks/useKxSummary';

const fetchMonth = (key: string) => apiFetch<CalendarMonthEvents>(`/api/calendar/events?month=${key}`);

/** One month of calendar events (server), cached per month for 45 s like the
 *  summary; the previous and next months are prefetched so ‹ › feels instant.
 *  Payments and confirmed attacks invalidate [CALENDAR_KEY] (useKxSummary.reload). */
export function useCalendarEvents(year: number | null, month: number | null) {
    const queryClient = useQueryClient();
    const enabled = year !== null && month !== null;
    const key = enabled ? monthKey(year!, month!) : '';
    const q = useQuery({
        queryKey: [CALENDAR_KEY, key],
        queryFn: () => fetchMonth(key),
        staleTime: KX_SUMMARY_STALE_MS,
        enabled,
    });
    useEffect(() => {
        if (!enabled) return;
        for (const step of [-1, 1]) {
            const d = new Date(year!, month! + step, 1);
            const k = monthKey(d.getFullYear(), d.getMonth());
            void queryClient.prefetchQuery({ queryKey: [CALENDAR_KEY, k], queryFn: () => fetchMonth(k), staleTime: KX_SUMMARY_STALE_MS });
        }
    }, [enabled, year, month, queryClient]);
    return { events: q.data ?? null, loading: q.isPending && enabled, error: q.isError };
}
