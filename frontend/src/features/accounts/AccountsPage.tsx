import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { emitDataChanged, useDataSync } from '@/lib/dataSync';
import { getUserPlan, getPlanLimit, getPlanName, syncPlanFromBackend } from '@/lib/planLimits';
import { useForm } from 'react-hook-form';
import { usePageTitle } from '@/hooks/usePageTitle';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, CreditCard, Landmark, Trash2, Loader2, AlertCircle, RefreshCw, Crown, Lock, ArrowUpRight, Flame, ShieldAlert, Lightbulb } from 'lucide-react';
import { BANK_NAMES, getCardsByBank, getNationalAverageAPR, type CardAPRInfo } from '@/lib/creditCardAPRs';
import { Skeleton } from '@/components/ui/skeleton';
import { CashflowManager } from './components/CashflowManager';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFormatMoney } from '@/hooks/useFormatMoney';
import UpgradeModal from '@/components/UpgradeModal';
import { WidgetHelp } from '@/components/WidgetHelp';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

// Loan subtype → interest_type mapping (auto-inferred)
const REVOLVING_SUBTYPES = ["credit_card", "heloc"];
const inferInterestType = (subtype: string) => REVOLVING_SUBTYPES.includes(subtype) ? "revolving" : "fixed";

// Validation Schema
const accountFormSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters." }),
    type: z.enum(["debt", "checking", "savings"]),
    balance: z.coerce.number().min(0, { message: "Balance cannot be negative." }),
    interest_rate: z.coerce.number().min(0).default(0),
    payment_frequency: z.enum(["monthly", "biweekly", "weekly"]).default("monthly"),
    min_payment: z.coerce.number().min(0).default(0),
    due_day: z.coerce.number().min(1).max(31).optional(),
    closing_day: z.coerce.number().min(1).max(31).optional(),
    credit_limit: z.coerce.number().min(0).optional(),
    // Loan Classification — interest_type is auto-inferred from debt_subtype
    debt_subtype: z.enum(["credit_card", "heloc", "auto_loan", "mortgage", "personal_loan", "student_loan"]).default("credit_card"),
});

const transactionFormSchema = z.object({
    description: z.string().min(2, "Description required"),
    amount: z.coerce.number().positive("Amount must be positive"),
    category: z.string().default("general"),
    type: z.enum(["expense", "income", "payment"]), // payment is for debt
});

type AccountFormValues = z.infer<typeof accountFormSchema>;
type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// Interfaces
interface Account {
    id: number;
    name: string;
    type: string;
    balance: number;
    interest_rate: number;
    min_payment: number;
    due_day?: number;
    closing_day?: number;
    payment_frequency: string;
    plaid_account_id?: string;
    interest_type?: string;
    debt_subtype?: string;
    original_amount?: number;
    loan_term_months?: number;
    remaining_months?: number;
    credit_limit?: number;
}

interface Transaction {
    id: number;
    account_id: number;
    date: string;
    amount: number;
    description: string;
    category: string;
}

export default function AccountsPage() {
    usePageTitle('Accounts');
    const { t, language } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [updatingAccount, setUpdatingAccount] = useState<Account | null>(null);
    const [cashflowRefreshKey, setCashflowRefreshKey] = useState(0);


    // Form Setup
    const form = useForm<AccountFormValues>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(accountFormSchema) as any,
        defaultValues: {
            name: "",
            type: "debt",
            balance: 0,
            interest_rate: 0,
            min_payment: 0,
            due_day: 1,
            closing_day: 15,
            payment_frequency: "monthly",
            debt_subtype: "credit_card",
        },
    });

    const watchType = form.watch("type");
    const watchDebtSubtype = form.watch("debt_subtype");
    const isRevolvingDebt = REVOLVING_SUBTYPES.includes(watchDebtSubtype);

    // APR suggestion state
    const [showAPRSuggestions, setShowAPRSuggestions] = useState(false);
    const [selectedBank, setSelectedBank] = useState<string | null>(null);

    // API Functions
    const fetchAccounts = async () => {
        try {
            setErrorMsg(null);
            const data = await apiFetch<any[]>('/api/accounts');
            const safeData = data.map((acc: any) => ({
                ...acc,
                balance: Number(acc.balance),
                interest_rate: Number(acc.interest_rate),
                min_payment: Number(acc.min_payment)
            }));
            setAccounts(safeData);
            // Trigger cashflow refetch so Debt Obligations section stays in sync
            setCashflowRefreshKey(prev => prev + 1);
        } catch (err) {
            console.error(err);
            setErrorMsg(t("accounts.errorConnecting"));
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
        syncPlanFromBackend(); // Sync plan from backend on mount
    }, []);

    // Listen for data changes from Dashboard or Strategy pages
    useDataSync('accounts', () => {
        fetchAccounts();
    });

    const onSubmit = async (values: AccountFormValues) => {
        // Guard: check account limit for debt accounts
        if (values.type === 'debt') {
            const max = getPlanLimit();
            if (debts.length >= max) {
                setErrorMsg(`${t('accounts.limitReached')} (${debts.length}/${max}). ${t('accounts.limitReachedDesc')}`);
                return;
            }
        }
        setIsSubmitting(true);
        try {
            // Auto-infer interest_type from debt_subtype
            const payload = {
                ...values,
                interest_type: values.type === "debt" ? inferInterestType(values.debt_subtype) : undefined,
            };
            await apiFetch('/api/accounts', {
                method: 'POST',
                body: JSON.stringify(payload),
            });

            await fetchAccounts();
            setIsDialogOpen(false);
            form.reset();
            toast({ title: t("accounts.accountCreated"), description: t("accounts.accountCreatedDesc") });
            emitDataChanged('accounts');
        } catch (err) {
            console.error(err);
            setErrorMsg(t("accounts.failedCreate"));
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async (id: number) => {
        if (!confirm(t("accounts.deleteConfirm"))) return;
        try {
            await apiFetch(`/api/accounts/${id}`, { method: 'DELETE' });
            setAccounts(prev => prev.filter(a => a.id !== id));
            toast({ title: t("accounts.accountDeleted"), variant: "destructive" });
            emitDataChanged('accounts');
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const handleResetSystem = async () => {
        try {
            await apiFetch('/api/accounts', { method: 'DELETE' });
            setAccounts([]);
            toast({ title: t("accounts.systemReset"), description: t("accounts.systemResetDesc") });
            emitDataChanged('accounts');
        } catch (e) {
            console.error("Reset failed", e);
        }
    };

    // Derived State
    const debts = accounts.filter(a => a.type === 'debt');
    const assets = accounts.filter(a => ['checking', 'savings', 'investment'].includes(a.type));

    // ─── Plan Limit Logic (from centralized planLimits.ts) ─────────
    const userPlan = getUserPlan();
    const planLimit = getPlanLimit(userPlan);
    const planName = getPlanName(userPlan);
    const debtCount = debts.length;
    const isAtLimit = debtCount >= planLimit;
    const isNearLimit = planLimit !== Infinity && debtCount >= Math.floor(planLimit * 0.8);
    const usagePercent = planLimit === Infinity ? 0 : Math.min((debtCount / planLimit) * 100, 100);
    const isDevLicense = userPlan === 'freedom-dev';

    // ─── Smart Lock Priority ──────────────────────────────────────
    // Sort by APR descending so highest-interest accounts stay ACTIVE
    const sortedDebts = [...debts].sort((a, b) => b.interest_rate - a.interest_rate);
    // Active debts = sortedDebts.slice(0, planLimit) — used implicitly via lockedDebts inverse
    const lockedDebts = planLimit === Infinity ? [] : sortedDebts.slice(planLimit);
    const lockedIds = new Set(lockedDebts.map(d => d.id));

    // Locked accounts summary stats (for banner + badges)
    const lockedTotalDebt = lockedDebts.reduce((sum, d) => sum + d.balance, 0);
    const lockedDailyInterest = lockedDebts.reduce(
        (sum, d) => sum + (d.balance * d.interest_rate / 100 / 365), 0
    );

    // Upgrade modal state
    const [showUpgradeModal, setShowUpgradeModal] = useState(false);

    if (isLoading) {
        return (
            <div className="container mx-auto p-6 space-y-10 animate-in fade-in duration-500 max-w-7xl pb-20">
                {/* Header skeleton */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-72" />
                        <Skeleton className="h-5 w-56" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton className="h-10 w-10 rounded-md" />
                        <Skeleton className="h-10 w-32 rounded-md" />
                        <Skeleton className="h-10 w-36 rounded-md" />
                    </div>
                </div>

                <div className="space-y-12">
                    {/* Liabilities skeleton */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-white/5">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-28" />
                                <Skeleton className="h-4 w-48" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(3)].map((_, i) => (
                                <Card key={i} className="p-6 space-y-4">
                                    <div className="flex justify-between">
                                        <Skeleton className="h-5 w-32" />
                                        <Skeleton className="h-5 w-20" />
                                    </div>
                                    <Skeleton className="h-8 w-36" />
                                    <Skeleton className="h-3 w-24" />
                                    <Skeleton className="h-16 w-full rounded-lg" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-9 flex-1 rounded-md" />
                                        <Skeleton className="h-9 w-9 rounded-md" />
                                        <Skeleton className="h-9 flex-1 rounded-md" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>

                    {/* Assets skeleton */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-white/5">
                            <Skeleton className="h-10 w-10 rounded-lg" />
                            <div className="space-y-1">
                                <Skeleton className="h-6 w-20" />
                                <Skeleton className="h-4 w-40" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[...Array(2)].map((_, i) => (
                                <Card key={i} className="p-6 space-y-4">
                                    <Skeleton className="h-5 w-36" />
                                    <Skeleton className="h-8 w-28" />
                                    <Skeleton className="h-3 w-20" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-9 flex-1 rounded-md" />
                                        <Skeleton className="h-9 flex-1 rounded-md" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-10 animate-in fade-in duration-700 max-w-7xl pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white drop-shadow-lg mb-2">
                        {t("accounts.financialNetwork")}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-light text-lg">{t("accounts.manageConnected")}</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="icon" onClick={fetchAccounts} title={t("accounts.refreshData")} className="border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5">
                        <RefreshCw size={18} className={isLoading ? "animate-spin text-gold-400" : "text-slate-500 dark:text-slate-400"} strokeWidth={1.5} />
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="shadow-lg shadow-rose-900/20 hover:shadow-rose-900/40">{t("accounts.resetSystem")}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-panel border-rose-900/50 bg-white dark:bg-slate-950/90 backdrop-blur-xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-rose-500 flex items-center gap-2">
                                    <AlertCircle size={20} /> {t("accounts.nuclearReset")}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-600 dark:text-slate-300">
                                    {t("accounts.resetWarning")} {t("accounts.resetCannotUndo")}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300">{t("accounts.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetSystem} className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/50">
                                    {t("accounts.yesWipe")}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            {isAtLimit ? (
                                <Button
                                    variant="outline"
                                    className="font-bold tracking-wide border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setShowUpgradeModal(true);
                                    }}
                                >
                                    <Lock className="mr-2 h-4 w-4" strokeWidth={2} />
                                    {t('upgrade.toAddMore')}
                                    <ArrowUpRight className="ml-1 h-3 w-3" />
                                </Button>
                            ) : (
                                <Button variant="glow" className="font-bold tracking-wide">
                                    <Plus className="mr-2 h-4 w-4" strokeWidth={2} /> {t("accounts.addAccount")}
                                </Button>
                            )}
                        </DialogTrigger>
                        <DialogContent className="glass-panel sm:max-w-[450px] bg-white dark:bg-slate-950/90 backdrop-blur-2xl border-slate-200 dark:border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-slate-900 dark:text-white">{t("accounts.addManual")}</DialogTitle>
                                <DialogDescription className="text-slate-500 dark:text-slate-400">
                                    {t("accounts.addManualDesc")}
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("accounts.accountName")}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t("accounts.accountNamePlaceholder")} {...field} className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:border-emerald-500/50 text-slate-900 dark:text-white h-11" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-5">
                                        <FormField
                                            control={form.control}
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("accounts.type")}</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11">
                                                                <SelectValue placeholder={t("accounts.selectType")} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                                                            <SelectItem value="debt">{t("accounts.debt")}</SelectItem>
                                                            <SelectItem value="checking">{t("accounts.checking")}</SelectItem>
                                                            <SelectItem value="savings">{t("accounts.savings")}</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="balance"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-emerald-600 dark:text-emerald-400 font-semibold">{t("accounts.currentBalance")}</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">$</span>
                                                            <Input type="number" placeholder="0.00" {...field} className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:border-emerald-500/50 text-slate-900 dark:text-white pl-7 h-11 font-mono" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    {watchType === "debt" && (
                                        <>
                                            {/* Debt Type — single dropdown, interest_type auto-inferred */}
                                            <FormField
                                                control={form.control}
                                                name="debt_subtype"
                                                render={({ field }) => (
                                                    <FormItem className="animate-in fade-in slide-in-from-top-2">
                                                        <FormLabel className="text-amber-500 dark:text-amber-400 font-semibold">{t("accounts.debtType")}</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11">
                                                                    <SelectValue placeholder={t("accounts.whatKindDebt")} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                                                                <SelectItem value="credit_card">{t("accounts.creditCard")}</SelectItem>
                                                                <SelectItem value="auto_loan">{t("accounts.autoLoan")}</SelectItem>
                                                                <SelectItem value="mortgage">{t("accounts.mortgage")}</SelectItem>
                                                                <SelectItem value="personal_loan">{t("accounts.personalLoan")}</SelectItem>
                                                                <SelectItem value="student_loan">{t("accounts.studentLoan")}</SelectItem>
                                                                <SelectItem value="heloc">{t("accounts.heloc")}</SelectItem>
                                                            </SelectContent>
                                                        </Select>
                                                    </FormItem>
                                                )}
                                            />

                                            <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="interest_rate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-rose-500 dark:text-rose-400 font-semibold">{t("accounts.apr")}</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input type="number" step="0.01" placeholder="24.99" {...field} className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:border-rose-500/50 text-slate-900 dark:text-white h-11 font-mono pr-8" />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500">%</span>
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="min_payment"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="flex items-center justify-between text-rose-500 dark:text-rose-400 font-semibold">
                                                                {t("accounts.minPayment")}
                                                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/5 uppercase tracking-wider" title="Leave 0 to auto-calculate">{t("accounts.optional")}</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-600">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:border-rose-500/50 text-slate-900 dark:text-white pl-7 h-11 font-mono"
                                                                        placeholder="0.00 (Auto)"
                                                                    />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Credit Limit — only for revolving debt types (CC, HELOC) */}
                                            {isRevolvingDebt && (
                                                <FormField
                                                    control={form.control}
                                                    name="credit_limit"
                                                    render={({ field }) => (
                                                        <FormItem className="animate-in fade-in slide-in-from-top-2">
                                                            <FormLabel className="text-blue-500 dark:text-blue-400 font-semibold">{t("accounts.creditLimit")}</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-600">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        step="100"
                                                                        placeholder="5,000"
                                                                        {...field}
                                                                        className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 focus:border-blue-500/50 text-slate-900 dark:text-white pl-7 h-11 font-mono"
                                                                    />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            )}

                                            {/* APR Suggestion Panel — only for credit cards */}
                                            {watchDebtSubtype === 'credit_card' && (
                                                <div className="animate-in fade-in slide-in-from-top-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowAPRSuggestions(!showAPRSuggestions)}
                                                        className="flex items-center gap-2 text-xs text-amber-500 hover:text-amber-400 transition-colors mb-2"
                                                    >
                                                        <Lightbulb size={14} />
                                                        {showAPRSuggestions ? t('accounts.hideAPRSuggestions') : t('accounts.showAPRSuggestions')}
                                                    </button>
                                                    {showAPRSuggestions && (
                                                        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2">
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500 mb-2">
                                                                {t('accounts.aprSuggestionHint')} — Avg: <span className="font-mono text-amber-400">{getNationalAverageAPR()}%</span>
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {BANK_NAMES.map(bank => (
                                                                    <button
                                                                        key={bank}
                                                                        type="button"
                                                                        onClick={() => setSelectedBank(selectedBank === bank ? null : bank)}
                                                                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${selectedBank === bank
                                                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                                                            : 'bg-slate-100 dark:bg-slate-900/60 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 hover:bg-slate-200 dark:hover:bg-slate-800/80'
                                                                            }`}
                                                                    >
                                                                        {bank}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                            {selectedBank && (
                                                                <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                                                                    {getCardsByBank(selectedBank).map((card: CardAPRInfo) => (
                                                                        <button
                                                                            key={`${card.bank}-${card.card}`}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                form.setValue('interest_rate', card.aprTypical);
                                                                                setShowAPRSuggestions(false);
                                                                                setSelectedBank(null);
                                                                            }}
                                                                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-white/5 hover:border-amber-500/30 transition-all text-left group"
                                                                        >
                                                                            <div>
                                                                                <span className="text-xs font-medium text-slate-700 dark:text-white">{card.card}</span>
                                                                                <span className="ml-2 text-[10px] text-slate-400 uppercase">{card.category.replace('_', ' ')}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-mono text-xs text-amber-500 group-hover:text-amber-400">
                                                                                    {card.aprLow}%–{card.aprHigh}%
                                                                                </span>
                                                                                <span className="text-[10px] text-slate-500">→</span>
                                                                                <span className="font-mono text-xs font-bold text-amber-400">{card.aprTypical}%</span>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="closing_day"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-slate-600 dark:text-slate-300">{t("accounts.closingDay")}</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="15" {...field} className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="due_day"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-slate-600 dark:text-slate-300">{t("accounts.dueDay")}</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="1" {...field} className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <DialogFooter className="pt-4">
                                        <Button type="submit" disabled={isSubmitting} variant="premium" className="w-full h-12 text-lg">
                                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : t("accounts.verifyConnect")}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {errorMsg && (
                <div className="glass-panel bg-rose-50 dark:bg-rose-950/10 border-rose-300 dark:border-rose-900/50 p-4 rounded-lg flex items-center gap-3 text-rose-600 dark:text-rose-400">
                    <AlertCircle size={20} className="text-rose-500" />
                    <span className="font-medium">{errorMsg}</span>
                </div>
            )}

            {/* Plan Status Banner */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border ${isAtLimit
                ? 'bg-rose-500/5 border-rose-500/20'
                : isNearLimit
                    ? 'bg-amber-500/5 border-amber-500/20'
                    : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/5'
                }`}>
                <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isDevLicense ? 'bg-amber-500/10' : 'bg-blue-500/10'
                        }`}>
                        {isDevLicense ? <Crown size={16} className="text-amber-500" /> : <CreditCard size={16} className="text-blue-500" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{planName}</span>
                            {isDevLicense && (
                                <span className="text-[10px] font-bold bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded-full">
                                    {t('accounts.lifetime')}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {planLimit === Infinity
                                ? `${debtCount} ${t('accounts.debtUnlimited')}`
                                : `${debtCount}/${planLimit} ${t('accounts.debtAccountsUsed')}`}
                        </p>
                    </div>
                </div>

                {/* Progress bar (only for limited plans) */}
                {planLimit !== Infinity && (
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="w-32 h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isAtLimit
                                    ? 'bg-rose-500'
                                    : isNearLimit
                                        ? 'bg-amber-500'
                                        : 'bg-emerald-500'
                                    }`}
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
                        {isAtLimit && (
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="text-xs font-semibold text-amber-500 hover:text-amber-400 transition-colors whitespace-nowrap flex items-center gap-1"
                            >
                                {t('upgrade.button')} <ArrowUpRight size={12} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Upgrade CTA when near limit */}
            {isNearLimit && !isAtLimit && planLimit !== Infinity && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <div className="flex items-center gap-2">
                        <Crown size={14} className="text-amber-500" />
                        <span className="text-xs text-amber-500 font-medium">
                            {t('upgrade.runningOutSlots')}
                        </span>
                    </div>
                    <button onClick={() => setShowUpgradeModal(true)} className="text-xs font-bold text-amber-500 hover:text-amber-400 underline">
                        {t('upgrade.viewPlans')}
                    </button>
                </div>
            )}

            {/* ─── LOCKED ACCOUNTS BANNER ─── */}
            {lockedDebts.length > 0 && (
                <div className="relative overflow-hidden rounded-xl border border-rose-500/20 bg-gradient-to-r from-rose-950/40 via-rose-950/20 to-transparent p-3 sm:p-4 animate-in fade-in slide-in-from-top-3 duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,63,94,0.08),transparent_70%)] pointer-events-none" />
                    <div className="relative flex flex-col gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-rose-500/10 flex items-center justify-center animate-pulse shrink-0">
                                <ShieldAlert size={18} className="text-rose-500 sm:hidden" />
                                <ShieldAlert size={20} className="text-rose-500 hidden sm:block" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-sm font-bold text-rose-400">
                                        {lockedDebts.length} {t('accounts.accountsLocked')}
                                    </span>
                                    <span className="text-[10px] font-bold bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        {t('accounts.unmonitored')}
                                    </span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-rose-300/70 mt-0.5 leading-snug">
                                    {formatMoney(lockedTotalDebt)} {t('accounts.inUnmonitoredDebt')}
                                    <span className="hidden sm:inline"> • </span>
                                    <br className="sm:hidden" />
                                    ~{formatMoney(lockedDailyInterest)}{t('accounts.dayDraining')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="flex items-center justify-center gap-1.5 w-full sm:w-auto sm:self-end px-4 py-2.5 sm:py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-lg shadow-rose-900/30 hover:shadow-rose-900/50"
                        >
                            <Lock size={12} />
                            {t('upgrade.unlockAll')}
                            <ArrowUpRight size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Content Grid */}
            <div className="space-y-12">
                {/* Liabilities */}
                <div className="space-y-6 relative group">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-white/5">
                        <WidgetHelp helpKey="liabilitiesSection" />
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                            <CreditCard size={24} className="text-rose-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                                {t("accounts.liabilities")}
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({debtCount}{planLimit === Infinity ? '' : `/${planLimit}`})
                                </span>
                            </h2>
                            <p className="text-sm text-slate-500">{t("accounts.liabilitiesDesc")}</p>
                        </div>
                    </div>

                    {debts.length === 0 ? (
                        <div className="p-6 sm:p-12 border border-dashed border-slate-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 dark:bg-slate-950/30">
                            <CreditCard size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">{t("accounts.noDebts")}</p>
                            <p className="text-sm opacity-60">{t("accounts.noDebtsHint")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {sortedDebts.map(acc => {
                                const isLocked = lockedIds.has(acc.id);
                                const dailyLoss = acc.balance * acc.interest_rate / 100 / 365;

                                return (
                                    <Card
                                        key={acc.id}
                                        className={`glass-card group transition-all duration-500 bg-white dark:bg-slate-950/50 relative ${isLocked
                                            ? 'opacity-60 border-rose-500/15 cursor-pointer'
                                            : 'hover:border-rose-500/30'
                                            }`}
                                        onClick={isLocked ? () => setShowUpgradeModal(true) : undefined}
                                    >
                                        {/* Hover gradient — only on active cards */}
                                        {!isLocked && (
                                            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        )}

                                        {/* 🔒 Lock Overlay */}
                                        {isLocked && (
                                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-950/30 backdrop-blur-[2px] rounded-lg pointer-events-none">
                                                <div className="h-12 w-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-2">
                                                    <Lock size={20} className="text-rose-400" />
                                                </div>
                                                <span className="text-xs font-bold text-rose-300 uppercase tracking-wider">{t('accounts.lockedBadge')}</span>
                                            </div>
                                        )}

                                        {/* Delete button — only active */}
                                        {!isLocked && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400" onClick={() => confirmDelete(acc.id)}>
                                                    <Trash2 size={14} strokeWidth={1.5} />
                                                </Button>
                                            </div>
                                        )}

                                        <CardHeader className="pb-2 relative z-10">
                                            <CardTitle className="flex justify-between items-start">
                                                <span className={`text-lg font-bold truncate pr-8 transition-colors ${isLocked
                                                    ? 'text-slate-500 dark:text-slate-400'
                                                    : 'text-slate-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-200'
                                                    }`}>{acc.name}</span>
                                                <span className="text-[10px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/20 px-2 py-1 rounded text-rose-500 dark:text-rose-300 font-mono tracking-wide">
                                                    {acc.interest_rate}% APR
                                                </span>
                                            </CardTitle>
                                        </CardHeader>

                                        <CardContent className="relative z-10">
                                            <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
                                                {formatMoney(acc.balance)}
                                            </div>
                                            <p className="text-xs text-rose-500 dark:text-rose-400/80 font-medium uppercase tracking-wider mb-2">{t("accounts.outstandingBalance")}</p>

                                            {/* 📊 Credit Utilization Bar — only for revolving debts with a credit limit */}
                                            {acc.credit_limit && acc.credit_limit > 0 && ['credit_card', 'heloc'].includes(acc.debt_subtype || '') && (() => {
                                                const utilPct = Math.min(100, Math.round((acc.balance / acc.credit_limit) * 100));
                                                const utilColor = utilPct <= 30
                                                    ? 'bg-emerald-500' : utilPct <= 50
                                                        ? 'bg-amber-500' : utilPct <= 70
                                                            ? 'bg-orange-500' : 'bg-rose-500';
                                                const utilTextColor = utilPct <= 30
                                                    ? 'text-emerald-500' : utilPct <= 50
                                                        ? 'text-amber-500' : utilPct <= 70
                                                            ? 'text-orange-500' : 'text-rose-500';
                                                const utilLabel = utilPct <= 30
                                                    ? (language === 'es' ? 'Excelente' : 'Excellent')
                                                    : utilPct <= 50
                                                        ? (language === 'es' ? 'Moderado' : 'Moderate')
                                                        : utilPct <= 70
                                                            ? (language === 'es' ? 'Alto' : 'High')
                                                            : (language === 'es' ? 'Crítico' : 'Critical');

                                                return (
                                                    <div className="mb-3 animate-in fade-in slide-in-from-top-1 duration-300">
                                                        <div className="flex items-center justify-between text-[10px] mb-1">
                                                            <span className="text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">
                                                                {language === 'es' ? 'Utilización' : 'Utilization'}
                                                            </span>
                                                            <span className={`font-bold ${utilTextColor}`}>
                                                                {utilPct}% · {utilLabel}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ease-out ${utilColor}`}
                                                                style={{ width: `${utilPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 mt-0.5 font-mono">
                                                            <span>{formatMoney(acc.balance)}</span>
                                                            <span>{language === 'es' ? 'Límite' : 'Limit'}: {formatMoney(acc.credit_limit)}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}

                                            {/* ⚡ Float Strategy Indicator — only for credit cards with a due_day */}
                                            {acc.debt_subtype === 'credit_card' && acc.due_day && !isLocked && (() => {
                                                const today = new Date();
                                                const currentDay = today.getDate();
                                                const dueDay = acc.due_day;
                                                const daysUntilDue = dueDay >= currentDay
                                                    ? dueDay - currentDay
                                                    : (new Date(today.getFullYear(), today.getMonth() + 1, dueDay).getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
                                                const daysLeft = Math.ceil(daysUntilDue);
                                                const isGracePeriod = daysLeft > 0 && daysLeft <= 25;

                                                return isGracePeriod ? (
                                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-500/5 border border-blue-500/10 mb-3">
                                                        <span className="text-base">⚡</span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">
                                                                {language === 'es' ? 'Período de Gracia' : 'Grace Period'}
                                                            </span>
                                                            <p className="text-[10px] text-blue-300/70 leading-tight">
                                                                {language === 'es'
                                                                    ? `${daysLeft} días antes del cierre. Paga el balance para evitar interés.`
                                                                    : `${daysLeft} days until due. Pay balance to avoid interest charges.`
                                                                }
                                                            </p>
                                                        </div>
                                                    </div>
                                                ) : null;
                                            })()}

                                            {/* 💧 Bleeding Money Badge — only on locked cards */}
                                            {isLocked && (
                                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/15 mb-4 pointer-events-none">
                                                    <Flame size={14} className="text-rose-500 animate-pulse" />
                                                    <span className="text-[11px] font-semibold text-rose-400">
                                                        {t('accounts.notMonitored')}{formatMoney(dailyLoss)}{t('accounts.perDayInterest')}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-950/30 p-3 rounded-lg border border-slate-200 dark:border-white/5 mb-6">
                                                <div>
                                                    <span className="block text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t("accounts.minPayment")}</span>
                                                    <span className="text-slate-700 dark:text-slate-200 font-mono text-sm">{formatMoney(acc.min_payment)}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">{t("accounts.dueDate")}</span>
                                                    <span className="text-slate-700 dark:text-slate-200 font-mono text-sm">{t("accounts.day")} {acc.due_day}</span>
                                                </div>
                                            </div>

                                            {/* Action buttons — disabled when locked */}
                                            {isLocked ? (
                                                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800/30 text-slate-400 dark:text-slate-500 text-xs font-medium pointer-events-none">
                                                    <Lock size={12} />
                                                    {t('upgrade.toManage')}
                                                </div>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <TransactionDrawer account={acc} onUpdate={fetchAccounts} />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setUpdatingAccount(acc)}
                                                        className="h-9 px-3 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                        title={t("accounts.manualAdjustment")}
                                                    >
                                                        <RefreshCw size={14} />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="outline" size="sm" className="flex-1 h-9 border-rose-300 dark:border-rose-900/30 text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-300 hover:border-rose-400 dark:hover:border-rose-500/50 transition-all font-medium">
                                                                {t("accounts.payOff")}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="glass-panel bg-white dark:bg-slate-950/90 border-slate-200 dark:border-white/10">
                                                            <AccountActionDialog account={acc} type="payment" onClose={() => { }} onUpdate={fetchAccounts} />
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Assets */}
                <div className="space-y-6 relative group">
                    <div className="flex items-center gap-3 pb-2 border-b border-slate-200 dark:border-white/5">
                        <WidgetHelp helpKey="assetsSection" />
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Landmark size={24} className="text-emerald-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t("accounts.assets")}</h2>
                            <p className="text-sm text-slate-500">{t("accounts.assetsDesc")}</p>
                        </div>
                    </div>

                    {assets.length === 0 ? (
                        <div className="p-12 border border-dashed border-slate-300 dark:border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-50 dark:bg-slate-950/30">
                            <Landmark size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">{t("accounts.noAssets")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(acc => (
                                <Card key={acc.id} className="glass-card group hover:border-emerald-500/30 transition-all duration-500 bg-white dark:bg-slate-950/50">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10" onClick={() => confirmDelete(acc.id)}>
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </Button>
                                    </div>

                                    <CardHeader className="pb-2 relative z-10">
                                        <CardTitle className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{acc.name}</CardTitle>
                                    </CardHeader>

                                    <CardContent className="relative z-10">
                                        <div className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-1">
                                            {formatMoney(acc.balance)}
                                        </div>
                                        <p className="text-xs text-emerald-500 dark:text-emerald-400/80 font-medium uppercase tracking-wider mb-6">{t("accounts.availableCash")}</p>

                                        <div className="flex gap-2 mt-auto">
                                            <TransactionDrawer account={acc} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="h-9 w-9 p-0 border-slate-300 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                                title={t("accounts.manualAdjustment")}
                                            >
                                                <RefreshCw size={14} />
                                            </Button>

                                            <div className="flex gap-1 flex-1">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-xs font-semibold">
                                                            {t("accounts.deposit")}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-white dark:bg-slate-950/90 border-slate-200 dark:border-white/10">
                                                        <AccountActionDialog account={acc} type="deposit" onClose={() => { }} onUpdate={fetchAccounts} />
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-rose-500/10 text-rose-500 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold">
                                                            {t("accounts.spend")}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-white dark:bg-slate-950/90 border-slate-200 dark:border-white/10">
                                                        <AccountActionDialog account={acc} type="spend" onClose={() => { }} onUpdate={fetchAccounts} />
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cashflow Section */}
                <div className="pt-12 border-t border-slate-200 dark:border-white/5 relative group">
                    <WidgetHelp helpKey="cashflowOverview" />
                    <CashflowManager refreshKey={cashflowRefreshKey} lockedIds={lockedIds} onUpgrade={() => setShowUpgradeModal(true)} />
                </div>
            </div>

            {updatingAccount && (
                <ManualAdjustmentDialog
                    account={updatingAccount}
                    onClose={() => setUpdatingAccount(null)}
                    onUpdate={() => {
                        fetchAccounts();
                        setUpdatingAccount(null);
                    }}
                />
            )}

            {/* 🔒 Upgrade Modal — shared component with plan cards */}
            <UpgradeModal
                open={showUpgradeModal}
                onOpenChange={setShowUpgradeModal}
                reason={`Your ${planName} plan supports ${planLimit} accounts. Upgrade to unlock all ${debtCount} debt accounts and let KoreX optimize every dollar.`}
            />
        </div>
    );
}

// --- Helper Components ---

function AccountActionDialog({ account, type, onClose, onUpdate }: { account: Account, type: 'deposit' | 'spend' | 'payment', onClose: () => void, onUpdate: () => void }) {
    const { t } = useLanguage();
    const [amount, setAmount] = useState("");
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalAmount = parseFloat(amount);
            // Payments send POSITIVE amounts — backend handles debt reduction
            // Only 'spend' sends negative (asset withdrawal)
            if (type === 'spend') finalAmount = -Math.abs(finalAmount);
            else finalAmount = Math.abs(finalAmount);

            const payload = {
                account_id: account.id,
                amount: finalAmount,
                description: desc || (type === 'payment' ? `Debt Payment — ${account.name}` : type === 'deposit' ? 'Manual Deposit' : 'Manual Expense'),
                category: type === 'payment' ? 'payment' : 'manual',
                date: new Date().toISOString().split('T')[0]
            };

            await apiFetch('/api/transactions', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            onUpdate();
            onClose();
        } catch (e) {
            console.error("Action failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <AlertDialogHeader>
                <AlertDialogTitle className="text-slate-900 dark:text-white capitalize text-2xl font-bold flex items-center gap-2">
                    {type === 'payment' && <CreditCard className="text-rose-500" />}
                    {type === 'deposit' && <Landmark className="text-emerald-500" />}
                    {type === 'spend' && <Trash2 className="text-rose-500" />}
                    {type} {t("accounts.transaction")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
                    {type === 'payment' ? `${t("accounts.payOffDesc")} ${account.name}` :
                        type === 'deposit' ? `${t("accounts.addFundsDesc")} ${account.name}` :
                            `${t("accounts.recordExpenseDesc")} ${account.name}`}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">{t("accounts.amount")}</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-lg">$</span>
                        <Input
                            type="number" step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-xl font-mono h-12 pl-8 text-slate-900 dark:text-white focus:border-slate-400 dark:focus:border-white/20"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase tracking-wider">{t("accounts.descriptionOptional")}</label>
                    <Input
                        placeholder={type === 'deposit' ? "Paycheck, Gift, etc." : "Groceries, Coffee, etc."}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 text-slate-900 dark:text-white h-11"
                    />
                </div>
            </div>
            <AlertDialogFooter className="pt-2">
                <AlertDialogAction type="submit" className={`w-full h-12 text-lg shadow-lg ${type === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'}`} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : t("accounts.confirmTransaction")}
                </AlertDialogAction>
            </AlertDialogFooter>
        </form>
    );
}

function ManualAdjustmentDialog({ account, onClose, onUpdate }: { account: Account, onClose: () => void, onUpdate: () => void }) {
    const { t } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const [amount, setAmount] = useState("");
    const [operation, setOperation] = useState<'add' | 'subtract'>('add');
    const [loading, setLoading] = useState(false);

    const isDebt = account.type === 'debt';
    const currentBalance = Number(account.balance);
    const numAmount = parseFloat(amount) || 0;

    // Calculate New Balance for Preview
    // Debt: Add = Increase Debt (More Positive), Subtract = Pay Debt (Less Positive)
    // Asset: Add = Increase Cash, Subtract = Decrease Cash
    let newBalance = currentBalance;
    if (isDebt) {
        newBalance = operation === 'add' ? currentBalance + numAmount : currentBalance - numAmount;
    } else {
        newBalance = operation === 'add' ? currentBalance + numAmount : currentBalance - numAmount;
    }

    const handleTransaction = async () => {
        setLoading(true);
        try {
            // Logic for Backend Payload
            // Backend Debt: Negative = Spend (Increase Debt), Positive = Payment (Reduce Debt)
            // Backend Asset: Positive = Income, Negative = Expense

            let finalAmount = 0;
            if (isDebt) {
                // If Add (Increase Debt) -> Send Negative
                // If Subtract (Reduce Debt) -> Send Positive
                finalAmount = operation === 'add' ? -numAmount : numAmount;
            } else {
                // If Add (Deposit) -> Send Positive
                // If Subtract (Withdraw) -> Send Negative
                finalAmount = operation === 'add' ? numAmount : -numAmount;
            }

            await apiFetch(`/api/transactions/manual`, {
                method: 'POST',
                body: JSON.stringify({
                    account_id: account.id,
                    amount: finalAmount,
                    description: "Manual Adjustment",
                    category: "Adjustment",
                    date: new Date().toISOString().split('T')[0]
                })
            });

            onUpdate();
            onClose();
        } catch (e) {
            console.error("Adjustment failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="glass-panel sm:max-w-[420px] bg-white dark:bg-slate-950/90 backdrop-blur-2xl border-slate-200 dark:border-white/10 text-slate-900 dark:text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-xl font-bold">
                        <RefreshCw size={20} className="text-blue-500" strokeWidth={2} />
                        {t("accounts.manualAdjustment")}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        {t("accounts.adjustBalanceFor")} <span className="text-slate-900 dark:text-white font-medium">{account.name}</span>.
                        <br />
                        <span className="text-xs text-slate-400 dark:text-slate-500">{t("accounts.createsRecord")}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Operation Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg border border-slate-200 dark:border-white/5">
                        <button
                            onClick={() => setOperation('add')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'add'
                                ? (isDebt ? "bg-rose-500 text-white shadow-lg shadow-rose-900/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-900/20")
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5"
                                }`}
                        >
                            {isDebt ? t("accounts.addCharge") : t("accounts.addDeposit")}
                        </button>
                        <button
                            onClick={() => setOperation('subtract')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'subtract'
                                ? (isDebt ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/20" : "bg-rose-500 text-white shadow-lg shadow-rose-900/20")
                                : "text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/5"
                                }`}
                        >
                            {isDebt ? t("accounts.subtractPayment") : t("accounts.subtractExpense")}
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            {t("accounts.adjustmentAmount")}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-light">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-white/10 pl-8 text-3xl font-mono h-16 font-bold text-slate-900 dark:text-white focus:border-blue-500/50"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-slate-50 dark:bg-slate-900/30 rounded-lg p-4 border border-slate-200 dark:border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">{t("accounts.currentBalanceLabel")}</span>
                            <span className="font-mono text-slate-600 dark:text-slate-300">{formatMoney(currentBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-3 border-b border-slate-200 dark:border-white/5">
                            <span className={operation === 'add' ? "text-emerald-500" : "text-rose-500"}>
                                {operation === 'add' ? '+' : '-'} {t("accounts.adjustment")}
                            </span>
                            <span className={`font-mono font-medium ${operation === 'add' ? "text-emerald-500" : "text-rose-500"}`}>
                                {operation === 'add' ? '+' : '-'}{formatMoney(numAmount)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-slate-900 dark:text-white">{t("accounts.newBalance")}</span>
                            <span className="font-mono text-blue-500 dark:text-blue-400">{formatMoney(newBalance)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="hover:bg-slate-100 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400">{t("accounts.cancel")}</Button>
                    <Button
                        onClick={handleTransaction}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : t("accounts.applyTransaction")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TransactionDrawer({ account, onUpdate }: { account: Account, onUpdate: () => void }) {
    const { t } = useLanguage();
    const { formatMoney } = useFormatMoney();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);

    // Transaction Form
    const txForm = useForm<TransactionFormValues>({
        resolver: zodResolver(transactionFormSchema) as any,
        defaultValues: {
            description: "",
            amount: 0,
            category: "general",
            type: "expense"
        }
    });

    const fetchTransactions = async () => {
        setLoading(true);
        try {
            const data = await apiFetch<any[]>(`/api/accounts/${account.id}/transactions`);
            setTransactions(data);
        } catch (e) {
            console.error("Failed to load transactions", e);
        } finally {
            setLoading(false);
        }
    };

    const onAddTransaction = async (values: TransactionFormValues) => {
        try {
            let finalAmount = values.amount;
            if (values.type === 'expense') finalAmount = -Math.abs(values.amount);
            else finalAmount = Math.abs(values.amount);

            const payload = {
                account_id: account.id,
                amount: finalAmount,
                description: values.description,
                category: values.category,
                date: new Date().toISOString().split('T')[0]
            };

            await apiFetch('/api/transactions', {
                method: 'POST',
                body: JSON.stringify(payload)
            });

            txForm.reset();
            fetchTransactions();
            onUpdate();
        } catch (e) {
            console.error("Tx failed", e);
        }
    };

    return (
        <Sheet onOpenChange={(open: boolean) => open && fetchTransactions()}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full text-xs h-9 border-slate-300 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800/50 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-zinc-300">{t("accounts.history")}</Button>
            </SheetTrigger>
            <SheetContent className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white w-full sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="text-slate-900 dark:text-white">{t("accounts.transactions")} {account.name}</SheetTitle>
                    <SheetDescription className="text-slate-500 dark:text-slate-400">
                        {t("accounts.historyContext")} {account.type.toUpperCase()}.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Add Transaction Form */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                        <h3 className="text-sm font-medium text-slate-600 dark:text-zinc-300 mb-3">{t("accounts.newTransaction")}</h3>
                        <Form {...txForm}>
                            <form onSubmit={txForm.handleSubmit(onAddTransaction)} className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder={t("accounts.description")} {...field} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={txForm.control} name="amount" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" placeholder={t("accounts.amount")} {...field} className="bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="type" render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-8 text-xs">
                                                        <SelectValue placeholder={t("accounts.type")} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                                                    <SelectItem value="expense">{t("accounts.expense")}</SelectItem>
                                                    <SelectItem value="income">{t("accounts.income")}</SelectItem>
                                                    <SelectItem value="payment">{t("accounts.payment")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <Button type="submit" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">{t("accounts.add")}</Button>
                                </div>
                            </form>
                        </Form>
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-slate-600 dark:text-zinc-300">{t("accounts.history")}</h3>
                        <ScrollArea className="h-[400px] rounded-md border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-900/20">
                            {loading ? (
                                <div className="flex justify-center items-center h-full text-slate-500">
                                    <Loader2 className="animate-spin mr-2" /> {t("accounts.loading")}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {transactions.length === 0 ? (
                                        <p className="text-slate-500 text-sm text-center italic py-10">{t("accounts.noTransactions")}</p>
                                    ) : (
                                        transactions.map(tx => (
                                            <div key={tx.id} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-medium text-slate-700 dark:text-zinc-200">{tx.description}</div>
                                                    <div className="text-xs text-slate-500">{tx.date} • {tx.category}</div>
                                                </div>
                                                <div className={`font-mono ${tx.amount < 0 ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                    {formatMoney(tx.amount)}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </ScrollArea>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
