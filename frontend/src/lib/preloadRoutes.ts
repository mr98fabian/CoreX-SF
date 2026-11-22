/**
 * Warms the code of the first screen after sign-in (the panel's layout + Inicio) while the
 * user is still on /login. Without it, signing in waited for two chunks in a row (layout,
 * then the page) before the panel's data requests could even start. Same import() paths
 * as the React.lazy routes in App.tsx, so Vite serves the very same chunks — nothing loads
 * twice and nothing changes on screen. Fire-and-forget: a failed preload just means the
 * route loads on demand as before.
 */
let started = false;

export function preloadDashboard(): void {
    if (started) return;
    started = true;
    const run = () => {
        void import('@/layouts/DashboardLayout').catch(() => undefined);
        void import('@/features/home/HomePage').catch(() => undefined);
    };
    const idle = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (idle) idle(run, { timeout: 2000 });
    else setTimeout(run, 300);
}
