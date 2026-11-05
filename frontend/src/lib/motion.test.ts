import { describe, it, expect } from 'vitest';
import css from '../styles/kx.css?raw';
import { COUNT_MS, DURATION, EASE_OUT, EASE_OUT_CSS, MAX_MS, STAMP_SPRING, tx } from './motion';

describe('motion tokens', () => {
    it('exports the four durations and nothing runs past 700 ms', () => {
        expect(DURATION).toEqual({ fast: 0.12, base: 0.24, slow: 0.48, celebration: 0.7 });
        expect(Math.max(...Object.values(DURATION)) * 1000).toBeLessThanOrEqual(MAX_MS);
        expect(COUNT_MS).toBeLessThanOrEqual(600);
    });

    it('has one ease-out curve (JS and CSS agree) and one spring', () => {
        expect(EASE_OUT_CSS).toBe(`cubic-bezier(${EASE_OUT.join(', ')})`);
        expect(STAMP_SPRING.type).toBe('spring');
    });

    it('CSS tokens mirror the JS tokens', () => {
        expect(css).toContain('--kx-dur-fast: 120ms');
        expect(css).toContain('--kx-dur-base: 240ms');
        expect(css).toContain('--kx-dur-slow: 480ms');
        expect(css).toContain('--kx-dur-celebration: 700ms');
        expect(css).toContain(`--kx-ease-out: ${EASE_OUT_CSS}`);
    });

    it('tx() is instant under reduced motion', () => {
        expect(tx('slow', true)).toEqual({ duration: 0 });
        expect(tx('base')).toEqual({ duration: 0.24, ease: EASE_OUT });
    });
});
