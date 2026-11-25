/**
 * Misión 17 (spec of misión 14 §3): the screens that used to compute money on their own now read
 * the server's single source. A money multiplication or a debt subtraction coming back into any of
 * these files is the exact bug that made two screens contradict each other — this test blocks it.
 */
import { describe, expect, it } from 'vitest';
import calendar from '@/components/kx/DebtCalendar.tsx?raw';
import settings from '@/features/settings/SettingsPage.tsx?raw';
import accounts from '@/features/accounts/AccountsPage.tsx?raw';
import actionPlan from '@/features/actionplan/ActionPlanPage.tsx?raw';
import attack from '@/features/attack/AttackPage.tsx?raw';
import home from '@/features/home/HomePage.tsx?raw';

const FILES: Record<string, string> = {
    'DebtCalendar.tsx': calendar, 'SettingsPage.tsx': settings, 'AccountsPage.tsx': accounts,
    'ActionPlanPage.tsx': actionPlan, 'AttackPage.tsx': attack,
};

// Money arithmetic that each screen used to do by hand (N-09, N-10, N-01)
const FORBIDDEN: [string, RegExp][] = [
    ['interest per month as daily × 30', /\*\s*30\b/],
    ['interest per year as daily × 365', /\*\s*365\b/],
    ['interest per day as balance × APR / 365', /\/\s*365\b/],
    ['month drop as start − end', /\.start\s*-\s*\w+\.end/],
    ['a client-side cap of the recommended amount', /Math\.min\(\s*rec\.amount/],
    ['summing movement amounts on the client', /\.reduce\(\s*\(\s*sum\s*,\s*m\s*\)\s*=>\s*sum\s*\+\s*m\.amount/],
];

describe('fuente única: las pantallas no calculan dinero por su cuenta', () => {
    for (const [file, src] of Object.entries(FILES)) {
        for (const [what, re] of FORBIDDEN) {
            it(`${file}: sin ${what}`, () => {
                expect(src).not.toMatch(re);
            });
        }
    }

    it('Inicio: «Disponible para tu plan» es el ataque de la misión (D3), el efectivo va aparte', () => {
        expect(home).toMatch(/Disponible para tu plan: '[^\n]*formatMoney\(s\.available\)/);
        expect(home).toContain('Efectivo en cuentas');
    });

    it('Calendario: la baja del mes en curso se rotula «desde hoy»', () => {
        expect(calendar).toContain('bajas desde hoy');
        expect(calendar).toContain('Te cobran este mes (fechado)');
    });
});
