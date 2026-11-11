import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import homeSrc from '@/features/home/HomePage.tsx?raw';

vi.mock('@/hooks/useFormatMoney', () => ({ useFormatMoney: () => ({ formatMoney: (n: number) => `$${n.toFixed(2)}` }) }));
vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es' }) }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/hooks/useAccounts', () => ({ useAccountLogos: () => () => undefined }));
vi.mock('@/hooks/useKxSummary', () => ({
    useKxSummary: () => ({
        loading: false, error: null, reload: vi.fn(), path: null,
        debts: [{ name: 'Upstart', stage: 'debt' }],
        staged: [{ name: 'Checking', type: 'checking', bal: 2000 }],
    }),
}));
vi.mock('@/lib/api', () => ({ apiFetch: vi.fn() }));

import { apiFetch } from '@/lib/api';
import { MissionCard, type DailyMission } from './MissionCard';
import AttackPage from '@/features/attack/AttackPage';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
async function render(node: React.ReactNode) {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
    await act(async () => { await Promise.resolve(); });
    return host;
}
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

const m = (over: Partial<DailyMission>): DailyMission =>
    ({ tipo: 'corte', cuenta: 'Chase', monto: 500, fecha_accion: '2026-11-19', fecha_evento: '2026-11-21', ...over });

describe('MissionCard — one mission, one amount, one date', () => {
    it('corte: pay by cut − 2 so it reports $0 on the cut', async () => {
        const el = await render(<MissionCard es mission={m({})} />);
        expect(el.querySelector('[data-testid="mission-title"]')!.textContent).toBe('Deja la Chase en $0');
        expect(el.querySelector('[data-testid="mission-body"]')!.textContent).toBe('Paga $500.00 a más tardar el 19 de noviembre para que reporte $0 el 21 de noviembre.');
    });

    it('estado / préstamo / faltante read in the house voice, and every amount is an estimate', async () => {
        let el = await render(<MissionCard es mission={m({ tipo: 'estado', cuenta: 'Amex Gold', monto: 1679.27, fecha_accion: '2026-12-07', fecha_evento: '2026-12-07' })} />);
        expect(el.textContent).toContain('Paga el estado de la Amex Gold$1679.27 antes del 7 de diciembre.');
        expect(el.textContent).toContain('estimado');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        el = await render(<MissionCard es mission={m({ tipo: 'prestamo', cuenta: 'Auto', monto: 641.12, fecha_accion: '2026-11-11', fecha_evento: '2026-11-11' })} />);
        expect(el.textContent).toContain('Reserva el pago de la Auto$641.12 para el 11 de noviembre.');
        act(() => root.unmount()); document.body.removeChild(host!); host = null;
        el = await render(<MissionCard es mission={m({ tipo: 'faltante', obligacion: 'estado', cuenta: 'Amex', monto: 1320.39, fecha_evento: '2026-11-28' })} />);
        expect(el.querySelector('[data-testid="mission-body"]')!.textContent).toBe('Te faltan $1320.39 para cubrir el estado de la Amex del 28 de noviembre.');
    });
});

describe('Inicio and Plan show the same server mission', () => {
    it('Inicio no longer derives its to-do from nextCut', () => {
        expect(homeSrc).not.toMatch(/nextCut\(/);
        expect(homeSrc).toContain('<MissionCard mission={s.mission}');
    });

    it('Plan puts the obligation first and the attack becomes "what is left"', async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            mision: { mision: m({ tipo: 'prestamo', cuenta: 'Auto', monto: 641.12, fecha_accion: '2026-11-11', fecha_evento: '2026-11-11' }), reserva: 641.12, ataque: 300, objetivo: 'Upstart' },
            morning_briefing: { recommended_action: { amount: 300, destination: 'Upstart', destination_balance: 8000, destination_apr: 22, reason: '' } },
            confidence_meter: { debts_ranked: [] },
        });
        const el = await render(<AttackPage />);
        expect(el.querySelector('[data-testid="mission"]')!.getAttribute('data-tipo')).toBe('prestamo');
        expect(el.textContent).toContain('Con lo que sobra después de ese pago, ataca la Upstart');
        expect(el.textContent).not.toContain('Hoy toca atacar');
    });

    it('obligation with nothing left: no "Hoy no hay ataque" contradicting the mission', async () => {
        vi.mocked(apiFetch).mockResolvedValue({
            mision: { mision: m({ tipo: 'faltante', obligacion: 'prestamo', cuenta: 'Auto', monto: 141.12 }), reserva: 641.12, ataque: 0, objetivo: 'Upstart' },
            morning_briefing: null, confidence_meter: { debts_ranked: [] },
        });
        const el = await render(<AttackPage />);
        expect(el.querySelector('[data-testid="mission"]')!.getAttribute('data-tipo')).toBe('faltante');
        expect(el.textContent).not.toContain('Hoy no hay ataque');
    });
});
