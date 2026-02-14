import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, CreditCard, Landmark, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { CashflowManager } from './components/CashflowManager';

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
    const { toast } = useToast();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [updatingAccount, setUpdatingAccount] = useState<Account | null>(null);


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
        },
    });

    // API Functions
    const fetchAccounts = async () => {
        try {
            setErrorMsg(null);
            const res = await fetch('/api/accounts');
            if (!res.ok) throw new Error("Failed to fetch accounts");
            const data = await res.json();
            // Ensure numbers
            const safeData = data.map((acc: any) => ({
                ...acc,
                balance: Number(acc.balance),
                interest_rate: Number(acc.interest_rate),
                min_payment: Number(acc.min_payment)
            }));
            setAccounts(safeData);
        } catch (err) {
            console.error(err);
            setErrorMsg("Error connecting to the backend engine.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const onSubmit = async (values: AccountFormValues) => {
        setIsSubmitting(true);
        try {
            const res = await fetch('/api/accounts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(values),
            });

            if (!res.ok) throw new Error("Failed to create account");

            await fetchAccounts();
            setIsDialogOpen(false);
            form.reset();
            toast({ title: "Account Created", description: "Successfully added to your financial network." });
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to create account.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const confirmDelete = async (id: number) => {
        if (!confirm("Are you sure? This will verify related transactions and delete history.")) return;
        try {
            const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setAccounts(prev => prev.filter(a => a.id !== id));
                toast({ title: "Account Deleted", variant: "destructive" });
            }
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const handleResetSystem = async () => {
        try {
            const res = await fetch('/api/accounts', { method: 'DELETE' });
            if (res.ok) {
                setAccounts([]);
                toast({ title: "System Reset", description: "All accounts and transactions wiped." });
                window.location.reload();
            }
        } catch (e) {
            console.error("Reset failed", e);
        }
    };

    // Derived State
    const debts = accounts.filter(a => a.type === 'debt');
    const assets = accounts.filter(a => ['checking', 'savings', 'investment'].includes(a.type));

    // Formatting
    const formatMoney = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

    return (
        <div className="container mx-auto p-6 space-y-10 animate-in fade-in duration-700 max-w-7xl pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h1 className="text-4xl font-bold tracking-tight text-white drop-shadow-lg mb-2">
                        Financial Network
                    </h1>
                    <p className="text-slate-400 font-light text-lg">Manage your connected assets and liabilities</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="icon" onClick={fetchAccounts} title="Refresh Data" className="border-white/10 hover:bg-white/5">
                        <RefreshCw size={18} className={isLoading ? "animate-spin text-gold-400" : "text-slate-400"} strokeWidth={1.5} />
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive" className="shadow-lg shadow-rose-900/20 hover:shadow-rose-900/40">Reset System</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="glass-panel border-rose-900/50 bg-slate-950/90 backdrop-blur-xl">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-rose-500 flex items-center gap-2">
                                    <AlertCircle size={20} /> Nuclear Option: Hard Reset
                                </AlertDialogTitle>
                                <AlertDialogDescription className="text-slate-300">
                                    This will delete <b>ALL accounts, transactions, and movement logs</b>.
                                    This action cannot be undone. Are you absolutely sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-white/10 hover:bg-white/5 text-slate-300">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetSystem} className="bg-rose-600 hover:bg-rose-700 text-white shadow-lg shadow-rose-900/50">
                                    Yes, Wipe Everything
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="glow" className="font-bold tracking-wide">
                                <Plus className="mr-2 h-4 w-4" strokeWidth={2} /> Add Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="glass-panel sm:max-w-[450px] bg-slate-950/90 backdrop-blur-2xl border-white/10">
                            <DialogHeader>
                                <DialogTitle className="text-2xl font-bold text-white">Add Manual Account</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Enter account details manually to track in the Velocity engine.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 mt-2">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-emerald-400 font-semibold">Account Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Chase Sapphire, Wells Fargo" {...field} className="bg-slate-950/50 border-white/10 focus:border-emerald-500/50 text-white h-11" />
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
                                                    <FormLabel className="text-emerald-400 font-semibold">Type</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-11">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                                            <SelectItem value="debt">Debt (Credit/Loan)</SelectItem>
                                                            <SelectItem value="checking">Checking (Cash)</SelectItem>
                                                            <SelectItem value="savings">Savings (Reserve)</SelectItem>
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
                                                    <FormLabel className="text-emerald-400 font-semibold">Current Balance</FormLabel>
                                                    <FormControl>
                                                        <div className="relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                                            <Input type="number" placeholder="0.00" {...field} className="bg-slate-950/50 border-white/10 focus:border-emerald-500/50 text-white pl-7 h-11 font-mono" />
                                                        </div>
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    {form.watch("type") === "debt" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="interest_rate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-rose-400 font-semibold">APR (%)</FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <Input type="number" step="0.01" placeholder="24.99" {...field} className="bg-slate-950/50 border-white/10 focus:border-rose-500/50 text-white h-11 font-mono pr-8" />
                                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">%</span>
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
                                                            <FormLabel className="flex items-center justify-between text-rose-400 font-semibold">
                                                                Min. Payment
                                                                <span className="text-[10px] bg-slate-800/50 text-slate-400 px-1.5 py-0.5 rounded border border-white/5 uppercase tracking-wider" title="Leave 0 to auto-calculate">Optional</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <div className="relative">
                                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600">$</span>
                                                                    <Input
                                                                        type="number"
                                                                        {...field}
                                                                        className="bg-slate-950/50 border-white/10 focus:border-rose-500/50 text-white pl-7 h-11 font-mono"
                                                                        placeholder="0.00 (Auto)"
                                                                    />
                                                                </div>
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-5 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="closing_day"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="text-slate-300">Closing Day (Corte)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="15" {...field} className="bg-slate-950/50 border-white/10 text-white h-11" />
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
                                                            <FormLabel className="text-slate-300">Due Day (Pago)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="1" {...field} className="bg-slate-950/50 border-white/10 text-white h-11" />
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
                                            {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : "Verify & Connect"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {errorMsg && (
                <div className="glass-panel bg-rose-950/10 border-rose-900/50 p-4 rounded-lg flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} className="text-rose-500" />
                    <span className="font-medium">{errorMsg}</span>
                </div>
            )}

            {/* Content Grid */}
            <div className="space-y-12">
                {/* Liabilities */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                        <div className="p-2 bg-rose-500/10 rounded-lg">
                            <CreditCard size={24} className="text-rose-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Liabilities (Debt)</h2>
                            <p className="text-sm text-slate-500">Credit cards and loans attacking your wealth</p>
                        </div>
                    </div>

                    {debts.length === 0 ? (
                        <div className="p-12 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-950/30">
                            <CreditCard size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No debts added yet.</p>
                            <p className="text-sm opacity-60">You are either free or haven't connected your burdens.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {debts.map(acc => (
                                <Card key={acc.id} className="glass-card group hover:border-rose-500/30 transition-all duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-400" onClick={() => confirmDelete(acc.id)}>
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </Button>
                                    </div>

                                    <CardHeader className="pb-2 relative z-10">
                                        <CardTitle className="flex justify-between items-start">
                                            <span className="text-lg font-bold text-white group-hover:text-rose-200 transition-colors truncate pr-8">{acc.name}</span>
                                            <span className="text-[10px] bg-rose-950/40 border border-rose-500/20 px-2 py-1 rounded text-rose-300 font-mono tracking-wide">
                                                {acc.interest_rate}% APR
                                            </span>
                                        </CardTitle>
                                    </CardHeader>

                                    <CardContent className="relative z-10">
                                        <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
                                            {formatMoney(acc.balance)}
                                        </div>
                                        <p className="text-xs text-rose-400/80 font-medium uppercase tracking-wider mb-6">Outstanding Balance</p>

                                        <div className="grid grid-cols-2 gap-4 text-xs bg-slate-950/30 p-3 rounded-lg border border-white/5 mb-6">
                                            <div>
                                                <span className="block text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">Min. Payment</span>
                                                <span className="text-slate-200 font-mono text-sm">{formatMoney(acc.min_payment)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-500 uppercase text-[10px] font-bold tracking-wider mb-1">Due Date</span>
                                                <span className="text-slate-200 font-mono text-sm">Day {acc.due_day}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2">
                                            <TransactionDrawer account={acc} formatMoney={formatMoney} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="h-9 px-3 border-white/10 hover:bg-white/5 text-slate-400 hover:text-white"
                                                title="Manual Adjustment"
                                            >
                                                <RefreshCw size={14} />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="flex-1 h-9 border-rose-900/30 text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 hover:border-rose-500/50 transition-all font-medium">
                                                        Pay Off
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="glass-panel bg-slate-950/90 border-white/10">
                                                    <AccountActionDialog account={acc} type="payment" onClose={() => { }} onUpdate={fetchAccounts} />
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>

                {/* Assets */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                        <div className="p-2 bg-emerald-500/10 rounded-lg">
                            <Landmark size={24} className="text-emerald-500" strokeWidth={1.5} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Assets (Cash)</h2>
                            <p className="text-sm text-slate-500">Checking and savings fueling your velocity</p>
                        </div>
                    </div>

                    {assets.length === 0 ? (
                        <div className="p-12 border border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center text-slate-500 bg-slate-950/30">
                            <Landmark size={48} className="mb-4 opacity-20" />
                            <p className="text-lg font-medium">No assets connected.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {assets.map(acc => (
                                <Card key={acc.id} className="glass-card group hover:border-emerald-500/30 transition-all duration-500">
                                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10" onClick={() => confirmDelete(acc.id)}>
                                            <Trash2 size={14} strokeWidth={1.5} />
                                        </Button>
                                    </div>

                                    <CardHeader className="pb-2 relative z-10">
                                        <CardTitle className="text-lg font-bold text-emerald-400">{acc.name}</CardTitle>
                                    </CardHeader>

                                    <CardContent className="relative z-10">
                                        <div className="text-3xl font-extrabold text-white tracking-tight mb-1">
                                            {formatMoney(acc.balance)}
                                        </div>
                                        <p className="text-xs text-emerald-400/80 font-medium uppercase tracking-wider mb-6">Available Cash</p>

                                        <div className="flex gap-2 mt-auto">
                                            <TransactionDrawer account={acc} formatMoney={formatMoney} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="h-9 w-9 p-0 border-white/10 hover:bg-white/5 text-slate-400 hover:text-white"
                                                title="Manual Adjustment"
                                            >
                                                <RefreshCw size={14} />
                                            </Button>

                                            <div className="flex gap-1 flex-1">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 hover:border-emerald-500/40 text-xs font-semibold">
                                                            Deposit
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-slate-950/90 border-white/10">
                                                        <AccountActionDialog account={acc} type="deposit" onClose={() => { }} onUpdate={fetchAccounts} />
                                                    </AlertDialogContent>
                                                </AlertDialog>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button size="sm" className="flex-1 h-9 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20 hover:border-rose-500/40 text-xs font-semibold">
                                                            Spend
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent className="glass-panel bg-slate-950/90 border-white/10">
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
                <div className="pt-12 border-t border-white/5">
                    <CashflowManager />
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
        </div>
    );
}

// --- Helper Components ---

function AccountActionDialog({ account, type, onClose, onUpdate }: { account: Account, type: 'deposit' | 'spend' | 'payment', onClose: () => void, onUpdate: () => void }) {
    const [amount, setAmount] = useState("");
    const [desc, setDesc] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            let finalAmount = parseFloat(amount);
            if (type === 'spend' || type === 'payment') finalAmount = -Math.abs(finalAmount);
            else finalAmount = Math.abs(finalAmount);

            const payload = {
                account_id: account.id,
                amount: finalAmount,
                description: desc || (type === 'deposit' ? 'Manual Deposit' : 'Manual Expense'),
                category: type === 'payment' ? 'payment' : 'manual',
                date: new Date().toISOString().split('T')[0]
            };

            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                onUpdate();
                onClose(); // In a real dialog, this might need more logic to close the parent
            }
        } catch (e) {
            console.error("Action failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            <DialogHeader>
                <DialogTitle className="text-white capitalize text-2xl font-bold flex items-center gap-2">
                    {type === 'payment' && <CreditCard className="text-rose-500" />}
                    {type === 'deposit' && <Landmark className="text-emerald-500" />}
                    {type === 'spend' && <Trash2 className="text-rose-500" />}
                    {type} Transaction
                </DialogTitle>
                <DialogDescription className="text-slate-400">
                    {type === 'payment' ? `Pay off debt for ${account.name}` :
                        type === 'deposit' ? `Add funds to ${account.name}` :
                            `Record expense from ${account.name}`}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
                <div className="space-y-2">
                    <label className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">Amount</label>
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
                        <Input
                            type="number" step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="bg-slate-950/50 border-white/10 text-xl font-mono h-12 pl-8 text-white focus:border-white/20"
                            placeholder="0.00"
                            autoFocus
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Description (Optional)</label>
                    <Input
                        placeholder={type === 'deposit' ? "Paycheck, Gift, etc." : "Groceries, Coffee, etc."}
                        value={desc}
                        onChange={e => setDesc(e.target.value)}
                        className="bg-slate-950/50 border-white/10 text-white h-11"
                    />
                </div>
            </div>
            <DialogFooter className="pt-2">
                <AlertDialogAction type="submit" className={`w-full h-12 text-lg shadow-lg ${type === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20' : 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20'}`} disabled={loading}>
                    {loading ? <Loader2 className="animate-spin" /> : 'Confirm Transaction'}
                </AlertDialogAction>
            </DialogFooter>
        </form>
    );
}

function ManualAdjustmentDialog({ account, onClose, onUpdate }: { account: Account, onClose: () => void, onUpdate: () => void }) {
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

            const res = await fetch(`/api/transactions/manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    account_id: account.id,
                    amount: finalAmount,
                    description: "Manual Adjustment",
                    category: "Adjustment",
                    date: new Date().toISOString().split('T')[0]
                })
            });

            if (res.ok) {
                onUpdate();
                onClose();
            }
        } catch (e) {
            console.error("Adjustment failed", e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="glass-panel sm:max-w-[420px] bg-slate-950/90 backdrop-blur-2xl border-white/10 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white text-xl font-bold">
                        <RefreshCw size={20} className="text-blue-500" strokeWidth={2} />
                        Manual Adjustment
                    </DialogTitle>
                    <DialogDescription className="text-slate-400">
                        Adjust the balance for <span className="text-white font-medium">{account.name}</span>.
                        <br />
                        <span className="text-xs text-slate-500">This will create a transaction record.</span>
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Operation Selector */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-900/50 p-1 rounded-lg border border-white/5">
                        <button
                            onClick={() => setOperation('add')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'add'
                                ? (isDebt ? "bg-rose-500 text-white shadow-lg shadow-rose-900/20" : "bg-emerald-500 text-white shadow-lg shadow-emerald-900/20")
                                : "text-slate-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {isDebt ? "Add Charge (+)" : "Add Deposit (+)"}
                        </button>
                        <button
                            onClick={() => setOperation('subtract')}
                            className={`py-2.5 text-sm font-medium rounded-md transition-all ${operation === 'subtract'
                                ? (isDebt ? "bg-emerald-500 text-white shadow-lg shadow-emerald-900/20" : "bg-rose-500 text-white shadow-lg shadow-rose-900/20")
                                : "text-slate-500 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {isDebt ? "Subtract Payment (-)" : "Subtract Expense (-)"}
                        </button>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                            Adjustment Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xl font-light">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-slate-950/50 border-white/10 pl-8 text-3xl font-mono h-16 font-bold text-white focus:border-blue-500/50"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-slate-900/30 rounded-lg p-4 border border-white/5 space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <span className="text-slate-500">Current Balance:</span>
                            <span className="font-mono text-slate-300">${currentBalance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-3 border-b border-white/5">
                            <span className={operation === 'add' ? "text-emerald-500" : "text-rose-500"}>
                                {operation === 'add' ? '+' : '-'} Adjustment:
                            </span>
                            <span className={`font-mono font-medium ${operation === 'add' ? "text-emerald-500" : "text-rose-500"}`}>
                                {operation === 'add' ? '+' : '-'}${numAmount.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-lg font-bold">
                            <span className="text-white">New Balance:</span>
                            <span className="font-mono text-blue-400">${newBalance.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="hover:bg-white/10 text-slate-400">Cancel</Button>
                    <Button
                        onClick={handleTransaction}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                    >
                        {loading ? <Loader2 className="animate-spin mr-2" /> : 'Apply Transaction'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function TransactionDrawer({ account, formatMoney, onUpdate }: { account: Account, formatMoney: (v: number) => string, onUpdate: () => void }) {
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
            const res = await fetch(`/api/accounts/${account.id}/transactions`);
            if (res.ok) {
                const data = await res.json();
                setTransactions(data);
            }
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

            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                txForm.reset();
                fetchTransactions();
                onUpdate(); // Call parent update
            }
        } catch (e) {
            console.error("Tx failed", e);
        }
    };

    return (
        <Sheet onOpenChange={(open: boolean) => open && fetchTransactions()}>
            <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="w-full text-xs h-9 border-zinc-700 bg-zinc-800/50 hover:bg-slate-800 text-zinc-300">History</Button>
            </SheetTrigger>
            <SheetContent className="bg-slate-950 border-slate-800 text-white w-[400px] sm:w-[540px]">
                <SheetHeader>
                    <SheetTitle className="text-white">Transactions: {account.name}</SheetTitle>
                    <SheetDescription className="text-slate-400">
                        History of payments and expenses. Context: {account.type.toUpperCase()}.
                    </SheetDescription>
                </SheetHeader>

                <div className="py-6 space-y-6">
                    {/* Add Transaction Form */}
                    <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800">
                        <h3 className="text-sm font-medium text-zinc-300 mb-3">New Transaction</h3>
                        <Form {...txForm}>
                            <form onSubmit={txForm.handleSubmit(onAddTransaction)} className="space-y-3">
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="description" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input placeholder="Description" {...field} className="bg-slate-950 border-slate-800 h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                    <FormField control={txForm.control} name="amount" render={({ field }) => (
                                        <FormItem>
                                            <FormControl><Input type="number" placeholder="Amount" {...field} className="bg-slate-950 border-slate-800 h-8 text-xs" /></FormControl>
                                        </FormItem>
                                    )} />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <FormField control={txForm.control} name="type" render={({ field }) => (
                                        <FormItem>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger className="bg-slate-900 border-slate-800 h-8 text-xs">
                                                        <SelectValue placeholder="Type" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                                    <SelectItem value="expense">Expense</SelectItem>
                                                    <SelectItem value="income">Income</SelectItem>
                                                    <SelectItem value="payment">Payment</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </FormItem>
                                    )} />
                                    <Button type="submit" size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-500">Add</Button>
                                </div>
                            </form>
                        </Form>
                    </div>

                    {/* Transaction List */}
                    <div className="space-y-2">
                        <h3 className="text-sm font-medium text-zinc-300">History</h3>
                        <ScrollArea className="h-[400px] rounded-md border border-slate-800 p-4 bg-slate-900/20">
                            {loading ? (
                                <div className="flex justify-center items-center h-full text-slate-500">
                                    <Loader2 className="animate-spin mr-2" /> Loading...
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {transactions.length === 0 ? (
                                        <p className="text-slate-500 text-sm text-center italic py-10">No transactions recorded.</p>
                                    ) : (
                                        transactions.map(tx => (
                                            <div key={tx.id} className="flex justify-between items-center border-b border-slate-800 pb-2 last:border-0 last:pb-0">
                                                <div>
                                                    <div className="font-medium text-zinc-200">{tx.description}</div>
                                                    <div className="text-xs text-slate-500">{tx.date} • {tx.category}</div>
                                                </div>
                                                <div className={`font-mono ${tx.amount < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
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
