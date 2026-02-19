/**
 * Celebration Engine — Dopamine-driven victory animations
 * Skill: neuroventa §7 — "Celebration Engine (Dopamine Design)"
 * 
 * Uses canvas-confetti for lightweight confetti explosions.
 * Falls back gracefully if the library isn't available.
 */

type CelebrationLevel = 'spark' | 'burst' | 'epic';

let confettiModule: typeof import('canvas-confetti') | null = null;

// Lazy-load canvas-confetti to avoid blocking initial bundle
async function getConfetti() {
    if (confettiModule) return confettiModule.default;
    try {
        confettiModule = await import('canvas-confetti');
        return confettiModule.default;
    } catch {
        return null;
    }
}

export function useCelebration() {
    const celebrate = async (level: CelebrationLevel = 'burst') => {
        const confetti = await getConfetti();
        if (!confetti) return;

        switch (level) {
            case 'spark':
                // Subtle sparkle — transaction logged, small wins
                confetti({
                    particleCount: 15,
                    spread: 40,
                    startVelocity: 20,
                    origin: { y: 0.7 },
                    colors: ['#10b981', '#34d399', '#6ee7b7'],
                    ticks: 60,
                    scalar: 0.8,
                });
                break;

            case 'burst':
                // Medium celebration — attack executed, shield milestone
                confetti({
                    particleCount: 60,
                    spread: 70,
                    startVelocity: 30,
                    origin: { y: 0.6 },
                    colors: ['#f59e0b', '#fbbf24', '#fcd34d', '#10b981'],
                    ticks: 100,
                });
                break;

            case 'epic':
                // Full explosion — onboarding complete, debt eliminated
                // Fire from both sides
                const defaults = {
                    startVelocity: 35,
                    spread: 60,
                    ticks: 150,
                    colors: ['#f59e0b', '#fbbf24', '#10b981', '#34d399', '#8b5cf6', '#a78bfa'],
                };
                confetti({ ...defaults, particleCount: 80, origin: { x: 0.2, y: 0.5 } });
                confetti({ ...defaults, particleCount: 80, origin: { x: 0.8, y: 0.5 } });
                // Delayed second wave
                setTimeout(() => {
                    confetti({ ...defaults, particleCount: 50, origin: { x: 0.5, y: 0.3 } });
                }, 300);
                break;
        }
    };

    return { celebrate };
}
