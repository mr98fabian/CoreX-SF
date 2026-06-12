import { describe, it, expect, beforeEach, vi } from 'vitest';

// planLimits.ts imports apiFetch which pulls in supabase.ts (throws without env vars).
// The functions under test don't use the network — mock the whole module.
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));
import {
    PLAN_LIMITS,
    getUserPlan,
    getPlanLimit,
    getPlanName,
    getPlanLimitParam,
    withPlanLimit,
} from './planLimits';

describe('planLimits', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('defaults to starter when nothing is stored', () => {
        expect(getUserPlan()).toBe('starter');
        expect(getPlanLimit()).toBe(PLAN_LIMITS.starter);
        expect(getPlanName()).toBe('Starter');
    });

    it('reads the stored plan from localStorage', () => {
        localStorage.setItem('korex-plan', 'velocity');
        expect(getUserPlan()).toBe('velocity');
        expect(getPlanLimit()).toBe(PLAN_LIMITS.velocity);
        expect(getPlanName()).toBe('Velocity');
    });

    it('falls back safely for unknown plan ids', () => {
        localStorage.setItem('korex-plan', 'hacked-plan');
        expect(getPlanLimit()).toBe(2);
        expect(getPlanName()).toBe('Starter');
    });

    it('freedom plans are unlimited and emit no plan_limit param', () => {
        localStorage.setItem('korex-plan', 'freedom');
        expect(getPlanLimit()).toBe(Infinity);
        expect(getPlanLimitParam()).toBe('');
        expect(withPlanLimit('/api/accounts')).toBe('/api/accounts');
    });

    it('appends plan_limit with ? on clean URLs and & when query exists', () => {
        localStorage.setItem('korex-plan', 'velocity');
        const limit = PLAN_LIMITS.velocity;
        expect(withPlanLimit('/api/accounts')).toBe(`/api/accounts?plan_limit=${limit}`);
        expect(withPlanLimit('/api/accounts?foo=1')).toBe(`/api/accounts?foo=1&plan_limit=${limit}`);
    });
});
