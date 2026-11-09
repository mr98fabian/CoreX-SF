import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    User, Palette, Bell, Database, Info, Flame, Bot,
    Download, Upload, Trash2, RefreshCw, FileSpreadsheet,
    FileJson, FileText, CheckCircle, AlertTriangle, Globe, DollarSign,
    Calendar, Shield, Sparkles, ExternalLink, Github, BookOpen,
    CreditCard, Crown, Tag, XCircle,
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";
import { PAID_PLAN_ID } from '@/lib/pricing';
import { PlanCards } from '@/components/kx/PlanCards';
import { fetchSubStatus, longDate, planLabel as planDisplayName, type SubStatus } from '@/lib/planLimits';
import { useLanguage } from "@/contexts/LanguageContext";
import { useFormatMoney } from "@/hooks/useFormatMoney";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiFetch, ApiError } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ReferralProgram } from "@/components/ReferralProgram";
import { ConnectAI } from "@/components/ConnectAI";

// ─── Types ──────────────────────────────────────────────────────────
type Section = "profile" | "appearance" | "notifications" | "data" | "subscription" | "ai" | "about";

interface NavItem {
    id: Section;
    labelKey: string;
    icon: React.ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
    { id: "profile", labelKey: "settings.nav.profile", icon: <User className="h-4 w-4" /> },
    { id: "appearance", labelKey: "settings.nav.appearance", icon: <Palette className="h-4 w-4" /> },

    { id: "notifications", labelKey: "settings.nav.notifications", icon: <Bell className="h-4 w-4" /> },
    { id: "data", labelKey: "settings.nav.data", icon: <Database className="h-4 w-4" /> },
    { id: "subscription", labelKey: "settings.nav.subscription", icon: <CreditCard className="h-4 w-4" /> },
    { id: "ai", labelKey: "settings.nav.ai", icon: <Bot className="h-4 w-4" /> },
    { id: "about", labelKey: "settings.nav.about", icon: <Info className="h-4 w-4" /> },
];

const TECH_STACK = [
    { name: "React 18", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
    { name: "FastAPI", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
    { name: "PostgreSQL", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    { name: "TailwindCSS", color: "text-sky-400 bg-sky-500/10 border-sky-500/20" },
    { name: "TypeScript", color: "text-blue-300 bg-blue-400/10 border-blue-400/20" },
    { name: "SheetJS", color: "text-green-400 bg-green-500/10 border-green-500/20" },
];

// ─── Subscription Constants ───
// Price anchors are now translated via t() — see sub.anchor.* keys

interface SavingsData {
    has_data: boolean;
    total_debt: number;
    daily_interest_all: number;
    plans: Record<string, {
        accounts_used: number;
        annual_savings: number;
        monthly_savings: number;
        daily_interest_burning: number;
        roi_days: number;
        plan_cost_annual: number;
        years_without: number;
        years_with: number;
        total_interest_without: number;
        total_interest_with: number;
    }>;
    social_proof: {
        total_accounts_monitored: number;
        total_debt_tracked: number;
    };
}



// Used when real user data is unavailable (demo, auth issues, no accounts)
// ═══════════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
    const { t, language, setLanguage } = useLanguage();
    const { formatMoney, formatMoneyShort } = useFormatMoney();
    usePageTitle(t("nav.settings"));
    const { user, isDemo } = useAuth();
    const onboarding = useOnboarding();

    // ─── Profile data from auth ────────────────────────────────
    const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';
    const userEmail = user?.email || '';
    const userInitials = userName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const [displayName, setDisplayName] = useState(userName);
    const [profileSaving, setProfileSaving] = useState(false);

    // Update displayName when user changes (e.g. after initial load)
    useEffect(() => { setDisplayName(userName); }, [userName]);

    const handleSaveProfile = async () => {
        if (isDemo) {
            toast({ title: t('settings.profile.demoAccount'), description: t('settings.profile.demoCannotEdit'), variant: 'destructive' });
            return;
        }
        setProfileSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } });
            if (error) throw error;
            toast({ title: t('settings.profile.saved'), description: t('settings.profile.savedDesc') });
        } catch {
            toast({ title: 'Error', description: 'Could not update profile.', variant: 'destructive' });
        } finally {
            setProfileSaving(false);
        }
    };

    // ─── Local state ────────────────────────────────────────────
    // Opened from the new Ajustes screen with ?section=… (or ?tab=subscription after checkout)
    const [activeSection, setActiveSection] = useState<Section>(() => {
        const q = new URLSearchParams(window.location.search);
        const wanted = (q.get("section") || q.get("tab")) as Section | null;
        return wanted && NAV_ITEMS.some((n) => n.id === wanted) ? wanted : "profile";
    });

    const [currency, setCurrency] = useState(() => localStorage.getItem("korex-currency") || "USD");
    const [dateFormat, setDateFormat] = useState(() => localStorage.getItem("korex-date-format") || "MM/DD/YYYY");
    const [exportLoading, setExportLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Notification states
    // Notification toggles — persisted in localStorage
    const [notifPayment, setNotifPayment] = useState(() => localStorage.getItem('korex-notif-payment') !== 'false');
    const [notifDaily, setNotifDaily] = useState(() => localStorage.getItem('korex-notif-daily') === 'true');
    const [notifBank, setNotifBank] = useState(() => localStorage.getItem('korex-notif-bank') !== 'false');
    const [notifMilestones, setNotifMilestones] = useState(() => localStorage.getItem('korex-notif-milestones') !== 'false');
    const [notifWeekly, setNotifWeekly] = useState(() => localStorage.getItem('korex-notif-weekly') === 'true');

    const toggleNotif = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => (val: boolean) => {
        setter(val);
        localStorage.setItem(`korex-notif-${key}`, String(val));
    };
    const [promoCode, setPromoCode] = useState('');
    const [promoStatus, setPromoStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
    const [promoMessage, setPromoMessage] = useState('');
    const [activePlan, setActivePlan] = useState(() => localStorage.getItem('korex-plan') || 'starter');
    const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
    const [savingsData, setSavingsData] = useState<SavingsData | null>(null);
    const [interestTick, setInterestTick] = useState(0);
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const { toast } = useToast();

    // Plan shown here is the server's, never just the cached localStorage value.
    // Coming back from Lemon Squeezy (?checkout=success) the webhook may land a few
    // seconds after the redirect, so poll briefly until the paid plan appears.
    useEffect(() => {
        const fromCheckout = new URLSearchParams(window.location.search).get('checkout') === 'success';
        let cancelled = false;
        let attempts = 0;
        if (fromCheckout) {
            toast({ title: t('sub.checkoutReturnTitle'), description: t('sub.checkoutReturnDesc') });
        }
        const sync = async () => {
            const st = await fetchSubStatus();
            const plan = st ? st.plan || 'starter' : (localStorage.getItem('korex-plan') || 'starter');
            if (cancelled) return;
            setActivePlan(plan);
            setSubStatus(st);
            if (fromCheckout && plan === 'starter' && ++attempts < 8) {
                setTimeout(sync, 3000);
            } else if (fromCheckout) {
                toast({
                    title: plan === 'starter' ? t('sub.checkoutPendingTitle') : t('sub.checkoutActiveTitle'),
                    description: plan === 'starter' ? t('sub.checkoutPendingDesc') : undefined,
                });
                window.history.replaceState(null, '', window.location.pathname);
            }
        };
        sync();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
    }, []);

    // Savings are only ever the user's own calculated numbers: no data → no figures
    useEffect(() => {
        apiFetch<SavingsData>('/api/subscriptions/savings-estimate')
            .then(data => {
                setSavingsData(data.has_data ? data : null);
            })
            .catch(() => {
                setSavingsData(null);
            });
    }, []);

    // Animated interest ticker — ticks every 100ms to show money burning
    useEffect(() => {
        if (!savingsData?.has_data) return;
        const dailyRate = savingsData.daily_interest_all;
        const perTick = dailyRate / 24 / 3600 * 0.1; // per 100ms
        const interval = setInterval(() => {
            setInterestTick(prev => prev + perTick);
        }, 100);
        return () => clearInterval(interval);
    }, [savingsData]);

    // ─── Handlers ───────────────────────────────────────────────
    const handleCurrencyChange = (val: string) => {
        setCurrency(val);
        localStorage.setItem("korex-currency", val);
    };

    const handleDateFormatChange = (val: string) => {
        setDateFormat(val);
        localStorage.setItem("korex-date-format", val);
    };

    const handleExportExcel = async () => {
        setExportLoading(true);
        try {
            // Lazy-load xlsx (~430 KB) only when the user actually exports
            const [XLSX, debtsRes, transRes, accountsRes] = await Promise.all([
                import("xlsx"),
                apiFetch<unknown[]>("/api/debts").catch(() => []),
                apiFetch<unknown[]>("/api/transactions/recent?limit=100").catch(() => []),
                apiFetch<unknown[]>("/api/accounts").catch(() => []),
            ]);

            const wb = XLSX.utils.book_new();

            // Sheet 1: Debts
            const debtsData = Array.isArray(debtsRes) ? debtsRes : [];
            if (debtsData.length > 0) {
                const ws1 = XLSX.utils.json_to_sheet(debtsData);
                XLSX.utils.book_append_sheet(wb, ws1, "Debts");
            }

            // Sheet 2: Accounts
            const accountsData = Array.isArray(accountsRes) ? accountsRes : [];
            if (accountsData.length > 0) {
                const ws2 = XLSX.utils.json_to_sheet(accountsData);
                XLSX.utils.book_append_sheet(wb, ws2, "Accounts");
            }

            // Sheet 3: Transactions
            const transData = Array.isArray(transRes) ? transRes : [];
            if (transData.length > 0) {
                const ws3 = XLSX.utils.json_to_sheet(transData);
                XLSX.utils.book_append_sheet(wb, ws3, "Transactions");
            }

            // Fallback empty sheet
            if (wb.SheetNames.length === 0) {
                const wsEmpty = XLSX.utils.aoa_to_sheet([["No data available"]]);
                XLSX.utils.book_append_sheet(wb, wsEmpty, "Info");
            }

            XLSX.writeFile(wb, `KoreX_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
        } catch (err) {
            console.error("Export failed:", err);
        } finally {
            setExportLoading(false);
        }
    };

    const handleExportJson = async () => {
        try {
            const [debts, transactions, accounts] = await Promise.all([
                apiFetch<unknown[]>("/api/debts").catch(() => []),
                apiFetch<unknown[]>("/api/transactions/recent?limit=100").catch(() => []),
                apiFetch<unknown[]>("/api/accounts").catch(() => []),
            ]);

            const data = { debts, transactions, accounts, exportedAt: new Date().toISOString() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `KoreX_Backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error("JSON export failed:", err);
        }
    };

    const handleDownloadTemplate = async () => {
        const XLSX = await import("xlsx");
        const wb = XLSX.utils.book_new();

        // Debts template
        const debtsTemplate = XLSX.utils.aoa_to_sheet([
            ["name", "current_balance", "apr", "minimum_payment", "loan_type", "closing_day"],
            ["Example Credit Card", 5000, 24.99, 150, "credit_card", 15],
        ]);
        XLSX.utils.book_append_sheet(wb, debtsTemplate, "Debts Template");

        // Transactions template
        const transTemplate = XLSX.utils.aoa_to_sheet([
            ["date", "description", "amount", "category"],
            ["2026-02-15", "Grocery Store", -85.50, "food"],
        ]);
        XLSX.utils.book_append_sheet(wb, transTemplate, "Transactions Template");

        XLSX.writeFile(wb, "KoreX_Import_Template.xlsx");
    };

    const handleImportExcel = async () => {
        if (!importFile) return;
        try {
            const [XLSX, data] = await Promise.all([import("xlsx"), importFile.arrayBuffer()]);
            const wb = XLSX.read(data);
            const sheetNames = wb.SheetNames;

            for (const name of sheetNames) {
                const sheet = wb.Sheets[name];
                XLSX.utils.sheet_to_json(sheet);
            }
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            toast({ title: "✅ Import Complete", description: t("settings.data.importSuccess").replace("{count}", String(sheetNames.length)) });

        } catch (err) {
            toast({ title: "Import Failed", description: String(err), variant: "destructive" });
        }
    };

    const handleResetDemo = async () => {
        const confirmed = window.confirm(t("settings.data.resetConfirm"));

        if (!confirmed) return;
        setResetLoading(true);
        try {
            await apiFetch("/api/demo/seed", { method: "POST" });
            window.location.reload();
        } catch (err) {
            console.error("Reset failed:", err);
        } finally {
            setResetLoading(false);
        }
    };

    const handleClearCache = () => {
        const confirmed = window.confirm(t("settings.data.clearConfirm"));

        if (!confirmed) return;
        localStorage.clear();
        window.location.reload();
    };

    // ─── Render Sections ────────────────────────────────────────
    const renderProfile = () => (
        <div className="space-y-6">
            <SectionHeader title={t("settings.profile.title")} subtitle={t("settings.profile.subtitle")} icon={<User className="h-5 w-5 text-blue-400" />} />
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardContent className="pt-6 space-y-6">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white dark:text-white shrink-0">
                            {userInitials}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{userName}</h3>
                            <p className="text-sm text-gray-500 dark:text-gray-400">{userEmail}</p>
                            {isDemo && (
                                <Badge className="mt-1 bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                    {t("settings.profile.demoAccount")}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator className="bg-gray-200 dark:bg-neutral-800" />

                    {/* Form fields */}
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="text-slate-700 dark:text-gray-300">{t("settings.profile.displayName")}</Label>
                            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isDemo} className="bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white focus:border-blue-500/50" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-slate-700 dark:text-gray-300">{t("settings.profile.email")}</Label>
                            <Input id="email" value={userEmail} disabled className="bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white focus:border-blue-500/50 opacity-60" />
                        </div>
                        {!isDemo && (
                            <Button onClick={handleSaveProfile} disabled={profileSaving || displayName === userName} variant="premium" className="w-full mt-2">
                                {profileSaving ? <RefreshCw size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                                {t('settings.profile.saveChanges')}
                            </Button>
                        )}
                    </div>

                    {/* Security */}
                    <Separator className="bg-gray-200 dark:bg-neutral-800" />
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            {t("settings.profile.security")}
                        </h4>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm text-slate-700 dark:text-gray-300">
                                    {t("settings.profile.twoFactor")}
                                </Label>
                                <p className="text-xs text-gray-500 dark:text-gray-500">
                                    {t("settings.profile.twoFactorDesc")}
                                </p>
                            </div>
                            <Switch />
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const renderAppearance = () => (
        <div className="space-y-6">
            <SectionHeader title={t("settings.appearance.title")} subtitle={t("settings.appearance.subtitle")} icon={<Palette className="h-5 w-5 text-purple-400" />} />
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardContent className="pt-6 space-y-6">
                    {/* Language */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Globe className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-gray-200">{t("settings.appearance.language")}</Label>
                                <p className="text-xs text-gray-500">{t("settings.appearance.languageDesc")}</p>
                            </div>
                        </div>
                        <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "es")}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-neutral-700">
                                <SelectItem value="en" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">🇺🇸 English</SelectItem>
                                <SelectItem value="es" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">🇪🇸 Español</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-gray-200 dark:bg-neutral-800" />

                    {/* Currency */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <DollarSign className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-gray-200">{t("settings.appearance.currency")}</Label>
                                <p className="text-xs text-gray-500">{t("settings.appearance.currencyDesc")}</p>
                            </div>
                        </div>
                        <Select value={currency} onValueChange={handleCurrencyChange}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-neutral-700">
                                <SelectItem value="USD" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">$ USD (US Dollar)</SelectItem>
                                <SelectItem value="MXN" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">$ MXN (Peso Mexicano)</SelectItem>
                                <SelectItem value="EUR" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">€ EUR (Euro)</SelectItem>
                                <SelectItem value="GBP" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">£ GBP (British Pound)</SelectItem>
                                <SelectItem value="CAD" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">$ CAD (Canadian Dollar)</SelectItem>
                                <SelectItem value="COP" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">$ COP (Peso Colombiano)</SelectItem>
                                <SelectItem value="ARS" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">$ ARS (Peso Argentino)</SelectItem>
                                <SelectItem value="BRL" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">R$ BRL (Real Brasileiro)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-gray-200 dark:bg-neutral-800" />

                    {/* Date Format */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Calendar className="h-4 w-4 text-amber-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-gray-200">{t("settings.appearance.dateFormat")}</Label>
                                <p className="text-xs text-gray-500">{t("settings.appearance.dateDesc")}</p>
                            </div>
                        </div>
                        <Select value={dateFormat} onValueChange={handleDateFormatChange}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-neutral-700">
                                <SelectItem value="MM/DD/YYYY" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">MM/DD/YYYY</SelectItem>
                                <SelectItem value="DD/MM/YYYY" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">DD/MM/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD" className="text-slate-900 dark:text-white focus:bg-gray-100 dark:focus:bg-neutral-800">YYYY-MM-DD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const renderNotifications = () => {
        const items = [
            { key: "payment", uiKey: "paymentDue", state: notifPayment, setter: toggleNotif('payment', setNotifPayment), critical: false },
            { key: "daily", uiKey: "dailySummary", state: notifDaily, setter: toggleNotif('daily', setNotifDaily), critical: false },
            { key: "bank", uiKey: "bankDisconnect", state: notifBank, setter: toggleNotif('bank', setNotifBank), critical: true },
            { key: "milestones", uiKey: "milestones", state: notifMilestones, setter: toggleNotif('milestones', setNotifMilestones), critical: false },
            { key: "weekly", uiKey: "weeklyReport", state: notifWeekly, setter: toggleNotif('weekly', setNotifWeekly), critical: false },
        ];

        return (
            <div className="space-y-6">
                <SectionHeader title={t("settings.notifications.title")} subtitle={t("settings.notifications.subtitle")} icon={<Bell className="h-5 w-5 text-amber-400" />} />
                <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                    <CardContent className="pt-6 space-y-1">
                        {items.map((item, i) => (
                            <div key={item.key}>
                                <div className="flex items-center justify-between py-3">
                                    <div className="space-y-0.5">
                                        <Label className={`text-sm ${item.critical ? "text-rose-500 dark:text-rose-300" : "text-slate-700 dark:text-gray-200"}`}>
                                            {t(`settings.notifications.${item.uiKey}`)}
                                        </Label>
                                        <p className="text-xs text-gray-500">
                                            {t(`settings.notifications.${item.uiKey}Desc`)}
                                        </p>
                                    </div>
                                    <Switch checked={item.state} onCheckedChange={item.setter} />
                                </div>
                                {i < items.length - 1 && <Separator className="bg-gray-200/50 dark:bg-neutral-800/50" />}
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        );
    };

    const renderDataManagement = () => (
        <div className="space-y-6">
            <SectionHeader title={t("settings.data.title")} subtitle={t("settings.data.subtitle")} icon={<Database className="h-5 w-5 text-purple-400" />} />

            {/* Export Section */}
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Download className="h-4 w-4 text-emerald-400" />
                        {t("settings.data.exportData")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        <button
                            onClick={handleExportExcel}
                            disabled={exportLoading}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all text-center"
                        >
                            <FileSpreadsheet className="h-8 w-8 text-emerald-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium text-emerald-300">{t("settings.data.exportExcel")}</span>
                            <span className="text-[10px] text-gray-500">{t("settings.data.exportExcelDesc")}</span>
                        </button>

                        <button
                            onClick={handleExportJson}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-center"
                        >
                            <FileJson className="h-8 w-8 text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium text-blue-300">{t("settings.data.exportJson")}</span>
                            <span className="text-[10px] text-gray-500">{t("settings.data.exportJsonDesc")}</span>
                        </button>

                        <button
                            onClick={async () => {
                                setPdfLoading(true);
                                try {
                                    // Lazy-load jsPDF (~900 KB) only when the user actually exports
                                    const { generateMonthlyReport } = await import("@/lib/PDFReportGenerator");
                                    await generateMonthlyReport(language as 'en' | 'es', currency);
                                } catch (err) {
                                    console.error('PDF generation failed:', err);
                                    alert(`❌ ${t("settings.data.pdfError")}`);
                                } finally {
                                    setPdfLoading(false);
                                }
                            }}
                            disabled={pdfLoading}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all text-center"
                        >
                            <FileText className={`h-8 w-8 text-rose-400 group-hover:scale-110 transition-transform ${pdfLoading ? 'animate-pulse' : ''}`} />
                            <span className="text-sm font-medium text-rose-300">{t("settings.data.exportPdf")}</span>
                            <span className="text-[10px] text-gray-500">{t("settings.data.exportPdfDesc")}</span>
                        </button>

                        <button
                            onClick={handleDownloadTemplate}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-center"
                        >
                            <Download className="h-8 w-8 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium text-amber-300">{t("settings.data.downloadTemplate")}</span>
                            <span className="text-[10px] text-gray-500">{t("settings.data.downloadTemplateDesc")}</span>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Import Section */}
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-400" />
                        {t("settings.data.importExcel")}
                    </CardTitle>
                    <CardDescription className="text-xs">{t("settings.data.importExcelDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border-2 border-dashed border-slate-300 dark:border-neutral-700 rounded-xl p-6 text-center hover:border-blue-500/50 transition-colors">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="hidden"
                            id="import-file"
                        />
                        <FileSpreadsheet className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                        {importFile ? (
                            <div className="space-y-3">
                                <div className="flex items-center justify-center gap-2">
                                    <CheckCircle className="h-4 w-4 text-emerald-400" />
                                    <span className="text-sm text-emerald-300">{importFile.name}</span>
                                </div>
                                <div className="flex gap-2 justify-center">
                                    <Button size="sm" onClick={handleImportExcel} className="bg-blue-600 hover:bg-blue-700">
                                        <Upload className="h-3 w-3 mr-1" />
                                        {t("settings.data.process")}
                                    </Button>
                                    <Button size="sm" variant="outline" onClick={() => { setImportFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                                        className="border-slate-300 dark:border-neutral-700 text-slate-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-800"
                                    >
                                        {t("settings.data.cancelImport")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="import-file" className="cursor-pointer">
                                    <p className="text-sm text-gray-400 mb-1">
                                        {t("settings.data.dragFile")}
                                    </p>
                                    <span className="text-sm text-blue-400 hover:text-blue-300 underline underline-offset-2">
                                        {t("settings.data.clickBrowse")}
                                    </span>
                                </label>
                                <p className="text-[10px] text-slate-600 mt-2">.xlsx, .xls, .csv</p>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Restart Tutorial */}
            <Card className="border-blue-500/20 bg-white dark:bg-black/50">
                <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Sparkles className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-700 dark:text-gray-200">{t('settings.restartTutorial')}</p>
                                <p className="text-xs text-gray-500">{t('settings.restartTutorialDesc')}</p>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                                await onboarding.restart();
                                window.location.href = '/';
                            }}
                            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300"
                        >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {t('settings.restartBtn')}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Danger Zone */}
            <Card className="border-rose-500/20 bg-white dark:bg-black/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {t("settings.data.dangerZone")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-700 dark:text-gray-200">{t("settings.data.resetDemo")}</p>
                            <p className="text-xs text-gray-500">{t("settings.data.resetDemoDesc")}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleResetDemo}
                            disabled={resetLoading}
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <RefreshCw className={`h-3 w-3 mr-1 ${resetLoading ? "animate-spin" : ""}`} />
                            {t("settings.data.reset")}
                        </Button>
                    </div>
                    <Separator className="bg-gray-200 dark:bg-neutral-800" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-700 dark:text-gray-200">{t("settings.data.clearCache")}</p>
                            <p className="text-xs text-gray-500">{t("settings.data.clearCacheDesc")}</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearCache}
                            className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                        >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {t("settings.data.clear")}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const renderAbout = () => (
        <div className="space-y-6">
            <SectionHeader title={t("settings.about.title")} subtitle={t("settings.about.subtitle")} icon={<Info className="h-5 w-5 text-gray-400" />} />

            {/* Version Hero */}
            <Card className="border-gray-200 dark:border-neutral-800 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 dark:from-black dark:via-blue-950/20 dark:to-black overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <CardContent className="pt-6 pb-8">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                                {t("settings.about.financialSystem")}
                            </span>
                        </div>
                        <h2 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
                            KoreX <span className="text-blue-400">v{__APP_VERSION__}</span>
                        </h2>
                        <p className="text-sm text-gray-400 dark:text-gray-500 max-w-md mx-auto">
                            {t("settings.about.tagline")}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("settings.about.version")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{__APP_VERSION__}</p>
                    </CardContent>
                </Card>
                <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("settings.about.build")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{__BUILD_DATE__}</p>
                    </CardContent>
                </Card>
                <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t("settings.about.engine")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">Velocity v1</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tech Stack */}
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-white">{t("settings.about.techStack")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap gap-2">
                        {TECH_STACK.map((tech) => (
                            <Badge key={tech.name} variant="outline" className={`${tech.color} text-xs px-3 py-1`}>
                                {tech.name}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Links */}
            <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50">
                <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-[#0f0f0f] hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">
                            <BookOpen className="h-4 w-4" />
                            Docs
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-[#0f0f0f] hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">
                            <Github className="h-4 w-4" />
                            GitHub
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-gray-100 dark:bg-[#0f0f0f] hover:bg-gray-200 dark:hover:bg-neutral-800 transition-colors text-sm text-slate-600 dark:text-gray-300 hover:text-slate-900 dark:hover:text-white">
                            <ExternalLink className="h-4 w-4" />
                            Support
                        </a>
                    </div>
                </CardContent>
            </Card>

            {/* Footer */}
            <p className="text-center text-xs text-slate-600 pb-4">
                {t("settings.about.madeWith")}
            </p>
        </div>
    );

    // ─── Render Subscription ────────────────────────────────────
    function renderSubscription() {
        // Access codes (Founder / gift months): POST /api/codes/redeem. Errors stay discreet and
        // generic — the server never says whether a code exists.
        const handleApplyPromo = async () => {
            if (!promoCode.trim()) return;
            setPromoStatus('loading');
            const es = language === 'es';
            try {
                const result = await apiFetch<{ plan: string; permanent: boolean; ends_at: string | null }>(
                    '/api/codes/redeem',
                    { method: 'POST', body: JSON.stringify({ code: promoCode.trim() }) },
                );
                setPromoStatus('success');
                setPromoMessage(result.permanent
                    ? (es ? 'Tu cuenta ahora es Fundadora 🦝' : 'Your account is now a Founder account 🦝')
                    : (es ? `Plan activo hasta el ${longDate(result.ends_at!, true)}` : `Plan active until ${longDate(result.ends_at!, false)}`));
                setPromoCode('');
                const st = await fetchSubStatus();
                if (st) { setSubStatus(st); setActivePlan(st.plan); }
            } catch (err) {
                setPromoStatus('error');
                const status = err instanceof ApiError ? err.status : 0;
                setPromoMessage(status === 429
                    ? (es ? 'Demasiados intentos. Espera un minuto.' : 'Too many attempts. Wait a minute.')
                    : status === 400 || status === 403
                        ? (es ? 'Código no válido o no disponible.' : 'Invalid or unavailable code.')
                        : t('sub.connectionError'));
            }
        };

        const handleCancelSubscription = () => {
            setActivePlan('starter');
            localStorage.setItem('korex-plan', 'starter');
            localStorage.removeItem('korex-plan-label');
            setPromoStatus('idle');
            setPromoMessage('');
        };

        const currentPlan = activePlan === 'freedom-dev' ? 'freedom' : activePlan;
        const checkoutHidden = !!subStatus?.checkout_hidden; // founder or a current gift: nothing to buy here
        const grantLine = subStatus?.plan === 'founder'
            ? (language === 'es' ? 'Cuenta Fundadora · acceso total y permanente' : 'Founder account · full, permanent access')
            : subStatus?.grant_plan && subStatus.grant_ends_at
                ? (language === 'es'
                    ? `${planDisplayName(subStatus.grant_plan, true)} regalado · activo hasta el ${longDate(subStatus.grant_ends_at, true)}`
                    : `${planDisplayName(subStatus.grant_plan, false)} gift · active until ${longDate(subStatus.grant_ends_at, false)}`)
                : null;
        const isDevLicense = activePlan === 'freedom-dev';
        const planLabel = localStorage.getItem('korex-plan-label');

        const sd = savingsData; // shorthand

        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                <SectionHeader
                    title={t('sub.title')}
                    subtitle={t('sub.subtitle')}
                    icon={<CreditCard className="h-5 w-5 text-amber-400" />}
                />

                {/* 🔥 NEUROMARKETING: Interest Burning Banner */}
                {sd?.has_data && sd.daily_interest_all > 0 && (
                    <Card className="border-red-500/30 bg-gradient-to-r from-red-50/40 via-orange-50/30 to-red-50/40 dark:from-red-950/40 dark:via-orange-950/30 dark:to-red-950/40 overflow-hidden relative">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(239,68,68,0.08),transparent_70%)]" />
                        <CardContent className="p-5 relative">
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-12 w-12 rounded-xl bg-red-500/15 flex items-center justify-center animate-pulse">
                                        <Flame className="h-6 w-6 text-red-400" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-medium text-red-300/80 uppercase tracking-wider">{t('sub.interestBurning')}</p>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-red-400 font-mono tabular-nums">
                                                ${(interestTick).toFixed(4)}
                                            </span>
                                            <span className="text-xs text-red-400/60">{t('sub.sinceOpened')}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-6 text-center">
                                    <div>
                                        <p className="text-lg font-bold text-red-400 font-mono">{formatMoney(sd.daily_interest_all)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perDay')}</p>
                                    </div>
                                    <div className="h-8 w-px bg-red-500/20" />
                                    <div>
                                        <p className="text-lg font-bold text-red-400 font-mono">{formatMoneyShort(sd.daily_interest_all * 30)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perMonth')}</p>
                                    </div>
                                    <div className="h-8 w-px bg-red-500/20" />
                                    <div>
                                        <p className="text-lg font-bold text-red-400 font-mono">{formatMoneyShort(sd.daily_interest_all * 365)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perYear')}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Without vs With KoreX Comparison */}
                {sd?.has_data && sd.plans?.freedom && (
                    <Card className="border-gray-200 dark:border-white/5 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-white/5">
                                <div className="p-5 text-center bg-red-500/5">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">{t('sub.withoutKorex')}</p>
                                    <p className="text-2xl font-black text-red-400">{sd.plans.freedom.years_without} {t('sub.years')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('sub.toPayOff')}</p>
                                    <p className="text-sm font-bold text-red-400 mt-2">{formatMoneyShort(sd.plans.freedom.total_interest_without)}</p>
                                    <p className="text-[10px] text-red-400/60">{t('sub.totalInterest')}</p>
                                </div>
                                <div className="p-5 text-center bg-emerald-500/5">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">{t('sub.withKorex')}</p>
                                    <p className="text-2xl font-black text-emerald-400">{sd.plans.freedom.years_with} {t('sub.years')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('sub.toFreedom')}</p>
                                    <p className="text-sm font-bold text-emerald-400 mt-2">{formatMoneyShort(sd.plans.freedom.total_interest_with)}</p>
                                    <p className="text-[10px] text-emerald-400/60">{t('sub.totalInterest')}</p>
                                </div>
                            </div>
                            <div className="bg-emerald-500/10 px-5 py-2.5 text-center border-t border-emerald-500/10">
                                <span className="text-sm font-bold text-emerald-400">
                                    💰 {t('sub.youKeep')} ${(sd.plans.freedom.total_interest_without - sd.plans.freedom.total_interest_with).toLocaleString()} {t('sub.goneToBank')}
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Plans: the two commercial plans (lib/pricing.ts); paid = KoreX Anual, annual only */}
                {checkoutHidden ? (
                    <p data-testid="checkout-hidden" className="rounded-md border border-gray-200 dark:border-white/10 p-4 text-center text-sm text-zinc-500">
                        {language === 'es' ? 'Incluido en tu acceso: no hay nada que comprar.' : 'Included in your access: nothing to buy.'}
                    </p>
                ) : (
                    <div className="kx-scope mx-auto max-w-xl">
                        <PlanCards currentPlan={currentPlan} busy={upgrading} onChoose={async (planId) => {
                            setUpgrading(planId);
                            try {
                                const data = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                                    method: 'POST',
                                    body: JSON.stringify({ plan: PAID_PLAN_ID, billing_cycle: 'annual' }),
                                });
                                if (!data.checkout_url) throw new Error('No checkout URL returned');
                                window.open(data.checkout_url, '_blank');
                                toast({ title: t('sub.checkoutOpened'), description: t('sub.checkoutDesc') });
                            } catch {
                                toast({ title: t('sub.checkoutFailed'), description: t('sub.checkoutFailedDesc'), variant: 'destructive' });
                            } finally {
                                setUpgrading(null);
                            }
                        }} />
                    </div>
                )}

                {/* 📊 NEUROMARKETING: Social Proof Stats */}
                {sd?.has_data && (
                    <Card className="border-gray-200 dark:border-white/5 bg-gradient-to-r from-blue-950/20 via-purple-950/10 to-blue-950/20">
                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-black text-blue-400">{sd.social_proof.total_accounts_monitored}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.accountsMonitored')}</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-purple-400">${(sd.total_debt / 1000).toFixed(0)}K</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.debtOptimized')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* FAQ / Trust Section */}
                <Card className="border-gray-200 dark:border-white/5">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                            <div className="space-y-2">
                                <Shield className="h-6 w-6 text-emerald-500 mx-auto" />
                                <h4 className="text-sm font-semibold">{t('sub.securePlatform')}</h4>
                                <p className="text-xs text-muted-foreground">{t('sub.securePlatformDesc')}</p>
                            </div>
                            <div className="space-y-2">
                                <RefreshCw className="h-6 w-6 text-blue-500 mx-auto" />
                                <h4 className="text-sm font-semibold">{t('sub.cancelAnytime')}</h4>
                                <p className="text-xs text-muted-foreground">{t('sub.cancelAnytimeDesc')}</p>
                            </div>
                            <div className="space-y-2">
                                <Sparkles className="h-6 w-6 text-amber-500 mx-auto" />
                                <h4 className="text-sm font-semibold">{t('sub.allFeaturesIncluded')}</h4>
                                <p className="text-xs text-muted-foreground">{t('sub.allFeaturesDesc')}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Promo Code Section */}
                <Card className="border-gray-200 dark:border-white/5">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                                <Tag className="h-4 w-4 text-amber-500" />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold">{t('sub.promoCode')}</h4>
                                <p className="text-xs text-muted-foreground">{t('sub.promoCodeDesc')}</p>
                            </div>
                        </div>

                        {/* Active Plan Badge */}
                        {grantLine && (
                            <div data-testid="grant-state" className="flex items-center gap-2 p-3 rounded-xl border bg-emerald-500/5 border-emerald-500/20">
                                <CheckCircle size={14} className="text-emerald-500" />
                                <span className="text-sm font-medium">{grantLine}</span>
                            </div>
                        )}
                        {!grantLine && (isDevLicense || (activePlan !== 'starter')) && (
                            <div className={`flex items-center justify-between p-3 rounded-xl border ${isDevLicense
                                ? 'bg-gradient-to-r from-amber-500/5 to-yellow-500/5 border-amber-500/20'
                                : 'bg-emerald-500/5 border-emerald-500/20'
                                }`}>
                                <div className="flex items-center gap-2">
                                    {isDevLicense ? <Crown size={14} className="text-amber-500" /> : <CheckCircle size={14} className="text-emerald-500" />}
                                    <span className="text-sm font-medium">
                                        {isDevLicense ? t('sub.devLicense') : `${t('sub.activePlan')} ${planLabel || activePlan}`}
                                    </span>
                                </div>
                                {!isDevLicense && (
                                    <button
                                        onClick={handleCancelSubscription}
                                        className="text-xs text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        {t('sub.remove')}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Promo Input */}
                        <div className="flex gap-2">
                            <Input
                                value={promoCode}
                                onChange={(e) => {
                                    setPromoCode(e.target.value.toUpperCase());
                                    if (promoStatus !== 'idle') setPromoStatus('idle');
                                }}
                                placeholder={t('sub.promoPlaceholder')}
                                className="flex-1 font-mono tracking-wider uppercase text-sm"
                                onKeyDown={(e) => e.key === 'Enter' && handleApplyPromo()}
                            />
                            <Button
                                onClick={handleApplyPromo}
                                disabled={!promoCode.trim() || promoStatus === 'loading'}
                                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold px-6"
                            >
                                {promoStatus === 'loading' ? (
                                    <RefreshCw size={14} className="animate-spin" />
                                ) : (
                                    t('sub.apply')
                                )}
                            </Button>
                        </div>

                        {/* Status Message */}
                        {promoMessage && (
                            <p className={`text-xs font-medium px-3 py-2 rounded-lg ${promoStatus === 'success'
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : promoStatus === 'error'
                                    ? 'bg-red-500/10 text-red-400'
                                    : ''
                                }`}>
                                {promoMessage}
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Manage / Cancel Subscription */}
                {activePlan !== 'starter' && (
                    <Card className="border-red-500/10">
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                                    <XCircle className="h-4 w-4 text-red-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold">{t('sub.manageSub')}</h4>
                                    <p className="text-xs text-muted-foreground">
                                        {isDevLicense
                                            ? t('sub.devPermanent')
                                            : t('sub.cancelOrChange')}
                                    </p>
                                </div>
                            </div>

                            {!isDevLicense && (
                                <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                    <div>
                                        <p className="text-sm font-medium">{t('sub.cancelSub')}</p>
                                        <p className="text-xs text-muted-foreground">{t('sub.cancelDesc')}</p>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                        onClick={() => {
                                            if (window.confirm(t('sub.cancelConfirm'))) {
                                                handleCancelSubscription();
                                            }
                                        }}
                                    >
                                        {t('sub.cancelPlan')}
                                    </Button>
                                </div>
                            )}

                            {isDevLicense && (
                                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                                    <Crown size={14} className="text-amber-500" />
                                    <span className="text-xs text-amber-500 font-medium">
                                        {t('sub.devLifetime')}
                                    </span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ─── Referral Program ─── */}
                <ReferralProgram />
            </div>
        );
    }

    // ─── Section Map ────────────────────────────────────────────
    const sectionMap: Record<Section, () => React.ReactNode> = {
        profile: renderProfile,
        appearance: renderAppearance,

        notifications: renderNotifications,
        data: renderDataManagement,
        subscription: renderSubscription,
        ai: () => <ConnectAI />,
        about: renderAbout,
    };

    // ═══════════════════════════════════════════════════════════
    //  MAIN RENDER
    // ═══════════════════════════════════════════════════════════
    return (
        <div className="space-y-6 pb-16">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-white">{t("settings.title")}</h1>
                <p className="text-sm text-gray-400 mt-1">{t("settings.subtitle")}</p>
            </div>

            {/* Layout: Sidebar + Content */}
            <div className="flex gap-6">
                {/* Sidebar Nav */}
                <nav className="hidden lg:flex flex-col w-56 shrink-0">
                    <div className="sticky top-6 space-y-1">
                        {NAV_ITEMS.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeSection === item.id
                                    ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    : "text-gray-400 hover:text-white hover:bg-neutral-800/50"
                                    }`}
                            >
                                {item.icon}
                                {t(item.labelKey)}
                            </button>
                        ))}

                        {/* Version badge at bottom */}
                        <div className="pt-6 mt-4 border-t border-neutral-800 dark:border-neutral-700">
                            <div className="flex items-center justify-center gap-2 py-2">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[10px] text-slate-600 font-mono">KoreX v{__APP_VERSION__}</span>
                            </div>
                        </div>
                    </div>
                </nav>

                {/* Mobile Dropdown (visible < lg) */}
                <div className="lg:hidden w-full">
                    <Select value={activeSection} onValueChange={(v) => setActiveSection(v as Section)}>
                        <SelectTrigger className="w-full bg-slate-900 border-neutral-700 text-white dark:bg-neutral-800 dark:border-slate-600 dark:text-gray-100 mb-4">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-neutral-700 dark:bg-neutral-800 dark:border-slate-600">
                            {NAV_ITEMS.map((item) => (
                                <SelectItem key={item.id} value={item.id} className="text-white focus:bg-neutral-800">
                                    {t(item.labelKey)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Content for mobile */}
                    <div className="flex-1 min-w-0">
                        {sectionMap[activeSection]()}
                    </div>
                </div>

                {/* Content Area (desktop) */}
                <div className="hidden lg:block flex-1 min-w-0">
                    {sectionMap[activeSection]()}
                </div>
            </div>
        </div>
    );
}

// ─── Helper Component ───────────────────────────────────────────────
function SectionHeader({ title, subtitle, icon }: { title: string; subtitle: string; icon: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-neutral-800/50 border border-neutral-700/50 dark:bg-neutral-800/60 dark:border-slate-600/50 mt-0.5">
                {icon}
            </div>
            <div>
                <h2 className="text-lg font-bold text-white dark:text-gray-100">{title}</h2>
                <p className="text-sm text-gray-400 dark:text-gray-500">{subtitle}</p>
            </div>
        </div>
    );
}
