import { describe, it, expect, vi, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/contexts/LanguageContext', () => ({ useLanguage: () => ({ language: 'es', setLanguage: vi.fn() }) }));
vi.mock('@/hooks/usePageTitle', () => ({ usePageTitle: () => undefined }));
vi.mock('@/components/MoneyAmount', () => ({ MoneyAmount: ({ value }: { value: number }) => <span>${value.toFixed(2)}</span> }));
vi.mock('./VelocityCalculatorModal', () => ({ VelocityCalculatorModal: () => null }));

import KxLanding from './KxLanding';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Landing · María', () => {
    it('quotes her daily interest as pinned by the engine test (13.12 → 2.64 at month 12)', async () => {
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => root.render(<MemoryRouter><KxLanding /></MemoryRouter>));
        const line = host.querySelector('[data-testid="maria-daily"]')!.textContent;
        // Same figures as backend/tests/test_demo_persona.py MARIA_DAILY_BEFORE / MARIA_DAILY_MONTH12
        expect(line).toContain('$13.12');
        expect(line).toContain('$2.64');
        expect(host.textContent).toContain('María, persona ficticia');
    });
});
