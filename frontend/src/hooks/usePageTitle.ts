import { useEffect } from 'react';

const APP_NAME = 'KoreX';

/**
 * Sets the browser tab title dynamically per route.
 * Format: "KoreX | PageName" or just "KoreX" for the root.
 */
export function usePageTitle(pageTitle?: string) {
    useEffect(() => {
        document.title = pageTitle
            ? `${APP_NAME} | ${pageTitle}`
            : `${APP_NAME} — Velocity Banking System`;
    }, [pageTitle]);
}
