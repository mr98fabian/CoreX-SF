import { useEffect, useRef } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCurrencyProps {
    /** The numeric value to animate to */
    value: number;
    /** Additional CSS classes */
    className?: string;
    /** Duration in milliseconds (default: 1500ms) */
    duration?: number;
    /** Locale-aware currency formatting prefix (default: "$") */
    prefix?: string;
}

/**
 * Animated currency display — numbers "roll" to their final value
 * like a professional financial terminal. Creates a sensation of
 * real-time calculation and precision.
 * 
 * Skill: corex-ui-magic §1 — "The Money Count Effect"
 */
export function AnimatedCurrency({
    value,
    className = '',
    duration = 1500,
    prefix = '$',
}: AnimatedCurrencyProps) {
    const spring = useSpring(0, {
        bounce: 0,
        duration,
    });

    const display = useTransform(spring, (current) => {
        const abs = Math.abs(current);
        const formatted = abs.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${prefix}${formatted}`;
    });

    // Track if first render (skip animation on mount with 0)
    const hasAnimated = useRef(false);

    useEffect(() => {
        if (!hasAnimated.current) {
            // First render — snap immediately then animate future changes
            spring.jump(value);
            hasAnimated.current = true;
        } else {
            spring.set(value);
        }
    }, [value, spring]);

    return (
        <motion.span className={`tabular-nums ${className}`}>
            {display}
        </motion.span>
    );
}
