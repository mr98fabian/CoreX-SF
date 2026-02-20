/**
 * use3DTilt — Hook that applies a mouse-tracking 3D perspective tilt
 * to any HTML element. Creates a premium "floating card" effect.
 *
 * Usage:
 *   const tiltRef = use3DTilt\<HTMLDivElement\>({ maxTilt: 12, scale: 1.03 });
 *   return \<div ref={tiltRef} style={{ transformStyle: 'preserve-3d' }}\>...\</div\>;
 *
 * Performance:
 *  - Uses RAF for smooth 60fps updates
 *  - Writes directly to element.style (no React state)
 *  - Cleans up listeners on unmount
 */
import { useEffect, useRef, useCallback } from 'react';

interface TiltOptions {
    /** Maximum tilt angle in degrees. Default: 15 */
    maxTilt?: number;
    /** Scale factor on hover. Default: 1.02 */
    scale?: number;
    /** Perspective value in px. Default: 1000 */
    perspective?: number;
    /** Transition speed for reset in ms. Default: 600 */
    resetSpeed?: number;
    /** Glow effect — adds a radial light-follow gradient. Default: true */
    glowEffect?: boolean;
}

export function use3DTilt<T extends HTMLElement>(options?: TiltOptions) {
    const {
        maxTilt = 15,
        scale = 1.02,
        perspective = 1000,
        resetSpeed = 600,
        glowEffect = true,
    } = options || {};

    const ref = useRef<T>(null);
    const rafRef = useRef<number | null>(null);

    const handleMouseMove = useCallback(
        (e: MouseEvent) => {
            const el = ref.current;
            if (!el) return;

            // Cancel previous frame to avoid stacking
            if (rafRef.current) cancelAnimationFrame(rafRef.current);

            rafRef.current = requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                // Normalize to -1..1
                const normalizedX = (x / rect.width) * 2 - 1;
                const normalizedY = (y / rect.height) * 2 - 1;

                // Tilt values (inverted Y for natural feel)
                const tiltX = -normalizedY * maxTilt;
                const tiltY = normalizedX * maxTilt;

                el.style.transition = 'transform 0.1s ease-out';
                el.style.transform = `perspective(${perspective}px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) scale3d(${scale}, ${scale}, ${scale})`;

                // Light follow effect
                if (glowEffect) {
                    const glowX = ((x / rect.width) * 100).toFixed(1);
                    const glowY = ((y / rect.height) * 100).toFixed(1);
                    el.style.setProperty(
                        '--tilt-glow',
                        `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(251, 191, 36, 0.15), transparent 60%)`
                    );
                }
            });
        },
        [maxTilt, scale, perspective, glowEffect],
    );

    const handleMouseLeave = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        el.style.transition = `transform ${resetSpeed}ms cubic-bezier(0.23, 1, 0.32, 1)`;
        el.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
        if (glowEffect) {
            el.style.setProperty('--tilt-glow', 'none');
        }
    }, [perspective, resetSpeed, glowEffect]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        el.addEventListener('mousemove', handleMouseMove, { passive: true });
        el.addEventListener('mouseleave', handleMouseLeave);

        return () => {
            el.removeEventListener('mousemove', handleMouseMove);
            el.removeEventListener('mouseleave', handleMouseLeave);
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [handleMouseMove, handleMouseLeave]);

    return ref;
}
