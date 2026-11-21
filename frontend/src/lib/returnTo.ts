/**
 * Where to land after signing in. Only the OAuth consent screen can be a return target,
 * so this can never become an open redirect. Per-tab (sessionStorage), best effort.
 */
const KEY = 'korex-return-to';
const ALLOWED = /^\/oauth\/consent\?request=[A-Za-z0-9_-]+$/;

export function rememberReturnTo(path: string): void {
    if (!ALLOWED.test(path)) return;
    try { sessionStorage.setItem(KEY, path); } catch { /* storage blocked: the user starts again */ }
}

/** The remembered consent URL, or `fallback`. */
export function returnToOr(fallback: string): string {
    try {
        const v = sessionStorage.getItem(KEY);
        return v && ALLOWED.test(v) ? v : fallback;
    } catch {
        return fallback;
    }
}

export function clearReturnTo(): void {
    try { sessionStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}
