/**
 * Editorial dateline ("sábado, 8 de noviembre") via Intl. A YYYY-MM-DD string
 * is anchored at noon (T12:00:00) so negative timezones never fall a day back.
 */
export function editorialDate(value: Date | string, lang: 'es' | 'en'): string {
    const d = typeof value === 'string' ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value) : value;
    return new Intl.DateTimeFormat(lang === 'es' ? 'es' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
}
