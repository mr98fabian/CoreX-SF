import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface SimpleFreedomSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function SimpleFreedomSVG({ className, style }: SimpleFreedomSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    // Expanded viewBox to 1200x800 for maximum padding
    const viewBoxWidth = 1200;
    const viewBoxHeight = 800;
    const centerX = viewBoxWidth / 2;
    const centerY = viewBoxHeight / 2;

    // Adjusted radii to be well within the safe zone
    const nodesData = [
        { label: "MORTGAGE CLEARED", angle: -25, radius: 260 },
        { label: "EMERGENCY FUND MAXED", angle: 35, radius: 230 },
        { label: "AUTO LOAN DEAD", angle: 110, radius: 250 },
        { label: "CREDIT CARDS 0", angle: 160, radius: 280 },
        { label: "STUDENT LOANS GONE", angle: 210, radius: 240 },
        { label: "SOVEREIGN RANK", angle: -110, radius: 250 },
    ];

    const nodes = nodesData.map(node => {
        const rad = (node.angle * Math.PI) / 180;
        return {
            ...node,
            x: centerX + Math.cos(rad) * node.radius,
            y: centerY + Math.sin(rad) * node.radius,
        };
    });

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: svg,
                    start: "top 70%",
                    once: true,
                }
            });

            tl.fromTo('.fc-orbit-ring',
                { scale: 0.8, opacity: 0, transformOrigin: 'center' },
                { scale: 1, opacity: 1, duration: 1.5, stagger: 0.2, ease: 'power3.out' },
                0
            );

            tl.fromTo('.fc-core',
                { scale: 0, opacity: 0, transformOrigin: 'center' },
                { scale: 1, opacity: 1, duration: 1, ease: 'back.out(1.5)' },
                0.2
            );

            tl.fromTo('.fc-line',
                { strokeDashoffset: 400, strokeDasharray: 400 },
                { strokeDashoffset: 0, duration: 1.2, stagger: 0.1, ease: 'power2.out' },
                0.5
            );

            tl.fromTo('.fc-dot',
                { scale: 0, transformOrigin: 'center' },
                { scale: 1, duration: 0.6, stagger: 0.1, ease: 'back.out(2)' },
                1
            );
        }, svg);

        return () => ctx.revert();
    }, [nodes, centerX]);

    return (
        <svg
            ref={svgRef}
            className={className}
            style={style}
            viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`}
            preserveAspectRatio="xMidYMid meet"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <radialGradient id="fc-core-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.5" />
                    <stop offset="50%" stopColor="#8B5CF6" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </radialGradient>
                <linearGradient id="fc-line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.9" />
                    <stop offset="100%" stopColor="#4C1D95" stopOpacity="0.2" />
                </linearGradient>
            </defs>

            {/* Orbit Rings */}
            <circle className="fc-orbit-ring" cx={centerX} cy={centerY} r="180" stroke="#4C1D95" strokeWidth="1" strokeDasharray="4 8" opacity="0.6" />
            <circle className="fc-orbit-ring" cx={centerX} cy={centerY} r="350" stroke="#2E1065" strokeWidth="1" />

            {/* Central Glowing Core Container */}
            <circle className="fc-core" cx={centerX} cy={centerY} r="180" fill="url(#fc-core-glow)" />

            {/* Inner Core Shield (CSS Animated Pulse via LandingPage.css) */}
            <g className="fc-center-shield" transform={`translate(${centerX}, ${centerY})`}>
                <circle cx="0" cy="0" r="14" fill="#C4B5FD" />
                <circle cx="0" cy="0" r="32" fill="none" stroke="#8B5CF6" strokeWidth="2" opacity="0.9" />
                <path d="M-10 0 L0 10 L14 -10" stroke="#020617" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

            {/* Network Nodes */}
            {nodes.map((node, i) => {
                return (
                    <g key={`node-${i}`}>
                        {/* Connection Line */}
                        <line
                            className="fc-line"
                            x1={centerX} y1={centerY}
                            x2={node.x} y2={node.y}
                            stroke="url(#fc-line-grad)"
                            strokeWidth="2"
                            strokeLinecap="round"
                        />

                        {/* Node Dot */}
                        <circle
                            className="fc-dot"
                            cx={node.x} cy={node.y}
                            r="6"
                            fill="#C4B5FD"
                            stroke="#1E1B4B"
                            strokeWidth="3"
                        />
                    </g>
                );
            })}
        </svg>
    );
}
