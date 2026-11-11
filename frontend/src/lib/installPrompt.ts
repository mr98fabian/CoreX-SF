/**
 * PWA install offer, one store for the toast (InstallPrompt) and the persistent
 * "Instalar KoreX" row in Más → App. `beforeinstallprompt` fires once per page
 * load, so it is captured at import time (main.tsx imports this module).
 *
 * The 7-day mute is written ONLY on an explicit dismissal ("Ahora no" in the
 * toast, or "Cancel" in the browser's own install dialog) — never just for
 * showing the toast. The Más row ignores the mute: it is always there while the
 * browser offers installation.
 */
export const DISMISS_KEY = 'korex-install-dismissed';
export const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

export interface BeforeInstallPromptEvent extends Event {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = typeof window !== 'undefined' && !!window.matchMedia?.('(display-mode: standalone)').matches;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function subscribeInstall(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
export function canInstall() { return !!deferred && !installed; }
export function isInstalled() { return installed; }

export function isInstallMuted(now = Date.now()): boolean {
    try {
        const v = localStorage.getItem(DISMISS_KEY);
        return !!v && now - Number(v) < DISMISS_DURATION_MS;
    } catch { return false; }
}
/** Explicit "no" from the user — the only thing that mutes the toast for 7 days. */
export function muteInstall(now = Date.now()) {
    try { localStorage.setItem(DISMISS_KEY, String(now)); } catch { /* storage blocked */ }
}

/** Opens the browser's install dialog. Cancel there counts as an explicit dismissal. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    const ev = deferred;
    if (!ev) return 'unavailable';
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    deferred = null; // a prompt event can only be used once
    if (outcome === 'accepted') installed = true; else muteInstall();
    notify();
    return outcome;
}

/** Test seam / capture: register the deferred event. */
export function captureInstallEvent(e: Event) {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
}

export function resetInstallState(standalone = false) { deferred = null; installed = standalone; notify(); }

if (typeof window !== 'undefined') {
    window.addEventListener('beforeinstallprompt', captureInstallEvent);
    window.addEventListener('appinstalled', () => { installed = true; deferred = null; notify(); });
}
