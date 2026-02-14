import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

// ──────────────────────────────────────────────
// Password Requirements
// ──────────────────────────────────────────────

interface Requirement {
    label: string;
    met: boolean;
}

function getPasswordRequirements(password: string): Requirement[] {
    return [
        { label: 'At least 6 characters', met: password.length >= 6 },
        { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
        { label: 'One lowercase letter', met: /[a-z]/.test(password) },
        { label: 'One number', met: /\d/.test(password) },
        { label: 'One special character (!@#$...)', met: /[^A-Za-z0-9]/.test(password) },
    ];
}

type StrengthLevel = 'empty' | 'weak' | 'fair' | 'good' | 'strong';

interface StrengthResult {
    level: StrengthLevel;
    score: number;
    label: string;
    color: string;
}

function getPasswordStrength(password: string): StrengthResult {
    if (!password) return { level: 'empty', score: 0, label: '', color: '' };
    const reqs = getPasswordRequirements(password);
    const metCount = reqs.filter(r => r.met).length;
    const clamped = Math.max(1, Math.min(4, Math.ceil((metCount / reqs.length) * 4)));

    const map: Record<number, Omit<StrengthResult, 'score'>> = {
        1: { level: 'weak', label: 'Weak', color: '#ef4444' },
        2: { level: 'fair', label: 'Fair', color: '#f97316' },
        3: { level: 'good', label: 'Good', color: '#eab308' },
        4: { level: 'strong', label: 'Strong', color: '#22c55e' },
    };
    return { ...map[clamped], score: clamped };
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

interface ValidationErrors {
    email?: string;
    confirmEmail?: string;
    password?: string;
    confirmPassword?: string;
    fullName?: string;
    terms?: string;
}

function validateForm(
    mode: 'signin' | 'signup',
    fields: {
        email: string; confirmEmail: string;
        password: string; confirmPassword: string;
        fullName: string; acceptedTerms: boolean;
    }
): ValidationErrors {
    const errors: ValidationErrors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!fields.email.trim()) {
        errors.email = 'Email is required';
    } else if (!emailRegex.test(fields.email)) {
        errors.email = 'Invalid email format';
    }

    if (!fields.password) {
        errors.password = 'Password is required';
    } else if (fields.password.length < 6) {
        errors.password = 'Minimum 6 characters';
    }

    if (mode === 'signup') {
        if (!fields.fullName.trim()) {
            errors.fullName = 'Full name is required';
        } else if (fields.fullName.trim().length < 2) {
            errors.fullName = 'At least 2 characters';
        }

        if (!fields.confirmEmail.trim()) {
            errors.confirmEmail = 'Please confirm your email';
        } else if (fields.confirmEmail !== fields.email) {
            errors.confirmEmail = 'Emails do not match';
        }

        if (!fields.confirmPassword) {
            errors.confirmPassword = 'Please confirm your password';
        } else if (fields.confirmPassword !== fields.password) {
            errors.confirmPassword = 'Passwords do not match';
        }

        if (!fields.acceptedTerms) {
            errors.terms = 'You must accept the Terms & Conditions';
        }
    }

    return errors;
}

// ──────────────────────────────────────────────
// Input Component
// ──────────────────────────────────────────────

function FormInput({
    id, label, type = 'text', value, onChange, placeholder, error, autoComplete,
    children,
}: {
    id: string; label: string; type?: string;
    value: string; onChange: (v: string) => void;
    placeholder?: string; error?: string; autoComplete?: string;
    children?: React.ReactNode;
}) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium text-slate-300 mb-1.5">
                {label}
            </label>
            <div className="relative">
                <input
                    id={id}
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    className={`w-full px-4 py-3 bg-slate-800/60 border rounded-xl text-white placeholder:text-slate-500 outline-none transition-all
                        ${error
                            ? 'border-red-500/50 focus:ring-2 focus:ring-red-500/25'
                            : 'border-white/10 focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/15'
                        } ${children ? 'pr-12' : ''}`}
                />
                {children}
            </div>
            {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
        </div>
    );
}

// ──────────────────────────────────────────────
// Login Page
// ──────────────────────────────────────────────

type ViewState = 'signin' | 'signup' | 'forgot' | 'success';

export default function LoginPage() {
    const { user, loading, signInWithGoogle, signInWithPassword, signUp, resetPassword } = useAuth();

    const [view, setView] = useState<ViewState>('signin');
    const [email, setEmail] = useState('');
    const [confirmEmail, setConfirmEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});

    const strength = useMemo(() => getPasswordStrength(password), [password]);
    const requirements = useMemo(() => getPasswordRequirements(password), [password]);

    if (user && !loading) return <Navigate to="/" replace />;

    const clearForm = () => {
        setEmail(''); setConfirmEmail('');
        setPassword(''); setConfirmPassword('');
        setFullName(''); setAcceptedTerms(false);
        setError(''); setSuccessMessage('');
        setFieldErrors({});
    };

    const switchView = (v: ViewState) => { clearForm(); setView(v); };

    const clearFieldError = (field: keyof ValidationErrors) =>
        setFieldErrors(prev => ({ ...prev, [field]: undefined }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        // Forgot password flow
        if (view === 'forgot') {
            if (!email.trim()) {
                setFieldErrors({ email: 'Email is required' });
                return;
            }
            setIsSubmitting(true);
            try {
                await resetPassword(email);
                setSuccessMessage('Password reset email sent! Check your inbox.');
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to send reset email');
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        // Validate
        const mode = view === 'signin' ? 'signin' : 'signup';
        const errors = validateForm(mode, {
            email, confirmEmail, password, confirmPassword, fullName, acceptedTerms,
        });
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            return;
        }
        setFieldErrors({});
        setIsSubmitting(true);

        try {
            if (view === 'signin') {
                await signInWithPassword(email, password);
            } else {
                const { confirmEmail: needsConfirmation } = await signUp(email, password, fullName);
                if (needsConfirmation) {
                    setView('success');
                }
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'An unexpected error occurred';
            if (message.includes('Invalid login credentials')) {
                setError('Invalid email or password');
            } else if (message.includes('already registered')) {
                setError('This email is already registered. Try signing in.');
            } else {
                setError(message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsGoogleLoading(true);
        setError('');
        try {
            await signInWithGoogle();
        } catch {
            setError('Google sign-in failed. Please try again.');
            setIsGoogleLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
            </div>
        );
    }

    // ── Animated Success State ──
    if (view === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
                <BackgroundOrbs />
                <Styles />
                <div className="relative z-10 w-full max-w-md text-center animate-slide-in">
                    <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-10">
                        {/* Animated Checkmark */}
                        <div className="mx-auto w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-6 animate-success-pop">
                            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-check-draw" />
                            </svg>
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Account Created!</h2>
                        <p className="text-slate-400 mb-2">
                            We've sent a verification email to:
                        </p>
                        <p className="text-amber-400 font-mono text-sm mb-6 break-all">{email}</p>
                        <p className="text-slate-500 text-sm mb-8">
                            Click the link in your email to activate your account, then come back to sign in.
                        </p>
                        <button
                            onClick={() => switchView('signin')}
                            className="w-full py-3 rounded-xl font-semibold text-sm
                                bg-gradient-to-r from-amber-500 to-amber-600 text-white
                                hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/25
                                active:scale-[0.98] transition-all duration-300"
                        >
                            Go to Sign In
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ── Eye Toggle Button ──
    const EyeToggle = ({ show, onToggle }: { show: boolean; onToggle: () => void }) => (
        <button
            type="button"
            onClick={onToggle}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
            tabIndex={-1}
        >
            {show ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
            ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
            )}
        </button>
    );

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 relative overflow-hidden px-4">
            <BackgroundOrbs />
            <Styles />

            <div className="relative z-10 w-full max-w-md">
                {/* Logo */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 shadow-lg shadow-amber-500/25 mb-4">
                        <svg viewBox="0 0 24 24" fill="none" className="w-8 h-8 text-white">
                            <path d="M12 2L3 7v10l9 5 9-5V7l-9-5zM12 22V12M3 7l9 5 9-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white">
                        CoreX <span className="text-amber-400">System</span>
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Velocity Banking Intelligence Platform</p>
                </div>

                {/* Card */}
                <div className="bg-slate-900/70 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-8">
                    {/* Tabs */}
                    {view !== 'forgot' && (
                        <div className="flex bg-slate-800/60 rounded-xl p-1 mb-6">
                            {(['signin', 'signup'] as const).map((tab) => (
                                <button
                                    key={tab}
                                    type="button"
                                    onClick={() => switchView(tab)}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 ${view === tab
                                            ? 'bg-amber-500 text-white shadow-md shadow-amber-500/25'
                                            : 'text-slate-400 hover:text-white'
                                        }`}
                                >
                                    {tab === 'signin' ? 'Sign In' : 'Create Account'}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Forgot Header */}
                    {view === 'forgot' && (
                        <div className="text-center mb-6 animate-slide-in">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-500/10 mb-3">
                                <svg className="w-6 h-6 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <h2 className="text-xl font-bold text-white">Reset Password</h2>
                            <p className="text-slate-400 text-sm mt-1">Enter your email and we'll send a reset link</p>
                        </div>
                    )}

                    {/* Messages */}
                    {successMessage && (
                        <div className="mb-4 px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm animate-slide-in">
                            {successMessage}
                        </div>
                    )}
                    {error && (
                        <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm animate-slide-in">
                            {error}
                        </div>
                    )}

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="space-y-4 animate-slide-in" key={view}>
                        {/* Full Name — sign up */}
                        {view === 'signup' && (
                            <FormInput
                                id="fullName" label="Full Name" value={fullName}
                                onChange={(v) => { setFullName(v); clearFieldError('fullName'); }}
                                placeholder="Fabian Murillo" error={fieldErrors.fullName}
                            />
                        )}

                        {/* Email */}
                        <FormInput
                            id="email" label="Email" type="email" value={email}
                            onChange={(v) => { setEmail(v); clearFieldError('email'); }}
                            placeholder="fabian@example.com" error={fieldErrors.email}
                            autoComplete="email"
                        />

                        {/* Confirm Email — sign up */}
                        {view === 'signup' && (
                            <FormInput
                                id="confirmEmail" label="Confirm Email" type="email" value={confirmEmail}
                                onChange={(v) => { setConfirmEmail(v); clearFieldError('confirmEmail'); }}
                                placeholder="fabian@example.com" error={fieldErrors.confirmEmail}
                                autoComplete="off"
                            />
                        )}

                        {/* Password (hidden on forgot) */}
                        {view !== 'forgot' && (
                            <>
                                <FormInput
                                    id="password" label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(v) => { setPassword(v); clearFieldError('password'); }}
                                    placeholder="••••••••" error={fieldErrors.password}
                                    autoComplete={view === 'signup' ? 'new-password' : 'current-password'}
                                >
                                    <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
                                </FormInput>

                                {/* Password Requirements — sign up */}
                                {view === 'signup' && password.length > 0 && (
                                    <div className="animate-slide-in space-y-2">
                                        {/* Strength Bar */}
                                        <div className="flex gap-1.5">
                                            {[1, 2, 3, 4].map((i) => (
                                                <div
                                                    key={i}
                                                    className="h-1.5 flex-1 rounded-full transition-all duration-500"
                                                    style={{
                                                        backgroundColor: i <= strength.score ? strength.color : 'rgb(51 65 85 / 0.6)',
                                                    }}
                                                />
                                            ))}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium" style={{ color: strength.color }}>
                                                {strength.label}
                                            </span>
                                        </div>

                                        {/* Requirements Checklist */}
                                        <div className="grid grid-cols-1 gap-1 pt-1">
                                            {requirements.map((req) => (
                                                <div key={req.label} className="flex items-center gap-2 text-xs">
                                                    {req.met ? (
                                                        <svg className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    ) : (
                                                        <svg className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                            <circle cx="12" cy="12" r="9" />
                                                        </svg>
                                                    )}
                                                    <span className={req.met ? 'text-emerald-400' : 'text-slate-500'}>
                                                        {req.label}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Confirm Password — sign up */}
                                {view === 'signup' && (
                                    <FormInput
                                        id="confirmPassword" label="Confirm Password"
                                        type={showConfirmPassword ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={(v) => { setConfirmPassword(v); clearFieldError('confirmPassword'); }}
                                        placeholder="••••••••" error={fieldErrors.confirmPassword}
                                        autoComplete="new-password"
                                    >
                                        <EyeToggle show={showConfirmPassword} onToggle={() => setShowConfirmPassword(!showConfirmPassword)} />
                                    </FormInput>
                                )}
                            </>
                        )}

                        {/* Forgot link — sign in */}
                        {view === 'signin' && (
                            <div className="text-right">
                                <button type="button" onClick={() => switchView('forgot')}
                                    className="text-sm text-amber-400/80 hover:text-amber-400 transition-colors">
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        {/* Terms — sign up */}
                        {view === 'signup' && (
                            <div className="pt-1">
                                <label className="flex items-start gap-3 cursor-pointer group">
                                    <div className="relative mt-0.5">
                                        <input
                                            type="checkbox"
                                            checked={acceptedTerms}
                                            onChange={(e) => { setAcceptedTerms(e.target.checked); clearFieldError('terms'); }}
                                            className="sr-only peer"
                                        />
                                        <div className={`w-5 h-5 rounded-md border-2 transition-all duration-200
                                            flex items-center justify-center
                                            ${acceptedTerms
                                                ? 'bg-amber-500 border-amber-500'
                                                : fieldErrors.terms
                                                    ? 'border-red-500/50 bg-transparent'
                                                    : 'border-white/20 bg-transparent group-hover:border-white/40'
                                            }`}>
                                            {acceptedTerms && (
                                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-sm text-slate-400 leading-tight">
                                        I agree to the{' '}
                                        <span className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer">
                                            Terms of Service
                                        </span>
                                        {' '}and{' '}
                                        <span className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer">
                                            Privacy Policy
                                        </span>
                                    </span>
                                </label>
                                {fieldErrors.terms && (
                                    <p className="mt-1.5 text-xs text-red-400 ml-8">{fieldErrors.terms}</p>
                                )}
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-300
                                bg-gradient-to-r from-amber-500 to-amber-600 text-white
                                hover:from-amber-400 hover:to-amber-500 hover:shadow-lg hover:shadow-amber-500/25
                                active:scale-[0.98]
                                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                        >
                            {isSubmitting ? (
                                <span className="inline-flex items-center gap-2">
                                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    {view === 'forgot' ? 'Sending...' : view === 'signup' ? 'Creating...' : 'Signing in...'}
                                </span>
                            ) : (
                                view === 'forgot' ? 'Send Reset Link' : view === 'signup' ? 'Create Account' : 'Sign In'
                            )}
                        </button>

                        {/* Back — forgot */}
                        {view === 'forgot' && (
                            <button type="button" onClick={() => switchView('signin')}
                                className="w-full text-sm text-slate-400 hover:text-white transition-colors py-2">
                                ← Back to Sign In
                            </button>
                        )}
                    </form>

                    {/* Divider + Google */}
                    {view !== 'forgot' && (
                        <>
                            <div className="flex items-center gap-4 my-6">
                                <div className="flex-1 h-px bg-white/10" />
                                <span className="text-xs text-slate-500 uppercase tracking-wider">or</span>
                                <div className="flex-1 h-px bg-white/10" />
                            </div>
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                disabled={isGoogleLoading || isSubmitting}
                                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl
                                    bg-slate-800/60 border border-white/10 text-white text-sm font-medium
                                    hover:bg-slate-700/60 hover:border-white/20 transition-all duration-300
                                    active:scale-[0.98]
                                    disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isGoogleLoading ? (
                                    <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                    </svg>
                                )}
                                Continue with Google
                            </button>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="text-center mt-6">
                    <p className="text-xs text-slate-500 flex items-center justify-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0110 0v4" />
                        </svg>
                        Secured by Supabase Auth • Google OAuth 2.0
                    </p>
                    <p className="text-xs text-slate-600 mt-2">
                        CoreX Financial System v1.0 — Your data stays private.
                    </p>
                </div>
            </div>
        </div>
    );
}

// ── Shared Components ──

function BackgroundOrbs() {
    return (
        <>
            <div
                className="absolute w-[500px] h-[500px] rounded-full blur-[120px] opacity-15"
                style={{ background: 'radial-gradient(circle, #f59e0b, transparent)', top: '-10%', left: '-10%', animation: 'float 8s ease-in-out infinite' }}
            />
            <div
                className="absolute w-[400px] h-[400px] rounded-full blur-[100px] opacity-10"
                style={{ background: 'radial-gradient(circle, #3b82f6, transparent)', bottom: '-10%', right: '-10%', animation: 'float 10s ease-in-out infinite reverse' }}
            />
        </>
    );
}

function Styles() {
    return (
        <style>{`
            @keyframes float {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-20px) scale(1.05); }
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateY(12px); }
                to { opacity: 1; transform: translateY(0); }
            }
            @keyframes successPop {
                0% { transform: scale(0); opacity: 0; }
                50% { transform: scale(1.2); }
                100% { transform: scale(1); opacity: 1; }
            }
            @keyframes checkDraw {
                from { stroke-dashoffset: 24; }
                to { stroke-dashoffset: 0; }
            }
            .animate-slide-in { animation: slideIn 0.3s ease-out; }
            .animate-success-pop { animation: successPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
            .animate-check-draw {
                stroke-dasharray: 24;
                stroke-dashoffset: 24;
                animation: checkDraw 0.4s ease-out 0.3s forwards;
            }
        `}</style>
    );
}
