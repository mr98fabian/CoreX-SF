/**
 * LandingPage — GTA VI Cinematic Edition.
 *
 * Inspired by rockstargames.com/VI:
 * - Full-bleed hero with cinematic letterboxing
 * - Film grain overlay for texture
 * - Bold Oswald typography (uppercase, impactful)
 * - Scroll-driven GSAP reveals with parallax depth
 * - Gold accent color palette (premium feel)
 *
 * 7 sections: Hero → Problem → Solution → Comparison → Proof → Pricing → Final CTA
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './LandingPage.css';

gsap.registerPlugin(ScrollTrigger);

/* ═══════════════════════════════════════════════════════
   Copy — bilingual, NLP-optimized
   ═══════════════════════════════════════════════════════ */
const copy = {
    hero: {
        tagline: {
            en: 'The weapon banks don\'t want you to have.',
            es: 'El arma que los bancos no quieren que tengas.',
        },
        cta: { en: 'Calculate Your Savings', es: 'Calcula Tu Ahorro' },
        secondary: { en: 'Watch Demo', es: 'Ver Demo' },
    },
    problem: {
        label: { en: 'THE PROBLEM', es: 'EL PROBLEMA' },
        title: {
            en: 'While You Read This, Your Debt Just Grew',
            es: 'Mientras lees esto, tu deuda acaba de crecer',
        },
        subtitle: {
            en: 'Banks designed the system to keep you paying for 30 years. On average, you\'ll pay $284,000 in interest on a $200,000 mortgage.',
            es: 'Los bancos diseñaron el sistema para mantenerte pagando por 30 años. En promedio, pagarás $284,000 en intereses por una hipoteca de $200,000.',
        },
        counterLabel: {
            en: 'lost in interest every day by the average American household',
            es: 'perdidos en intereses diariamente por el hogar promedio',
        },
    },
    solution: {
        label: { en: 'THE SOLUTION', es: 'LA SOLUCIÓN' },
        title: {
            en: 'Turn The Banks\' Math Against Them',
            es: 'Usa las matemáticas de los bancos en su contra',
        },
        subtitle: {
            en: 'KoreX uses Velocity Banking — the same compound interest strategy banks use to profit from you, but reversed in your favor.',
            es: 'KoreX usa Velocity Banking — la misma estrategia de interés compuesto que los bancos usan para lucrar contigo, pero invertida a tu favor.',
        },
        features: [
            {
                icon: '⚔️',
                bg: 'rgba(139, 92, 246, 0.15)',
                title: { en: 'Attack Engine', es: 'Motor de Ataque' },
                desc: {
                    en: 'AI identifies which debt to attack first for maximum interest savings. Each "attack" can save you $200-$2,000.',
                    es: 'La IA identifica qué deuda atacar primero para máximo ahorro en intereses. Cada "ataque" puede ahorrarte $200-$2,000.',
                },
            },
            {
                icon: '🛡️',
                bg: 'rgba(52, 211, 153, 0.15)',
                title: { en: 'Peace Shield', es: 'Escudo de Paz' },
                desc: {
                    en: 'Build an emergency buffer of 2-3 months expenses before attacking debt. Financial peace of mind.',
                    es: 'Construye un colchón de emergencia de 2-3 meses antes de atacar deuda. Tranquilidad financiera real.',
                },
            },
            {
                icon: '📊',
                bg: 'rgba(245, 158, 11, 0.15)',
                title: { en: 'Cashflow GPS', es: 'GPS de Cashflow' },
                desc: {
                    en: '90-day projections show exactly when each debt dies. You\'ll see your freedom date on day one.',
                    es: 'Proyecciones a 90 días muestran exactamente cuándo muere cada deuda. Verás tu fecha de libertad desde el día uno.',
                },
            },
            {
                icon: '🎖️',
                bg: 'rgba(251, 113, 133, 0.15)',
                title: { en: 'Hero Rank System', es: 'Sistema de Rango' },
                desc: {
                    en: 'From Recruit to Sovereign — earn ranks as you eliminate debts. Your identity transforms with every victory.',
                    es: 'De Recluta a Soberano — gana rangos al eliminar deudas. Tu identidad se transforma con cada victoria.',
                },
            },
        ],
    },
    compare: {
        label: { en: 'THE DIFFERENCE', es: 'LA DIFERENCIA' },
        title: {
            en: 'Your Money, Two Futures',
            es: 'Tu Dinero, Dos Futuros',
        },
        without: {
            heading: { en: 'Without KoreX', es: 'Sin KoreX' },
            items: [
                { en: '30 years of minimum payments', es: '30 años de pagos mínimos' },
                { en: '$284,000 in interest to banks', es: '$284,000 en intereses para el banco' },
                { en: 'No emergency buffer', es: 'Sin colchón de emergencia' },
                { en: 'Stress, guessing, hoping', es: 'Estrés, adivinanzas, esperanza' },
            ],
        },
        with: {
            heading: { en: 'With KoreX', es: 'Con KoreX' },
            items: [
                { en: '7-12 years to total freedom', es: '7-12 años para libertad total' },
                { en: 'Save $45,000+ in interest', es: 'Ahorra $45,000+ en intereses' },
                { en: 'Peace Shield emergency fund', es: 'Escudo de Paz como fondo de emergencia' },
                { en: 'AI strategy, clear roadmap', es: 'Estrategia IA, hoja de ruta clara' },
            ],
        },
    },
    proof: {
        label: { en: 'TRUSTED BY', es: 'CONFÍAN EN NOSOTROS' },
        stats: [
            { value: '3.2x', label: { en: 'Faster Debt Freedom', es: 'Más Rápido que Pagos Mínimos' } },
            { value: '$45K', label: { en: 'Avg Interest Saved', es: 'Ahorro Promedio en Intereses' } },
            { value: '4.9★', label: { en: 'User Rating', es: 'Calificación de Usuarios' } },
            { value: '24/7', label: { en: 'AI Monitoring', es: 'Monitoreo IA' } },
        ],
    },
    pricing: {
        label: { en: 'PRICING', es: 'PRECIOS' },
        title: { en: 'Less Than A Coffee A Day', es: 'Menos Que Un Café Al Día' },
        subtitle: {
            en: 'Your daily interest loss is 10x more than any plan below.',
            es: 'Tu pérdida diaria en intereses es 10x más que cualquier plan.',
        },
        plans: [
            {
                name: 'Starter',
                price: '$0',
                period: { en: '/forever', es: '/siempre' },
                popular: false,
                cta: { en: 'Start Free', es: 'Empieza Gratis' },
                features: [
                    { en: '3 accounts', es: '3 cuentas' },
                    { en: 'Basic dashboard', es: 'Dashboard básico' },
                    { en: 'Monthly PDF report', es: 'Reporte PDF mensual' },
                ],
            },
            {
                name: 'Estratega',
                price: '$8',
                period: { en: '/month', es: '/mes' },
                popular: true,
                badge: { en: 'MOST POPULAR', es: 'MÁS POPULAR' },
                cta: { en: 'Stop Losing Money', es: 'Deja de Perder Dinero' },
                features: [
                    { en: '10 accounts', es: '10 cuentas' },
                    { en: 'Velocity Attack Engine', es: 'Motor de Ataque Velocity' },
                    { en: 'Peace Shield', es: 'Escudo de Paz' },
                    { en: 'Cashflow GPS', es: 'GPS de Cashflow' },
                    { en: 'Priority support', es: 'Soporte prioritario' },
                ],
            },
            {
                name: 'Comandante',
                price: '$29',
                period: { en: '/month', es: '/mes' },
                popular: false,
                cta: { en: 'Take Full Control', es: 'Toma Control Total' },
                features: [
                    { en: 'Unlimited accounts', es: 'Cuentas ilimitadas' },
                    { en: 'Everything in Estratega', es: 'Todo en Estratega' },
                    { en: 'Bank sync (Plaid)', es: 'Sincronización bancaria' },
                    { en: 'Advanced analytics', es: 'Analytics avanzado' },
                    { en: 'Custom strategies', es: 'Estrategias personalizadas' },
                ],
            },
        ],
    },
    final: {
        title: {
            en: ['Every day you wait,', 'banks win.'],
            es: ['Cada día que esperas,', 'ganan los bancos.'],
        },
        cta: { en: 'Start Your Freedom', es: 'Inicia Tu Libertad' },
        sub: {
            en: 'Free forever. No credit card required.',
            es: 'Gratis para siempre. Sin tarjeta de crédito.',
        },
    },
    nav: {
        features: { en: 'Features', es: 'Funciones' },
        pricing: { en: 'Pricing', es: 'Precios' },
        login: { en: 'Login', es: 'Iniciar Sesión' },
    },
    footer: {
        terms: { en: 'Terms of Service', es: 'Términos de Servicio' },
        privacy: { en: 'Privacy Policy', es: 'Política de Privacidad' },
        copy: '© 2026 KoreX Financial Systems. All rights reserved.',
    },
};

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */
export default function LandingPage() {
    const { language } = useLanguage();
    const navigate = useNavigate();
    const L = language === 'es' ? 'es' : 'en';

    // ── Refs for GSAP ──
    const containerRef = useRef<HTMLDivElement>(null);
    const heroRef = useRef<HTMLDivElement>(null);
    const problemRef = useRef<HTMLDivElement>(null);
    const solutionRef = useRef<HTMLDivElement>(null);
    const compareRef = useRef<HTMLDivElement>(null);
    const proofRef = useRef<HTMLDivElement>(null);
    const pricingRef = useRef<HTMLDivElement>(null);
    const finalRef = useRef<HTMLDivElement>(null);

    // ── State ──
    const [navScrolled, setNavScrolled] = useState(false);
    const [interestCount, setInterestCount] = useState(0);

    // ── Navbar scroll detection ──
    useEffect(() => {
        const handleScroll = () => setNavScrolled(window.scrollY > 80);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // ── GSAP Cinematic Animations ──
    useEffect(() => {
        const ctx = gsap.context(() => {
            // ──── Hero cinematic entrance ────
            const heroTl = gsap.timeline({ delay: 0.2 });

            heroTl
                .from('.lp-hero-logo', {
                    scale: 1.3,
                    opacity: 0,
                    duration: 1.8,
                    ease: 'power4.out',
                })
                .from('.lp-hero-tagline', {
                    y: 30,
                    opacity: 0,
                    duration: 1,
                    ease: 'power3.out',
                }, '-=0.8')
                .from('.lp-hero-buttons', {
                    y: 20,
                    opacity: 0,
                    duration: 0.8,
                    ease: 'power3.out',
                }, '-=0.5')
                .from('.lp-scroll-hint', {
                    opacity: 0,
                    duration: 1,
                    ease: 'power2.out',
                }, '-=0.3');

            // Hero mockup — parallax scroll reveal
            gsap.from('.lp-hero-mockup', {
                scrollTrigger: {
                    trigger: '.lp-hero-mockup',
                    start: 'top 90%',
                    end: 'top 40%',
                    scrub: 1,
                },
                y: 100,
                opacity: 0,
                scale: 0.9,
            });

            // Hero background parallax on scroll
            gsap.to('.lp-hero-bg img', {
                scrollTrigger: {
                    trigger: heroRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                },
                y: '20%',
                scale: 1.1,
            });

            // ──── Problem section ────
            ScrollTrigger.create({
                trigger: problemRef.current,
                start: 'top 70%',
                onEnter: () => {
                    // Average US household: ~$36/day in interest
                    const dailyRate = 36.44;
                    const perSecond = dailyRate / 86400;
                    let count = 0;
                    let lastUpdate = 0;
                    const tick = (now: number) => {
                        count += perSecond / 60; // ~60fps increments
                        // Only push state update every 500ms to avoid flicker
                        if (now - lastUpdate > 500) {
                            lastUpdate = now;
                            setInterestCount(count);
                        }
                        (window as any).__lp_raf = requestAnimationFrame(tick);
                    };
                    (window as any).__lp_raf = requestAnimationFrame(tick);
                },
            });

            // Problem title dramatic reveal
            gsap.from('.lp-problem .lp-section-title', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 75%',
                },
                y: 80,
                opacity: 0,
                duration: 1.2,
                ease: 'power3.out',
            });

            gsap.from('.lp-problem .lp-section-subtitle', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 70%',
                },
                y: 40,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.2,
            });

            // Counter scale-pop
            gsap.from('.lp-counter', {
                scrollTrigger: {
                    trigger: problemRef.current,
                    start: 'top 60%',
                },
                scale: 0.5,
                opacity: 0,
                duration: 0.8,
                ease: 'back.out(2)',
            });

            // ──── Solution — staggered cards ────
            gsap.from('.lp-feature-card', {
                scrollTrigger: {
                    trigger: solutionRef.current,
                    start: 'top 70%',
                },
                y: 80,
                opacity: 0,
                stagger: 0.12,
                duration: 0.8,
                ease: 'power3.out',
            });

            gsap.from('.lp-solution-preview', {
                scrollTrigger: {
                    trigger: solutionRef.current,
                    start: 'top 65%',
                },
                x: 100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.3,
            });

            // ──── Comparison — dramatic split ────
            gsap.from('.lp-compare-banner', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 75%',
                    end: 'top 30%',
                    scrub: 1,
                },
                scale: 0.85,
                opacity: 0,
            });

            gsap.from('.lp-compare-without', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 60%',
                },
                x: -100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
            });
            gsap.from('.lp-compare-with', {
                scrollTrigger: {
                    trigger: compareRef.current,
                    start: 'top 60%',
                },
                x: 100,
                opacity: 0,
                duration: 1,
                ease: 'power3.out',
                delay: 0.15,
            });

            // ──── Social proof — stats scale pop ────
            gsap.from('.lp-stat', {
                scrollTrigger: {
                    trigger: proofRef.current,
                    start: 'top 75%',
                },
                scale: 0,
                opacity: 0,
                stagger: 0.1,
                duration: 0.7,
                ease: 'back.out(2)',
            });

            // ──── Pricing — cinematic rise ────
            gsap.from('.lp-plan-card', {
                scrollTrigger: {
                    trigger: pricingRef.current,
                    start: 'top 70%',
                },
                y: 100,
                opacity: 0,
                stagger: 0.15,
                duration: 0.9,
                ease: 'power3.out',
            });

            // ──── Final CTA — dramatic scale entrance ────
            gsap.from('.lp-final-headline', {
                scrollTrigger: {
                    trigger: finalRef.current,
                    start: 'top 70%',
                },
                scale: 0.8,
                y: 60,
                opacity: 0,
                duration: 1.2,
                ease: 'power3.out',
            });

            // Section labels — slide in
            gsap.utils.toArray<HTMLElement>('.lp-section-label').forEach((label) => {
                gsap.from(label, {
                    scrollTrigger: {
                        trigger: label,
                        start: 'top 85%',
                    },
                    y: 20,
                    opacity: 0,
                    duration: 0.6,
                    ease: 'power2.out',
                });
            });

        }, containerRef);

        return () => {
            ctx.revert();
            if ((window as any).__lp_raf) {
                cancelAnimationFrame((window as any).__lp_raf);
            }
        };
    }, []);

    // ── Navigation helpers ──
    const scrollTo = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
        ref.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    const goAuth = useCallback(() => navigate('/login'), [navigate]);

    // ── Particles — gold-tinted ──
    const particles = Array.from({ length: 20 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        size: `${1.5 + Math.random() * 2.5}px`,
        delay: `${Math.random() * 15}s`,
        duration: `${12 + Math.random() * 18}s`,
        opacity: 0.08 + Math.random() * 0.2,
    }));

    return (
        <div className="landing-page" ref={containerRef}>
            {/* ─── Cinematic Overlays ──────────────────────── */}
            <div className="lp-film-grain" />
            <div className="lp-letterbox lp-letterbox--top" />
            <div className="lp-letterbox lp-letterbox--bottom" />

            {/* ─── Navbar ──────────────────────────────────── */}
            <nav className={`lp-navbar ${navScrolled ? 'scrolled' : ''}`}>
                <img src="/korex-logotipo.png" alt="KoreX" className="lp-nav-logo-img" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />
                <div className="lp-nav-links">
                    <button className="lp-nav-link desktop-only" onClick={() => scrollTo(solutionRef)}>
                        {copy.nav.features[L]}
                    </button>
                    <button className="lp-nav-link desktop-only" onClick={() => scrollTo(pricingRef)}>
                        {copy.nav.pricing[L]}
                    </button>
                    <button className="lp-nav-cta" onClick={goAuth}>
                        {copy.hero.cta[L]}
                    </button>
                </div>
            </nav>

            {/* ═══ 1. HERO — Full-Bleed Cinematic ═══════════ */}
            <section className="lp-section lp-hero" ref={heroRef}>
                {/* Full-bleed background image */}
                <div className="lp-hero-bg">
                    <img
                        src="/landing-assets/hero-background.png"
                        alt=""
                        loading="eager"
                    />
                </div>

                {/* Floating particles */}
                <div className="lp-particles">
                    {particles.map((p) => (
                        <div
                            key={p.id}
                            className="lp-particle"
                            style={{
                                left: p.left,
                                width: p.size,
                                height: p.size,
                                animationDelay: p.delay,
                                animationDuration: p.duration,
                                opacity: p.opacity,
                            }}
                        />
                    ))}
                </div>

                {/* Hero split: Mockup LEFT, Branding RIGHT */}
                <div className="lp-hero-split">
                    {/* Left: Dashboard mockup */}
                    <div className="lp-hero-split-media">
                        <img
                            src="/landing-assets/dashboard-desktop.png"
                            alt="KoreX Dashboard"
                            className="lp-hero-mockup-img"
                            loading="eager"
                        />
                    </div>

                    {/* Right: Logo + tagline + CTA */}
                    <div className="lp-hero-split-content">
                        <img
                            src="/korex-imagotipo.png"
                            alt="KoreX"
                            className="lp-hero-logo-img"
                        />
                        <p className="lp-hero-tagline">
                            {copy.hero.tagline[L]}
                        </p>
                        <div className="lp-hero-buttons">
                            <button className="lp-hero-cta" onClick={goAuth}>
                                {copy.hero.cta[L]} →
                            </button>
                            <button className="lp-hero-secondary" onClick={() => scrollTo(solutionRef)}>
                                ▶ {copy.hero.secondary[L]}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Scroll hint */}
                <div className="lp-scroll-hint">
                    <span>Scroll</span>
                    <div className="lp-scroll-line" />
                </div>
            </section>

            {/* ═══ 2. PROBLEM — Text LEFT, Image RIGHT ═════ */}
            <section className="lp-section lp-problem" ref={problemRef}>
                <span className="lp-section-label">{copy.problem.label[L]}</span>

                <div className="lp-split lp-split--text-left">
                    {/* Left: Text + counter */}
                    <div className="lp-split-text">
                        <h2 className="lp-section-title" style={{ textAlign: 'left' }}>{copy.problem.title[L]}</h2>
                        <p className="lp-section-subtitle" style={{ textAlign: 'left' }}>{copy.problem.subtitle[L]}</p>
                        <div className="lp-counter">
                            ${interestCount.toFixed(2)}
                        </div>
                        <p className="lp-counter-label">
                            {copy.problem.counterLabel[L]}
                        </p>
                    </div>
                    {/* Right: Image */}
                    <div className="lp-split-media">
                        <img
                            src="/landing-assets/hero-visual-debt.png"
                            alt="Debt visualization"
                            className="lp-split-img"
                            loading="lazy"
                        />
                    </div>
                </div>
            </section>

            {/* ═══ 3. SOLUTION — Image LEFT, Cards RIGHT ════ */}
            <section className="lp-section lp-solution" ref={solutionRef}>
                <span className="lp-section-label">{copy.solution.label[L]}</span>
                <h2 className="lp-section-title">{copy.solution.title[L]}</h2>
                <p className="lp-section-subtitle">{copy.solution.subtitle[L]}</p>

                <div className="lp-split lp-split--img-left">
                    {/* Left: Mobile 3D App Preview */}
                    <div className="lp-split-media lp-solution-preview">
                        <img
                            src="/landing-assets/app-mobile-3d.png"
                            alt="KoreX Mobile App"
                            className="lp-split-img lp-solution-preview-img"
                            loading="lazy"
                        />
                    </div>
                    {/* Right: Feature cards */}
                    <div className="lp-split-text">
                        <div className="lp-features-grid">
                            {copy.solution.features.map((f, i) => (
                                <div className="lp-feature-card" key={i}>
                                    <div className="lp-feature-icon" style={{ background: f.bg }}>
                                        {f.icon}
                                    </div>
                                    <h3 className="lp-feature-title">{f.title[L]}</h3>
                                    <p className="lp-feature-desc">{f.desc[L]}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══ 4. COMPARISON — Image RIGHT, Text LEFT ═══ */}
            <section className="lp-section lp-comparison" ref={compareRef}>
                <span className="lp-section-label">{copy.compare.label[L]}</span>
                <h2 className="lp-section-title">{copy.compare.title[L]}</h2>

                <div className="lp-split lp-split--text-left">
                    {/* Left: Comparison columns */}
                    <div className="lp-split-text">
                        <div className="lp-compare-grid">
                            <div className="lp-compare-column lp-compare-without">
                                <h3 className="lp-compare-col-heading" style={{ color: '#fb7185' }}>
                                    ✗ {copy.compare.without.heading[L]}
                                </h3>
                                {copy.compare.without.items.map((item, i) => (
                                    <div className="lp-compare-item" key={i}>
                                        <span style={{ color: '#fb7185', flexShrink: 0 }}>✗</span>
                                        <span style={{ color: '#94a3b8' }}>{item[L]}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="lp-compare-divider">→</div>

                            <div className="lp-compare-column lp-compare-with">
                                <h3 className="lp-compare-col-heading" style={{ color: '#34d399' }}>
                                    ✓ {copy.compare.with.heading[L]}
                                </h3>
                                {copy.compare.with.items.map((item, i) => (
                                    <div className="lp-compare-item" key={i}>
                                        <span style={{ color: '#34d399', flexShrink: 0 }}>✓</span>
                                        <span>{item[L]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Right: Images stacked */}
                    <div className="lp-split-media">
                        <img
                            src="/landing-assets/bank-vs-korex.png"
                            alt="The Bank's Plan vs KoreX Plan"
                            className="lp-split-img lp-compare-banner-img"
                            loading="lazy"
                        />
                        <img
                            src="/landing-assets/chaos-vs-order.png"
                            alt="Chaos vs Order"
                            className="lp-split-img"
                            style={{ marginTop: '1.5rem', opacity: 0.7 }}
                            loading="lazy"
                        />
                    </div>
                </div>
            </section>

            {/* ═══ 5. SOCIAL PROOF ══════════════════════════ */}
            <section className="lp-section lp-proof" ref={proofRef}>
                <span className="lp-section-label">{copy.proof.label[L]}</span>
                <div className="lp-stats-row">
                    {copy.proof.stats.map((s, i) => (
                        <div className="lp-stat" key={i}>
                            <div className="lp-stat-number">{s.value}</div>
                            <div className="lp-stat-label">{s.label[L]}</div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ 6. PRICING ═══════════════════════════════ */}
            <section className="lp-section lp-pricing" ref={pricingRef}>
                <span className="lp-section-label">{copy.pricing.label[L]}</span>
                <h2 className="lp-section-title">{copy.pricing.title[L]}</h2>
                <p className="lp-section-subtitle">{copy.pricing.subtitle[L]}</p>

                <div className="lp-pricing-grid">
                    {copy.pricing.plans.map((plan, i) => (
                        <div className={`lp-plan-card ${plan.popular ? 'popular' : ''}`} key={i}>
                            {plan.popular && plan.badge && (
                                <div className="lp-plan-badge">{plan.badge[L]}</div>
                            )}
                            <div className="lp-plan-name">{plan.name}</div>
                            <div style={{ margin: '1rem 0' }}>
                                <span className="lp-plan-price">{plan.price}</span>
                                <span className="lp-plan-period">{plan.period[L]}</span>
                            </div>
                            <ul className="lp-plan-features">
                                {plan.features.map((feat, j) => (
                                    <li key={j}>
                                        <span style={{ color: '#fbbf24' }}>✓</span>
                                        {feat[L]}
                                    </li>
                                ))}
                            </ul>
                            <button
                                className={`lp-plan-cta ${plan.popular ? 'primary' : ''}`}
                                onClick={goAuth}
                            >
                                {plan.cta[L]}
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* ═══ 7. FINAL CTA ═════════════════════════════ */}
            <section className="lp-section lp-final" ref={finalRef}>
                {/* Background image layer */}
                <div className="lp-final-bg">
                    <img
                        src="/landing-assets/freedom-celebration.png"
                        alt=""
                        loading="lazy"
                    />
                </div>

                <h2 className="lp-final-headline">
                    {copy.final.title[L][0]}
                    <br />
                    <span className="lp-gradient-text">{copy.final.title[L][1]}</span>
                </h2>
                <div style={{
                    marginTop: '3rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1.25rem',
                }}>
                    <button className="lp-hero-cta lp-pulse-glow" onClick={goAuth}>
                        {copy.final.cta[L]} →
                    </button>
                    <p className="lp-final-sub">
                        {copy.final.sub[L]}
                    </p>
                </div>
            </section>

            {/* ─── Footer ──────────────────────────────────── */}
            <footer className="lp-footer">
                <div className="lp-footer-links">
                    <a className="lp-footer-link" href="/terms">{copy.footer.terms[L]}</a>
                    <a className="lp-footer-link" href="/privacy">{copy.footer.privacy[L]}</a>
                </div>
                <p className="lp-footer-copy">{copy.footer.copy}</p>
            </footer>
        </div>
    );
}
