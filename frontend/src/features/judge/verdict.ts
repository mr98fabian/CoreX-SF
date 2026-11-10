/** Juez de compras: the verdict, built only from POST /api/simulator/time-cost fields. */
export interface TimeCost {
    purchase_amount?: number;
    days_delayed: number;
    months_delayed?: number;
    /** Linear approximation in the engine: deliberately NOT shown until it computes the real delta */
    cost_in_interest?: number;
    freedom_date_baseline: string | null;
    freedom_date_impact: string | null;
    debug?: { baseline_months?: number };
}

export type Verdict =
    | { kind: 'free' }
    | { kind: 'absorbed' }
    | { kind: 'delay'; months: number; days: number; from: string; to: string }
    | { kind: 'broken' };

/** Pure: the verdict from the response fields alone. */
export function verdictOf(r: TimeCost): Verdict {
    if (r.freedom_date_baseline === null) return { kind: 'free' };
    const months = r.months_delayed ?? Math.round(r.days_delayed / 30);
    if (months >= 999 || (r.debug?.baseline_months ?? 0) >= 600) return { kind: 'broken' };
    if (months <= 0) return { kind: 'absorbed' };
    return { kind: 'delay', months, days: r.days_delayed, from: r.freedom_date_baseline, to: r.freedom_date_impact ?? r.freedom_date_baseline };
}

