import { describe, it, expect } from 'vitest';
import src from './OnboardingWizard.tsx?raw';

/**
 * The tutorial can be re-skinned and rewritten, but its data contract is frozen:
 * same 7 steps, same writes to /api/cashflow, /api/accounts, /api/user/me/shield,
 * same reads. This test fails if any of that moves.
 */
describe('OnboardingWizard data contract', () => {
    it('keeps the 7 steps in order', () => {
        const order = ['renderWelcome()', "renderCashflowStep('income')", "renderCashflowStep('expense')", 'renderAssetsStep()', 'renderDebtsStep()', 'renderPeaceShieldStep()', 'renderSuccess()'];
        order.forEach((call, i) => expect(src).toContain(`case ${i}: return ${call};`));
    });

    it('keeps the gating rules per step', () => {
        expect(src).toContain('case 1: return incomeItems.length >= 1;');
        expect(src).toContain('case 2: return expenseItems.length >= 1;');
        expect(src).toContain('case 4: return debtItems.length >= 1;');
        expect(src).toContain('case 5: return parseFloat(shieldAmount) > 0;');
    });

    it('writes the same cashflow payload', () => {
        for (const k of ['name: cashflowForm.name', 'amount: parseFloat(cashflowForm.amount)', 'frequency: cashflowForm.frequency', 'is_variable: cashflowForm.is_variable', 'day_of_month: cashflowForm.day_of_month',
            'payload.day_of_week = cashflowForm.day_of_week', 'payload.date_specific_1 = cashflowForm.date_specific_1', 'payload.date_specific_2 = cashflowForm.date_specific_2', 'payload.month_of_year = cashflowForm.month_of_year']) {
            expect(src).toContain(k);
        }
        expect(src).toMatch(/apiFetch<\{ id: number \}>\('\/api\/cashflow', \{\s*method: 'POST'/);
        expect(src).toContain('apiFetch(`/api/cashflow/${id}`');
    });

    it('writes the same account payload', () => {
        for (const k of ['name: accountForm.name', 'balance: parseFloat(accountForm.balance)', "interest_rate: parseFloat(accountForm.interest_rate || '0')", "min_payment: parseFloat(accountForm.min_payment || '0')", "payment_frequency: 'monthly'",
            'payload.debt_subtype = accountForm.debt_subtype', 'payload.interest_type = inferInterestType(accountForm.debt_subtype)', 'payload.credit_limit = parseFloat(accountForm.credit_limit)']) {
            expect(src).toContain(k);
        }
        expect(src).toMatch(/apiFetch<\{ id: number \}>\('\/api\/accounts', \{\s*method: 'POST'/);
        expect(src).toContain('apiFetch(`/api/accounts/${id}`');
    });

    it('writes the shield and keeps its reads', () => {
        expect(src).toMatch(/apiFetch\('\/api\/user\/me\/shield', \{\s*method: 'PUT',[\s\S]{0,160}body: JSON\.stringify\(\{ target: amount \}\)/);
        expect(src).toContain("'/api/velocity/projections'");
        expect(src).toContain("localStorage.setItem('korex_onboarding_step', String(currentStep))");
    });
});
