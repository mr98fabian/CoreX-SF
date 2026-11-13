/** Layout shared by Privacy Policy and Terms of Service. Every visible word comes from `copy`. */
import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { LegalCopy } from './privacyCopy';

export function LegalDocument({ copy, otherDocPath }: { copy: LegalCopy; otherDocPath: string }) {
    usePageTitle(copy.pageTitle);
    const year = new Date().getFullYear();
    return (
        <div className="kx-scope min-h-screen text-kx-ink2">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-kx-surface border-b border-kx-line ">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/login" className="flex items-center gap-2 text-sm text-kx-ink3 hover:text-kx-ink transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        {copy.back}
                    </Link>
                    <div className="flex items-center gap-2">
                        <img src="/korex-isotipo.svg" alt="KoreX" className="kx-logo w-6 h-6" />
                        <span className="text-sm font-semibold text-kx-ink ">KoreX</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-kx-ink mb-2">{copy.pageTitle}</h1>
                    <p className="text-sm text-kx-ink3">{copy.effective} {copy.effectiveDate}</p>
                </div>

                {copy.intro && (
                    <div className="mb-10 p-5 rounded-xl bg-[color-mix(in_srgb,var(--kx-paid)_5%,transparent)] border border-[color-mix(in_srgb,var(--kx-paid)_10%,transparent)]">
                        <p className="text-sm text-kx-paid leading-relaxed">{copy.intro}</p>
                    </div>
                )}

                {/* Quick Nav */}
                <div className="mb-10 p-4 rounded-xl bg-kx-raised dark:bg-[#0f0f0f]/50 border border-kx-line ">
                    <p className="text-xs uppercase tracking-wider text-kx-ink3 mb-3 font-medium">{copy.toc}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {copy.sections.map((s) => (
                            <a key={s.id} href={`#${s.id}`} className="text-sm text-kx-amber hover:text-kx-amber transition-colors py-1">
                                {s.title}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Sections */}
                <div className="space-y-10">
                    {copy.sections.map((s) => (
                        <section key={s.id} id={s.id} className="scroll-mt-20">
                            <h2 className="text-lg font-semibold text-kx-ink mb-3">{s.title}</h2>
                            <div className="text-sm leading-relaxed whitespace-pre-line text-kx-ink2">
                                {s.content.split('**').map((part, i) =>
                                    i % 2 === 1 ? (
                                        <strong key={i} className="text-kx-ink ">{part}</strong>
                                    ) : (
                                        <span key={i}>{part}</span>
                                    )
                                )}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-kx-line text-center">
                    <p className="text-xs text-kx-ink2">{copy.footer(year)}</p>
                    <div className="flex items-center justify-center gap-4 mt-3">
                        <Link to={otherDocPath} className="text-xs text-kx-amber hover:text-kx-amber transition-colors">{copy.otherDoc}</Link>
                        <span className="text-kx-ink">•</span>
                        <Link to="/login" className="text-xs text-kx-amber hover:text-kx-amber transition-colors">{copy.back}</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
