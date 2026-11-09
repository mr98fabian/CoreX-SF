import { describe, it, expect, afterEach } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Switch } from './switch';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement | null = null;
let root: Root;
afterEach(() => { if (host) { act(() => root.unmount()); document.body.removeChild(host); host = null; } });

describe('Switch (shared)', () => {
    it('the button is the 44×44 touch target; the 44×24 pill and its colors live in the inner track', async () => {
        host = document.createElement('div');
        document.body.appendChild(host);
        root = createRoot(host);
        await act(async () => root.render(<Switch aria-label="x" trackClassName="group-data-[state=checked]:bg-rose-500" />));
        const btn = host.querySelector('[role="switch"]') as HTMLButtonElement;
        const cls = btn.className.split(/\s+/);
        expect(cls).toEqual(expect.arrayContaining(['h-11', 'w-11', 'bg-transparent', 'group']));
        expect(cls).not.toContain('h-6');
        expect(cls).not.toContain('rounded-full');
        const track = btn.querySelector('[data-kx="switch-track"]') as HTMLSpanElement;
        expect(track.className.split(/\s+/)).toEqual(expect.arrayContaining(['h-6', 'w-11', 'rounded-full', 'group-data-[state=checked]:bg-rose-500']));
        expect(track.querySelector('[data-state]')).not.toBeNull(); // the thumb sits inside the track
        await act(async () => btn.click());
        expect(btn.getAttribute('aria-checked')).toBe('true');
    });
});
