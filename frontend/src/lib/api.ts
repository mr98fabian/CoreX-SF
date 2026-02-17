import { supabase } from './supabase';
import { Capacitor } from '@capacitor/core';

// Backend base URL:
// - Dev: connect directly to local backend
// - Capacitor (native app): connect directly to Railway (no Vercel proxy available)
// - Production web: empty string (Vercel proxies /api/* to Railway, same-origin)
const RAILWAY_URL = 'https://corex-sf-production.up.railway.app';

const API_BASE = import.meta.env.DEV
    ? 'http://localhost:8000'
    : Capacitor.isNativePlatform()
        ? RAILWAY_URL
        : '';

// Demo Mode constants
const DEMO_TOKEN_KEY = 'corex_demo_token';

export function setDemoToken(token: string) {
    localStorage.setItem(DEMO_TOKEN_KEY, token);
}

export function clearDemoToken() {
    localStorage.removeItem(DEMO_TOKEN_KEY);
}

export function getDemoToken(): string | null {
    return localStorage.getItem(DEMO_TOKEN_KEY);
}

/** Structured error from API calls — includes status code for categorization */
export class ApiError extends Error {
    status: number;
    isRetryable: boolean;

    constructor(status: number, body: string) {
        const message = body || `Request failed with status ${status}`;
        super(message);
        this.name = 'ApiError';
        this.status = status;
        // Only 5xx and network errors (0) are retryable, never 4xx
        this.isRetryable = status === 0 || status >= 500;
    }
}

/** Retry config */
const MAX_RETRIES = 2;
const BASE_DELAY_MS = 800;

/**
 * Authenticated fetch wrapper for KoreX backend API.
 * - Attaches Supabase or demo token as Bearer header
 * - Retries network errors and 5xx up to 2 times with exponential backoff
 * - Never retries 4xx (auth, validation, not found)
 */
export async function apiFetch<T = unknown>(
    url: string,
    options: RequestInit = {}
): Promise<T> {
    // Priority: Supabase session → Demo token
    let accessToken: string | null = null;

    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
        accessToken = session.access_token;
    } else {
        accessToken = getDemoToken();
    }

    if (!accessToken) {
        throw new ApiError(401, 'No active session — user not authenticated');
    }

    const headers = new Headers(options.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    headers.set('Content-Type', 'application/json');

    // Prefix relative URLs with the backend base URL
    const fullUrl = url.startsWith('http') ? url : `${API_BASE}${url}`;

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(fullUrl, { ...options, headers });

            if (!response.ok) {
                const errorBody = await response.text().catch(() => '');
                const error = new ApiError(response.status, errorBody);

                // Only retry 5xx — fail immediately on 4xx
                if (!error.isRetryable) throw error;
                lastError = error;
            } else {
                return response.json();
            }
        } catch (err) {
            // Network errors (fetch threw) — retryable
            if (err instanceof ApiError) {
                lastError = err;
                if (!err.isRetryable) throw err;
            } else {
                lastError = new ApiError(0, (err as Error).message || 'Network error');
            }
        }

        // Wait before retry (exponential backoff)
        if (attempt < MAX_RETRIES) {
            await new Promise(r => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
        }
    }

    throw lastError ?? new ApiError(0, 'Request failed after retries');
}


