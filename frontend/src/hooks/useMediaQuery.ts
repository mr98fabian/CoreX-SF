import { useState, useEffect } from 'react';

/**
 * Hook to detect viewport matches for responsive behavior.
 * Desktop layout stays untouched — this only activates mobile-specific logic.
 */
export function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia(query).matches;
    });

    useEffect(() => {
        const mql = window.matchMedia(query);
        const handler = (e: MediaQueryListEvent) => setMatches(e.matches);

        mql.addEventListener('change', handler);
        setMatches(mql.matches);

        return () => mql.removeEventListener('change', handler);
    }, [query]);

    return matches;
}

/** Convenience: true when viewport is < 768px */
export function useIsMobile(): boolean {
    return useMediaQuery('(max-width: 767px)');
}
