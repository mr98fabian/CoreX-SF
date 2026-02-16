import { useState, useRef, useEffect } from 'react';
import { Bug, X, Send, Loader2, CheckCircle2, Sparkles, AlertTriangle, Palette, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

// ─── Types ─────────────────────────────────────────────────
type ReportType = 'bug' | 'feature' | 'ui' | 'other';
type Priority = 'low' | 'medium' | 'high';

interface SystemContext {
    page: string;
    browser: string;
    os: string;
    screen: string;
    timestamp: string;
}

// ─── Report Type Options ───────────────────────────────────
const REPORT_TYPES: { value: ReportType; icon: typeof Bug; label: string; color: string }[] = [
    { value: 'bug', icon: Bug, label: 'Bug', color: 'text-red-400 bg-red-500/10 border-red-500/20 hover:bg-red-500/20' },
    { value: 'feature', icon: Sparkles, label: 'Feature', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20' },
    { value: 'ui', icon: Palette, label: 'UI Issue', color: 'text-purple-400 bg-purple-500/10 border-purple-500/20 hover:bg-purple-500/20' },
    { value: 'other', icon: HelpCircle, label: 'Other', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
];

const PRIORITIES: { value: Priority; emoji: string; label: string }[] = [
    { value: 'low', emoji: '🟢', label: 'Low' },
    { value: 'medium', emoji: '🟡', label: 'Medium' },
    { value: 'high', emoji: '🔴', label: 'Critical' },
];

// ─── Auto-detect system context ────────────────────────────
function getSystemContext(): SystemContext {
    const ua = navigator.userAgent;
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';

    let os = 'Unknown';
    if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

    return {
        page: window.location.pathname,
        browser,
        os,
        screen: `${window.innerWidth}×${window.innerHeight}`,
        timestamp: new Date().toISOString(),
    };
}

// ─── Component ─────────────────────────────────────────────
export default function FeedbackWidget() {
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [isSent, setIsSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pulse, setPulse] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // Form state
    const [type, setType] = useState<ReportType>('bug');
    const [priority, setPriority] = useState<Priority>('medium');
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');

    // Subtle pulse every 45s to hint the button exists
    useEffect(() => {
        const interval = setInterval(() => {
            if (!isOpen) {
                setPulse(true);
                setTimeout(() => setPulse(false), 2000);
            }
        }, 45000);
        return () => clearInterval(interval);
    }, [isOpen]);

    // Close on outside click/touch
    useEffect(() => {
        function handleOutsideInteraction(e: MouseEvent | TouchEvent) {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleOutsideInteraction);
            document.addEventListener('touchstart', handleOutsideInteraction, { passive: true });
        }
        return () => {
            document.removeEventListener('mousedown', handleOutsideInteraction);
            document.removeEventListener('touchstart', handleOutsideInteraction);
        };
    }, [isOpen]);

    // Reset form after close
    useEffect(() => {
        if (!isOpen && isSent) {
            const timer = setTimeout(() => {
                setIsSent(false);
                setMessage('');
                setEmail('');
                setType('bug');
                setPriority('medium');
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, isSent]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!email.trim() || !message.trim()) return;

        setIsSubmitting(true);

        const ctx = getSystemContext();

        try {
            const response = await fetch('https://formsubmit.co/ajax/mr98fabian@gmail.com', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    _subject: `[KoreX ${type.toUpperCase()}] ${priority === 'high' ? '🔴 CRITICAL — ' : ''}${message.slice(0, 50)}`,
                    type: `${REPORT_TYPES.find(r => r.value === type)?.label}`,
                    priority: `${PRIORITIES.find(p => p.value === priority)?.emoji} ${PRIORITIES.find(p => p.value === priority)?.label}`,
                    email,
                    message,
                    _page: ctx.page,
                    _browser: ctx.browser,
                    _os: ctx.os,
                    _screen: ctx.screen,
                    _timestamp: ctx.timestamp,
                    _template: 'table',
                    _captcha: 'false',
                }),
            });

            if (response.ok) {
                setIsSent(true);
                toast({
                    title: '✅ Thanks for the feedback!',
                    description: 'Your report has been sent successfully.',
                });
            } else {
                throw new Error('Send failed');
            }
        } catch {
            toast({
                title: 'Error',
                description: 'Could not send your report. Please try again.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div ref={panelRef} className="fixed bottom-5 right-5 z-30 flex flex-col items-end gap-3">
            {/* ─── Expanded Panel ─────────────────────────────── */}
            <div
                className={cn(
                    'w-[360px] max-h-[85vh] overflow-y-auto rounded-2xl border shadow-2xl transition-all duration-300 origin-bottom-right',
                    'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10',
                    'shadow-black/10 dark:shadow-black/40',
                    isOpen
                        ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto'
                        : 'scale-90 opacity-0 translate-y-4 pointer-events-none'
                )}
            >
                {/* Success State */}
                {isSent ? (
                    <div className="p-8 text-center space-y-4 animate-in fade-in zoom-in duration-300">
                        <div className="mx-auto h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                            <CheckCircle2 className="text-emerald-500" size={32} />
                        </div>
                        <h3 className="text-lg font-semibold">Thanks! 🎉</h3>
                        <p className="text-sm text-muted-foreground">
                            Your feedback has been sent. We'll review it shortly.
                        </p>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-sm text-amber-500 hover:text-amber-400 font-medium transition-colors"
                        >
                            Close
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                    <Bug size={16} className="text-amber-500" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold">Send Feedback</h3>
                                    <p className="text-[11px] text-muted-foreground">Help us improve KoreX</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Report Type Selector */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Type</label>
                            <div className="grid grid-cols-4 gap-1.5">
                                {REPORT_TYPES.map(({ value, icon: Icon, label, color }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setType(value)}
                                        className={cn(
                                            'flex flex-col items-center gap-1 p-2 rounded-xl border text-xs font-medium transition-all duration-200',
                                            type === value
                                                ? color
                                                : 'border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                                        )}
                                    >
                                        <Icon size={16} />
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Priority */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Priority</label>
                            <div className="flex gap-1.5">
                                {PRIORITIES.map(({ value, emoji, label }) => (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => setPriority(value)}
                                        className={cn(
                                            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200',
                                            priority === value
                                                ? 'border-amber-500/30 bg-amber-500/10 text-amber-500'
                                                : 'border-slate-200 dark:border-white/5 text-slate-500 hover:bg-slate-50 dark:hover:bg-white/[0.02]'
                                        )}
                                    >
                                        <span>{emoji}</span>
                                        {label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Your Email</label>
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="you@email.com"
                                className={cn(
                                    'w-full px-3 py-2 rounded-xl text-sm border transition-colors',
                                    'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/5',
                                    'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                                    'focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40'
                                )}
                            />
                        </div>

                        {/* Message */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-muted-foreground">Description</label>
                            <textarea
                                required
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder={type === 'bug'
                                    ? 'What happened? What did you expect?'
                                    : type === 'feature'
                                        ? "Describe the feature you'd like to see..."
                                        : "Tell us what's on your mind..."}
                                rows={4}
                                className={cn(
                                    'w-full px-3 py-2 rounded-xl text-sm border resize-none transition-colors',
                                    'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/5',
                                    'placeholder:text-slate-400 dark:placeholder:text-slate-600',
                                    'focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500/40'
                                )}
                            />
                        </div>

                        {/* Context info (auto-captured) */}
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-600">
                            <AlertTriangle size={10} />
                            Page, browser & device info will be included automatically.
                        </div>

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isSubmitting || !email.trim() || !message.trim()}
                            className={cn(
                                'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200',
                                'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
                                'hover:from-amber-400 hover:to-orange-400 hover:shadow-lg hover:shadow-amber-500/20',
                                'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none',
                                'active:scale-[0.98]'
                            )}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={14} />
                                    Send Report
                                </>
                            )}
                        </button>
                    </form>
                )}
            </div>

            {/* ─── Floating Trigger Button ────────────────────── */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                aria-label="Report a bug or send feedback"
                className={cn(
                    'group relative h-11 w-11 rounded-full flex items-center justify-center transition-all duration-300',
                    'bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10',
                    'hover:bg-amber-500/10 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/10',
                    'active:scale-95',
                    isOpen && 'bg-amber-500/10 border-amber-500/30 rotate-12',
                    pulse && 'animate-bounce'
                )}
            >
                <Bug
                    size={18}
                    className={cn(
                        'transition-all duration-300',
                        isOpen
                            ? 'text-amber-500'
                            : 'text-slate-400 dark:text-slate-500 group-hover:text-amber-500'
                    )}
                />
                {/* Subtle ping dot */}
                {!isOpen && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-500 border-2 border-white dark:border-slate-800 animate-pulse" />
                )}
            </button>
        </div>
    );
}
