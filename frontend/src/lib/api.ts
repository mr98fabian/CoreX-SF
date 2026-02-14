import { supabase } from './supabase';

// Backend base URL: uses VITE_API_URL in production (Railway), localhost in dev
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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

    // Prefix relative URLs with the backend base URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    const response = await fetch(fullUrl, {
        ...options,
        headers,
    });

    if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        throw new Error(`API ${response.status}: ${errorBody}`);
    }

    return response.json();
}
