import { useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, Calendar, Wallet, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface CashflowItem {
    id: number;
    name: string;
    amount: number;
    category: 'income' | 'expense';
    day_of_month: number;
    frequency: string;
    is_variable: boolean;
    // New Fields
    day_of_week?: number;
    date_specific_1?: number;
    date_specific_2?: number;
    month_of_year?: number;
}

export function CashflowManager() {
    const [items, setItems] = useState<CashflowItem[]>([]);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    // Form State
    const [newItem, setNewItem] = useState<Partial<CashflowItem>>({
        category: 'expense',
        frequency: 'monthly',
        day_of_month: 1,
        is_variable: false,
        day_of_week: 0, // Monday default
        date_specific_1: 15,
        date_specific_2: 30
    });

    const fetchCashflow = async () => {
        try {
            const res = await fetch('http://127.0.0.1:8001/api/cashflow');
            if (res.ok) setItems(await res.json());
        } catch (e) {
            console.error("Failed to fetch cashflow", e);
        }
    };

    useEffect(() => { fetchCashflow(); }, []);

    const handleAdd = async () => {
        if (!newItem.name || !newItem.amount) {
            alert("Please fill in Name and Amount");
            return;
        }

        console.log("Submitting Item:", newItem);

        try {
            const res = await fetch('http://127.0.0.1:8001/api/cashflow', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newItem)
            });

            if (res.ok) {
                fetchCashflow();
                setIsDialogOpen(false);
                setNewItem({
                    category: 'expense',
                    frequency: 'monthly',
                    day_of_month: 1,
                    is_variable: false,
                    day_of_week: 0,
                    date_specific_1: 15,
                    date_specific_2: 30
                });
            } else {
                const errorData = await res.json();
                console.error("Server Error:", errorData);
                alert(`Error saving: ${JSON.stringify(errorData)}`);
            }
        } catch (e) {
            console.error("Add failed", e);
            alert("Network Error: Failed to connect to server.");
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await fetch(`http://127.0.0.1:8001/api/cashflow/${id}`, { method: 'DELETE' });
            fetchCashflow();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    // Helper to normalize to monthly amount
    const getMonthlyAmount = (item: CashflowItem) => {
        const amt = Number(item.amount);
        switch (item.frequency) {
            case 'weekly': return amt * 4.345; // 52.14 weeks / 12 months
            case 'biweekly': return amt * 2.17; // 26.07 fortnights / 12 months
            case 'semi_monthly': return amt * 2; // Exactly 24 payments / 12 months
            case 'monthly': return amt;
            case 'annually': return amt / 12;
            default: return amt;
        }
    };

    const income = items.filter(i => i.category === 'income');
    const expenses = items.filter(i => i.category === 'expense');

    const totalIncome = income.reduce((acc, i) => acc + getMonthlyAmount(i), 0);
    const totalExpenses = expenses.reduce((acc, i) => acc + getMonthlyAmount(i), 0);
    const surplus = totalIncome - totalExpenses;

    const formatMoney = (val: number | string) => {
        const num = Number(val);
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(isNaN(num) ? 0 : num);
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <TrendingUp className="text-emerald-500 h-4 w-4" /> Monthly Income
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-400">{formatMoney(totalIncome)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <TrendingDown className="text-rose-500 h-4 w-4" /> Monthly Expenses
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-rose-400">{formatMoney(totalExpenses)}</div>
                    </CardContent>
                </Card>
                <Card className="bg-slate-900 border-slate-800">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-slate-400 flex items-center gap-2">
                            <Wallet className="text-blue-500 h-4 w-4" /> Net Surplus
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${surplus >= 0 ? 'text-blue-400' : 'text-orange-500'}`}>
                            {formatMoney(surplus)}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Recurring Grid</h2>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-slate-800 hover:bg-slate-700 text-white gap-2 border border-slate-700">
                            <Plus size={16} /> Add Recurring
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-slate-950 border-slate-800 text-white sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Add Recurring Item</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Type</Label>
                                    <Select
                                        value={newItem.category}
                                        onValueChange={(val: any) => setNewItem({ ...newItem, category: val })}
                                    >
                                        <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                            <SelectItem value="income">Income</SelectItem>
                                            <SelectItem value="expense">Expense</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Amount</Label>
                                    <Input
                                        type="number"
                                        placeholder="0.00"
                                        className="bg-slate-900 border-slate-800"
                                        value={newItem.amount || ''}
                                        onChange={e => setNewItem({ ...newItem, amount: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Name / Description</Label>
                                <Input
                                    placeholder="e.g. Salary, Rent, Spotify..."
                                    className="bg-slate-900 border-slate-800"
                                    value={newItem.name || ''}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Frequency</Label>
                                <Select
                                    value={newItem.frequency}
                                    onValueChange={(val) => setNewItem({ ...newItem, frequency: val })}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="weekly">Weekly (Every 7 Days)</SelectItem>
                                        <SelectItem value="biweekly">Bi-Weekly (Every 2 Weeks)</SelectItem>
                                        <SelectItem value="semi_monthly">Semi-Monthly (15th & 30th)</SelectItem>
                                        <SelectItem value="monthly">Monthly (Once a month)</SelectItem>
                                        <SelectItem value="annually">Annually (Once a year)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* DYNAMIC FIELDS BASED ON FREQUENCY */}

                            {/* WEEKLY / BIWEEKLY -> SELECT DAY OF WEEK */}
                            {(newItem.frequency === 'weekly' || newItem.frequency === 'biweekly') && (
                                <div className="space-y-2">
                                    <Label>On which day?</Label>
                                    <div className="flex justify-between gap-1">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                            <Button
                                                key={day}
                                                type="button"
                                                variant={newItem.day_of_week === idx ? "default" : "outline"}
                                                className={`h-9 w-9 p-0 ${newItem.day_of_week === idx ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-transparent' : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'}`}
                                                onClick={() => setNewItem({ ...newItem, day_of_week: idx })}
                                            >
                                                {day[0]}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* MONTHLY -> SELECT DAY OF MONTH */}
                            {newItem.frequency === 'monthly' && (
                                <div className="space-y-2">
                                    <Label>Day of Month (1-31)</Label>
                                    <Input
                                        type="number"
                                        min="1" max="31"
                                        className="bg-slate-900 border-slate-800"
                                        value={newItem.day_of_month || ''}
                                        onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {/* SEMI-MONTHLY -> SELECT 2 DATES */}
                            {newItem.frequency === 'semi_monthly' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>First Payment Day</Label>
                                        <Input
                                            type="number"
                                            min="1" max="15"
                                            placeholder="15"
                                            className="bg-slate-900 border-slate-800"
                                            value={newItem.date_specific_1 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_1: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Second Payment Day</Label>
                                        <Input
                                            type="number"
                                            min="16" max="31"
                                            placeholder="30"
                                            className="bg-slate-900 border-slate-800"
                                            value={newItem.date_specific_2 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_2: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* ANNUAL -> SELECT MONTH & DAY */}
                            {newItem.frequency === 'annually' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label>Month</Label>
                                        <Select
                                            value={newItem.month_of_year?.toString()}
                                            onValueChange={(val) => setNewItem({ ...newItem, month_of_year: parseInt(val) })}
                                        >
                                            <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <SelectItem key={m} value={m.toString()}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Day</Label>
                                        <Input
                                            type="number"
                                            min="1" max="31"
                                            className="bg-slate-900 border-slate-800"
                                            value={newItem.day_of_month || ''}
                                            onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label>Variable?</Label>
                                <Select
                                    value={newItem.is_variable ? "yes" : "no"}
                                    onValueChange={(val) => setNewItem({ ...newItem, is_variable: val === 'yes' })}
                                >
                                    <SelectTrigger className="bg-slate-900 border-slate-800 text-white">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-900 border-slate-800 text-white">
                                        <SelectItem value="no">Fixed Amount</SelectItem>
                                        <SelectItem value="yes">Variable (~Avg)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleAdd} className="w-full bg-emerald-600 hover:bg-emerald-500 mt-4">
                                Save Item
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Income Column */}
                <div className="space-y-3">
                    <h3 className="text-slate-400 font-medium text-sm uppercase tracking-wider">Income Streams</h3>
                    {income.length === 0 && <div className="text-slate-600 italic text-sm">No income streams added.</div>}
                    {income.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-emerald-900/30 group hover:border-emerald-700/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="bg-emerald-900/20 p-2 rounded-full">
                                    <TrendingUp size={16} className="text-emerald-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-white">{item.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Repeat size={10} /> {item.frequency} • <Calendar size={10} /> Day {item.day_of_month}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-emerald-400 font-medium">+{formatMoney(item.amount)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-8 w-8 text-slate-600 hover:text-rose-400 hover:bg-rose-900/20"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Expense Column */}
                <div className="space-y-3">
                    <h3 className="text-slate-400 font-medium text-sm uppercase tracking-wider">Recurring Expenses</h3>
                    {expenses.length === 0 && <div className="text-slate-600 italic text-sm">No recurring expenses added.</div>}
                    {expenses.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-slate-900/50 border border-rose-900/30 group hover:border-rose-700/50 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="bg-rose-900/20 p-2 rounded-full">
                                    <TrendingDown size={16} className="text-rose-500" />
                                </div>
                                <div>
                                    <div className="font-medium text-white">{item.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1">
                                        <Repeat size={10} /> {item.frequency} • <Calendar size={10} /> Day {item.day_of_month}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono text-rose-400 font-medium">{formatMoney(item.amount)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-8 w-8 text-slate-600 hover:text-rose-400 hover:bg-rose-900/20"
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
