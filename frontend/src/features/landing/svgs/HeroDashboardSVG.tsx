import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroDashboardSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function HeroDashboardSVG({ className, style }: HeroDashboardSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            // Background grid entry
            gsap.from('.hd-grid', { opacity: 0, duration: 1.5, delay: 0.2, ease: 'power2.inOut' });

            // Glowing line draws itself
            gsap.from('.hd-glowy-line', {
                strokeDashoffset: 1000,
                strokeDasharray: 1000,
                duration: 2.5,
                ease: 'power3.out',
                delay: 0.5
            });

            // Bars animate up staggeredly
            gsap.from('.hd-bar', {
                scaleY: 0,
                transformOrigin: 'bottom',
                duration: 1.2,
                stagger: 0.1,
                ease: 'elastic.out(1, 0.7)',
                delay: 0.8
            });

            // Floating data points fade in and drift
            gsap.fromTo('.hd-data-node',
                { opacity: 0, y: 10 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 1,
                    stagger: 0.2,
                    ease: 'power2.out',
                    delay: 1.5
                }
            );

        }, svgRef);

        return () => ctx.revert();
    }, []);

    return (
        <svg
            ref={svgRef}
            className={className}
            style={style}
            viewBox="0 0 800 500"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Defs */}
            <defs>
                <linearGradient id="hd-bgGrad" x1="0" y1="0" x2="0" y2="500" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#0B1120" />
                    <stop offset="100%" stopColor="#020617" />
                </linearGradient>

                <linearGradient id="hd-goldGrad" x1="0" y1="0" x2="800" y2="500" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#F59E0B" />
                    <stop offset="100%" stopColor="#D97706" />
                </linearGradient>

                <filter id="hd-glow">
                    <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>

            {/* Base Screen / Frame */}
            <rect width="800" height="500" rx="20" fill="url(#hd-bgGrad)" stroke="#1E293B" strokeWidth="2" />

            {/* Top Bar macOS style */}
            <path d="M 0 20 C 0 8.954 8.954 0 20 0 L 780 0 C 791.046 0 800 8.954 800 20 L 800 40 L 0 40 L 0 20 Z" fill="#0F172A" />
            <circle cx="25" cy="20" r="6" fill="#EF4444" />
            <circle cx="45" cy="20" r="6" fill="#F59E0B" />
            <circle cx="65" cy="20" r="6" fill="#10B981" />

            {/* Background Grid */}
            <g className="hd-grid" stroke="#1E293B" strokeWidth="1" strokeDasharray="4 4" opacity="0.4">
                {[100, 150, 200, 250, 300, 350, 400, 450].map((y) => (
                    <line key={`hy${y}`} x1="50" y1={y} x2="750" y2={y} />
                ))}
            </g>

            {/* Bar Charts (Foreground) */}
            <g className="hd-chart-group" fill="#334155" opacity="0.6">
                <rect className="hd-bar" x="90" y="300" width="40" height="150" rx="4" />
                <rect className="hd-bar" x="170" y="280" width="40" height="170" rx="4" />
                <rect className="hd-bar" x="250" y="340" width="40" height="110" rx="4" />
                <rect className="hd-bar" x="330" y="200" width="40" height="250" rx="4" />
                <rect className="hd-bar" x="410" y="250" width="40" height="200" rx="4" />
                <rect className="hd-bar" x="490" y="150" width="40" height="300" rx="4" />
                <rect className="hd-bar" x="570" y="220" width="40" height="230" rx="4" />
                <rect className="hd-bar" x="650" y="100" width="40" height="350" rx="4" fill="url(#hd-goldGrad)" />
            </g>

            {/* Golden Performance Line */}
            <path
                className="hd-glowy-line"
                d="M 50 380 Q 150 350 200 300 T 350 220 T 500 120 T 650 60 T 750 20"
                fill="none"
                stroke="url(#hd-goldGrad)"
                strokeWidth="4"
                strokeLinecap="round"
                filter="url(#hd-glow)"
            />

            {/* Data Nodes */}
            <g className="hd-data-node">
                <circle cx="200" cy="300" r="6" fill="#F59E0B" />
                <rect x="215" y="280" width="80" height="24" rx="4" fill="#0F172A" stroke="#334155" />
                <text x="255" y="296" fill="#94A3B8" fontSize="12" fontFamily="monospace" textAnchor="middle">SAVING</text>
            </g>
            <g className="hd-data-node">
                <circle cx="500" cy="120" r="6" fill="#F59E0B" />
                <rect x="515" y="100" width="80" height="24" rx="4" fill="#0F172A" stroke="#334155" />
                <text x="555" y="116" fill="#94A3B8" fontSize="12" fontFamily="monospace" textAnchor="middle">VELOCITY</text>
            </g>
            <g className="hd-data-node">
                <circle cx="650" cy="60" r="10" fill="#10B981" filter="url(#hd-glow)" />
                <rect x="520" y="40" width="110" height="30" rx="4" fill="#020617" stroke="#10B981" />
                <text x="575" y="60" fill="#10B981" fontSize="14" fontWeight="bold" fontFamily="monospace" textAnchor="middle">FREEDOM</text>
            </g>

            {/* Abstract Sidebar / UI Elements */}
            <rect x="20" y="60" width="150" height="100" rx="8" fill="#1E293B" opacity="0.4" />
            <rect x="35" y="75" width="80" height="10" rx="4" fill="#475569" />
            <rect x="35" y="95" width="120" height="8" rx="4" fill="#334155" />
            <rect x="35" y="115" width="100" height="8" rx="4" fill="#334155" />
            <rect x="35" y="135" width="90" height="8" rx="4" fill="#334155" />

            {/* Dynamic circular gauge */}
            <g transform="translate(70, 220)">
                <circle cx="0" cy="0" r="30" fill="none" stroke="#334155" strokeWidth="8" />
                <circle cx="0" cy="0" r="30" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="188" strokeDashoffset="40" strokeLinecap="round" className="hd-data-node" />
                <text x="0" y="5" fill="#F1F5F9" fontSize="16" fontWeight="bold" textAnchor="middle">78%</text>
            </g>

        </svg>
    );
}
