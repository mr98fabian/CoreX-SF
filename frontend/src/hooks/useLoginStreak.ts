import { useState, useEffect, useCallback } from 'react';

/**
 * Activity Streak Tracker — v3 (Transaction-based)
 *
 * Streak increments ONLY when user registers a transaction (income/expense).
 * On login, we READ the existing streak state + apply -2 penalty for missed days.
 * The popup is shown on login if isNewDay=true, inviting the user to register a transaction.
 *
 * Persisted in localStorage — no backend changes needed.
 */

interface StreakData {
    /** Current streak score (can differ from raw days if penalties applied) */
    score: number;
    /** Raw consecutive days without any miss */
    rawStreak: number;
    /** Whether today is a new day that hasn't had a transaction yet */
    isNewDay: boolean;
    /** Whether today's transaction already counted (streak already incremented) */
    hasTransactionToday: boolean;
    /** Whether user just ranked up (for animation triggers) */
    didRankUp: boolean;
    /** Milestone label if just reached one, null otherwise */
    milestone: string | null;
    /** Whether to show the login popup (new day + no transaction yet) */
    showLoginPopup: boolean;
    /** Function to dismiss the login popup */
    dismissPopup: () => void;
    /** Function to increment streak after a transaction */
    incrementStreakOnTransaction: () => void;
}

const STORAGE_KEY = 'corex_login_streak_v2';

interface StoredStreak {
    score: number;        // Effective score (with penalties applied)
    rawStreak: number;    // Consecutive days without miss
    lastDate: string;     // YYYY-MM-DD of last transaction
    lastLoginDate: string; // YYYY-MM-DD of last login (for penalty calc)
    hasTransactionToday: boolean; // Whether a transaction was registered today
}

function todayStr(): string {
    return new Date().toISOString().split('T')[0];
}

function daysBetween(dateA: string, dateB: string): number {
    const a = new Date(dateA + 'T00:00:00');
    const b = new Date(dateB + 'T00:00:00');
    return Math.round((b.getTime() - a.getTime()) / (24 * 60 * 60 * 1000));
}

const MILESTONES: Record<number, string> = {
    3: '🔥 3 días seguidos',
    7: '⚔️ Racha guerrera — 1 semana',
    14: '⚡ 2 semanas imparables',
    30: '🛡️ Escudo de 30 días',
    60: '💎 Maestro de la constancia',
    90: '🏆 Élite financiera — 3 meses',
    180: '🌟 Medio año invicto',
    365: '👑 Leyenda anual',
};

// Rank-up thresholds for detecting tier changes (cumulative days at each material start)
// Updated for doubled daysPerRank: 0, 18, 54, 126, 234, 396, 612, 900, 1278, 1746
const TIER_THRESHOLDS = [0, 18, 54, 126, 234, 396, 612, 900, 1278, 1746];

export function useLoginStreak(): StreakData {
    const [data, setData] = useState<StreakData>({
        score: 0,
        rawStreak: 0,
        isNewDay: false,
        hasTransactionToday: false,
        didRankUp: false,
        milestone: null,
        showLoginPopup: false,
        dismissPopup: () => { },
        incrementStreakOnTransaction: () => { },
    });

    const dismissPopup = useCallback(() => {
        setData(prev => ({ ...prev, showLoginPopup: false }));
    }, []);

    const incrementStreakOnTransaction = useCallback(() => {
        const today = todayStr();
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        const stored: StoredStreak = JSON.parse(raw);

        // Already counted a transaction today — don't double-count
        if (stored.hasTransactionToday && stored.lastDate === today) return;

        // Calculate the gap from the last TRANSACTION date (not login)
        const gap = stored.lastDate ? daysBetween(stored.lastDate, today) : 0;
        let newScore: number;
        let newRawStreak: number;

        if (gap <= 1) {
            // Same day or consecutive day — increment
            newScore = stored.score + 1;
            newRawStreak = gap === 0 ? stored.rawStreak : stored.rawStreak + 1;
        } else if (gap > 1 && stored.lastDate) {
            // Missed day(s) between last transaction and today
            // Penalty already applied on login, just increment from current score
            newScore = stored.score + 1;
            newRawStreak = 1;
        } else {
            // First transaction ever
            newScore = 1;
            newRawStreak = 1;
        }

        // Check for milestone
        const milestone = MILESTONES[newRawStreak] || null;

        // Check for tier rank-up
        const didRankUp = TIER_THRESHOLDS.some(
            threshold => stored.score < threshold && newScore >= threshold
        );

        const updated: StoredStreak = {
            ...stored,
            score: newScore,
            rawStreak: newRawStreak,
            lastDate: today,
            hasTransactionToday: true,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        setData(prev => ({
            ...prev,
            score: newScore,
            rawStreak: newRawStreak,
            hasTransactionToday: true,
            isNewDay: false,
            didRankUp,
            milestone,
            showLoginPopup: false, // Hide popup after transaction
        }));
    }, []);

    useEffect(() => {
        const today = todayStr();

        // Migrate from v1 format if exists
        const v1Raw = localStorage.getItem('corex_login_streak');
        if (v1Raw && !localStorage.getItem(STORAGE_KEY)) {
            try {
                const v1 = JSON.parse(v1Raw);
                const migrated: StoredStreak = {
                    score: v1.count || 0,
                    rawStreak: v1.count || 0,
                    lastDate: v1.lastDate || '',
                    lastLoginDate: v1.lastDate || '',
                    hasTransactionToday: false,
                };
                localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
                localStorage.removeItem('corex_login_streak');
            } catch {
                // Ignore migration errors
            }
        }

        // Migrate from v2 format (add missing fields)
        const raw = localStorage.getItem(STORAGE_KEY);
        let stored: StoredStreak = raw
            ? JSON.parse(raw)
            : { score: 0, rawStreak: 0, lastDate: '', lastLoginDate: '', hasTransactionToday: false };

        // Ensure v2 fields exist
        if (stored.lastLoginDate === undefined) stored.lastLoginDate = stored.lastDate;
        if (stored.hasTransactionToday === undefined) stored.hasTransactionToday = false;

        // If already logged in today — just read the existing state
        if (stored.lastLoginDate === today) {
            setData({
                score: stored.score,
                rawStreak: stored.rawStreak,
                isNewDay: !stored.hasTransactionToday,
                hasTransactionToday: stored.hasTransactionToday,
                didRankUp: false,
                milestone: null,
                showLoginPopup: !stored.hasTransactionToday,
                dismissPopup,
                incrementStreakOnTransaction,
            });
            return;
        }

        // New day: apply penalties for any missed days since last LOGIN
        const gap = stored.lastLoginDate ? daysBetween(stored.lastLoginDate, today) : 0;
        let newScore = stored.score;

        if (gap > 1 && stored.lastLoginDate) {
            // Apply -2 penalty for each MISSED day (not counting today)
            const missedDays = gap - 1;
            const penalty = missedDays * 2;
            newScore = Math.max(0, stored.score - penalty);
        }

        // Update login date but do NOT increment streak — that happens on transaction
        const updated: StoredStreak = {
            score: newScore,
            rawStreak: gap > 1 ? 0 : stored.rawStreak, // Reset raw if missed days
            lastDate: stored.lastDate, // Keep last TRANSACTION date unchanged
            lastLoginDate: today,
            hasTransactionToday: false,
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        setData({
            score: newScore,
            rawStreak: updated.rawStreak,
            isNewDay: true,
            hasTransactionToday: false,
            didRankUp: false,
            milestone: null,
            showLoginPopup: true, // Show popup on new day
            dismissPopup,
            incrementStreakOnTransaction,
        });
    }, [dismissPopup, incrementStreakOnTransaction]);

    return data;
}
