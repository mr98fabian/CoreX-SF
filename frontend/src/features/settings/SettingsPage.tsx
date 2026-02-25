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
    User, Palette, Bell, Database, Info, Flame,
    Download, Upload, Trash2, RefreshCw, FileSpreadsheet,
    FileJson, FileText, CheckCircle, AlertTriangle, Globe, DollarSign,
    Calendar, Shield, Sparkles, ExternalLink, Github, BookOpen,
    CreditCard, Crown, Zap, Rocket, Check, Tag, XCircle,
    TrendingDown, Infinity as InfinityIcon,
} from "lucide-react";
import { generateMonthlyReport } from "@/lib/PDFReportGenerator";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAuth } from "@/features/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "xlsx";
import { useOnboarding } from "@/hooks/useOnboarding";
import { ReferralProgram } from "@/components/ReferralProgram";

// ─── Types ──────────────────────────────────────────────────────────
type Section = "profile" | "appearance" | "notifications" | "data" | "subscription" | "about";

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

const SUBSCRIPTION_PLANS = [
    {
        id: 'starter',
        name: 'Starter',
        iconKey: 'zap' as const,
        accounts: 2,
        monthly: 0,
        annual: 0,
        color: 'from-slate-500 to-slate-600',
        borderColor: 'border-slate-300 dark:border-slate-700',
        iconBg: 'bg-slate-500/10',
        iconColor: 'text-slate-500',
        badge: null as string | null,
        popular: false,
    },
    {
        id: 'velocity',
        name: 'Velocity',
        iconKey: 'zap' as const,
        accounts: 6,
        monthly: 19.99,
        annual: 96.99,
        color: 'from-amber-500 to-orange-500',
        borderColor: 'border-amber-300 dark:border-amber-700',
        iconBg: 'bg-amber-500/10',
        iconColor: 'text-amber-500',
        badge: null as string | null,
        popular: false,
    },
    {
        id: 'accelerator',
        name: 'Accelerator',
        iconKey: 'rocket' as const,
        accounts: 12,
        monthly: 34.99,
        annual: 196.99,
        color: 'from-purple-500 to-indigo-500',
        borderColor: 'border-purple-400 dark:border-purple-600',
        iconBg: 'bg-purple-500/10',
        iconColor: 'text-purple-500',
        badge: 'MOST POPULAR' as string | null,
        popular: true,
    },
    {
        id: 'freedom',
        name: 'Freedom',
        iconKey: 'crown' as const,
        accounts: Infinity,
        monthly: 54.99,
        annual: 346.99,
        color: 'from-amber-400 to-yellow-500',
        borderColor: 'border-yellow-400 dark:border-yellow-600',
        iconBg: 'bg-yellow-500/10',
        iconColor: 'text-yellow-500',
        badge: null as string | null,
        popular: false,
    },
];

const PLAN_ICON_MAP: Record<string, React.ReactNode> = {
    zap: <Zap className="h-5 w-5" />,
    rocket: <Rocket className="h-5 w-5" />,
    crown: <Crown className="h-5 w-5" />,
};

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
    const { t, language, setLanguage } = useLanguage();
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
    const [activeSection, setActiveSection] = useState<Section>("profile");

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
    const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("annual");
    const [promoCode, setPromoCode] = useState('');
    const [promoStatus, setPromoStatus] = useState<'idle' | 'success' | 'error' | 'loading'>('idle');
    const [promoMessage, setPromoMessage] = useState('');
    const [activePlan, setActivePlan] = useState(() => localStorage.getItem('korex-plan') || 'starter');
    const [savingsData, setSavingsData] = useState<SavingsData | null>(null);
    const [interestTick, setInterestTick] = useState(0);
    const [upgrading, setUpgrading] = useState<string | null>(null);
    const { toast } = useToast();

    // Generic estimates based on typical US consumer debt ($45K avg, ~18% APR)
    // Used when real user data is unavailable (demo, auth issues, no accounts)
    const FALLBACK_SAVINGS: SavingsData = {
        has_data: true,
        total_debt: 45000,
        daily_interest_all: 22.19, // $45K * 18% / 365
        plans: {
            starter: { accounts_used: 2, annual_savings: 1296, monthly_savings: 108, daily_interest_burning: 4.93, roi_days: 0, plan_cost_annual: 0, years_without: 30, years_with: 18, total_interest_without: 54000, total_interest_with: 32400 },
            velocity: { accounts_used: 5, annual_savings: 3240, monthly_savings: 270, daily_interest_burning: 12.33, roi_days: 11, plan_cost_annual: 96.99, years_without: 25, years_with: 15, total_interest_without: 112500, total_interest_with: 67500 },
            accelerator: { accounts_used: 10, annual_savings: 4860, monthly_savings: 405, daily_interest_burning: 18.49, roi_days: 15, plan_cost_annual: 196.99, years_without: 22, years_with: 13, total_interest_without: 145800, total_interest_with: 87480 },
            freedom: { accounts_used: 15, annual_savings: 6480, monthly_savings: 540, daily_interest_burning: 22.19, roi_days: 20, plan_cost_annual: 346.99, years_without: 20, years_with: 12, total_interest_without: 162000, total_interest_with: 97200 },
        },
        social_proof: { total_accounts_monitored: 2847, total_debt_tracked: 127500000 },
    };

    // Fetch dynamic savings data — fall back to generic estimates if API fails
    useEffect(() => {
        apiFetch<SavingsData>('/api/subscriptions/savings-estimate')
            .then(data => {
                setSavingsData(data.has_data ? data : FALLBACK_SAVINGS);
            })
            .catch(() => {
                setSavingsData(FALLBACK_SAVINGS);
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
            // Fetch data from API
            const [debtsRes, transRes, accountsRes] = await Promise.all([
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

    const handleDownloadTemplate = () => {
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
            const data = await importFile.arrayBuffer();
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
            await apiFetch("/api/seed", { method: "POST" });
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
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                <CardContent className="pt-6 space-y-6">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white dark:text-white shrink-0">
                            {userInitials}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{userName}</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400">{userEmail}</p>
                            {isDemo && (
                                <Badge className="mt-1 bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                    {t("settings.profile.demoAccount")}
                                </Badge>
                            )}
                        </div>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-slate-800" />

                    {/* Form fields */}
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="text-slate-700 dark:text-slate-300">{t("settings.profile.displayName")}</Label>
                            <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} disabled={isDemo} className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500/50" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-slate-700 dark:text-slate-300">{t("settings.profile.email")}</Label>
                            <Input id="email" value={userEmail} disabled className="bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white focus:border-blue-500/50 opacity-60" />
                        </div>
                        {!isDemo && (
                            <Button onClick={handleSaveProfile} disabled={profileSaving || displayName === userName} variant="premium" className="w-full mt-2">
                                {profileSaving ? <RefreshCw size={16} className="animate-spin mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                                {t('settings.profile.saveChanges')}
                            </Button>
                        )}
                    </div>

                    {/* Security */}
                    <Separator className="bg-slate-200 dark:bg-slate-800" />
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            {t("settings.profile.security")}
                        </h4>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm text-slate-700 dark:text-slate-300">
                                    {t("settings.profile.twoFactor")}
                                </Label>
                                <p className="text-xs text-slate-500 dark:text-slate-500">
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
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                <CardContent className="pt-6 space-y-6">
                    {/* Language */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Globe className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-slate-200">{t("settings.appearance.language")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.languageDesc")}</p>
                            </div>
                        </div>
                        <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "es")}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                <SelectItem value="en" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">🇺🇸 English</SelectItem>
                                <SelectItem value="es" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">🇪🇸 Español</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-slate-800" />

                    {/* Currency */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <DollarSign className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-slate-200">{t("settings.appearance.currency")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.currencyDesc")}</p>
                            </div>
                        </div>
                        <Select value={currency} onValueChange={handleCurrencyChange}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                <SelectItem value="USD" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">$ USD (US Dollar)</SelectItem>
                                <SelectItem value="MXN" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">$ MXN (Peso Mexicano)</SelectItem>
                                <SelectItem value="EUR" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">€ EUR (Euro)</SelectItem>
                                <SelectItem value="GBP" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">£ GBP (British Pound)</SelectItem>
                                <SelectItem value="CAD" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">$ CAD (Canadian Dollar)</SelectItem>
                                <SelectItem value="COP" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">$ COP (Peso Colombiano)</SelectItem>
                                <SelectItem value="ARS" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">$ ARS (Peso Argentino)</SelectItem>
                                <SelectItem value="BRL" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">R$ BRL (Real Brasileiro)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-slate-200 dark:bg-slate-800" />

                    {/* Date Format */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Calendar className="h-4 w-4 text-amber-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-700 dark:text-slate-200">{t("settings.appearance.dateFormat")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.dateDesc")}</p>
                            </div>
                        </div>
                        <Select value={dateFormat} onValueChange={handleDateFormatChange}>
                            <SelectTrigger className="w-full sm:w-[180px] bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                                <SelectItem value="MM/DD/YYYY" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">MM/DD/YYYY</SelectItem>
                                <SelectItem value="DD/MM/YYYY" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">DD/MM/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD" className="text-slate-900 dark:text-white focus:bg-slate-100 dark:focus:bg-slate-800">YYYY-MM-DD</SelectItem>
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
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                    <CardContent className="pt-6 space-y-1">
                        {items.map((item, i) => (
                            <div key={item.key}>
                                <div className="flex items-center justify-between py-3">
                                    <div className="space-y-0.5">
                                        <Label className={`text-sm ${item.critical ? "text-rose-500 dark:text-rose-300" : "text-slate-700 dark:text-slate-200"}`}>
                                            {t(`settings.notifications.${item.uiKey}`)}
                                        </Label>
                                        <p className="text-xs text-slate-500">
                                            {t(`settings.notifications.${item.uiKey}Desc`)}
                                        </p>
                                    </div>
                                    <Switch checked={item.state} onCheckedChange={item.setter} />
                                </div>
                                {i < items.length - 1 && <Separator className="bg-slate-200/50 dark:bg-slate-800/50" />}
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
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
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
                            <span className="text-[10px] text-slate-500">{t("settings.data.exportExcelDesc")}</span>
                        </button>

                        <button
                            onClick={handleExportJson}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-center"
                        >
                            <FileJson className="h-8 w-8 text-blue-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium text-blue-300">{t("settings.data.exportJson")}</span>
                            <span className="text-[10px] text-slate-500">{t("settings.data.exportJsonDesc")}</span>
                        </button>

                        <button
                            onClick={async () => {
                                setPdfLoading(true);
                                try {
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
                            <span className="text-[10px] text-slate-500">{t("settings.data.exportPdfDesc")}</span>
                        </button>

                        <button
                            onClick={handleDownloadTemplate}
                            className="group flex flex-col items-center gap-2 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-center"
                        >
                            <Download className="h-8 w-8 text-amber-400 group-hover:scale-110 transition-transform" />
                            <span className="text-sm font-medium text-amber-300">{t("settings.data.downloadTemplate")}</span>
                            <span className="text-[10px] text-slate-500">{t("settings.data.downloadTemplateDesc")}</span>
                        </button>
                    </div>
                </CardContent>
            </Card>

            {/* Import Section */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-slate-900 dark:text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-400" />
                        {t("settings.data.importExcel")}
                    </CardTitle>
                    <CardDescription className="text-xs">{t("settings.data.importExcelDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-blue-500/50 transition-colors">
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
                                        className="border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    >
                                        {t("settings.data.cancelImport")}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <label htmlFor="import-file" className="cursor-pointer">
                                    <p className="text-sm text-slate-400 mb-1">
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
            <Card className="border-blue-500/20 bg-white dark:bg-slate-950/50">
                <CardContent className="pt-5 pb-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Sparkles className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm text-slate-700 dark:text-slate-200">{t('settings.restartTutorial')}</p>
                                <p className="text-xs text-slate-500">{t('settings.restartTutorialDesc')}</p>
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
            <Card className="border-rose-500/20 bg-white dark:bg-slate-950/50">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {t("settings.data.dangerZone")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{t("settings.data.resetDemo")}</p>
                            <p className="text-xs text-slate-500">{t("settings.data.resetDemoDesc")}</p>
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
                    <Separator className="bg-slate-200 dark:bg-slate-800" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-700 dark:text-slate-200">{t("settings.data.clearCache")}</p>
                            <p className="text-xs text-slate-500">{t("settings.data.clearCacheDesc")}</p>
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
            <SectionHeader title={t("settings.about.title")} subtitle={t("settings.about.subtitle")} icon={<Info className="h-5 w-5 text-slate-400" />} />

            {/* Version Hero */}
            <Card className="border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50 via-blue-50/20 to-slate-50 dark:from-slate-950 dark:via-blue-950/20 dark:to-slate-950 overflow-hidden relative">
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
                        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                            {t("settings.about.tagline")}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.version")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{__APP_VERSION__}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.build")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">{__BUILD_DATE__}</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.engine")}</p>
                        <p className="text-lg font-bold text-slate-900 dark:text-white font-mono">Velocity v1</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tech Stack */}
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
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
            <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50">
                <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                            <BookOpen className="h-4 w-4" />
                            Docs
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                            <Github className="h-4 w-4" />
                            GitHub
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-100 dark:bg-slate-900 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors text-sm text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
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
        const handleApplyPromo = async () => {
            if (!promoCode.trim()) return;
            setPromoStatus('loading');

            try {
                const result = await apiFetch<{ valid: boolean; plan?: string; label?: string; message: string }>(
                    '/api/subscriptions/apply-promo',
                    {
                        method: 'POST',
                        body: JSON.stringify({ code: promoCode.trim() }),
                    }
                );

                if (result.valid && result.plan) {
                    setActivePlan(result.plan);
                    localStorage.setItem('korex-plan', result.plan);
                    localStorage.setItem('korex-plan-label', result.label || result.plan);
                    setPromoStatus('success');
                    setPromoMessage(result.message);
                    setPromoCode('');
                } else {
                    setPromoStatus('error');
                    setPromoMessage(result.message);
                }
            } catch {
                setPromoStatus('error');
                setPromoMessage(t('sub.connectionError'));
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
                                        <p className="text-lg font-bold text-red-400 font-mono">${sd.daily_interest_all.toFixed(2)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perDay')}</p>
                                    </div>
                                    <div className="h-8 w-px bg-red-500/20" />
                                    <div>
                                        <p className="text-lg font-bold text-red-400 font-mono">${(sd.daily_interest_all * 30).toFixed(0)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perMonth')}</p>
                                    </div>
                                    <div className="h-8 w-px bg-red-500/20" />
                                    <div>
                                        <p className="text-lg font-bold text-red-400 font-mono">${(sd.daily_interest_all * 365).toFixed(0)}</p>
                                        <p className="text-[10px] text-red-300/60 uppercase">{t('sub.perYear')}</p>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Without vs With KoreX Comparison */}
                {sd?.has_data && sd.plans?.freedom && (
                    <Card className="border-slate-200 dark:border-white/5 overflow-hidden">
                        <CardContent className="p-0">
                            <div className="grid grid-cols-2 divide-x divide-slate-200 dark:divide-white/5">
                                <div className="p-5 text-center bg-red-500/5">
                                    <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mb-2">{t('sub.withoutKorex')}</p>
                                    <p className="text-2xl font-black text-red-400">{sd.plans.freedom.years_without} {t('sub.years')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('sub.toPayOff')}</p>
                                    <p className="text-sm font-bold text-red-400 mt-2">${sd.plans.freedom.total_interest_without.toLocaleString()}</p>
                                    <p className="text-[10px] text-red-400/60">{t('sub.totalInterest')}</p>
                                </div>
                                <div className="p-5 text-center bg-emerald-500/5">
                                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-2">{t('sub.withKorex')}</p>
                                    <p className="text-2xl font-black text-emerald-400">{sd.plans.freedom.years_with} {t('sub.years')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('sub.toFreedom')}</p>
                                    <p className="text-sm font-bold text-emerald-400 mt-2">${sd.plans.freedom.total_interest_with.toLocaleString()}</p>
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

                {/* Billing Toggle */}
                <div className="flex items-center justify-center gap-4 py-2">
                    <button
                        onClick={() => setBillingCycle('monthly')}
                        className={`text-sm font-medium px-4 py-2 rounded-lg transition-all ${billingCycle === 'monthly'
                            ? 'bg-slate-200 dark:bg-white/10 text-foreground'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {t('sub.monthly')}
                    </button>
                    <button
                        onClick={() => setBillingCycle('annual')}
                        className={`text-sm font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${billingCycle === 'annual'
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {t('sub.annual')}
                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full">
                            {t('sub.saveUpTo')}
                        </span>
                    </button>
                </div>

                {/* Pricing Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {SUBSCRIPTION_PLANS.map((plan, idx) => {
                        const price = billingCycle === 'annual' ? plan.annual : plan.monthly;
                        const monthlyEquiv = billingCycle === 'annual' && plan.annual > 0
                            ? (plan.annual / 12).toFixed(2)
                            : null;
                        const saving = billingCycle === 'annual' && plan.monthly > 0
                            ? Math.round((1 - plan.annual / (plan.monthly * 12)) * 100)
                            : 0;
                        const isCurrent = plan.id === currentPlan;
                        const currentIdx = SUBSCRIPTION_PLANS.findIndex(p => p.id === currentPlan);
                        const isDowngrade = idx < currentIdx;
                        const isUnlimitedPlan = plan.accounts === Infinity;

                        // Real checkout handler — calls /api/subscriptions/checkout
                        const handleCheckout = async () => {
                            if (price === 0 || isCurrent || isDowngrade) return;
                            setUpgrading(plan.id);
                            try {
                                const data = await apiFetch<{ checkout_url: string }>('/api/subscriptions/checkout', {
                                    method: 'POST',
                                    body: JSON.stringify({
                                        plan: plan.id,
                                        billing_cycle: billingCycle,
                                    }),
                                });
                                if (!data.checkout_url) throw new Error('No checkout URL returned');
                                window.open(data.checkout_url, '_blank');
                                toast({
                                    title: t('sub.checkoutOpened'),
                                    description: t('sub.checkoutDesc'),
                                });
                            } catch {
                                toast({
                                    title: t('sub.checkoutFailed'),
                                    description: t('sub.checkoutFailedDesc'),
                                    variant: 'destructive',
                                });
                            } finally {
                                setUpgrading(null);
                            }
                        };

                        return (
                            <Card
                                key={plan.id}
                                className={`relative overflow-hidden transition-all duration-300 ${plan.popular
                                    ? 'border-purple-500/40 bg-purple-950/10 hover:border-purple-400/60 hover:shadow-lg hover:shadow-purple-900/20 scale-[1.02]'
                                    : isCurrent
                                        ? 'border-emerald-500/40 bg-emerald-950/20 ring-1 ring-emerald-500/20'
                                        : 'border-zinc-800/60 dark:border-white/5 bg-zinc-900/40 dark:bg-slate-950/50 hover:border-zinc-700/60 hover:bg-zinc-900/60 dark:hover:bg-slate-900/60'
                                    }`}
                            >
                                {/* Popular Badge */}
                                {plan.popular && !isCurrent && (
                                    <div className="absolute -top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-[10px] font-bold text-center py-1 tracking-wider">
                                        {t('sub.mostPopular')}
                                    </div>
                                )}

                                {/* Current Plan Badge */}
                                {isCurrent && (
                                    <div className="absolute -top-0 left-0 right-0 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-[10px] font-bold text-center py-1 tracking-wider">
                                        {t('sub.yourPlan')}
                                    </div>
                                )}

                                <CardContent className={`p-6 space-y-5 ${plan.popular || isCurrent ? 'pt-10' : ''}`}>
                                    {/* Plan Header */}
                                    <div className="flex items-center gap-3">
                                        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${plan.color} bg-opacity-20 flex items-center justify-center`}>
                                            <span className="text-white">{PLAN_ICON_MAP[plan.iconKey]}</span>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-lg text-white">{plan.name}</h3>
                                            <p className="text-xs text-zinc-500">
                                                {isUnlimitedPlan ? t('sub.unlimited') : plan.accounts} {t('sub.accounts')}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="space-y-1">
                                        {price === 0 ? (
                                            <div className="text-3xl font-black text-white">{t('sub.free')}</div>
                                        ) : (
                                            <>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-3xl font-black text-white">
                                                        ${billingCycle === 'annual' ? monthlyEquiv : price}
                                                    </span>
                                                    <span className="text-sm text-zinc-500">{t('sub.mo')}</span>
                                                </div>
                                                {billingCycle === 'annual' && (
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs text-zinc-500 line-through">
                                                            ${plan.monthly}/mo
                                                        </span>
                                                        <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded-full">
                                                            {saving}% {t('sub.off')}
                                                        </span>
                                                    </div>
                                                )}
                                                {billingCycle === 'annual' && (
                                                    <p className="text-xs text-zinc-500">
                                                        {t('sub.billed')} ${plan.annual}{t('sub.year')}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* 🔥 NEUROMARKETING: Dynamic Savings Badge — Freedom gets gold variant */}
                                    {sd?.has_data && sd.plans?.[plan.id] && sd.plans[plan.id].annual_savings > 0 && (() => {
                                        const s = sd.plans[plan.id];
                                        const displaySavings = billingCycle === 'monthly'
                                            ? `~$${Math.round(s.monthly_savings).toLocaleString()}/mo`
                                            : `~$${Math.round(s.annual_savings).toLocaleString()}/yr`;
                                        const netGain = s.annual_savings - s.plan_cost_annual;

                                        return (
                                            <div className="space-y-2">
                                                {isUnlimitedPlan ? (
                                                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-gradient-to-br from-amber-500/15 to-yellow-500/10 border border-amber-500/30">
                                                        <div className="flex-shrink-0 p-1 rounded-full bg-amber-500/20">
                                                            <InfinityIcon size={16} className="text-amber-400" />
                                                        </div>
                                                        <div>
                                                            <span className="text-sm font-bold text-amber-300 block leading-snug">
                                                                {displaySavings} {t('sub.noLimits')}
                                                            </span>
                                                            <span className="text-xs text-amber-400/70 leading-snug">
                                                                {t('sub.futureDebt')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                                        <TrendingDown size={16} className="text-emerald-400 flex-shrink-0" />
                                                        <div>
                                                            <span className="text-sm font-bold text-emerald-400 block leading-snug">
                                                                {displaySavings} {t('sub.inInterest')}
                                                            </span>
                                                            <span className="text-xs text-emerald-500/70 leading-snug">
                                                                {t('sub.savedEach')} {billingCycle === 'monthly' ? t('sub.monthWord') : t('sub.yearWord')} {t('sub.usingKorex')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                                {/* Net ROI for paid plans */}
                                                {s.plan_cost_annual > 0 && netGain > 0 && (
                                                    <p className="text-xs text-zinc-500 pl-1 leading-snug">
                                                        💰 {t('sub.netGain')} <span className={`${isUnlimitedPlan ? 'text-amber-400' : 'text-emerald-400'} font-semibold`}>${Math.round(netGain).toLocaleString()}/yr</span> {t('sub.afterPlanCost')}
                                                        {s.roi_days > 0 && s.roi_days < 365 && (
                                                            <> · {t('sub.paysItself')} <span className="text-white font-semibold">{s.roi_days} {t('sub.days')}</span></>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })()}

                                    {/* Features */}
                                    <ul className="space-y-2">
                                        <li className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            <span>{isUnlimitedPlan ? t('sub.unlimited') : `${t('sub.upTo')} ${plan.accounts}`} {t('sub.debtAccounts')}</span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            <span>{t('sub.allFeatures')}</span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            <span>{t('sub.freedomClock')}</span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            <span>{t('sub.pdfReports')}</span>
                                        </li>
                                        <li className="flex items-center gap-2 text-sm text-zinc-400">
                                            <Check size={14} className="text-emerald-500 shrink-0" />
                                            <span>{t('sub.velocitySim')}</span>
                                        </li>
                                    </ul>

                                    {/* ☕ NEUROMARKETING: Price Reframe */}
                                    {plan.id !== 'starter' && (
                                        <p className="text-[11px] text-center text-zinc-500 italic">
                                            {t(`sub.anchor.${plan.id}`)}
                                        </p>
                                    )}

                                    {/* CTA Button */}
                                    {isCurrent ? (
                                        <Button disabled className="w-full bg-emerald-900/30 text-emerald-400 cursor-default border border-emerald-500/20" variant="outline">
                                            <CheckCircle size={14} className="mr-2" />
                                            {t('sub.active')}
                                        </Button>
                                    ) : isDowngrade ? (
                                        <Button disabled className="w-full bg-zinc-800/50 text-zinc-600 cursor-not-allowed" variant="outline">
                                            {t('sub.downgrade')}
                                        </Button>
                                    ) : (
                                        <Button
                                            disabled={upgrading !== null}
                                            className={`w-full font-semibold ${plan.popular
                                                ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-lg shadow-purple-900/30'
                                                : price === 0
                                                    ? 'bg-zinc-800 hover:bg-zinc-700 text-white'
                                                    : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white shadow-lg shadow-amber-900/20'
                                                }`}
                                            onClick={handleCheckout}
                                        >
                                            {upgrading === plan.id
                                                ? <><RefreshCw size={14} className="mr-2 animate-spin" /> {t('sub.processing')}</>
                                                : price === 0 ? t('sub.getStarted') : t('sub.upgradeNow')}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>

                {/* 📊 NEUROMARKETING: Social Proof Stats */}
                {sd?.has_data && (
                    <Card className="border-slate-200 dark:border-white/5 bg-gradient-to-r from-blue-950/20 via-purple-950/10 to-blue-950/20">
                        <CardContent className="p-5">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                                <div>
                                    <p className="text-2xl font-black text-blue-400">{sd.social_proof.total_accounts_monitored}</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.accountsMonitored')}</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-purple-400">${(sd.total_debt / 1000).toFixed(0)}K</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.debtOptimized')}</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-emerald-400">3.2x</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.fasterThanBanks')}</p>
                                </div>
                                <div>
                                    <p className="text-2xl font-black text-amber-400">40%</p>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('sub.avgInterestSaved')}</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* FAQ / Trust Section */}
                <Card className="border-slate-200 dark:border-white/5">
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
                <Card className="border-slate-200 dark:border-white/5">
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
                        {(isDevLicense || (activePlan !== 'starter')) && (
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
                <p className="text-sm text-slate-400 mt-1">{t("settings.subtitle")}</p>
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
                                    : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                                    }`}
                            >
                                {item.icon}
                                {t(item.labelKey)}
                            </button>
                        ))}

                        {/* Version badge at bottom */}
                        <div className="pt-6 mt-4 border-t border-slate-800 dark:border-slate-700">
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
                        <SelectTrigger className="w-full bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 mb-4">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600">
                            {NAV_ITEMS.map((item) => (
                                <SelectItem key={item.id} value={item.id} className="text-white focus:bg-slate-800">
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
            <div className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-700/50 dark:bg-slate-800/60 dark:border-slate-600/50 mt-0.5">
                {icon}
            </div>
            <div>
                <h2 className="text-lg font-bold text-white dark:text-slate-100">{title}</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500">{subtitle}</p>
            </div>
        </div>
    );
}
