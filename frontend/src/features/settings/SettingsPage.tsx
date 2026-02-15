import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    User, Palette, Brain, Bell, Database, Info, Flame,
    Download, Upload, Trash2, RefreshCw, FileSpreadsheet,
    FileJson, FileText, CheckCircle, AlertTriangle, Globe, DollarSign,
    Calendar, Shield, Sparkles, ExternalLink, Github, BookOpen,
} from "lucide-react";
import { generateMonthlyReport } from "@/lib/PDFReportGenerator";
import { usePageTitle } from "@/hooks/usePageTitle";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiFetch } from "@/lib/api";
import * as XLSX from "xlsx";

// ─── Types ──────────────────────────────────────────────────────────
type Section = "profile" | "appearance" | "algorithm" | "notifications" | "data" | "about";

interface NavItem {
    id: Section;
    labelKey: string;
    icon: React.ReactNode;
}

// ─── Constants ──────────────────────────────────────────────────────
const NAV_ITEMS: NavItem[] = [
    { id: "profile", labelKey: "settings.nav.profile", icon: <User className="h-4 w-4" /> },
    { id: "appearance", labelKey: "settings.nav.appearance", icon: <Palette className="h-4 w-4" /> },
    { id: "algorithm", labelKey: "settings.nav.algorithm", icon: <Brain className="h-4 w-4" /> },
    { id: "notifications", labelKey: "settings.nav.notifications", icon: <Bell className="h-4 w-4" /> },
    { id: "data", labelKey: "settings.nav.data", icon: <Database className="h-4 w-4" /> },
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

// ═══════════════════════════════════════════════════════════════════
//  SETTINGS PAGE
// ═══════════════════════════════════════════════════════════════════
export default function SettingsPage() {
    usePageTitle("Settings");
    const { t, language, setLanguage } = useLanguage();

    // ─── Local state ────────────────────────────────────────────
    const [activeSection, setActiveSection] = useState<Section>("profile");
    const [emergencyFund, setEmergencyFund] = useState([3000]);
    const [strategyMode, setStrategyMode] = useState<"balanced" | "aggressive">("aggressive");
    const [currency, setCurrency] = useState(() => localStorage.getItem("corex-currency") || "USD");
    const [dateFormat, setDateFormat] = useState(() => localStorage.getItem("corex-date-format") || "MM/DD/YYYY");
    const [exportLoading, setExportLoading] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const [resetLoading, setResetLoading] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Notification states
    const [notifPayment, setNotifPayment] = useState(true);
    const [notifDaily, setNotifDaily] = useState(false);
    const [notifBank, setNotifBank] = useState(true);
    const [notifMilestones, setNotifMilestones] = useState(true);
    const [notifWeekly, setNotifWeekly] = useState(false);

    // ─── Handlers ───────────────────────────────────────────────
    const handleCurrencyChange = (val: string) => {
        setCurrency(val);
        localStorage.setItem("corex-currency", val);
    };

    const handleDateFormatChange = (val: string) => {
        setDateFormat(val);
        localStorage.setItem("corex-date-format", val);
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

            XLSX.writeFile(wb, `CoreX_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
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
            a.download = `CoreX_Backup_${new Date().toISOString().slice(0, 10)}.json`;
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

        XLSX.writeFile(wb, "CoreX_Import_Template.xlsx");
    };

    const handleImportExcel = async () => {
        if (!importFile) return;
        try {
            const data = await importFile.arrayBuffer();
            const wb = XLSX.read(data);
            const sheetNames = wb.SheetNames;

            for (const name of sheetNames) {
                const sheet = wb.Sheets[name];
                const json = XLSX.utils.sheet_to_json(sheet);
                console.log(`[Import] Sheet "${name}":`, json.length, "rows");
                // Future: POST each sheet's data to the appropriate endpoint
            }
            setImportFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
            alert(`✅ ${t("settings.data.importSuccess").replace("{count}", String(sheetNames.length))}`);

        } catch (err) {
            console.error("Import failed:", err);
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
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardContent className="pt-6 space-y-6">
                    {/* Avatar + Name */}
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white dark:text-white shrink-0">
                            CM
                        </div>
                        <div className="flex-1">
                            <h3 className="text-lg font-semibold text-white dark:text-slate-100">Carlos Mendoza</h3>
                            <p className="text-sm text-slate-400 dark:text-slate-500">carlos@demo.corex.io</p>
                            <Badge className="mt-1 bg-amber-500/10 text-amber-400 border-amber-500/20 text-[10px]">
                                {t("settings.profile.demoAccount")}
                            </Badge>
                        </div>
                    </div>

                    <Separator className="bg-slate-800 dark:bg-slate-700" />

                    {/* Form fields */}
                    <div className="grid gap-4">
                        <div className="grid gap-2">
                            <Label htmlFor="name" className="text-slate-300 dark:text-slate-300">{t("settings.profile.displayName")}</Label>
                            <Input id="name" defaultValue="Carlos Mendoza" className="bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:border-blue-500/50" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="email" className="text-slate-300 dark:text-slate-300">{t("settings.profile.email")}</Label>
                            <Input id="email" defaultValue="carlos@demo.corex.io" className="bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100 focus:border-blue-500/50" />
                        </div>
                    </div>

                    {/* Security */}
                    <Separator className="bg-slate-800 dark:bg-slate-700" />
                    <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-white dark:text-slate-100 flex items-center gap-2">
                            <Shield className="h-4 w-4 text-emerald-500" />
                            {t("settings.profile.security")}
                        </h4>
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label className="text-sm text-slate-200 dark:text-slate-300">
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
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardContent className="pt-6 space-y-6">
                    {/* Language */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
                                <Globe className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-200">{t("settings.appearance.language")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.languageDesc")}</p>
                            </div>
                        </div>
                        <Select value={language} onValueChange={(v) => setLanguage(v as "en" | "es")}>
                            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600">
                                <SelectItem value="en" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">🇺🇸 English</SelectItem>
                                <SelectItem value="es" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">🇪🇸 Español</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-slate-800 dark:bg-slate-700" />

                    {/* Currency */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                                <DollarSign className="h-4 w-4 text-emerald-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-200">{t("settings.appearance.currency")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.currencyDesc")}</p>
                            </div>
                        </div>
                        <Select value={currency} onValueChange={handleCurrencyChange}>
                            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600">
                                <SelectItem value="USD" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">$ USD (US Dollar)</SelectItem>
                                <SelectItem value="MXN" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">$ MXN (Peso Mexicano)</SelectItem>
                                <SelectItem value="EUR" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">€ EUR (Euro)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <Separator className="bg-slate-800 dark:bg-slate-700" />

                    {/* Date Format */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                                <Calendar className="h-4 w-4 text-amber-400" />
                            </div>
                            <div>
                                <Label className="text-sm text-slate-200">{t("settings.appearance.dateFormat")}</Label>
                                <p className="text-xs text-slate-500">{t("settings.appearance.dateDesc")}</p>
                            </div>
                        </div>
                        <Select value={dateFormat} onValueChange={handleDateFormatChange}>
                            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600">
                                <SelectItem value="MM/DD/YYYY" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">MM/DD/YYYY</SelectItem>
                                <SelectItem value="DD/MM/YYYY" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">DD/MM/YYYY</SelectItem>
                                <SelectItem value="YYYY-MM-DD" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">YYYY-MM-DD</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const renderAlgorithm = () => (
        <div className="space-y-6">
            <SectionHeader title={t("settings.algorithm.title")} subtitle={t("settings.algorithm.subtitle")} icon={<Brain className="h-5 w-5 text-blue-400" />} />
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardContent className="pt-6 space-y-6">
                    {/* Strategy Mode */}
                    <div className="space-y-3">
                        <Label className="text-sm text-slate-200">{t("settings.algorithm.strategyMode")}</Label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                onClick={() => setStrategyMode("balanced")}
                                className={`rounded-xl border-2 p-4 text-left transition-all ${strategyMode === "balanced"
                                    ? "border-blue-500 bg-blue-950/30 ring-1 ring-blue-500/30"
                                    : "border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600"
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-blue-400" />
                                    <span className="font-semibold text-white">{t("settings.algorithm.balanced")}</span>
                                    {strategyMode === "balanced" && <CheckCircle className="h-4 w-4 text-blue-400 ml-auto" />}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{t("settings.algorithm.balancedDesc")}</p>
                            </button>
                            <button
                                onClick={() => setStrategyMode("aggressive")}
                                className={`rounded-xl border-2 p-4 text-left transition-all relative ${strategyMode === "aggressive"
                                    ? "border-orange-500 bg-orange-950/20 ring-1 ring-orange-500/30"
                                    : "border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-slate-600"
                                    }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Flame className="h-4 w-4 text-orange-400" />
                                    <span className="font-semibold text-white">{t("settings.algorithm.aggressive")}</span>
                                    {strategyMode === "aggressive" && <CheckCircle className="h-4 w-4 text-orange-400 ml-auto" />}
                                </div>
                                <p className="text-xs text-slate-400 mt-1">{t("settings.algorithm.aggressiveDesc")}</p>
                            </button>
                        </div>
                    </div>

                    <Separator className="bg-slate-800 dark:bg-slate-700" />

                    {/* Emergency Fund */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm text-slate-200">{t("settings.algorithm.emergencyFund")}</Label>
                            <span className="font-mono text-emerald-400 font-bold text-lg">${emergencyFund[0].toLocaleString()}</span>
                        </div>
                        <Slider defaultValue={[3000]} max={20000} step={100} className="py-2" onValueChange={setEmergencyFund} />
                        <p className="text-xs text-slate-500">{t("settings.algorithm.emergencyDesc")}</p>
                    </div>

                    <Separator className="bg-slate-800 dark:bg-slate-700" />

                    {/* Paycheck Frequency */}
                    <div className="flex items-center justify-between">
                        <Label className="text-sm text-slate-200">{t("settings.algorithm.paycheck")}</Label>
                        <Select defaultValue="biweekly">
                            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-white dark:bg-slate-800 dark:border-slate-600 dark:text-slate-100">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-700 dark:bg-slate-800 dark:border-slate-600">
                                <SelectItem value="weekly" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">{t("settings.algorithm.weekly")}</SelectItem>
                                <SelectItem value="biweekly" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">{t("settings.algorithm.biweekly")}</SelectItem>
                                <SelectItem value="monthly" className="text-white focus:bg-slate-800 dark:focus:bg-slate-700">{t("settings.algorithm.monthly")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>
        </div>
    );

    const renderNotifications = () => {
        const items = [
            { key: "paymentDue", state: notifPayment, setter: setNotifPayment, critical: false },
            { key: "dailySummary", state: notifDaily, setter: setNotifDaily, critical: false },
            { key: "bankDisconnect", state: notifBank, setter: setNotifBank, critical: true },
            { key: "milestones", state: notifMilestones, setter: setNotifMilestones, critical: false },
            { key: "weeklyReport", state: notifWeekly, setter: setNotifWeekly, critical: false },
        ];

        return (
            <div className="space-y-6">
                <SectionHeader title={t("settings.notifications.title")} subtitle={t("settings.notifications.subtitle")} icon={<Bell className="h-5 w-5 text-amber-400" />} />
                <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                    <CardContent className="pt-6 space-y-1">
                        {items.map((item, i) => (
                            <div key={item.key}>
                                <div className="flex items-center justify-between py-3">
                                    <div className="space-y-0.5">
                                        <Label className={`text-sm ${item.critical ? "text-rose-300" : "text-slate-200"}`}>
                                            {t(`settings.notifications.${item.key}`)}
                                        </Label>
                                        <p className="text-xs text-slate-500">
                                            {t(`settings.notifications.${item.key}Desc`)}
                                        </p>
                                    </div>
                                    <Switch checked={item.state} onCheckedChange={item.setter} />
                                </div>
                                {i < items.length - 1 && <Separator className="bg-slate-800/50 dark:bg-slate-700/50" />}
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
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
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
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white flex items-center gap-2">
                        <Upload className="h-4 w-4 text-blue-400" />
                        {t("settings.data.importExcel")}
                    </CardTitle>
                    <CardDescription className="text-xs">{t("settings.data.importExcelDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-blue-500/50 transition-colors">
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
                                        className="border-slate-700 text-slate-300 hover:bg-slate-800"
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

            {/* Danger Zone */}
            <Card className="border-rose-500/20 bg-slate-950/50 dark:border-rose-500/30 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        {t("settings.data.dangerZone")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200">{t("settings.data.resetDemo")}</p>
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
                    <Separator className="bg-slate-800 dark:bg-slate-700" />
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-slate-200">{t("settings.data.clearCache")}</p>
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
            <Card className="border-slate-800 bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 dark:border-slate-700 dark:from-slate-900 dark:via-blue-950/30 dark:to-slate-900 overflow-hidden relative">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <CardContent className="pt-6 pb-8">
                    <div className="text-center space-y-4">
                        <div className="inline-flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">
                                {t("settings.about.financialSystem")}
                            </span>
                        </div>
                        <h2 className="text-4xl font-bold text-white tracking-tight">
                            CoreX <span className="text-blue-400">v1.0.0</span>
                        </h2>
                        <p className="text-sm text-slate-400 dark:text-slate-500 max-w-md mx-auto">
                            {t("settings.about.tagline")}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.version")}</p>
                        <p className="text-lg font-bold text-white font-mono">1.0.0</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.build")}</p>
                        <p className="text-lg font-bold text-white font-mono">Feb 2026</p>
                    </CardContent>
                </Card>
                <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                    <CardContent className="pt-4 pb-4 text-center">
                        <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{t("settings.about.engine")}</p>
                        <p className="text-lg font-bold text-white font-mono">Velocity v3</p>
                    </CardContent>
                </Card>
            </div>

            {/* Tech Stack */}
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-white">{t("settings.about.techStack")}</CardTitle>
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
            <Card className="border-slate-800 bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900/60">
                <CardContent className="pt-4 pb-4">
                    <div className="grid grid-cols-3 gap-3">
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors text-sm text-slate-300 hover:text-white">
                            <BookOpen className="h-4 w-4" />
                            Docs
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors text-sm text-slate-300 hover:text-white">
                            <Github className="h-4 w-4" />
                            GitHub
                        </a>
                        <a href="#" className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors text-sm text-slate-300 hover:text-white">
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

    // ─── Section Map ────────────────────────────────────────────
    const sectionMap: Record<Section, () => React.ReactNode> = {
        profile: renderProfile,
        appearance: renderAppearance,
        algorithm: renderAlgorithm,
        notifications: renderNotifications,
        data: renderDataManagement,
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
                                <span className="text-[10px] text-slate-600 font-mono">CoreX v1.0.0</span>
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
