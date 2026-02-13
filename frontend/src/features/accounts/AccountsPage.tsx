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
            const res = await fetch('http://127.0.0.1:8001/api/accounts');
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
            const res = await fetch('http://127.0.0.1:8001/api/accounts', {
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
            const res = await fetch(`http://127.0.0.1:8001/api/accounts/${id}`, { method: 'DELETE' });
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
            const res = await fetch('http://127.0.0.1:8001/api/accounts', { method: 'DELETE' });
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
        <div className="container mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
                        Financial Network
                    </h1>
                    <p className="text-slate-500 mt-1">Manage your connected assets and liabilities</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" size="icon" onClick={fetchAccounts} title="Refresh Data">
                        <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} strokeWidth={1.5} />
                    </Button>

                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="destructive">Reset System</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-slate-950 border-rose-900/50">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="text-rose-500">Nuclear Option: Hard Reset</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will delete <b>ALL accounts, transactions, and movement logs</b>.
                                    This action cannot be undone. Are you absolutely sure?
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="border-none hover:bg-slate-900">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleResetSystem} className="bg-rose-600 hover:bg-rose-700">
                                    Yes, Wipe Everything
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>

                    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:scale-105 active:scale-95">
                                <Plus className="mr-2 h-4 w-4" strokeWidth={1.5} /> Add Account
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-white">
                            <DialogHeader>
                                <DialogTitle>Add Manual Account</DialogTitle>
                                <DialogDescription className="text-slate-400">
                                    Enter account details manually.
                                </DialogDescription>
                            </DialogHeader>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Account Name</FormLabel>
                                                <FormControl>
                                                    <Input placeholder="e.g. Chase Sapphire, Wells Fargo" {...field} className="bg-slate-900 border-slate-800" />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="type"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Type</FormLabel>
                                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                        <FormControl>
                                                            <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                                                <SelectValue placeholder="Select type" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
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
                                                    <FormLabel>Current Balance</FormLabel>
                                                    <FormControl>
                                                        <Input type="number" placeholder="0.00" {...field} className="bg-slate-900 border-slate-800" />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    {form.watch("type") === "debt" && (
                                        <>
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="interest_rate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>APR (%)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" step="0.01" placeholder="24.99" {...field} className="bg-slate-900 border-slate-800" />
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
                                                            <FormLabel className="flex items-center justify-between">
                                                                Min. Payment
                                                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Auto</span>
                                                            </FormLabel>
                                                            <FormControl>
                                                                <Input
                                                                    type="number"
                                                                    {...field}
                                                                    className="bg-slate-900/50 border-slate-800 text-slate-500 cursor-not-allowed"
                                                                    disabled={true}
                                                                    placeholder="Auto-calculated"
                                                                />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                                <FormField
                                                    control={form.control}
                                                    name="closing_day"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Closing Day (Corte)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="15" {...field} className="bg-slate-900 border-slate-800" />
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
                                                            <FormLabel>Due Day (Pago)</FormLabel>
                                                            <FormControl>
                                                                <Input type="number" min="1" max="31" placeholder="1" {...field} className="bg-slate-900 border-slate-800" />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </>
                                    )}
                                    <DialogFooter className="pt-4">
                                        <Button type="submit" disabled={isSubmitting} className="w-full bg-emerald-600 hover:bg-emerald-500">
                                            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify & Connect"}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </Form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {errorMsg && (
                <div className="bg-rose-950/30 border border-rose-900/50 p-4 rounded-lg flex items-center gap-3 text-rose-400">
                    <AlertCircle size={20} strokeWidth={1.5} />
                    <span>{errorMsg}</span>
                </div>
            )}

            {/* Content Grid */}
            <div className="space-y-8">
                {/* Liabilities */}
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-rose-400 flex items-center gap-2">
                        <CreditCard size={20} strokeWidth={1.5} /> Liabilities (Debt)
                    </h2>
                    {debts.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 bg-slate-950/50">
                            <CreditCard size={32} className="mb-2 opacity-50" />
                            <p>No debts added yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {debts.map(acc => (
                                <Card key={acc.id} className="relative overflow-hidden group hover:border-rose-500/50 transition-all">
                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:bg-rose-900/20" onClick={() => confirmDelete(acc.id)}>
                                            <Trash2 size={12} strokeWidth={1.5} />
                                        </Button>
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-rose-500 flex justify-between">
                                            {acc.name}
                                            <span className="text-xs bg-rose-950/50 px-2 py-0.5 rounded text-rose-300">{acc.interest_rate}% APR</span>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-white">{formatMoney(acc.balance)}</div>
                                        <p className="text-xs text-slate-500 mt-1">Outstanding Balance</p>

                                        <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] text-slate-400 border-t border-slate-800/50 pt-3">
                                            <div>
                                                <span className="block text-slate-500 uppercase font-semibold">Min. Payment</span>
                                                <span className="text-slate-200">{formatMoney(acc.min_payment)}</span>
                                            </div>
                                            <div>
                                                <span className="block text-slate-500 uppercase font-semibold">Schedule</span>
                                                <span className="text-slate-200">Cut: {acc.closing_day} | Due: {acc.due_day}</span>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 mt-4">
                                            <TransactionDrawer account={acc} formatMoney={formatMoney} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="text-xs h-9 text-slate-500 hover:text-white hover:bg-slate-800"
                                                title="Manual Adjustment"
                                            >
                                                <RefreshCw size={14} strokeWidth={1.5} />
                                            </Button>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="outline" size="sm" className="w-full text-xs h-9 border-rose-900 text-rose-400 hover:bg-rose-900/20">Pay Off</Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="bg-slate-950 border-slate-800">
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
                <div className="space-y-4">
                    <h2 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                        <Landmark size={20} strokeWidth={1.5} /> Assets (Cash)
                    </h2>
                    {assets.length === 0 ? (
                        <div className="p-8 border border-dashed border-slate-800 rounded-lg flex flex-col items-center justify-center text-slate-500 bg-slate-950/50">
                            <Landmark size={32} className="mb-2 opacity-50" />
                            <p>No assets connected.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {assets.map(acc => (
                                <Card key={acc.id} className="relative overflow-hidden group hover:border-emerald-500/50 transition-all">
                                    <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-rose-500 hover:bg-rose-900/20" onClick={() => confirmDelete(acc.id)}>
                                            <Trash2 size={12} strokeWidth={1.5} />
                                        </Button>
                                    </div>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium text-emerald-500">{acc.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold text-white">{formatMoney(acc.balance)}</div>
                                        <p className="text-xs text-slate-500 mt-1">Available Cash</p>
                                        <div className="flex gap-2 mt-4">
                                            <TransactionDrawer account={acc} formatMoney={formatMoney} onUpdate={fetchAccounts} />
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setUpdatingAccount(acc)}
                                                className="h-9 px-2 text-slate-500 hover:text-white hover:bg-slate-800"
                                                title="Manual Adjustment"
                                            >
                                                <RefreshCw size={14} strokeWidth={1.5} />
                                            </Button>
                                            <div className="flex gap-1 w-full">
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button size="sm" className="w-full text-xs h-9 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/40 border border-emerald-900/50">Dep</Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-slate-950 border-slate-800"><AccountActionDialog account={acc} type="deposit" onClose={() => { }} onUpdate={fetchAccounts} /></AlertDialogContent>
                                                </AlertDialog>
                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild><Button size="sm" className="w-full text-xs h-9 bg-rose-900/20 text-rose-400 hover:bg-rose-900/40 border border-rose-900/50">Spd</Button></AlertDialogTrigger>
                                                    <AlertDialogContent className="bg-slate-950 border-slate-800"><AccountActionDialog account={acc} type="spend" onClose={() => { }} onUpdate={fetchAccounts} /></AlertDialogContent>
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
                <div className="pt-8 border-t border-zinc-900">
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
            )};
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

            const res = await fetch('http://127.0.0.1:8001/api/transactions', {
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
        <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
                <DialogTitle className="text-white capitalize">{type} Transaction</DialogTitle>
                <DialogDescription>
                    {type === 'payment' ? `Pay off debt for ${account.name}` :
                        type === 'deposit' ? `Add funds to ${account.name}` :
                            `Record expense from ${account.name}`}
                </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <label className="text-xs text-slate-400">Amount</label>
                <Input
                    type="number" step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    className="bg-slate-900 border-slate-800 text-lg"
                    placeholder="0.00"
                    autoFocus
                />
            </div>
            <div className="space-y-2">
                <label className="text-xs text-slate-400">Description (Optional)</label>
                <Input
                    placeholder={type === 'deposit' ? "Paycheck, Gift, etc." : "Groceries, Coffee, etc."}
                    value={desc}
                    onChange={e => setDesc(e.target.value)}
                    className="bg-slate-900 border-slate-800"
                />
            </div>
            <DialogFooter>
                <AlertDialogAction type="submit" className={`w-full ${type === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-rose-600 hover:bg-rose-500'}`} disabled={loading}>
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

            const res = await fetch(`http://127.0.0.1:8001/api/transactions/manual`, {
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
            <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-[400px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-white">
                        <RefreshCw size={18} className="text-blue-500" strokeWidth={1.5} />
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
                    <div className="grid grid-cols-2 gap-2 bg-slate-900 p-1 rounded-lg">
                        <button
                            onClick={() => setOperation('add')}
                            className={`py-2 text-sm font-medium rounded-md transition-all ${operation === 'add'
                                ? (isDebt ? "bg-rose-900/50 text-rose-200 shadow-sm" : "bg-emerald-900/50 text-emerald-200 shadow-sm")
                                : "text-slate-500 hover:text-slate-300"
                                }`}
                        >
                            {isDebt ? "Add Charge (+)" : "Add Deposit (+)"}
                        </button>
                        <button
                            onClick={() => setOperation('subtract')}
                            className={`py-2 text-sm font-medium rounded-md transition-all ${operation === 'subtract'
                                ? (isDebt ? "bg-emerald-900/50 text-emerald-200 shadow-sm" : "bg-rose-900/50 text-rose-200 shadow-sm")
                                : "text-slate-500 hover:text-slate-300"
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">$</span>
                            <Input
                                type="number"
                                step="0.01"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="bg-slate-900 border-slate-800 pl-7 text-2xl font-mono h-14"
                                autoFocus
                            />
                        </div>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800">
                        <div className="flex justify-between items-center text-sm mb-1">
                            <span className="text-slate-500">Current Balance:</span>
                            <span className="font-mono text-slate-300">${currentBalance.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm mb-2 pb-2 border-b border-slate-800">
                            <span className={operation === 'add' ? "text-emerald-500" : "text-rose-500"}>
                                {operation === 'add' ? '+' : '-'} Adjustment:
                            </span>
                            <span className={`font-mono ${operation === 'add' ? "text-emerald-500" : "text-rose-500"}`}>
                                ${numAmount.toFixed(2)}
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-base font-semibold">
                            <span className="text-white">New Balance:</span>
                            <span className="font-mono text-white">${newBalance.toFixed(2)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={onClose} className="hover:bg-slate-800 text-slate-400">Cancel</Button>
                    <Button
                        onClick={handleTransaction}
                        disabled={loading || !amount || parseFloat(amount) <= 0}
                        className="bg-blue-600 hover:bg-blue-500 text-white"
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
            const res = await fetch(`http://127.0.0.1:8001/api/accounts/${account.id}/transactions`);
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

            const res = await fetch('http://127.0.0.1:8001/api/transactions', {
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
