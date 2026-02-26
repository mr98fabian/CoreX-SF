import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface MobileAppSVGProps {
    className?: string;
    style?: React.CSSProperties;
}

export default function MobileAppSVG({ className, style }: MobileAppSVGProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        const ctx = gsap.context(() => {
            const tl = gsap.timeline({
                scrollTrigger: {
                    trigger: svgRef.current,
                    start: 'top 75%',
                }
            });

            // Frame slides up
            tl.from('.ma-frame', { y: 50, opacity: 0, duration: 1, ease: 'power3.out' });

            // UI Header drops in
            tl.from('.ma-header', { y: -20, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.5');

            // List items stagger in
            tl.from('.ma-list-item', {
                scale: 0.9,
                opacity: 0,
                stagger: 0.15,
                duration: 0.5,
                ease: 'back.out(1.5)'
            }, '-=0.3');

            // The "Attack" execution — Target highlights, line strikes through
            tl.to('#ma-target', {
                fill: '#1E1B4B',
                stroke: '#8B5CF6',
                duration: 0.4,
                delay: 0.5
            });

            tl.from('.ma-strike', {
                scaleX: 0,
                transformOrigin: 'left',
                duration: 0.6,
                ease: 'power3.out'
            });

            // Target fades slightly, success badge pops
            tl.to('.ma-target-content', { opacity: 0.4, duration: 0.4 }, '-=0.2');
            tl.from('.ma-success-badge', { scale: 0, opacity: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, '-=0.2');

        }, svgRef);

        return () => ctx.revert();
    }, []);

    return (
        <svg
            ref={svgRef}
            className={className}
            style={style}
            viewBox="0 0 400 700"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            {/* Phone Frame */}
            <g className="ma-frame">
                <rect x="25" y="25" width="350" height="650" rx="40" fill="#0F172A" stroke="#334155" strokeWidth="8" />
                {/* Dynamic Island / Notch */}
                <rect x="150" y="33" width="100" height="25" rx="12" fill="#020617" />
                {/* Screen background inner glow */}
                <rect x="33" y="33" width="334" height="634" rx="32" fill="#020617" opacity="0.8" />
            </g>

            {/* App UI Content */}
            {/* Header */}
            <g className="ma-header">
                <circle cx="65" cy="100" r="16" fill="#1E293B" />
                <path d="M 58 100 L 72 100 M 58 95 L 72 95 M 58 105 L 67 105" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
                <rect x="270" y="84" width="60" height="32" rx="16" fill="#0F172A" stroke="#F59E0B" />
                <circle cx="286" cy="100" r="6" fill="#F59E0B" />
                <text x="300" y="104" fill="#F59E0B" fontSize="12" fontWeight="bold" fontFamily="sans-serif">PRO</text>

                <text x="200" y="160" fill="#F8FAFC" fontSize="28" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">Dashboard</text>
                <text x="200" y="180" fill="#94A3B8" fontSize="14" fontFamily="sans-serif" textAnchor="middle">Ready to Attack</text>
            </g>

            {/* List Item 1: Checked */}
            <g className="ma-list-item">
                <rect x="50" y="220" width="300" height="80" rx="16" fill="#1E40AF" fillOpacity="0.1" stroke="#3B82F6" strokeOpacity="0.3" />
                <circle cx="85" cy="260" r="12" fill="#3B82F6" />
                <path d="M 80 260 L 84 264 L 91 256" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                <text x="110" y="255" fill="#64748B" fontSize="16" fontWeight="bold" fontFamily="sans-serif" textDecoration="line-through">Car Loan</text>
                <text x="110" y="275" fill="#475569" fontSize="12" fontFamily="monospace">$0 / $12,500</text>
                <text x="320" y="265" fill="#3B82F6" fontSize="14" fontWeight="bold" fontFamily="monospace" textAnchor="end">CLEARED</text>
            </g>

            {/* List Item 2: Active Target */}
            <g className="ma-list-item" id="ma-target-group">
                <rect id="ma-target" x="50" y="320" width="300" height="90" rx="16" fill="#1E293B" stroke="#334155" />

                <g className="ma-target-content">
                    <circle cx="85" cy="365" r="12" fill="none" stroke="#94A3B8" strokeWidth="2" />
                    <text x="110" y="355" fill="#F8FAFC" fontSize="18" fontWeight="bold" fontFamily="sans-serif">Chase Sapphire</text>
                    <text x="110" y="375" fill="#F43F5E" fontSize="14" fontFamily="monospace">24.99% APR</text>
                    <text x="320" y="360" fill="#F8FAFC" fontSize="18" fontWeight="bold" fontFamily="monospace" textAnchor="end">$8,450</text>
                    <text x="320" y="380" fill="#94A3B8" fontSize="12" fontFamily="sans-serif" textAnchor="end">Balance</text>
                </g>

                {/* Strike line (initially hidden by scaleX: 0) */}
                <path className="ma-strike" d="M 70 365 L 330 365" stroke="#A78BFA" strokeWidth="4" strokeLinecap="round" />

                {/* Success Badge */}
                <g className="ma-success-badge" transform="translate(290, 340)">
                    <rect x="0" y="0" width="60" height="24" rx="12" fill="#8B5CF6" />
                    <text x="30" y="16" fill="#FFFFFF" fontSize="10" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">ATTACKED</text>
                </g>
            </g>

            {/* List Item 3: Pending */}
            <g className="ma-list-item">
                <rect x="50" y="430" width="300" height="80" rx="16" fill="#0F172A" stroke="#1E293B" />
                <circle cx="85" cy="470" r="12" fill="none" stroke="#475569" strokeWidth="2" />
                <text x="110" y="465" fill="#94A3B8" fontSize="16" fontWeight="bold" fontFamily="sans-serif">Student Loan</text>
                <text x="110" y="485" fill="#64748B" fontSize="12" fontFamily="monospace">6.5% APR</text>
                <text x="320" y="475" fill="#94A3B8" fontSize="16" fontWeight="bold" fontFamily="monospace" textAnchor="end">$42,100</text>
            </g>

            {/* Bottom Nav / Button */}
            <g className="ma-list-item">
                <rect x="50" y="550" width="300" height="60" rx="30" fill="#F59E0B" />
                <circle cx="85" cy="580" r="15" fill="#FFFFFF" fillOpacity="0.2" />
                <path d="M 78 580 L 88 580 M 83 575 L 83 585" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" />
                <text x="200" y="586" fill="#000000" fontSize="16" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">EXECUTE CHUNK</text>
            </g>

        </svg >
    );
}
