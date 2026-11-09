import { localDay } from '@/lib/localDay';
import { useCallback, useEffect, useState } from 'react';
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
const REVOLVING_SUBTYPES = ["credit_card", "heloc", "uil"];
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
    debt_subtype: z.enum(["credit_card", "heloc", "uil", "auto_loan", "mortgage", "personal_loan", "student_loan"]).default("credit_card"),
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
    const { t, language } = useLanguage();
    usePageTitle(t('nav.accounts'));
    const { formatMoney } = useFormatMoney();
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [updatingAccount, setUpdatingAccount] = useState<Account | null>(null);
    const [deleteAccountTarget, setDeleteAccountTarget] = useState<Account | null>(null);
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
    const fetchAccounts = useCallback(async () => {
        try {
            setErrorMsg(null);
            const data = await apiFetch<Account[]>('/api/accounts');
            const safeData = data.map((acc) => ({
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
    }, [t]);

    useEffect(() => {
        fetchAccounts();
        syncPlanFromBackend(); // Sync plan from backend on mount
    }, [fetchAccounts]);

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

    const requestDeleteAccount = (acc: Account) => {
        setDeleteAccountTarget(acc);
    };

    const executeDeleteAccount = async () => {
        if (!deleteAccountTarget) return;
        try {
            await apiFetch(`/api/accounts/${deleteAccountTarget.id}`, { method: 'DELETE' });
            setAccounts(prev => prev.filter(a => a.id !== deleteAccountTarget.id));
            toast({ title: t("accounts.accountDeleted"), variant: "destructive" });
            emitDataChanged('accounts');
        } catch (e) {
            console.error("Delete failed", e);
        } finally {
            setDeleteAccountTarget(null);
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
            <div className="container mx-auto px-4 py-6 sm:p-6 space-y-10 animate-in fade-in duration-500 max-w-7xl pb-20">
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
                        <div className="flex items-center gap-3 pb-2 border-b border-kx-line ">
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
                        <div className="flex items-center gap-3 pb-2 border-b border-kx-line ">
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
        <div className="container mx-auto px-4 py-6 sm:p-6 space-y-10 animate-in fade-in duration-700 max-w-7xl pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-kx-ink drop-shadow-lg mb-2">
                        {t("accounts.financialNetwork")}
                    </h1>
                    <p className="text-kx-ink3 font-light text-lg">{t("accounts.manageConnected")}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="icon" onClick={fetchAccounts} title={t("accounts.refreshData")} className="border-kx-line hover:bg-kx-raised ">
                        <RefreshCw size={18} className={isLoading ? "animate-spin text-kx-amber" : "text-kx-ink3 "} strokeWidth={1.5} />
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="shadow-lg ">{t("accounts.resetSystem")}</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-panel border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] bg-kx-surface backdrop-blur-xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-kx-debt flex items-center gap-2">
                                    <AlertCircle size={20} /> {t("accounts.nuclearReset")}
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-kx-ink2 ">
                                    {t("accounts.resetWarning")} {t("accounts.resetCannotUndo")}
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-kx-line hover:bg-kx-raised text-kx-ink ">{t("accounts.cancel")}</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetSystem} className="bg-kx-debt hover:bg-kx-debt text-[#111418] shadow-lg ">
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
                                    className="font-bold tracking-wide border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)] text-kx-amber hover:bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)]"
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
                                <Button variant="default" className="font-bold tracking-wide">
                                    <Plus className="mr-2 h-4 w-4" strokeWidth={2} /> {t("accounts.addAccount")}
                                </Button>
                            )}
                        </DialogTrigger>
                        <DialogContent className="glass-panel sm:max-w-[450px] bg-kx-surface backdrop-blur-2xl border-kx-line ">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-kx-ink ">{t("accounts.addManual")}</DialogTitle>
                                <DialogDescription className="text-kx-ink3 ">
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
                                                <FormLabel className="text-kx-paid font-semibold">{t("accounts.accountName")}</FormLabel>
                                                <FormControl>
                                                    <Input placeholder={t("accounts.accountNamePlaceholder")} {...field} className="bg-kx-surface border-kx-line focus:border-[color-mix(in_srgb,var(--kx-paid)_50%,transparent)] text-kx-ink h-11" />
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
                                                    <FormLabel className="text-kx-paid font-semibold">{t("accounts.type")}</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-kx-surface border-kx-line text-kx-ink h-11">
                                                                <SelectValue placeholder={t("accounts.selectType")} />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-kx-surface border-kx-line text-kx-ink ">
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
                                                    <FormLabel className="text-kx-paid font-semibold">{t("accounts.currentBalance")}</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink2 ">$</span>
                                                            <Input type="number" placeholder="0.00" {...field} className="bg-kx-surface border-kx-line focus:border-[color-mix(in_srgb,var(--kx-paid)_50%,transparent)] text-kx-ink pl-7 h-11 font-mono" />
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
                                                        <FormLabel className="text-kx-amber font-semibold">{t("accounts.debtType")}</FormLabel>
                                                        <Select onValueChange={field.onChange} value={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger className="bg-kx-surface border-kx-line text-kx-ink h-11">
                                                                    <SelectValue placeholder={t("accounts.whatKindDebt")} />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent className="bg-kx-surface border-kx-line text-kx-ink ">
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
                                                            <FormLabel className="text-kx-debt font-semibold">{t("accounts.apr")}</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input type="number" step="0.01" placeholder="24.99" {...field} className="bg-kx-surface border-kx-line focus:border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] text-kx-ink h-11 font-mono pr-8" />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-kx-ink2 ">%</span>
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
                                                            <FormLabel className="flex items-center justify-between text-kx-debt font-semibold">
                                                                {t("accounts.minPayment")}
                                                                <span className="text-[10px] bg-kx-raised text-kx-ink3 px-1.5 py-0.5 rounded border border-kx-line uppercase tracking-wider" title="Leave 0 to auto-calculate">{t("accounts.optional")}</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink3 ">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        className="bg-kx-surface border-kx-line focus:border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] text-kx-ink pl-7 h-11 font-mono"
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
                                                            <FormLabel className="text-kx-ink2 font-semibold">{t("accounts.creditLimit")}</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink3 ">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        step="100"
                                                                        placeholder="5,000"
                                                                        {...field}
                                                                        className="bg-kx-surface border-kx-line focus:border-kx-line text-kx-ink pl-7 h-11 font-mono"
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
                                                        className="flex items-center gap-2 text-xs text-kx-amber hover:text-kx-amber transition-colors mb-2"
                                                    >
                                                        <Lightbulb size={14} />
                                                        {showAPRSuggestions ? t('accounts.hideAPRSuggestions') : t('accounts.showAPRSuggestions')}
                                                    </button>
                                                    {showAPRSuggestions && (
                                                        <div className="bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] border border-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)] rounded-xl p-3 space-y-2">
                                                            <p className="text-[11px] text-kx-ink2 mb-2">
                                                                {t('accounts.aprSuggestionHint')} — Avg: <span className="font-mono text-kx-amber">{getNationalAverageAPR()}%</span>
                                                            </p>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {BANK_NAMES.map(bank => (
                                                                    <button
                                                                        key={bank}
                                                                        type="button"
                                                                        onClick={() => setSelectedBank(selectedBank === bank ? null : bank)}
                                                                        className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all ${selectedBank === bank
 ? 'bg-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)] text-kx-amber border border-[color-mix(in_srgb,var(--kx-amber)_40%,transparent)]'
 : 'bg-kx-raised dark:bg-[#0f0f0f]/60 text-kx-ink3 border border-kx-line hover:bg-kx-raised '
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
                                                                            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-kx-raised border border-kx-line hover:border-[color-mix(in_srgb,var(--kx-amber)_30%,transparent)] transition-all text-left group"
                                                                        >
                                                                            <div>
                                                                                <span className="text-xs font-medium text-kx-ink ">{card.card}</span>
                                                                                <span className="ml-2 text-[10px] text-kx-ink2 uppercase">{card.category.replace('_', ' ')}</span>
                                                                            </div>
                                                                            <div className="flex items-center gap-1">
                                                                                <span className="font-mono text-xs text-kx-amber group-hover:text-kx-amber">
                                                                                    {card.aprLow}%–{card.aprHigh}%
                                                                                </span>
                                                                                <span className="text-[10px] text-kx-ink3">→</span>
                                                                                <span className="font-mono text-xs font-bold text-kx-amber">{card.aprTypical}%</span>
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
                                                            <FormLabel className="text-kx-ink2 ">{t("accounts.closingDay")}</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="15" {...field} className="bg-kx-surface border-kx-line text-kx-ink h-11" />
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
                                                            <FormLabel className="text-kx-ink2 ">{t("accounts.dueDay")}</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="1" {...field} className="bg-kx-surface border-kx-line text-kx-ink h-11" />
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
                <div className="glass-panel bg-kx-debt border-kx-debt p-4 rounded-lg flex items-center gap-3 text-kx-debt ">
                    <AlertCircle size={20} className="text-kx-debt" />
                    <span className="font-medium">{errorMsg}</span>
                </div>
            )}

            {/* Plan Status Banner */}
            <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl border ${isAtLimit
 ? 'bg-[color-mix(in_srgb,var(--kx-debt)_5%,transparent)] border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)]'
 : isNearLimit
 ? 'bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] border-[color-mix(in_srgb,var(--kx-amber)_20%,transparent)]'
 : 'bg-kx-surface /[0.02] border-kx-line '
 }`}>
                <div className="flex items-center gap-3">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${isDevLicense ? 'bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)]' : 'bg-kx-raised'
 }`}>
                        {isDevLicense ? <Crown size={16} className="text-kx-amber" /> : <CreditCard size={16} className="text-kx-ink2" />}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{planName}</span>
                            {isDevLicense && (
                                <span className="text-[10px] font-bold bg-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)] text-kx-amber px-1.5 py-0.5 rounded-full">
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
                        <div className="w-32 h-2 bg-kx-raised rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isAtLimit
 ? 'bg-kx-debt'
 : isNearLimit
 ? 'bg-kx-amber'
 : 'bg-kx-paid'
 }`}
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
                        {isAtLimit && (
                            <button
                                onClick={() => setShowUpgradeModal(true)}
                                className="text-xs font-semibold text-kx-amber hover:text-kx-amber transition-colors whitespace-nowrap flex items-center gap-1"
                            >
                                {t('upgrade.button')} <ArrowUpRight size={12} />
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Upgrade CTA when near limit */}
            {isNearLimit && !isAtLimit && planLimit !== Infinity && (
                <div className="flex items-center justify-between p-3 rounded-xl bg-[color-mix(in_srgb,var(--kx-amber)_5%,transparent)] border border-[color-mix(in_srgb,var(--kx-amber)_10%,transparent)]">
                    <div className="flex items-center gap-2">
                        <Crown size={14} className="text-kx-amber" />
                        <span className="text-xs text-kx-amber font-medium">
                            {t('upgrade.runningOutSlots')}
                        </span>
                    </div>
                    <button onClick={() => setShowUpgradeModal(true)} className="text-xs font-bold text-kx-amber hover:text-kx-amber underline">
                        {t('upgrade.viewPlans')}
                    </button>
                </div>
            )}

            {/* ─── LOCKED ACCOUNTS BANNER ─── */}
            {lockedDebts.length > 0 && (
                <div className="relative overflow-hidden rounded-xl border border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] bg-[color-mix(in_srgb,var(--kx-debt)_40%,transparent)] to-transparent p-3 sm:p-4 animate-in fade-in slide-in-from-top-3 duration-500">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(244,63,94,0.08),transparent_70%)] pointer-events-none" />
                    <div className="relative flex flex-col gap-3">
                        <div className="flex items-start sm:items-center gap-3">
                            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] flex items-center justify-center animate-pulse shrink-0">
                                <ShieldAlert size={18} className="text-kx-debt sm:hidden" />
                                <ShieldAlert size={20} className="text-kx-debt hidden sm:block" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <span className="text-sm font-bold text-kx-debt">
                                        {lockedDebts.length} {t('accounts.accountsLocked')}
                                    </span>
                                    <span className="text-[10px] font-bold bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] text-kx-debt px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                                        {t('accounts.unmonitored')}
                                    </span>
                                </div>
                                <p className="text-[11px] sm:text-xs text-kx-debt mt-0.5 leading-snug">
                                    {formatMoney(lockedTotalDebt)} {t('accounts.inUnmonitoredDebt')}
                                    <span className="hidden sm:inline"> • </span>
                                    <br className="sm:hidden" />
                                    ~{formatMoney(lockedDailyInterest)}{t('accounts.dayDraining')}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowUpgradeModal(true)}
                            className="flex items-center justify-center gap-1.5 w-full sm:w-auto sm:self-end px-4 py-2.5 sm:py-2 rounded-lg bg-kx-debt hover:bg-kx-debt text-[#111418] text-xs font-bold transition-all shadow-lg "
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
                    <div className="flex items-center gap-3 pb-2 border-b border-kx-line ">
                        <WidgetHelp helpKey="liabilitiesSection" />
                        <div className="p-2 bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] rounded-lg">
                            <CreditCard size={24} className="text-kx-debt" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-kx-ink ">
                                {t("accounts.liabilities")}
                                <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({debtCount}{planLimit === Infinity ? '' : `/${planLimit}`})
                                </span>
                            </h2>
                            <p className="text-sm text-kx-ink3">{t("accounts.liabilitiesDesc")}</p>
                        </div>
                    </div>

                    {debts.length === 0 ? (
                        <div className="p-6 sm:p-12 border border-dashed border-kx-line rounded-xl flex flex-col items-center justify-center text-kx-ink3 bg-kx-surface ">
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
                                        className={`glass-card group transition-all duration-500 bg-kx-surface relative ${isLocked
 ? 'opacity-60 border-[color-mix(in_srgb,var(--kx-debt)_15%,transparent)] cursor-pointer'
 : 'hover:border-[color-mix(in_srgb,var(--kx-debt)_30%,transparent)]'
 }`}
                                        onClick={isLocked ? () => setShowUpgradeModal(true) : undefined}
                                    >
                                        {/* Hover gradient — only on active cards */}
                                        {!isLocked && (
                                            <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kx-debt)_5%,transparent)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                        )}

                                        {/* 🔒 Lock Overlay */}
                                        {isLocked && (
                                            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/30 backdrop-blur-[2px] rounded-lg pointer-events-none">
                                                <div className="h-12 w-12 rounded-full bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] border border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] flex items-center justify-center mb-2">
                                                    <Lock size={20} className="text-kx-debt" />
                                                </div>
                                                <span className="text-xs font-bold text-kx-debt uppercase tracking-wider">{t('accounts.lockedBadge')}</span>
                                            </div>
                                        )}

                                        {/* Delete button — only active */}
                                        {!isLocked && (
                                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] hover:text-kx-debt" onClick={() => requestDeleteAccount(acc)}>
                                                    <Trash2 size={14} strokeWidth={1.5} />
                                                </Button>
                                            </div>
                                        )}

                                        <CardHeader className="pb-2 relative z-10">
                                            <CardTitle className="flex justify-between items-start">
                                                <span className={`text-lg font-bold truncate pr-8 transition-colors ${isLocked
 ? 'text-kx-ink3 '
 : 'text-kx-ink group-hover:text-kx-debt dark:group-hover:text-kx-debt'
 }`}>{acc.name}</span>
                                                <span className="text-[10px] bg-kx-debt border border-kx-debt px-2 py-1 rounded text-kx-debt font-mono tracking-wide">
                                                    {acc.interest_rate}% APR
                                                </span>
                                            </CardTitle>
                                        </CardHeader>

                                        <CardContent className="relative z-10">
                                            <div className="text-3xl font-extrabold text-kx-ink tracking-tight mb-1">
                                                {formatMoney(acc.balance)}
                                            </div>
                                            <p className="text-xs text-kx-debt font-medium uppercase tracking-wider mb-2">{t("accounts.outstandingBalance")}</p>

                                            {/* 📊 Credit Utilization Bar — only for revolving debts with a credit limit */}
                                            {acc.credit_limit && acc.credit_limit > 0 && ['credit_card', 'heloc'].includes(acc.debt_subtype || '') && (() => {
                                                const utilPct = Math.min(100, Math.round((acc.balance / acc.credit_limit) * 100));
                                                const utilColor = utilPct <= 30
                                                    ? 'bg-kx-paid' : utilPct <= 50
                                                        ? 'bg-kx-amber' : utilPct <= 70
                                                            ? 'bg-kx-amber' : 'bg-kx-debt';
                                                const utilTextColor = utilPct <= 30
                                                    ? 'text-kx-paid' : utilPct <= 50
                                                        ? 'text-kx-amber' : utilPct <= 70
                                                            ? 'text-kx-amber' : 'text-kx-debt';
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
                                                            <span className="text-kx-ink3 uppercase font-bold tracking-wider">
                                                                {language === 'es' ? 'Utilización' : 'Utilization'}
                                                            </span>
                                                            <span className={`font-bold ${utilTextColor}`}>
                                                                {utilPct}% · {utilLabel}
                                                            </span>
                                                        </div>
                                                        <div className="h-2 w-full bg-kx-raised rounded-full overflow-hidden">
                                                            <div
                                                                className={`h-full rounded-full transition-all duration-700 ease-out ${utilColor}`}
                                                                style={{ width: `${utilPct}%` }}
                                                            />
                                                        </div>
                                                        <div className="flex justify-between text-[9px] text-kx-ink2 mt-0.5 font-mono">
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
                                                    <div className="flex items-center gap-2 p-2 rounded-lg bg-kx-raised border border-kx-line mb-3">
                                                        <span className="text-base">⚡</span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10px] font-bold text-kx-ink2 uppercase tracking-wide">
                                                                {language === 'es' ? 'Período de Gracia' : 'Grace Period'}
                                                            </span>
                                                            <p className="text-[10px] text-kx-ink2 leading-tight">
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
                                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] border border-[color-mix(in_srgb,var(--kx-debt)_15%,transparent)] mb-4 pointer-events-none">
                                                    <Flame size={14} className="text-kx-debt animate-pulse" />
                                                    <span className="text-[11px] font-semibold text-kx-debt">
                                                        {t('accounts.notMonitored')}{formatMoney(dailyLoss)}{t('accounts.perDayInterest')}
                                                    </span>
                                                </div>
                                            )}

                                            <div className="grid grid-cols-2 gap-4 text-xs bg-kx-surface p-3 rounded-lg border border-kx-line mb-6">
                                                <div>
                                                    <span className="block text-kx-ink3 uppercase text-[10px] font-bold tracking-wider mb-1">{t("accounts.minPayment")}</span>
                                                    <span className="text-kx-ink font-mono text-sm">{formatMoney(acc.min_payment)}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-kx-ink3 uppercase text-[10px] font-bold tracking-wider mb-1">{t("accounts.dueDate")}</span>
                                                    <span className="text-kx-ink font-mono text-sm">{t("accounts.day")} {acc.due_day}</span>
                                                </div>
                                            </div>

                                            {/* Action buttons — disabled when locked */}
                                            {isLocked ? (
                                                <div className="flex items-center justify-center gap-2 p-2 rounded-lg bg-kx-raised text-kx-ink2 text-xs font-medium pointer-events-none">
                                                    <Lock size={12} />
                                                    {t('upgrade.toManage')}
                                                </div>
                                            ) : (
                                                <div className="flex flex-wrap gap-2">
                                                    <TransactionDrawer account={acc} onUpdate={fetchAccounts} />
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => setUpdatingAccount(acc)}
                                                        className="h-9 px-3 border-kx-line hover:bg-kx-raised text-kx-ink3 hover:text-kx-ink "
                                                        title={t("accounts.manualAdjustment")}
                                                    >
                                                        <RefreshCw size={14} />
                                                    </Button>
                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button variant="outline" size="sm" className="flex-1 min-w-[96px] h-9 border-kx-debt text-kx-debt hover:bg-kx-debt hover:text-[#111418] hover:border-kx-debt transition-all font-medium">
                                                                {t("accounts.payOff")}
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="glass-panel bg-kx-surface border-kx-line ">
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
                    <div className="flex items-center gap-3 pb-2 border-b border-kx-line ">
                        <WidgetHelp helpKey="assetsSection" />
                        <div className="p-2 bg-[color-mix(in_srgb,var(--kx-paid)_10%,transparent)] rounded-lg">
                            <Landmark size={24} className="text-kx-paid" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-kx-ink ">{t("accounts.assets")}</h2>
                            <p className="text-sm text-kx-ink3">{t("accounts.assetsDesc")}</p>
                        </div>
                    </div>

                    {assets.length === 0 ? (
                        <div className="p-12 border border-dashed border-kx-line rounded-xl flex flex-col items-center justify-center text-kx-ink3 bg-kx-surface ">
                            <Landmark size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">{t("accounts.noAssets")}</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(acc => (
                                <Card key={acc.id} className="glass-card group hover:border-[color-mix(in_srgb,var(--kx-paid)_30%,transparent)] transition-all duration-500 bg-kx-surface ">
                                    <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--kx-paid)_5%,transparent)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-kx-ink2 hover:text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)]" onClick={() => requestDeleteAccount(acc)}>
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </Button>
                                    </div>

                                    <CardHeader className="pb-2 relative z-10">
                                        <CardTitle className="text-lg font-bold text-kx-paid ">{acc.name}</CardTitle>
                                    </CardHeader>

                                    <CardContent className="relative z-10">
                                        <div className="text-3xl font-extrabold text-kx-ink tracking-tight mb-1">
                                            {formatMoney(acc.balance)}
                                        </div>
                                        <p className="text-xs text-kx-paid font-medium uppercase tracking-wider mb-6">{t("accounts.availableCash")}</p>

                                        <div className="flex gap-2 mt-auto">
                                            <TransactionDrawer account={acc} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="h-9 w-9 p-0 border-kx-line hover:bg-kx-raised text-kx-ink3 hover:text-kx-ink "
                                                title={t("accounts.manualAdjustment")}
                                            >
                                                <RefreshCw size={14} />
                                            </Button>

                                            <div className="flex gap-1 flex-1">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-[color-mix(in_srgb,var(--kx-paid)_10%,transparent)] text-kx-paid hover:bg-[color-mix(in_srgb,var(--kx-paid)_20%,transparent)] border border-[color-mix(in_srgb,var(--kx-paid)_20%,transparent)] hover:border-[color-mix(in_srgb,var(--kx-paid)_40%,transparent)] text-xs font-semibold">
                                                            {t("accounts.deposit")}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-kx-surface border-kx-line ">
                                                        <AccountActionDialog account={acc} type="deposit" onClose={() => { }} onUpdate={fetchAccounts} />
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-[color-mix(in_srgb,var(--kx-debt)_10%,transparent)] text-kx-debt hover:bg-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] border border-[color-mix(in_srgb,var(--kx-debt)_20%,transparent)] hover:border-[color-mix(in_srgb,var(--kx-debt)_40%,transparent)] text-xs font-semibold">
                                                            {t("accounts.spend")}
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-kx-surface border-kx-line ">
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
                <div className="pt-12 border-t border-kx-line relative group">
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

            {/* 🗑️ Delete Account Confirmation Dialog */}
            <AlertDialog open={!!deleteAccountTarget} onOpenChange={(open) => { if (!open) setDeleteAccountTarget(null); }}>
                <AlertDialogContent className="glass-panel border-[color-mix(in_srgb,var(--kx-debt)_50%,transparent)] bg-kx-surface backdrop-blur-xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-kx-debt flex items-center gap-2">
                            <Trash2 size={18} /> {t("accounts.deleteConfirm")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-kx-ink2 ">
                            {deleteAccountTarget?.name
                                ? (language === 'es'
                                    ? `¿Estás seguro de que deseas eliminar "${deleteAccountTarget.name}"? Esta acción no se puede deshacer.`
                                    : `Are you sure you want to delete "${deleteAccountTarget.name}"? This action cannot be undone.`)
                                : t("accounts.deleteConfirm")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel className="border-kx-line hover:bg-kx-raised text-kx-ink ">
                            {t("accounts.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction onClick={executeDeleteAccount} className="bg-kx-debt hover:bg-kx-debt text-[#111418] shadow-lg ">
                            {t("accounts.delete")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                date: localDay()
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
                <AlertDialogTitle className="text-kx-ink capitalize text-2xl font-bold flex items-center gap-2">
                    {type === 'payment' && <CreditCard className="text-kx-debt" />}
                    {type === 'deposit' && <Landmark className="text-kx-paid" />}
                    {type === 'spend' && <Trash2 className="text-kx-debt" />}
                    {type} {t("accounts.transaction")}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-kx-ink3 ">
                    {type === 'payment' ? `${t("accounts.payOffDesc")} ${account.name}` :
                        type === 'deposit' ? `${t("accounts.addFundsDesc")} ${account.name}` :
                            `${t("accounts.recordExpenseDesc")} ${account.name}`}
                </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-kx-paid font-semibold uppercase tracking-wider">{t("accounts.amount")}</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink2 text-lg">$</span>
                        <Input
                            type="number" step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="bg-kx-surface border-kx-line text-xl font-mono h-12 pl-8 text-kx-ink focus:border-kx-line "
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-kx-ink3 font-semibold uppercase tracking-wider">{t("accounts.descriptionOptional")}</label>
                    <Input
                        placeholder={type === 'deposit' ? "Paycheck, Gift, etc." : "Groceries, Coffee, etc."}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        className="bg-kx-surface border-kx-line text-kx-ink h-11"
                    />
                </div>
            </div>
            <AlertDialogFooter className="pt-2">
                <AlertDialogAction type="submit" className={`w-full h-12 text-lg shadow-lg ${type === 'deposit' ? 'bg-kx-paid hover:bg-kx-paid ' : 'bg-kx-debt hover:bg-kx-debt '}`} disabled={loading}>
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
                    date: localDay()
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
            <DialogContent className="glass-panel sm:max-w-[420px] bg-kx-surface backdrop-blur-2xl border-kx-line text-kx-ink ">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-kx-ink text-xl font-bold">
                        <RefreshCw size={20} className="text-kx-ink2" strokeWidth={2} />
                        {t("accounts.manualAdjustment")}
                    </DialogTitle>
                    <DialogDescription className="text-kx-ink3 ">
                        {t("accounts.adjustBalanceFor")} <span className="text-kx-ink font-medium">{account.name}</span>.
                        <br />
                        <span className="text-xs text-kx-ink2 ">{t("accounts.createsRecord")}</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Operation Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-kx-raised dark:bg-[#0f0f0f]/50 p-1 rounded-lg border border-kx-line ">
                        <button
                            onClick={() => setOperation('add')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'add'
 ? (isDebt ? "bg-kx-debt text-[#111418] shadow-lg " : "bg-kx-paid text-[#111418] shadow-lg ")
 : "text-kx-ink3 hover:text-kx-ink hover:bg-kx-raised "
 }`}
                        >
                            {isDebt ? t("accounts.addCharge") : t("accounts.addDeposit")}
                        </button>
                        <button
                            onClick={() => setOperation('subtract')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'subtract'
 ? (isDebt ? "bg-kx-paid text-[#111418] shadow-lg " : "bg-kx-debt text-[#111418] shadow-lg ")
 : "text-kx-ink3 hover:text-kx-ink hover:bg-kx-raised "
 }`}
                        >
                            {isDebt ? t("accounts.subtractPayment") : t("accounts.subtractExpense")}
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-kx-ink3">
                            {t("accounts.adjustmentAmount")}
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-kx-ink2 text-xl font-light">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-kx-surface border-kx-line pl-8 text-3xl font-mono h-16 font-bold text-kx-ink focus:border-kx-line"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-kx-surface dark:bg-[#0f0f0f]/30 rounded-lg p-4 border border-kx-line space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-kx-ink3">{t("accounts.currentBalanceLabel")}</span>
                            <span className="font-mono text-kx-ink2 ">{formatMoney(currentBalance)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-3 border-b border-kx-line ">
                            <span className={operation === 'add' ? "text-kx-paid" : "text-kx-debt"}>
                                {operation === 'add' ? '+' : '-'} {t("accounts.adjustment")}
                            </span>
                            <span className={`font-mono font-medium ${operation === 'add' ? "text-kx-paid" : "text-kx-debt"}`}>
                                {operation === 'add' ? '+' : '-'}{formatMoney(numAmount)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-kx-ink ">{t("accounts.newBalance")}</span>
                            <span className="font-mono text-kx-ink2 ">{formatMoney(newBalance)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="hover:bg-kx-raised text-kx-ink3 ">{t("accounts.cancel")}</Button>
                    <Button
                        onClick={handleTransaction}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className="bg-kx-raised hover:bg-kx-raised text-kx-ink shadow-lg "
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
            const data = await apiFetch<Transaction[]>(`/api/accounts/${account.id}/transactions`);
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
                date: localDay()
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
                <Button variant="outline" size="sm" className="w-full text-xs h-9 border-kx-line bg-kx-raised hover:bg-kx-raised text-kx-ink2 ">{t("accounts.history")}</Button>
            </SheetTrigger>
            <SheetContent className="bg-kx-surface border-kx-line text-kx-ink w-full sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="text-kx-ink ">{t("accounts.transactions")} {account.name}</SheetTitle>
                    <SheetDescription className="text-kx-ink3 ">
                        {t("accounts.historyContext")} {account.type.toUpperCase()}.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Add Transaction Form */}
                    <div className="bg-kx-surface dark:bg-[#0f0f0f]/50 p-4 rounded-lg border border-kx-line ">
                        <h3 className="text-sm font-medium text-kx-ink2 mb-3">{t("accounts.newTransaction")}</h3>
                        <Form {...txForm}>
                            <form onSubmit={txForm.handleSubmit(onAddTransaction)} className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder={t("accounts.description")} {...field} className="bg-kx-surface border-kx-line h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={txForm.control} name="amount" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" placeholder={t("accounts.amount")} {...field} className="bg-kx-surface border-kx-line h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="type" render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-kx-raised dark:bg-[#0f0f0f] border-kx-line h-8 text-xs">
                                                        <SelectValue placeholder={t("accounts.type")} />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-kx-surface dark:bg-[#0f0f0f] border-kx-line text-kx-ink ">
                                                    <SelectItem value="expense">{t("accounts.expense")}</SelectItem>
                                                    <SelectItem value="income">{t("accounts.income")}</SelectItem>
                                                    <SelectItem value="payment">{t("accounts.payment")}</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <Button type="submit" size="sm" className="h-8 bg-kx-paid hover:bg-kx-paid">{t("accounts.add")}</Button>
                                </div>
                            </form>
                        </Form>
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-kx-ink2 ">{t("accounts.history")}</h3>
                        <ScrollArea className="h-[400px] rounded-md border border-kx-line p-4 bg-kx-surface dark:bg-[#0f0f0f]/20">
                            {loading ? (
                                <div className="flex justify-center items-center h-full text-kx-ink3">
                                    <Loader2 className="animate-spin mr-2" /> {t("accounts.loading")}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {transactions.length === 0 ? (
                                        <p className="text-kx-ink3 text-sm text-center italic py-10">{t("accounts.noTransactions")}</p>
                                    ) : (
                                        transactions.map(tx => (
                                            <div key={tx.id} className="flex justify-between items-center border-b border-kx-line pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-medium text-kx-ink ">{tx.description}</div>
                                                    <div className="text-xs text-kx-ink3">{tx.date} • {tx.category}</div>
                                                </div>
                                                <div className={`font-mono ${tx.amount < 0 ? 'text-kx-debt ' : 'text-kx-paid '}`}>
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
