import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface FreedomCelebrateSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function FreedomCelebrateSVG({ className, style }: FreedomCelebrateSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 75%',
                }
            });

            // Base glow expands
            tl.from('.fc-core-glow', {
                scale: 0,
                opacity: 0,
                transformOrigin: 'center',
                duration: 2,
                ease: 'power2.out'
            });

            // Concentric rings ripple outwards
            tl.fromTo('.fc-ring',
                { scale: 0, opacity: 1, transformOrigin: 'center' },
                {
                    scale: 1,
                    opacity: 0,
                    duration: 3,
                    stagger: 0.5,
                    ease: 'power2.out',
                    repeat: -1
                },
                0);

            // Lines and nodes burst outwards
            tl.from('.fc-node-line', {
                strokeDashoffset: 300,
                strokeDasharray: 300,
                duration: 1.5,
                stagger: 0.1,
                ease: 'power3.out'
            }, 0.5);

            tl.from('.fc-node-circle', {
                scale: 0,
                transformOrigin: 'center',
                duration: 0.8,
                stagger: 0.1,
                ease: 'back.out(2)'
            }, 1);

            // Floating text labels pop in
            tl.from('.fc-label', {
                y: 20,
                opacity: 0,
                duration: 1,
                stagger: 0.2,
                ease: 'power3.out'
            }, 1.2);

            // Center shield continuous pulse
            gsap.to('.fc-center-shield', {
                scale: 1.05,
                transformOrigin: 'center',
                duration: 2,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut'
            });

        }, svgRef);

        return () => ctx.revert();
    }, []);

    // Helper for circular layout
    const centerX = 300;
    const centerY = 200;
    const radius = 120;
    const nodes = [
        { angle: 0, label: "MORTGAGE CLEARED" },
        { angle: 45, label: "EMERGENCY FUND MAXED" },
        { angle: 90, label: "AUTO LOAN DEAD" },
        { angle: 135, label: "CREDIT CARDS 0" },
        { angle: 180, label: "STUDENT LOANS GONE" },
        { angle: 225, label: "SOVEREIGN RANK" },
        { angle: 270, label: "TOTAL FINANCIAL PEACE" },
        { angle: 315, label: "100% CASH FLOW" }
    ].map(node => {
        const rad = (node.angle * Math.PI) / 180;
        return {
            ...node,
            cx: centerX + radius * Math.cos(rad),
            cy: centerY + radius * Math.sin(rad),
            lx: centerX + (radius + 40) * Math.cos(rad),
            ly: centerY + (radius + 20) * Math.sin(rad),
        };
    });

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
                <radialGradient id="fc-centerGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </radialGradient>
            </defs>

            {/* Base Container */}
            <rect width="600" height="400" rx="16" fill="#020617" stroke="#1E293B" strokeWidth="2" />

            {/* Ripple Rings */}
            <circle className="fc-ring" cx={centerX} cy={centerY} r="180" fill="none" stroke="#8B5CF6" strokeWidth="2" />
            <circle className="fc-ring" cx={centerX} cy={centerY} r="180" fill="none" stroke="#8B5CF6" strokeWidth="2" />

            {/* Core Glow */}
            <circle className="fc-core-glow" cx={centerX} cy={centerY} r="150" fill="url(#fc-centerGrad)" />

            {/* Connecting Lines & Nodes */}
            {nodes.map((n, i) => (
                <g key={`node-${i}`}>
                    {/* Line connecting from center to node */}
                    <line
                        className="fc-node-line"
                        x1={centerX} y1={centerY}
                        x2={n.cx} y2={n.cy}
                        stroke="#A78BFA"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    {/* Node circle */}
                    <circle
                        className="fc-node-circle"
                        cx={n.cx} cy={n.cy}
                        r="6"
                        fill="#FFFFFF"
                    />
                    {/* Node Label */}
                    <g className="fc-label" transform={`translate(${n.lx - 60}, ${n.ly})`}>
                        <rect x="0" y="-12" width="120" height="24" rx="12" fill="#1E1B4B" stroke="#6D28D9" />
                        <text x="60" y="4" fill="#C4B5FD" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
                            {n.label}
                        </text>
                    </g>
                </g>
            ))}

            {/* Center Core Shield / Emblem */}
            <g className="fc-center-shield" transform={`translate(${centerX}, ${centerY})`}>
                <polygon points="0,-40 35,-20 35,20 0,40 -35,20 -35,-20" fill="#2E1065" stroke="#8B5CF6" strokeWidth="4" />
                <circle cx="0" cy="0" r="15" fill="#C4B5FD" />
                <path d="M -5 0 L 0 5 L 10 -5" stroke="#2E1065" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </g>

        </svg>
    );
}
