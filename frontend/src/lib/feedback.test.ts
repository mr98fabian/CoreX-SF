import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { __resetFeedback, moment, setSoundEnabled, soundEnabled, type Moment } from './feedback';

function fakeAudio() {
    const start = vi.fn();
    const node = { connect: vi.fn(() => node), start, buffer: null as unknown };
    const gain = { gain: { value: 1 }, connect: vi.fn(() => gain) };
    const ctx = { state: 'running', destination: {}, createBufferSource: () => node, createGain: () => gain } as unknown as AudioContext;
    return { ctx, start, gain };
}
const setMotion = (reduce: boolean) => {
    window.matchMedia = ((q: string) => ({ matches: reduce && q.includes('reduce'), media: q })) as unknown as typeof window.matchMedia;
};

let vibrate: ReturnType<typeof vi.fn>;
beforeEach(() => {
    localStorage.clear(); setMotion(false);
    vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
});
afterEach(() => { __resetFeedback(); });

describe('feedback moments', () => {
    it('sound is OFF by default: total silence', () => {
        const a = fakeAudio();
        __resetFeedback({ ctx: a.ctx, buffer: {} as AudioBuffer });
        expect(soundEnabled()).toBe(false);
        moment('payment'); moment('zero-cut');
        expect(a.start).not.toHaveBeenCalled();
    });

    it('with sound ON, only payment and zero-cut play — at low volume, once per moment', () => {
        setSoundEnabled(true);
        const a = fakeAudio();
        __resetFeedback({ ctx: a.ctx, buffer: {} as AudioBuffer });
        moment('unlock', 0);
        expect(a.start).not.toHaveBeenCalled();
        moment('payment', 10_000);
        moment('zero-cut', 10_500); // same moment (payment that zeroes a cut): one sound
        expect(a.start).toHaveBeenCalledTimes(1);
        expect(a.gain.gain.value).toBeLessThan(0.5);
        moment('zero-cut', 20_000);
        expect(a.start).toHaveBeenCalledTimes(2);
    });

    it('stays silent if audio was never primed by a user gesture (iOS rule)', () => {
        setSoundEnabled(true);
        __resetFeedback(); // no context, no buffer
        expect(() => moment('payment')).not.toThrow();
    });

    it('vibrates 10 ms only on payment and unlock', () => {
        const allowed: Moment[] = ['payment', 'unlock'];
        allowed.forEach((m) => moment(m));
        expect(vibrate).toHaveBeenCalledTimes(2);
        expect(vibrate).toHaveBeenCalledWith(10);
        moment('zero-cut');
        expect(vibrate).toHaveBeenCalledTimes(2);
    });

    it('degrades silently where vibrate does not exist (iOS web)', () => {
        Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
        expect(() => moment('payment')).not.toThrow();
    });

    it('reduced motion cancels the haptic', () => {
        setMotion(true);
        moment('payment'); moment('unlock');
        expect(vibrate).not.toHaveBeenCalled();
    });
});
