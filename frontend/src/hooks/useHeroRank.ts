/**
 * Hero Rank / Identity Title System
 * Skill: neuroventa §2 — "Identity Anchoring"
 * 
 * Assigns a military-style rank based on user progress.
 * The user sees themselves as a HERO, not a debtor.
 */

interface HeroRank {
    level: number;
    titleEn: string;
    titleEs: string;
    emoji: string;
}

const RANKS: HeroRank[] = [
    { level: 1, titleEn: 'Recruit', titleEs: 'Recluta', emoji: '🎖️' },
    { level: 2, titleEn: 'Defender', titleEs: 'Defensor', emoji: '🛡️' },
    { level: 3, titleEn: 'Warrior', titleEs: 'Guerrero', emoji: '⚔️' },
    { level: 4, titleEn: 'Commander', titleEs: 'Comandante', emoji: '🎯' },
    { level: 5, titleEn: 'Destroyer', titleEs: 'Destructor', emoji: '💥' },
    { level: 6, titleEn: 'General', titleEs: 'General', emoji: '⭐' },
    { level: 7, titleEn: 'Sovereign', titleEs: 'Soberano', emoji: '👑' },
];

interface DashboardData {
    shield_percent?: number;
    total_debt?: number;
    attacks_executed?: number;
    debts_eliminated?: number;
    initial_total_debt?: number;
}

/**
 * Calculate the user's hero rank based on their financial progress.
 * 
 * @param dashData - Dashboard data with shield %, attacks, etc.
 * @returns The hero rank object with title in both languages
 */
export function getHeroRank(dashData?: DashboardData | null): HeroRank {
    if (!dashData) return RANKS[0]; // Recruit

    const {
        shield_percent = 0,
        total_debt = 1,
        attacks_executed = 0,
        debts_eliminated = 0,
        initial_total_debt = 1,
    } = dashData;

    // Level 7: Debt-free (Sovereign)
    if (total_debt <= 0) return RANKS[6];

    // Level 6: 50%+ debt eliminated (General)
    if (initial_total_debt > 0 && total_debt < initial_total_debt * 0.5) return RANKS[5];

    // Level 5: At least 1 debt eliminated (Destroyer)
    if (debts_eliminated >= 1) return RANKS[4];

    // Level 4: 3+ attacks executed (Commander)
    if (attacks_executed >= 3) return RANKS[3];

    // Level 3: First attack executed (Warrior)
    if (attacks_executed >= 1) return RANKS[2];

    // Level 2: Peace Shield active (Defender)
    if (shield_percent > 0) return RANKS[1];

    // Level 1: Just registered (Recruit)
    return RANKS[0];
}

export { type HeroRank, RANKS };
