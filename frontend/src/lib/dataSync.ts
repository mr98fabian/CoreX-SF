/**
 * dataSync.ts — Cross-page data synchronization via CustomEvent bus.
 *
 * When a page mutates data (transaction, account CRUD, strategy execution),
 * it calls emitDataChanged(source). Other pages listening via useDataSync()
 * will re-fetch their data automatically.
 *
 * Why not React Query invalidation? Dashboard, Accounts, and Strategy all
 * use manual useState + useEffect rather than useQuery hooks, so
 * queryClient.invalidateQueries() has no effect on them.
 */
import { useEffect, useRef } from 'react';

export type DataSource = 'dashboard' | 'accounts' | 'strategy';

const EVENT_NAME = 'korex:data-changed';

interface DataChangedDetail {
    source: DataSource;
    timestamp: number;
}

/**
 * Emit a data-changed event so other pages know to re-fetch.
 * Call this after any successful mutation (transaction, account CRUD, etc.).
 */
export function emitDataChanged(source: DataSource): void {
    window.dispatchEvent(
        new CustomEvent<DataChangedDetail>(EVENT_NAME, {
            detail: { source, timestamp: Date.now() },
        })
    );
}

/**
 * Hook: subscribe to data-changed events from OTHER pages.
 * The callback fires only when the event source ≠ the current page,
 * preventing infinite re-fetch loops.
 *
 * @param currentPage - identity of the calling page (to skip self-events)
 * @param onChanged   - callback to run when another page mutates data
 */
export function useDataSync(
    currentPage: DataSource,
    onChanged: (source: DataSource) => void
): void {
    // Use ref so the callback always points to the latest closure
    const callbackRef = useRef(onChanged);

    // Keep ref in sync inside an effect (not during render)
    useEffect(() => {
        callbackRef.current = onChanged;
    });

    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<DataChangedDetail>).detail;
            // Skip events from ourselves to avoid infinite loops
            if (detail.source === currentPage) return;
            callbackRef.current(detail.source);
        };
        window.addEventListener(EVENT_NAME, handler);
        return () => window.removeEventListener(EVENT_NAME, handler);
    }, [currentPage]);
}
