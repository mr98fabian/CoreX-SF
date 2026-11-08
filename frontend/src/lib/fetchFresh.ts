/** GET a JSON file past every cache (CDN, proxy, WebView). Any failure → null, never throws. */
export async function fetchFreshJson<T = unknown>(url: string): Promise<T | null> {
    try {
        const sep = url.includes('?') ? '&' : '?';
        const res = await fetch(`${url}${sep}_t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return null;
        return (await res.json()) as T;
    } catch {
        return null;
    }
}
