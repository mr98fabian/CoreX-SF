/**
 * Local fingerprint lock (WebAuthn) — a privacy padlock on THIS device. The
 * session stays valid; this only hides the app from someone holding an
 * unlocked phone. Settings persist per device (localStorage); "unlocked"
 * never does when the user chose "Al salir": then it lives only in memory.
 */
import { apiFetch } from '@/lib/api';

export type Relock = 'exit' | 60 | 300 | 900; // seconds, or on every leave/open
export interface LockSettings { enabled: boolean; relock: Relock; credentialId: string | null }

const KEY = 'kx-lock';
const SEEN = 'kx-lock-seen'; // sessionStorage: last moment the app was in the foreground
const DEFAULTS: LockSettings = { enabled: false, relock: 60, credentialId: null };

export function readLock(): LockSettings {
    try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULTS; }
}
export function writeLock(s: LockSettings) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: lock simply stays off */ }
    window.dispatchEvent(new Event('kx-lock-change'));
}

/** Seen-timestamp for timed relock. "Al salir" keeps nothing between openings. */
export function markSeen(s: LockSettings, now = Date.now()) {
    if (s.relock === 'exit') return;
    try { sessionStorage.setItem(SEEN, String(now)); } catch { /* ignore */ }
}
export function clearSeen() {
    try { sessionStorage.removeItem(SEEN); } catch { /* ignore */ }
}

/** Should the app open locked? Locked unless seen within the relock interval. */
export function lockedOnOpen(s: LockSettings, now = Date.now()): boolean {
    if (!s.enabled || !s.credentialId) return false;
    if (s.relock === 'exit') return true;
    let seen = 0;
    try { seen = Number(sessionStorage.getItem(SEEN) || 0); } catch { /* ignore */ }
    return !seen || now - seen > s.relock * 1000;
}

/** Back to the foreground after `awayMs` in the background. */
export function lockedOnReturn(s: LockSettings, awayMs: number): boolean {
    if (!s.enabled || !s.credentialId) return false;
    return s.relock === 'exit' ? true : awayMs > s.relock * 1000;
}

export async function platformAuthenticatorAvailable(): Promise<boolean> {
    try {
        return typeof window.PublicKeyCredential !== 'undefined'
            && await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch { return false; }
}

// ── WebAuthn ceremony (no library: base64url <-> ArrayBuffer) ──
const b64uToBuf = (s: string) => {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0)).buffer;
};
const bufToB64u = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

interface CredJSON { id: string; type: string; [k: string]: unknown }
const post = <T,>(url: string, body?: unknown) => apiFetch<T>(url, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

/** Register this device's fingerprint; returns the credential id (kept locally to unregister). */
export async function registerFingerprint(): Promise<string> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = await post<any>('/api/webauthn/register/options');
    const cred = await navigator.credentials.create({
        publicKey: {
            ...o, challenge: b64uToBuf(o.challenge), user: { ...o.user, id: b64uToBuf(o.user.id) },
            excludeCredentials: (o.excludeCredentials ?? []).map((c: CredJSON) => ({ ...c, id: b64uToBuf(c.id) })),
        },
    }) as PublicKeyCredential | null;
    if (!cred) throw new Error('cancelled');
    const r = cred.response as AuthenticatorAttestationResponse;
    const json: CredJSON = { id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
        response: { clientDataJSON: bufToB64u(r.clientDataJSON), attestationObject: bufToB64u(r.attestationObject) } };
    await post('/api/webauthn/register/verify', { credential: json });
    return cred.id;
}

/** Ask for the fingerprint and have the backend verify the signature. */
export async function unlockWithFingerprint(): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const o = await post<any>('/api/webauthn/auth/options');
    const cred = await navigator.credentials.get({
        publicKey: { ...o, challenge: b64uToBuf(o.challenge),
            allowCredentials: (o.allowCredentials ?? []).map((c: CredJSON) => ({ ...c, id: b64uToBuf(c.id) })) },
    }) as PublicKeyCredential | null;
    if (!cred) throw new Error('cancelled');
    const r = cred.response as AuthenticatorAssertionResponse;
    const json: CredJSON = { id: cred.id, rawId: bufToB64u(cred.rawId), type: cred.type,
        response: { clientDataJSON: bufToB64u(r.clientDataJSON), authenticatorData: bufToB64u(r.authenticatorData),
            signature: bufToB64u(r.signature), userHandle: r.userHandle ? bufToB64u(r.userHandle) : undefined } };
    await post('/api/webauthn/auth/verify', { credential: json });
}

export async function unregisterFingerprint(credentialId: string) {
    await apiFetch(`/api/webauthn/credentials/${encodeURIComponent(credentialId)}`, { method: 'DELETE' });
}
