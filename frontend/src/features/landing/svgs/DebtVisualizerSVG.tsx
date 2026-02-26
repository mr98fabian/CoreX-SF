import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface DebtVisualizerSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function DebtVisualizerSVG({ className, style }: DebtVisualizerSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Debt Mountain grows menacingly
            gsap.from('.dv-mountain-debt', {
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 80%',
                },
                scaleY: 0,
                transformOrigin: 'bottom',
                duration: 2,
                ease: 'power3.out'
            });

            // Grid lines fade in
            gsap.from('.dv-grid', {
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 80%',
                },
                opacity: 0,
                duration: 1.5,
                delay: 0.5
            });

            // Red compounding line draws
            gsap.from('.dv-red-line', {
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 75%',
                },
                strokeDashoffset: 1500,
                strokeDasharray: 1500,
                duration: 2.5,
                ease: 'power2.inOut',
                delay: 0.2
            });

            // Debt texts drop in
            gsap.from('.dv-debt-text', {
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 70%',
                },
                y: -20,
                opacity: 0,
                stagger: 0.2,
                duration: 0.8,
                ease: 'back.out(1.5)',
                delay: 1
            });

        }, svgRef);

        return () => ctx.revert();
    }, []);

    return (
        <svg
            ref={svgRef}
            className={className}
            style={style}
            viewBox="0 0 600 400"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="dv-redGrad" x1="0" y1="0" x2="0" y2="400" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
                </linearGradient>
                <filter id="dv-glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="6" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Background Base */}
            <rect width="600" height="400" rx="16" fill="#020617" stroke="#1E293B" strokeWidth="2" />

            {/* Grid */}
            <g className="dv-grid" stroke="#1E293B" strokeWidth="1" strokeDasharray="3 3">
                {[50, 100, 150, 200, 250, 300, 350].map((y) => (
                    <line key={`hy${y}`} x1="0" y1={y} x2="600" y2={y} />
                ))}
                {[100, 200, 300, 400, 500].map((x) => (
                    <line key={`hx${x}`} x1={x} y1="0" x2={x} y2="400" />
                ))}
            </g>

            {/* The Debt Mountain (Red Area) */}
            <path
                className="dv-mountain-debt"
                d="M 0 400 L 0 350 Q 150 320 300 200 T 600 20 L 600 400 Z"
                fill="url(#dv-redGrad)"
            />

            {/* Hard Red Line (Compound Interest Nightmare) */}
            <path
                className="dv-red-line"
                d="M 0 350 Q 150 320 300 200 T 600 20"
                fill="none"
                stroke="#EF4444"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#dv-glow)"
            />

            {/* Data Annotations */}
            <g className="dv-debt-text">
                <rect x="50" y="300" width="100" height="30" rx="4" fill="#1E293B" stroke="#EF4444" strokeWidth="1" />
                <text x="100" y="320" fill="#F87171" fontSize="12" fontFamily="monospace" textAnchor="middle">YEAR 1</text>
            </g>

            <g className="dv-debt-text">
                <rect x="250" y="150" width="140" height="30" rx="4" fill="#0F172A" stroke="#EF4444" strokeWidth="1" />
                <text x="320" y="170" fill="#F87171" fontSize="12" fontFamily="monospace" textAnchor="middle">$23,000 INTEREST</text>
            </g>

            <g className="dv-debt-text">
                <rect x="420" y="40" width="150" height="50" rx="4" fill="#450A0A" stroke="#EF4444" strokeWidth="2" filter="url(#dv-glow)" />
                <text x="495" y="60" fill="#FECACA" fontSize="10" fontFamily="sans-serif" textAnchor="middle">BANKS WON</text>
                <text x="495" y="80" fill="#F87171" fontSize="16" fontWeight="bold" fontFamily="monospace" textAnchor="middle">-$284,000</text>
            </g>

        </svg>
    );
}
