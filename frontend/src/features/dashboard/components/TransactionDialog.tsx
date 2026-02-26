import { useState, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, DollarSign, CreditCard, Landmark, Wallet } from "lucide-react";
import { apiFetch } from '@/lib/api';
import { WidgetHelp } from '@/components/WidgetHelp';
import { useLanguage } from '@/contexts/LanguageContext';

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { InsufficientFundsDialog } from '@/components/InsufficientFundsDialog';
import { useInsufficientFundsDialog } from '@/hooks/useInsufficientFundsDialog';

const formSchema = z.object({
    account_id: z.string().min(1, "Account is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    description: z.string().min(2, "Description must be at least 2 characters"),
    category: z.string().optional().default(""),
    type: z.enum(["income", "expense"]),
});

type TransactionFormValues = z.infer<typeof formSchema>;

interface AccountFull {
    id: number;
    name: string;
    type: string;
    debt_subtype?: string;
    balance: number;
}

interface TransactionDialogProps {
    children?: React.ReactNode;
    defaultType?: "income" | "expense";
    onSuccess?: () => void;
    defaultAccountId?: string;
    defaultAmount?: number;
    defaultDescription?: string;
}

// ── Account grouping helper ──────────────────────────────────
const CREDIT_CARD_SUBTYPES = ["credit_card", "heloc"];

function groupAccounts(accounts: AccountFull[], isEs: boolean) {
    const bankAccounts: AccountFull[] = [];
    const creditCards: AccountFull[] = [];
    const otherDebts: AccountFull[] = [];

    for (const acc of accounts) {
        if (acc.type === "debt") {
            if (CREDIT_CARD_SUBTYPES.includes(acc.debt_subtype || "")) {
                creditCards.push(acc);
            } else {
                otherDebts.push(acc);
            }
        } else {
            bankAccounts.push(acc);
        }
    }

    const groups: { label: string; icon: string; accounts: AccountFull[] }[] = [];
    if (bankAccounts.length > 0) {
        groups.push({ label: isEs ? '🏦 Cuentas Bancarias' : '🏦 Bank Accounts', icon: 'bank', accounts: bankAccounts });
    }
    if (creditCards.length > 0) {
        groups.push({ label: isEs ? '💳 Tarjetas de Crédito' : '💳 Credit Cards', icon: 'cc', accounts: creditCards });
    }
    if (otherDebts.length > 0) {
        groups.push({ label: isEs ? '📋 Otros Préstamos' : '📋 Other Loans', icon: 'loan', accounts: otherDebts });
    }

    return groups;
}

export function TransactionDialog({
    children,
    defaultType = "expense",
    onSuccess,
    defaultAccountId,
    defaultAmount,
    defaultDescription
}: TransactionDialogProps) {
    const [open, setOpen] = useState(false);
    const [accounts, setAccounts] = useState<AccountFull[]>([]);
    const [loading, setLoading] = useState(false);
    const { language } = useLanguage();
    const isEs = language === 'es';
    const fundsDialog = useInsufficientFundsDialog();

    const form = useForm<any>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: defaultAmount || 0,
            description: defaultDescription || "",
            category: "",
            type: defaultType,
            account_id: defaultAccountId?.toString() || "",
        },
    });

    // Fetch full account data on open (includes type & debt_subtype for grouping)
    useEffect(() => {
        if (open) {
            apiFetch<AccountFull[]>('/api/accounts')
                .then((data) => setAccounts(data))
                .catch((err) => console.error("Error fetching accounts:", err));
        }
    }, [open]);

    // Update form values when props change or dialog opens
    useEffect(() => {
        if (open) {
            if (defaultType) form.setValue("type", defaultType);
            if (defaultAccountId) form.setValue("account_id", defaultAccountId.toString());
            if (defaultAmount) form.setValue("amount", defaultAmount);
            if (defaultDescription) form.setValue("description", defaultDescription);
        }
    }, [open, defaultType, defaultAccountId, defaultAmount, defaultDescription, form]);

    const [activeTab, setActiveTab] = useState(defaultType);

    const onTabChange = (value: string) => {
        const type = value as "income" | "expense";
        setActiveTab(type);
        form.setValue("type", type);
    };

    // Memoize grouped accounts to avoid re-calculating on every render
    const accountGroups = useMemo(() => groupAccounts(accounts, isEs), [accounts, isEs]);

    async function onSubmit(values: TransactionFormValues) {
        setLoading(true);
        try {
            const finalAmount = values.type === 'expense' ? -Math.abs(values.amount) : Math.abs(values.amount);

            await apiFetch('/api/transactions/manual', {
                method: 'POST',
                body: JSON.stringify({
                    account_id: parseInt(values.account_id),
                    amount: finalAmount,
                    description: values.description,
                    category: values.category || (values.type === 'income' ? 'Income' : 'General'),
                    date: new Date().toISOString().split('T')[0],
                }),
            });

            toast.success("Transaction Record Saved", {
                description: `${values.type === 'income' ? '+' : '-'}$${Math.abs(values.amount)} - ${values.description}`
            });

            form.reset({
                amount: 0,
                description: "",
                category: "",
                type: defaultType,
                account_id: "",
            });

            setOpen(false);
            if (onSuccess) onSuccess();

        } catch (error: unknown) {
            if (!fundsDialog.showIfInsufficientFunds(error)) {
                console.error(error);
                toast.error(isEs ? "Error al guardar la transacción" : "Failed to save transaction");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-black border-gray-200 dark:border-neutral-800 text-slate-900 dark:text-white">
                <DialogHeader className="relative group">
                    <WidgetHelp helpKey="addTransaction" />
                    <DialogTitle>{isEs ? 'Registrar Transacción' : 'Add Transaction'}</DialogTitle>
                    <DialogDescription className="text-gray-500">
                        {isEs ? 'Registra un movimiento manualmente para actualizar tu posición de efectivo.' : 'Manually record a transaction to update your cash position.'}
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-gray-100 dark:bg-[#0f0f0f]">
                        <TabsTrigger value="income" className="data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-400">
                            {isEs ? 'Ingreso' : 'Income'}
                        </TabsTrigger>
                        <TabsTrigger value="expense" className="data-[state=active]:bg-rose-950 data-[state=active]:text-rose-400">
                            {isEs ? 'Gasto' : 'Expense'}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">

                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isEs ? 'Monto' : 'Amount'}</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="pl-8 bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-800"
                                                placeholder="0.00"
                                                {...field}
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isEs ? 'Descripción' : 'Description'}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={isEs ? 'Supermercado, Salario, etc.' : 'Grocery, Salary, etc.'} className="bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-800" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* ── Account Selector with Groups ── */}
                        <FormField
                            control={form.control}
                            name="account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{isEs ? 'Cuenta' : 'Account'}</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-gray-50 dark:bg-[#0f0f0f] border-slate-300 dark:border-neutral-800 text-slate-900 dark:text-white">
                                                <SelectValue placeholder={isEs ? 'Seleccionar cuenta' : 'Select account'} />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-white dark:bg-[#0f0f0f] border-gray-200 dark:border-neutral-800 text-slate-900 dark:text-white max-h-64">
                                            {accountGroups.map((group) => (
                                                <SelectGroup key={group.label}>
                                                    <SelectLabel className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1.5">
                                                        {group.label}
                                                    </SelectLabel>
                                                    {group.accounts.map((acc) => (
                                                        <SelectItem
                                                            key={acc.id}
                                                            value={acc.id.toString()}
                                                            className="pl-4"
                                                        >
                                                            <span className="flex items-center gap-2">
                                                                {acc.type === 'debt'
                                                                    ? CREDIT_CARD_SUBTYPES.includes(acc.debt_subtype || '')
                                                                        ? <CreditCard size={12} className="text-purple-400 shrink-0" />
                                                                        : <Wallet size={12} className="text-orange-400 shrink-0" />
                                                                    : <Landmark size={12} className="text-emerald-400 shrink-0" />
                                                                }
                                                                {acc.name}
                                                            </span>
                                                        </SelectItem>
                                                    ))}
                                                </SelectGroup>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={loading} className={activeTab === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {activeTab === 'income' ? (isEs ? 'Registrar Ingreso' : 'Add Income') : (isEs ? 'Registrar Gasto' : 'Add Expense')}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
            <InsufficientFundsDialog data={fundsDialog.errorData} onClose={fundsDialog.dismiss} />
        </Dialog>
    );
}
