// ─── Centralized Currency & Date Formatting Hook ──────────────────────
// Reads the user's currency preference from localStorage and returns
// formatMoney() and formatDate() that respect the chosen locale.

type CurrencyCode = "USD" | "MXN" | "EUR";

interface CurrencyConfig {
    locale: string;
    currency: string;
}

const CURRENCY_MAP: Record<CurrencyCode, CurrencyConfig> = {
    USD: { locale: "en-US", currency: "USD" },
    MXN: { locale: "es-MX", currency: "MXN" },
    EUR: { locale: "de-DE", currency: "EUR" },
};

/**
 * Returns the user's preferred currency config from localStorage.
 * Defaults to USD if nothing is set.
 */
function getCurrencyConfig(): CurrencyConfig {
    const stored = localStorage.getItem("corex-currency") as CurrencyCode | null;
    return CURRENCY_MAP[stored ?? "USD"] ?? CURRENCY_MAP.USD;
}

/**
 * Hook that provides locale-aware formatMoney and formatDate utilities.
 * Reads the currency preference set in Settings → Appearance.
 */
export function useFormatMoney() {
    const config = getCurrencyConfig();

    /** Format a number as currency (e.g., $1,234.56 or €1.234,56) */
    const formatMoney = (amount: number): string =>
        new Intl.NumberFormat(config.locale, {
            style: "currency",
            currency: config.currency,
        }).format(amount);

    /** Format a number as compact currency without decimals (e.g., $1,235) */
    const formatMoneyShort = (amount: number): string =>
        new Intl.NumberFormat(config.locale, {
            style: "currency",
            currency: config.currency,
            maximumFractionDigits: 0,
        }).format(amount);

    /** Format a date string to locale-aware short format (e.g., "Feb 15") */
    const formatDateShort = (dateStr: string): string => {
        const date = new Date(dateStr + "T12:00:00");
        return date.toLocaleDateString(config.locale, { month: "short", day: "numeric" });
    };

    /** Format a date string to locale-aware long format (e.g., "February 15, 2026") */
    const formatDateLong = (dateStr: string): string => {
        const date = new Date(dateStr + "T12:00:00");
        return date.toLocaleDateString(config.locale, {
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    };

    /** Get the locale string for Intl formatters */
    const locale = config.locale;

    return { formatMoney, formatMoneyShort, formatDateShort, formatDateLong, locale };
}

/**
 * Standalone (non-hook) version for use outside React components.
 * Useful in utility functions or constants.
 */
export function getFormatMoney(): (amount: number) => string {
    const config = getCurrencyConfig();
    return (amount: number) =>
        new Intl.NumberFormat(config.locale, {
            style: "currency",
            currency: config.currency,
        }).format(amount);
}
