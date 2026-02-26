import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface ComparisonGraphSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function ComparisonGraphSVG({ className, style }: ComparisonGraphSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 75%',
                }
            });

            // Grid fades in
            tl.from('.cg-grid', { opacity: 0, duration: 1 });

            // Red line (Bank) draws slowly and flat
            tl.from('.cg-red-line', {
                strokeDashoffset: 1000,
                strokeDasharray: 1000,
                duration: 2.5,
                ease: 'power1.out'
            }, 0);

            tl.from('.cg-red-text', { opacity: 0, x: -20, duration: 1 }, 1);

            // Gold line (KoreX) shoots up aggressively
            tl.from('.cg-gold-line', {
                strokeDashoffset: 1000,
                strokeDasharray: 1000,
                duration: 2,
                ease: 'power3.out'
            }, 0.5);

            tl.from('.cg-gold-fill', {
                scaleY: 0,
                transformOrigin: 'bottom',
                duration: 2,
                ease: 'power3.out',
                opacity: 0
            }, 0.5);

            tl.from('.cg-gold-text', { opacity: 0, y: 20, duration: 1 }, 1.5);

            // Nodes pop in
            tl.from('.cg-node', {
                scale: 0,
                transformOrigin: 'center',
                stagger: 0.2,
                duration: 0.6,
                ease: 'back.out(2)'
            }, 1.2);

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
                <linearGradient id="cg-goldGrad" x1="0" y1="400" x2="0" y2="0" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity="0" />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.3" />
                </linearGradient>
            </defs>

            {/* Base Background */}
            <rect width="600" height="400" rx="16" fill="#020617" stroke="#1E293B" strokeWidth="2" />

            {/* Background Grid */}
            <g className="cg-grid" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 4">
                {[50, 150, 250, 350].map((y) => (
                    <line key={`cg-hy${y}`} x1="0" y1={y} x2="600" y2={y} />
                ))}
                {[100, 200, 300, 400, 500].map((x) => (
                    <line key={`cg-hx${x}`} x1={x} y1="0" x2={x} y2="400" />
                ))}
            </g>

            {/* Split Line Indicator (Years) */}
            <line x1="300" y1="0" x2="300" y2="400" stroke="#334155" strokeWidth="2" strokeDasharray="8 8" />
            <rect x="260" y="370" width="80" height="30" rx="4" fill="#0F172A" stroke="#334155" />
            <text x="300" y="390" fill="#94A3B8" fontSize="12" fontFamily="monospace" textAnchor="middle">YEAR 7</text>

            <rect x="540" y="370" width="60" height="30" rx="4" fill="#0F172A" stroke="#334155" />
            <text x="570" y="390" fill="#94A3B8" fontSize="12" fontFamily="monospace" textAnchor="middle">YR 30</text>


            {/* RED LINE: The Bank Way (Slow equity growth, mostly interest) */}
            <path
                className="cg-red-line"
                d="M 0 350 L 100 340 L 200 325 L 300 300 L 400 260 L 500 200 L 600 100"
                fill="none"
                stroke="#EF4444"
                strokeWidth="4"
                strokeLinecap="round"
            />
            {/* Red Data Point */}
            <g className="cg-node" transform="translate(600, 100)">
                <circle cx="0" cy="0" r="8" fill="#020617" stroke="#EF4444" strokeWidth="3" />
            </g>
            <g className="cg-red-text">
                <rect x="460" y="60" width="120" height="30" rx="4" fill="#450A0A" stroke="#EF4444" />
                <text x="520" y="80" fill="#FECACA" fontSize="12" fontFamily="sans-serif" fontWeight="bold" textAnchor="middle">Bank Route</text>
            </g>


            {/* GOLD LINE: The KoreX Way (Aggressive equity growth) */}
            <path
                className="cg-gold-fill"
                d="M 0 350 L 100 310 L 200 220 L 300 80 L 300 400 L 0 400 Z"
                fill="url(#cg-goldGrad)"
            />
            <path
                className="cg-gold-line"
                d="M 0 350 L 100 310 L 200 220 L 300 80"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="5"
                strokeLinecap="round"
            />
            {/* Gold Data Point at Freedom Date */}
            <g className="cg-node" transform="translate(300, 80)">
                <circle cx="0" cy="0" r="10" fill="#F59E0B" />
                <circle cx="0" cy="0" r="4" fill="#FFFFFF" />
            </g>
            <g className="cg-gold-text">
                <rect x="180" y="30" width="100" height="40" rx="4" fill="#1E293B" stroke="#F59E0B" strokeWidth="2" />
                <text x="230" y="48" fill="#FDE68A" fontSize="10" fontFamily="sans-serif" textAnchor="middle">FREEDOM</text>
                <text x="230" y="64" fill="#F59E0B" fontSize="14" fontWeight="bold" fontFamily="monospace" textAnchor="middle">ACHIEVED</text>
            </g>

            {/* Savings Gap Annotation */}
            <g className="cg-node cg-gold-text">
                <path d="M 300 80 L 300 300" stroke="#10B981" strokeWidth="2" strokeDasharray="4 4" />
                <rect x="310" y="170" width="100" height="30" rx="15" fill="#064E3B" stroke="#10B981" />
                <text x="360" y="190" fill="#34D399" fontSize="12" fontWeight="bold" fontFamily="monospace" textAnchor="middle">+$45,000</text>
            </g>

        </svg>
    );
}
