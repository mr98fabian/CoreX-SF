/** When the opening runs (misión 18, §4.4): once per session, cold start into the app only. */
import { Capacitor } from '@capacitor/core';

const KEY = 'kx-opening';
/** The app's own routes. The public web landing never gets the opening; the APK starts at
 *  «/» and goes to /login, so on native every cold start counts. */
export function isAppPath(pathname: string): boolean {
    return pathname === '/login' || pathname === '/dashboard' || pathname.startsWith('/dashboard/');
}

// Decided once per page load (StrictMode renders twice; a reload in the same session skips it)
let decided: boolean | null = null;
export function shouldOpen(pathname: string): boolean {
    if (decided === null) {
        let seen = false;
        try { seen = sessionStorage.getItem(KEY) === '1'; sessionStorage.setItem(KEY, '1'); } catch { /* storage blocked */ }
        decided = !seen && (isAppPath(pathname) || Capacitor.isNativePlatform());
    }
    return decided;
}
/** Tests only. */
export function resetOpening() { decided = null; }

