import { supabase } from './supabase';

/**
 * Authenticated fetch wrapper for KoreX backend API.
 * Automatically attaches the current Supabase session token
 * as an Authorization: Bearer header.
 *
 * Usage: const data = await apiFetch('/api/dashboard');
 */
export async function apiFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    const { data: { session } } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error('No active session — user not authenticated');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${session.access_token}`);
    headers.set('Content-Type', 'application/json');

    const response = await fetch(url, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errorBody}`);
    }

    return response.json();
}
