/**
 * Push notices on the Android app (Firebase Cloud Messaging via @capacitor/push-notifications).
 * The app only registers its token and shows what arrives: the backend decides what to send and
 * when (backend/push_engine.py). Nothing here runs on the web.
 */
import { Capacitor, registerPlugin } from '@capacitor/core';
import { PushNotifications, type ActionPerformed, type Token } from '@capacitor/push-notifications';
import { apiFetch } from '@/lib/api';

const ASKED_KEY = 'korex-push-asked';   // 'yes' | 'no': the pre-permission screen is shown at most once
const TOKEN_KEY = 'korex-push-token';   // the token this phone registered (to remove it on sign-out)

export type PushPermission = 'granted' | 'denied' | 'prompt';

export function isAndroidApp(): boolean {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

function read(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null): void {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* storage blocked */ }
}

export const pushAsked = (): 'yes' | 'no' | null => (read(ASKED_KEY) as 'yes' | 'no' | null);
export const markPushAsked = (answer: 'yes' | 'no') => write(ASKED_KEY, answer);

export async function pushPermission(): Promise<PushPermission> {
    const { receive } = await PushNotifications.checkPermissions();
    return receive === 'granted' ? 'granted' : receive === 'denied' ? 'denied' : 'prompt';
}

export async function serverCanPush(): Promise<boolean> {
    try { return (await apiFetch<{ enabled: boolean }>('/api/push/config')).enabled; } catch { return false; }
}

function timeZone(): string {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Chicago'; } catch { return 'America/Chicago'; }
}

/** The app's language (LanguageContext stores it): the server writes each notice in it. */
function appLanguage(): 'es' | 'en' {
    return read('korex-language') === 'en' ? 'en' : 'es';
}

function registerDevice(token: string): Promise<unknown> {
    return apiFetch('/api/push/devices', {
        method: 'POST',
        body: JSON.stringify({ token, platform: 'android', timezone: timeZone(), language: appLanguage() }),
    }).catch(() => undefined);
}

/** The user switched the app's language: this phone's notices follow it right away. */
export async function syncPushLanguage(): Promise<void> {
    const token = read(TOKEN_KEY);
    if (isAndroidApp() && token) await registerDevice(token);
}

let listening = false;

/** With the permission granted: listen and register. Every app start re-registers, so a token
 * that changed (or a new time zone or language) reaches the server on its own. */
export async function startPush(): Promise<void> {
    if (!listening) {
        listening = true;
        await PushNotifications.addListener('registration', async (token: Token) => {
            write(TOKEN_KEY, token.value);
            await registerDevice(token.value);
        });
    }
    await PushNotifications.register();
}

/** The system dialog; registers when granted. */
export async function requestPush(): Promise<PushPermission> {
    const { receive } = await PushNotifications.requestPermissions();
    if (receive === 'granted') {
        await startPush();
        return 'granted';
    }
    return receive === 'denied' ? 'denied' : 'prompt';
}

/** Sign-out: this phone stops receiving the user's notices. */
export async function clearPushToken(): Promise<void> {
    const token = read(TOKEN_KEY);
    if (!token) return;
    await apiFetch('/api/push/devices', { method: 'DELETE', body: JSON.stringify({ token }) }).catch(() => undefined);
    write(TOKEN_KEY, null);
}

/** Where a tapped notice goes: the destination travels in the payload's `data`. */
export function routeFor(data: Record<string, unknown> | undefined): string | null {
    const route = typeof data?.route === 'string' ? data.route : null;
    if (!route || !route.startsWith('/dashboard')) return null; // only in-app destinations
    const account = data?.account_id;
    return account !== undefined && account !== null && /^\d+$/.test(String(account)) ? `${route}?account=${account}` : route;
}

export async function onNoticeTap(go: (path: string) => void): Promise<() => void> {
    const handle = await PushNotifications.addListener('pushNotificationActionPerformed', (a: ActionPerformed) => {
        const path = routeFor(a.notification.data);
        if (path) go(path);
    });
    return () => { void handle.remove(); };
}

/** Our own tiny native plugin (android/.../system/AppSettingsPlugin.kt): opens this app's
 * notification settings, for when the permission was denied in the system. */
export const AppSettings = registerPlugin<{ openNotificationSettings(): Promise<void> }>('AppSettings');
