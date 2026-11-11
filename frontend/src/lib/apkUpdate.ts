/**
 * Native-shell update notice. Source of truth: https://korexf.com/apk.json (deployed with the web).
 * Absolute URL on purpose: the APK serves its own bundled /dist, so a relative path would read the
 * copy shipped inside the installed APK and never see a newer release.
 */
export const APK_MANIFEST_URL = 'https://korexf.com/apk.json';
export const CHECK_EVERY_MS = 6 * 60 * 60 * 1000;
export const LAST_KEY = 'kx-apk-last';
export const MUTE_KEY = 'kx-apk-mute';

export interface ApkManifest { version_code: number; version_name: string; apk_url: string; notas?: string }
interface Mute { version_code: number; until: number }

export function parseManifest(raw: unknown): ApkManifest | null {
    if (!raw || typeof raw !== 'object') return null;
    const m = raw as Record<string, unknown>;
    if (!Number.isInteger(m.version_code) || typeof m.version_name !== 'string' || typeof m.apk_url !== 'string') return null;
    if (!/^https:\/\//.test(m.apk_url)) return null; // empty or non-https → nothing to offer
    return { version_code: m.version_code as number, version_name: m.version_name, apk_url: m.apk_url, notas: typeof m.notas === 'string' ? m.notas : '' };
}

function read<T>(key: string): T | null {
    try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage blocked: notice still works this session */ }
}

/** Cached manifest if checked < 6 h ago, so a shown banner survives reopening the app. */
export function cachedManifest(now: number): { fresh: boolean; manifest: ApkManifest | null } {
    const last = read<{ at: number; manifest: unknown }>(LAST_KEY);
    if (!last || typeof last.at !== 'number' || now - last.at >= CHECK_EVERY_MS) return { fresh: false, manifest: null };
    return { fresh: true, manifest: parseManifest(last.manifest) };
}
export function rememberManifest(now: number, manifest: ApkManifest) { write(LAST_KEY, { at: now, manifest }); }

export function isMuted(versionCode: number, now: number): boolean {
    const m = read<Mute>(MUTE_KEY);
    return !!m && m.version_code === versionCode && now < m.until;
}

/** "Ahora no": silence THIS version until the next local midnight. */
export function muteVersion(versionCode: number, now: number) {
    const d = new Date(now);
    d.setHours(24, 0, 0, 0);
    write(MUTE_KEY, { version_code: versionCode, until: d.getTime() });
}

/** The announced version is above the installed one (no cache, no mute: the manual check uses this). */
export function isNewer(installed: number, manifest: ApkManifest | null): manifest is ApkManifest {
    return !!manifest && Number.isInteger(installed) && manifest.version_code > installed;
}

/** Automatic banner: newer AND not muted. */
export function shouldOffer(installed: number, manifest: ApkManifest | null, now: number): boolean {
    return isNewer(installed, manifest) && !isMuted(manifest.version_code, now);
}

/** Manual check ("Buscar actualización" in Más): always visible feedback, never silent. */
export type ManualCheck =
    | { state: 'checking' }
    | { state: 'new'; manifest: ApkManifest }
    | { state: 'current'; version_name: string }
    | { state: 'error' };

export function manualCheckResult(installed: number, installedName: string, manifest: ApkManifest | null): ManualCheck {
    if (!manifest || !Number.isInteger(installed)) return { state: 'error' };
    return isNewer(installed, manifest) ? { state: 'new', manifest } : { state: 'current', version_name: installedName };
}

/** iPhone / iPad (iPadOS reports "Macintosh" with touch): the download row is hidden there,
 *  iOS waits for the App Store (owner decision). */
export function isIOS(userAgent: string, maxTouchPoints = 0): boolean {
    return /iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1);
}
