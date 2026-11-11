/**
 * Google sign-in inside the APK. The WebView can't receive the OAuth redirect to
 * https://korexf.com, so in the native shell Supabase redirects to our own
 * scheme (AndroidManifest intent-filter) and the app finishes the session from
 * the deep link (App 'appUrlOpen'). The web keeps redirectTo = window.location.origin.
 *
 * MANUAL: korex://auth-callback must be listed in Supabase → Authentication →
 * URL Configuration → Redirect URLs, or Supabase falls back to the Site URL.
 */
export const NATIVE_AUTH_SCHEME = 'korex';
export const NATIVE_AUTH_REDIRECT = `${NATIVE_AUTH_SCHEME}://auth-callback`;

export type AuthCallback =
    | { kind: 'code'; code: string }
    | { kind: 'tokens'; access_token: string; refresh_token: string }
    | { kind: 'error'; message: string };

/** Parses korex://auth-callback?code=… (PKCE) or #access_token=…&refresh_token=… (implicit).
 *  Anything else (another deep link, a malformed URL) → null: not ours to handle. */
export function parseAuthCallback(url: string): AuthCallback | null {
    if (!url || !url.startsWith(NATIVE_AUTH_REDIRECT)) return null;
    const rest = url.slice(NATIVE_AUTH_REDIRECT.length);
    const query = new URLSearchParams(rest.split('#')[0].replace(/^[/?]+/, ''));
    const hash = new URLSearchParams(rest.includes('#') ? rest.slice(rest.indexOf('#') + 1) : '');
    const get = (k: string) => query.get(k) ?? hash.get(k);
    const err = get('error_description') ?? get('error');
    if (err) return { kind: 'error', message: err };
    const code = get('code');
    if (code) return { kind: 'code', code };
    const access_token = get('access_token');
    const refresh_token = get('refresh_token');
    if (access_token && refresh_token) return { kind: 'tokens', access_token, refresh_token };
    return null;
}

interface AuthClient {
    exchangeCodeForSession: (code: string) => Promise<{ error: unknown }>;
    setSession: (s: { access_token: string; refresh_token: string }) => Promise<{ error: unknown }>;
}

/** Completes the session from a deep link. true = it was ours and it worked. */
export async function completeNativeOAuth(url: string, auth: AuthClient): Promise<boolean> {
    const cb = parseAuthCallback(url);
    if (!cb) return false;
    if (cb.kind === 'error') throw new Error(cb.message);
    const { error } = cb.kind === 'code'
        ? await auth.exchangeCodeForSession(cb.code)
        : await auth.setSession({ access_token: cb.access_token, refresh_token: cb.refresh_token });
    if (error) throw error;
    return true;
}
