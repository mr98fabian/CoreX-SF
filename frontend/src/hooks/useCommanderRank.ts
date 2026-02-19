/**
 * Commander Rank System — Military × Material Progression
 *
 * 9 Military Ranks × 10 Material Tiers = 90 Total Levels
 * Progression is based on TRANSACTION streak score (register income/expense daily).
 * Paid users earn 2x XP per day.
 * Missing a day → score - 2 (not full reset).
 *
 * Total days to max (General Legendario):
 *   Free:  2,232 days  (~6.11 years)
 *   Paid:  1,116 days  (~3.06 years)
 */

// ─── Military Ranks (cycle within each material) ────────────────
export interface MilitaryRank {
    index: number;
    nameEn: string;
    nameEs: string;
    stars: string;
}

export const MILITARY_RANKS: MilitaryRank[] = [
    { index: 0, nameEn: 'Recruit', nameEs: 'Recluta', stars: '' },
    { index: 1, nameEn: 'Private', nameEs: 'Soldado', stars: '★' },
    { index: 2, nameEn: 'Corporal', nameEs: 'Cabo', stars: '★★' },
    { index: 3, nameEn: 'Sergeant', nameEs: 'Sargento', stars: '★★★' },
    { index: 4, nameEn: 'Lieutenant', nameEs: 'Teniente', stars: '★★★★' },
    { index: 5, nameEn: 'Captain', nameEs: 'Capitán', stars: '☆' },
    { index: 6, nameEn: 'Major', nameEs: 'Mayor', stars: '☆☆' },
    { index: 7, nameEn: 'Colonel', nameEs: 'Coronel', stars: '☆☆☆' },
    { index: 8, nameEn: 'General', nameEs: 'General', stars: '☆☆☆☆' },
];

// ─── Material Tiers ─────────────────────────────────────────────
export interface MaterialTier {
    index: number;
    nameEn: string;
    nameEs: string;
    emoji: string;
    color: string;
    glowColor: string;
    daysPerRank: number;
}

/**
 * Days per rank increase with each material tier.
 * Total days for a tier = daysPerRank × 9 (military ranks).
 *
 * Cumulative totals:
 *   Wood:        2 × 9 =   18  (cum:    18)
 *   Stone:       4 × 9 =   36  (cum:    54)
 *   Iron:        8 × 9 =   72  (cum:   126)
 *   Bronze:     12 × 9 =  108  (cum:   234)
 *   Silver:     18 × 9 =  162  (cum:   396)
 *   Gold:       24 × 9 =  216  (cum:   612)
 *   Emerald:    32 × 9 =  288  (cum:   900)
 *   Diamond:    42 × 9 =  378  (cum:  1278)
 *   Obsidian:   52 × 9 =  468  (cum:  1746)
 *   Legendary:  54 × 9 =  486  (cum:  2232)
 *
 *   MAX = 2,232 days ≈ 6.11 years (free)
 *   Paid (2x) = 1,116 days ≈ 3.06 years
 */
export const MATERIAL_TIERS: MaterialTier[] = [
    { index: 0, nameEn: 'Wood', nameEs: 'Madera', emoji: '🪵', color: '#8B6914', glowColor: 'rgba(139,105,20,0.3)', daysPerRank: 2 },
    { index: 1, nameEn: 'Stone', nameEs: 'Piedra', emoji: '🪨', color: '#808080', glowColor: 'rgba(128,128,128,0.3)', daysPerRank: 4 },
    { index: 2, nameEn: 'Iron', nameEs: 'Hierro', emoji: '⚙️', color: '#B0B0B0', glowColor: 'rgba(176,176,176,0.3)', daysPerRank: 8 },
    { index: 3, nameEn: 'Bronze', nameEs: 'Bronce', emoji: '🥉', color: '#CD7F32', glowColor: 'rgba(205,127,50,0.3)', daysPerRank: 12 },
    { index: 4, nameEn: 'Silver', nameEs: 'Plata', emoji: '🥈', color: '#C0C0C0', glowColor: 'rgba(192,192,192,0.4)', daysPerRank: 18 },
    { index: 5, nameEn: 'Gold', nameEs: 'Oro', emoji: '🥇', color: '#FFD700', glowColor: 'rgba(255,215,0,0.3)', daysPerRank: 24 },
    { index: 6, nameEn: 'Emerald', nameEs: 'Esmeralda', emoji: '💚', color: '#50C878', glowColor: 'rgba(80,200,120,0.3)', daysPerRank: 32 },
    { index: 7, nameEn: 'Diamond', nameEs: 'Diamante', emoji: '💎', color: '#B9F2FF', glowColor: 'rgba(185,242,255,0.3)', daysPerRank: 42 },
    { index: 8, nameEn: 'Obsidian', nameEs: 'Obsidiana', emoji: '🔮', color: '#9B30FF', glowColor: 'rgba(155,48,255,0.4)', daysPerRank: 52 },
    { index: 9, nameEn: 'Legendary', nameEs: 'Legendario', emoji: '👑', color: '#FF4500', glowColor: 'rgba(255,69,0,0.4)', daysPerRank: 54 },
];

// ─── Precomputed cumulative day thresholds ──────────────────────
interface RankThreshold {
    materialIndex: number;
    militaryIndex: number;
    cumulativeDays: number;  // days needed to REACH this rank
}

// Build flat list of all 90 ranks with their day thresholds
function buildThresholds(): RankThreshold[] {
    const thresholds: RankThreshold[] = [];
    let cumDays = 0;

    for (const mat of MATERIAL_TIERS) {
        for (const mil of MILITARY_RANKS) {
            thresholds.push({
                materialIndex: mat.index,
                militaryIndex: mil.index,
                cumulativeDays: cumDays,
            });
            cumDays += mat.daysPerRank;
        }
    }

    return thresholds;
}

const ALL_THRESHOLDS = buildThresholds();
const MAX_DAYS = ALL_THRESHOLDS[ALL_THRESHOLDS.length - 1].cumulativeDays +
    MATERIAL_TIERS[MATERIAL_TIERS.length - 1].daysPerRank;

// ─── Commander Rank Result ──────────────────────────────────────
export interface CommanderRank {
    /** Overall level 1-90 */
    level: number;
    /** Material tier object */
    material: MaterialTier;
    /** Military rank object */
    military: MilitaryRank;
    /** Display string: "Capitán de Diamante" / "Diamond Captain" */
    displayNameEs: string;
    displayNameEn: string;
    /** Full display with emoji: "💎 Capitán de Diamante" */
    fullDisplayEs: string;
    fullDisplayEn: string;
    /** Current effective XP (streak score) */
    xp: number;
    /** XP needed to reach the NEXT rank */
    xpForNext: number;
    /** XP at the START of current rank */
    xpAtCurrent: number;
    /** Progress 0-100 to next rank */
    progressPercent: number;
    /** Whether user is at max rank */
    isMaxRank: boolean;
    /** Name of next rank (for display) */
    nextRankEs: string | null;
    nextRankEn: string | null;
}

/**
 * Calculate the Commander Rank from a streak score.
 *
 * @param streakScore - Effective streak score (days × multiplier, with -2 penalty applied)
 * @returns Full CommanderRank object
 */
export function getCommanderRank(streakScore: number): CommanderRank {
    const score = Math.max(0, Math.floor(streakScore));

    // Find the highest rank the user has reached
    let rankIndex = 0;
    for (let i = ALL_THRESHOLDS.length - 1; i >= 0; i--) {
        if (score >= ALL_THRESHOLDS[i].cumulativeDays) {
            rankIndex = i;
            break;
        }
    }

    const current = ALL_THRESHOLDS[rankIndex];
    const material = MATERIAL_TIERS[current.materialIndex];
    const military = MILITARY_RANKS[current.militaryIndex];
    const isMaxRank = rankIndex === ALL_THRESHOLDS.length - 1;

    // XP progress within current rank
    const xpAtCurrent = current.cumulativeDays;
    const xpForNext = isMaxRank ? MAX_DAYS : ALL_THRESHOLDS[rankIndex + 1].cumulativeDays;
    const rankSpan = xpForNext - xpAtCurrent;
    const progressInRank = score - xpAtCurrent;
    const progressPercent = rankSpan > 0 ? Math.min(100, Math.round((progressInRank / rankSpan) * 100)) : 100;

    // Display names
    const displayNameEs = `${military.nameEs} de ${material.nameEs}`;
    const displayNameEn = `${material.nameEn} ${military.nameEn}`;

    // Next rank info
    let nextRankEs: string | null = null;
    let nextRankEn: string | null = null;
    if (!isMaxRank) {
        const next = ALL_THRESHOLDS[rankIndex + 1];
        const nextMat = MATERIAL_TIERS[next.materialIndex];
        const nextMil = MILITARY_RANKS[next.militaryIndex];
        nextRankEs = `${nextMil.nameEs} de ${nextMat.nameEs}`;
        nextRankEn = `${nextMat.nameEn} ${nextMil.nameEn}`;
    }

    return {
        level: rankIndex + 1,
        material,
        military,
        displayNameEs,
        displayNameEn,
        fullDisplayEs: `${material.emoji} ${displayNameEs}`,
        fullDisplayEn: `${material.emoji} ${displayNameEn}`,
        xp: score,
        xpForNext,
        xpAtCurrent,
        progressPercent,
        isMaxRank,
        nextRankEs,
        nextRankEn,
    };
}

/**
 * Calculate the effective streak score considering paid status.
 * Paid users earn 2x XP per login day.
 */
export function getEffectiveScore(rawStreakDays: number, isPaid: boolean): number {
    return isPaid ? rawStreakDays * 2 : rawStreakDays;
}
