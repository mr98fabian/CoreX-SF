import { describe, it, expect } from 'vitest';
import pageSrc from './AccountsPage.tsx?raw';
import cashflowSrc from './components/CashflowManager.tsx?raw';
import calSrc from '@/components/kx/DebtCalendar.tsx?raw';

// U-11: the payment day is optional and never pre-filled with a made-up day
describe('due_day optional in the account form', () => {
    it('schema accepts empty, form starts empty and says "opcional"', () => {
        expect(pageSrc).toMatch(/due_day: z\.preprocess\(emptyToUndefined, z\.coerce\.number\(\)\.int\(\)\.min\(1\)\.max\(31\)\.optional\(\)\)/);
        expect(pageSrc).toContain('due_day: undefined,');
        expect(pageSrc).not.toMatch(/due_day: 1,/);
        expect(pageSrc).toContain('{t("accounts.dueDay")} <span className="text-kx-ink3 font-normal">({t("accounts.optional").toLowerCase()})</span>');
    });
    it('surfaces say "sin fecha de pago cargada" instead of a day', () => {
        expect(pageSrc).toContain('acc.due_day ? `${t("accounts.day")} ${acc.due_day}` : t("cashflow.noDueDay")');
        expect(cashflowSrc).toContain("t('cashflow.noDueDay')");
        expect(calSrc).toContain('sin fecha de pago cargada');
    });
});
