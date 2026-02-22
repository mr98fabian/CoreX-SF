import { useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────
export interface FundsErrorData {
    account_name: string;
    current_balance: number;
    requested_amount: number;
    message?: string;
}

// ── Hook: useInsufficientFundsDialog ─────────────────────────
// Centralised state for showing the popup from any component.
export function useInsufficientFundsDialog() {
    const [errorData, setErrorData] = useState<FundsErrorData | null>(null);

    const showIfInsufficientFunds = useCallback((error: unknown): boolean => {
        // Extract detail from different error shapes:
        // - ApiError: .message is the raw JSON body string, needs parsing
        // - Plain object: may have .detail directly
        let detail: Record<string, unknown> | null = null;

        try {
            const err = error as Record<string, unknown> | null;

            // 1. Try err.detail directly (plain object shape)
            if (err?.detail && typeof err.detail === 'object') {
                detail = err.detail as Record<string, unknown>;
            }
            // 2. Try parsing err.message as JSON (ApiError shape)
            else if (err?.message && typeof err.message === 'string') {
                try {
                    const parsed = JSON.parse(err.message);
                    if (parsed?.detail && typeof parsed.detail === 'object') {
                        detail = parsed.detail;
                    } else if (parsed?.code) {
                        detail = parsed;
                    }
                } catch { /* not JSON, skip */ }
            }
            // 3. Fallback: err.body.detail
            else if ((err?.body as Record<string, unknown>)?.detail) {
                detail = (err?.body as Record<string, unknown>).detail as Record<string, unknown>;
            }
        } catch { /* extraction failed, detail stays null */ }

        if (detail?.code === "INSUFFICIENT_FUNDS") {
            setErrorData({
                account_name: (detail.account_name as string) ?? "Cuenta",
                current_balance: (detail.current_balance as number) ?? 0,
                requested_amount: (detail.requested_amount as number) ?? 0,
                message: detail.message as string | undefined,
            });
            return true; // Handled
        }
        return false; // Not our error, let caller handle
    }, []);

    const dismiss = useCallback(() => setErrorData(null), []);

    return { errorData, showIfInsufficientFunds, dismiss };
}
