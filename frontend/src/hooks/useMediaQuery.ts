import { useCallback, useSyncExternalStore } from 'react';

/**
 * Hook to detect viewport matches for responsive behavior.
 * Desktop layout stays untouched — this only activates mobile-specific logic.
 */
export function useMediaQuery(query: string): boolean {
    const subscribe = useCallback(
        (onChange: () => void) => {
            const mql = window.matchMedia(query);
            mql.addEventListener('change', onChange);
            return () => mql.removeEventListener('change', onChange);
        },
        [query],
    );

    return useSyncExternalStore(
        subscribe,
        () => window.matchMedia(query).matches,
        () => false, // SSR fallback
    );
}

/** Convenience: true when viewport is < 768px */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 767px)');
}
