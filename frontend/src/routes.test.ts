import { describe, it, expect } from 'vitest';
import app from './App.tsx?raw';

// Every source file, to prove nothing still imports what was removed
const sources = import.meta.glob(['./**/*.{ts,tsx}', '!./**/*.test.{ts,tsx}'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('route map after retiring /panel', () => {
    it('/dashboard/panel redirects to Home', () => {
        expect(app).toMatch(/<Route path="panel" element=\{<Navigate to="\/dashboard" replace \/>\} \/>/);
        expect(app).toMatch(/<Route index element=\{<HomePage \/>\} \/>/);
    });
    it('the retired dashboard is gone and nothing imports it', () => {
        expect(Object.keys(sources).some((f) => /features\/(dashboard|strategy)\//.test(f))).toBe(false);
        for (const [f, s] of Object.entries(sources)) {
            expect(s, f).not.toMatch(/features\/(dashboard|strategy)\/|OnboardingResumePopup|useDashboardData|useFinancialHealthScore/);
        }
    });
});
