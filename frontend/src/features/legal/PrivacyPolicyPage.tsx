import { Link } from 'react-router-dom';
import { usePageTitle } from '@/hooks/usePageTitle';

const EFFECTIVE_DATE = 'February 14, 2026';

const sections = [
    {
        id: 'info-collect',
        title: '1. Information We Collect',
        content: `We collect the following types of information when you use KoreX System:\n\n**Account Information**\n• Name and email address (provided during registration or via Google OAuth).\n• Authentication tokens managed by Supabase Auth.\n\n**Financial Data**\n• Account balances, interest rates, minimum payments, and closing dates that you manually enter.\n• Income and expense transactions you log.\n• Cashflow projections generated from your data.\n\n**Usage Data**\n• Pages visited, features used, and session duration.\n• Browser type and device information (collected automatically via standard web protocols).\n\nWe do NOT collect:\n• Bank login credentials.\n• Social Security numbers.\n• Credit card numbers (unless you voluntarily enter them as account data).`,
    },
    {
        id: 'how-we-use',
        title: '2. How We Use Your Data',
        content: `Your data is used exclusively to:\n• Perform financial calculations and generate projections.\n• Display your personalized dashboard and strategy recommendations.\n• Authenticate your identity and maintain your session.\n• Improve the Service's functionality and user experience.\n\nWe do NOT use your data for:\n• Advertising or marketing to third parties.\n• Selling to data brokers.\n• Training AI models on your personal financial information.\n• Any purpose unrelated to providing the Service.`,
    },
    {
        id: 'storage',
        title: '3. Data Storage & Security',
        content: `Your data is stored securely using:\n• **Supabase** (PostgreSQL) — hosted on AWS infrastructure with encryption at rest and in transit.\n• **Row-Level Security (RLS)** — database policies ensure users can only access their own data.\n• **JWT Authentication** — session tokens are cryptographically signed and validated on every request.\n• **HTTPS** — all data transmitted between your browser and our servers is encrypted via TLS.\n\nWhile we implement industry-standard security measures, no system is 100% secure. We cannot guarantee absolute security of your data.`,
    },
    {
        id: 'sharing',
        title: '4. Third-Party Data Sharing',
        content: `We do NOT sell, rent, or trade your personal information.\n\nYour data may be shared with the following third-party services solely for the purpose of providing the Service:\n\n• **Supabase** — database hosting and authentication infrastructure.\n• **Google** — OAuth authentication (only your public profile info: name, email, avatar).\n• **Vercel** — application hosting (no direct access to user data).\n\nWe may also disclose information if required by law, court order, or government regulation.`,
    },
    {
        id: 'cookies',
        title: '5. Cookies & Local Storage',
        content: `KoreX System uses minimal cookies and browser storage:\n\n• **Authentication cookies** — to maintain your login session (essential, cannot be disabled).\n• **Local storage** — to store non-sensitive UI preferences.\n\nWe do NOT use:\n• Tracking cookies.\n• Analytics cookies from third parties.\n• Advertising pixels or beacons.`,
    },
    {
        id: 'retention',
        title: '6. Data Retention',
        content: `We retain your data for as long as your account is active. Upon account deletion:\n• All personal data (name, email) is permanently deleted.\n• All financial data (accounts, transactions, projections) is permanently deleted.\n• Authentication records are removed from Supabase Auth.\n\nDeletion is irreversible. We recommend exporting your data before requesting account deletion.`,
    },
    {
        id: 'rights',
        title: '7. Your Rights',
        content: `You have the right to:\n• **Access** — request a copy of all data we hold about you.\n• **Rectification** — correct any inaccurate information.\n• **Deletion** — request permanent deletion of your account and all associated data.\n• **Portability** — export your financial data in a standard format.\n• **Restriction** — request that we limit processing of your data.\n\nTo exercise any of these rights, contact us through the Service's support channels. We will respond within 30 days.`,
    },
    {
        id: 'security-measures',
        title: '8. Security Measures',
        content: `We implement the following security measures:\n• Encrypted database connections (SSL/TLS).\n• Row-Level Security policies on all user data tables.\n• Secure password hashing via Supabase Auth (bcrypt).\n• JWT token-based authentication with expiration.\n• CORS restrictions to prevent unauthorized API access.\n• Regular security reviews and dependency updates.`,
    },
    {
        id: 'children',
        title: '9. Children\'s Privacy',
        content: `KoreX System is not intended for use by individuals under the age of 18. We do not knowingly collect personal information from minors. If we become aware that a user is under 18, we will take steps to delete their account and associated data immediately.`,
    },
    {
        id: 'international',
        title: '10. International Users',
        content: `KoreX System is hosted in the United States. If you access the Service from outside the US, your data may be transferred to and processed in the United States. By using the Service, you consent to this transfer.\n\nFor users in the European Economic Area (EEA), we comply with applicable data protection regulations including GDPR where applicable.`,
    },
    {
        id: 'changes',
        title: '11. Changes to This Policy',
        content: `We may update this Privacy Policy from time to time. Material changes will be communicated via:\n• A notice within the Service.\n• An email to the address associated with your account.\n\nYour continued use of the Service after changes are posted constitutes acceptance of the updated Privacy Policy.`,
    },
    {
        id: 'contact',
        title: '12. Contact',
        content: `If you have questions about this Privacy Policy or wish to exercise your data rights, please contact us through the Service's support channels or at the email provided in your account settings.`,
    },
];

export default function PrivacyPolicyPage() {
    usePageTitle('Privacy Policy');
    return (
        <div className="min-h-screen bg-slate-950 text-slate-300">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <Link to="/login" className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        Back to Login
                    </Link>
                    <div className="flex items-center gap-2">
                        <img src="/korex-icon.png" alt="KoreX" className="w-6 h-6" />
                        <span className="text-sm font-semibold text-white">KoreX</span>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-12">
                <div className="mb-10">
                    <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
                    <p className="text-sm text-slate-500">Effective Date: {EFFECTIVE_DATE}</p>
                </div>

                {/* Intro */}
                <div className="mb-10 p-5 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                    <p className="text-sm text-emerald-400/80 leading-relaxed">
                        Your privacy is important to us. This Privacy Policy explains what information KoreX System collects, how we use it, and your rights regarding your data. We are committed to protecting your financial information.
                    </p>
                </div>

                {/* Quick Nav */}
                <div className="mb-10 p-4 rounded-xl bg-slate-900/50 border border-white/5">
                    <p className="text-xs uppercase tracking-wider text-slate-500 mb-3 font-medium">Table of Contents</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                        {sections.map((s) => (
                            <a
                                key={s.id}
                                href={`#${s.id}`}
                                className="text-sm text-amber-400/70 hover:text-amber-400 transition-colors py-1"
                            >
                                {s.title}
                            </a>
                        ))}
                    </div>
                </div>

                {/* Sections */}
                <div className="space-y-10">
                    {sections.map((s) => (
                        <section key={s.id} id={s.id} className="scroll-mt-20">
                            <h2 className="text-lg font-semibold text-white mb-3">{s.title}</h2>
                            <div className="text-sm leading-relaxed whitespace-pre-line text-slate-400">
                                {s.content.split('**').map((part, i) =>
                                    i % 2 === 1 ? (
                                        <strong key={i} className="text-slate-200">{part}</strong>
                                    ) : (
                                        <span key={i}>{part}</span>
                                    )
                                )}
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer */}
                <div className="mt-16 pt-8 border-t border-white/5 text-center">
                    <p className="text-xs text-slate-600">
                        KoreX Financial System — &copy; {new Date().getFullYear()} All rights reserved.
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-3">
                        <Link to="/terms" className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors">Terms of Service</Link>
                        <span className="text-slate-700">•</span>
                        <Link to="/login" className="text-xs text-amber-400/60 hover:text-amber-400 transition-colors">Back to Login</Link>
                    </div>
                </div>
            </div>
        </div>
    );
}
