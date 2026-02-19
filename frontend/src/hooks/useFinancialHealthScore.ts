/**
 * Financial Health Score — A composite 0-100 score that grades
 * the user's overall financial posture across multiple dimensions.
 *
 * Scoring formula:
 *   30pts: Shield fill %
 *   25pts: Debt reduction progress
 *   20pts: Login consistency (streak)
 *   15pts: Cash-to-debt ratio
 *   10pts: Commander Rank level
 */

interface HealthScoreInput {
    shieldFillPercent: number;      // 0-100
    totalDebt: number;
    liquidCash: number;
    streakScore: number;            // login streak score
    commanderLevel: number;         // 1-90
    interestSaved?: number;
}

export interface HealthScore {
    /** Overall score 0-100 */
    score: number;
    /** Letter grade */
    grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';
    /** Grade color */
    color: string;
    /** Breakdown by category */
    breakdown: {
        shield: number;
        debtProgress: number;
        consistency: number;
        cashRatio: number;
        rank: number;
    };
    /** Motivational message */
    messageEs: string;
    messageEn: string;
}

function clamp(val: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, val));
}

export function calculateHealthScore(input: HealthScoreInput): HealthScore {
    // 1. Shield fill (30 pts)
    const shield = Math.round((clamp(input.shieldFillPercent, 0, 100) / 100) * 30);

    // 2. Debt reduction progress (25 pts)
    //    Lower debt = higher score. $0 debt = 25 pts. $100k+ debt = 0 pts.
    const debtFactor = input.totalDebt <= 0 ? 1 : clamp(1 - (input.totalDebt / 100_000), 0, 1);
    const debtProgress = Math.round(debtFactor * 25);

    // 3. Login consistency (20 pts) — 30 day streak = full marks
    const consistency = Math.round(clamp(input.streakScore / 30, 0, 1) * 20);

    // 4. Cash-to-Debt ratio (15 pts)
    //    Ideal: cash >= debt → 15 pts
    const cashRatio = input.totalDebt <= 0
        ? 15
        : Math.round(clamp(input.liquidCash / Math.max(1, input.totalDebt), 0, 1.5) * 10);

    // 5. Commander Rank (10 pts) — level 90 = full marks
    const rank = Math.round((input.commanderLevel / 90) * 10);

    const score = clamp(shield + debtProgress + consistency + cashRatio + rank, 0, 100);

    // Grade
    let grade: HealthScore['grade'] = 'F';
    let color = '#ef4444';
    if (score >= 90) { grade = 'A+'; color = '#10b981'; }
    else if (score >= 80) { grade = 'A'; color = '#22c55e'; }
    else if (score >= 65) { grade = 'B'; color = '#3b82f6'; }
    else if (score >= 50) { grade = 'C'; color = '#f59e0b'; }
    else if (score >= 35) { grade = 'D'; color = '#f97316'; }
    else { grade = 'F'; color = '#ef4444'; }

    // Motivational messages
    const messages: Record<string, [string, string]> = {
        'A+': ['¡Salud financiera ÉLITE! Eres imparable 👑', 'ELITE financial health! Unstoppable 👑'],
        'A': ['Excelente posición financiera 🏆', 'Excellent financial position 🏆'],
        'B': ['Buena salud financiera. Sigue así 💪', 'Good financial health. Keep it up 💪'],
        'C': ['Vas por buen camino. Más consistencia 🔥', 'On the right track. More consistency 🔥'],
        'D': ['Necesitas más disciplina. Tú puedes ⚡', 'You need more discipline. You can do it ⚡'],
        'F': ['Hora de tomar acción. Empieza hoy 🚀', 'Time to take action. Start today 🚀'],
    };

    return {
        score,
        grade,
        color,
        breakdown: { shield, debtProgress, consistency, cashRatio, rank },
        messageEs: messages[grade][0],
        messageEn: messages[grade][1],
    };
}
