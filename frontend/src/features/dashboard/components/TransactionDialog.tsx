import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, DollarSign } from "lucide-react";

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
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner"; // Assuming sonner is installed, checks package.json

const formSchema = z.object({
    account_id: z.string().min(1, "Account is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    description: z.string().min(2, "Description must be at least 2 characters"),
    category: z.string().min(1, "Category is required"),
    type: z.enum(["income", "expense"]),
});

type TransactionFormValues = z.infer<typeof formSchema>;

interface Account {
    id: number;
    name: string;
}

interface TransactionDialogProps {
    children?: React.ReactNode;
    defaultType?: "income" | "expense";
    onSuccess?: () => void;
    defaultAccountId?: string; // Added prop for pre-selecting account
    defaultAmount?: number;    // Added prop for pre-filling amount
    defaultDescription?: string; // Added prop for pre-filling description
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
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(false);

    // Use any to bypass strict resolver type mismatch
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

    // Fetch accounts on open
    useEffect(() => {
        if (open) {
            fetch("/api/accounts")
                .then((res) => res.json())
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

    // Update type when defaultType changes or tab changes
    const [activeTab, setActiveTab] = useState(defaultType);

    const onTabChange = (value: string) => {
        const type = value as "income" | "expense";
        setActiveTab(type);
        form.setValue("type", type);
    };

    async function onSubmit(values: TransactionFormValues) {
        setLoading(true);
        try {
            const finalAmount = values.type === 'expense' ? -Math.abs(values.amount) : Math.abs(values.amount);

            const response = await fetch("/api/transactions/manual", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    account_id: parseInt(values.account_id),
                    amount: finalAmount,
                    description: values.description,
                    category: values.category || (values.type === 'income' ? 'Income' : 'General'),
                    date: new Date().toISOString().split('T')[0],
                }),
            });

            if (!response.ok) throw new Error("Failed to create transaction");

            toast.success("Transaction Record Saved", {
                description: `${values.type === 'income' ? '+' : '-'}$${Math.abs(values.amount)} - ${values.description}`
            });

            form.reset({
                amount: 0,
                description: "",
                category: "",
                type: defaultType, // Reset to default type
                account_id: "",
            });

            setOpen(false);
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error(error);
            toast.error("Failed to save transaction");
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-slate-950 border-slate-800 text-white">
                <DialogHeader>
                    <DialogTitle>Add Transaction</DialogTitle>
                    <DialogDescription className="text-slate-500">
                        Manually record a transaction to update your cash position.
                    </DialogDescription>
                </DialogHeader>

                <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-slate-900">
                        <TabsTrigger value="income" className="data-[state=active]:bg-emerald-950 data-[state=active]:text-emerald-400">
                            Income
                        </TabsTrigger>
                        <TabsTrigger value="expense" className="data-[state=active]:bg-rose-950 data-[state=active]:text-rose-400">
                            Expense
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
                                    <FormLabel>Amount</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                            <Input
                                                type="number"
                                                step="0.01"
                                                className="pl-8 bg-slate-900 border-slate-800"
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
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Grocery, Salary, etc." className="bg-slate-900 border-slate-800" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="account_id"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Account</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                                <SelectValue placeholder="Select account" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            {accounts.map((acc) => (
                                                <SelectItem key={acc.id} value={acc.id.toString()}>
                                                    {acc.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Food, Rent, Crypto" className="bg-slate-900 border-slate-800" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter>
                            <Button type="submit" disabled={loading} className={activeTab === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}>
                                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {activeTab === 'income' ? 'Add Income' : 'Add Expense'}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
