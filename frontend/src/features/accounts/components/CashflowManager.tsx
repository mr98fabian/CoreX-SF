import { useState } from "react";
import { useLanguage } from '@/contexts/LanguageContext';
import { apiFetch } from '@/lib/api';
import { Plus, Trash2, TrendingUp, TrendingDown, Wallet, Repeat, Lock, CreditCard } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useCashflowStats } from "../hooks/useCashflowStats";
import type { Timeframe, CashflowItem } from "../hooks/useCashflowStats";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function CashflowManager({ refreshKey = 0, lockedIds = new Set<number>(), onUpgrade }: { refreshKey?: number; lockedIds?: Set<number>; onUpgrade?: () => void }) {
    const { items, fetchCashflow, calculateStats, formatMoney } = useCashflowStats(refreshKey);
    const { t } = useLanguage();
    const [currentTimeframe, setCurrentTimeframe] = useState<Timeframe>('monthly');

    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [newItem, setNewItem] = useState<Partial<CashflowItem>>({
        category: 'expense',
        frequency: 'monthly',
        day_of_month: 1,
        is_variable: false,
        day_of_week: 0,
        date_specific_1: 15,
        date_specific_2: 30
    });

    const stats = calculateStats(currentTimeframe);

    const handleAdd = async () => {
        if (!newItem.name || !newItem.amount) {
            alert(t('cashflow.fillNameAmount'));
            return;
        }

        try {
            await apiFetch('/api/cashflow', {
                method: 'POST',
                body: JSON.stringify(newItem)
            });

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
        } catch (e) {
            console.error("Add failed", e);
        }
    };

    const handleDelete = async (id: number) => {
        try {
            await apiFetch(`/api/cashflow/${id}`, { method: 'DELETE' });
            fetchCashflow();
        } catch (e) {
            console.error("Delete failed", e);
        }
    };

    const income = items.filter(i => i.category === 'income');
    const expenses = items.filter(i => i.category === 'expense' && !i.is_debt_virtual);
    const debtItems = items.filter(i => i.is_debt_virtual);

    return (
        <div className="space-y-8">
            {/* 1. Timeframe Toggle */}
            <div className="flex justify-center">
                <Tabs defaultValue="monthly" className="w-full max-w-md" onValueChange={(val) => setCurrentTimeframe(val as Timeframe)}>
                    <TabsList className="grid w-full grid-cols-4 bg-slate-900/50 border border-slate-800">
                        <TabsTrigger value="daily">{t('cashflow.daily')}</TabsTrigger>
                        <TabsTrigger value="weekly">{t('cashflow.weekly')}</TabsTrigger>
                        <TabsTrigger value="monthly">{t('cashflow.monthly')}</TabsTrigger>
                        <TabsTrigger value="annually">{t('cashflow.yearly')}</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* 2. Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card border-l-4 border-l-emerald-500 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                            <TrendingUp className="h-4 w-4" /> {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`)} {t('cashflow.income')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-white drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            {formatMoney(stats.income)}
                        </div>
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-rose-500 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-rose-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-rose-400 flex items-center gap-2 uppercase tracking-wider">
                            <TrendingDown className="h-4 w-4" /> {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`)} {t('cashflow.expenses')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-extrabold text-white drop-shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                            {formatMoney(stats.expenses)}
                        </div>
                        {stats.debtExpenses > 0 && (
                            <div className="mt-2 space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-slate-500">{t('cashflow.fixed')}: {formatMoney(stats.regularExpenses)}</span>
                                    <span className="text-amber-500">{t('cashflow.debt')}: {formatMoney(stats.debtExpenses)}</span>
                                </div>
                                <div className="flex items-center gap-2 text-xs mt-1">
                                    <span className={`font-semibold ${stats.debtDrainPct > 50 ? 'text-red-400' :
                                        stats.debtDrainPct > 30 ? 'text-amber-400' : 'text-emerald-400'
                                        }`}>
                                        {stats.debtDrainPct.toFixed(0)}% {t('cashflow.debtDrain')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card className="glass-card border-l-4 border-l-blue-500 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-semibold text-blue-400 flex items-center gap-2 uppercase tracking-wider">
                            <Wallet className="h-4 w-4" /> {t('cashflow.netSurplus')}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-3xl font-extrabold drop-shadow-md ${stats.surplus >= 0 ? 'text-blue-400' : 'text-orange-500'}`}>
                            {formatMoney(stats.surplus)}
                        </div>
                        <p className="text-xs text-slate-500 mt-1 capitalize">
                            {t('cashflow.available')} {t(`cashflow.${currentTimeframe === 'annually' ? 'yearly' : currentTimeframe}`).toLowerCase()}
                        </p>
                        {stats.surplus > 0 && (
                            <div className="flex flex-col gap-0.5 mt-1.5">
                                {currentTimeframe !== 'annually' && (
                                    <span className="text-xs text-amber-400 font-semibold">
                                        ⚡ {formatMoney(stats.surplus * (currentTimeframe === 'daily' ? 365.25 : currentTimeframe === 'weekly' ? 52.14 : 12))}/año
                                    </span>
                                )}
                                <span className="text-xs text-amber-400/80 font-medium">
                                    🎯 {((stats.surplus / stats.income) * 100).toFixed(0)}% {t('cashflow.attackPower') || 'Poder de Ataque'}
                                </span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* 3. Recurring Transactions List */}
            <div className="flex justify-between items-center pt-4 border-t border-slate-800">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Repeat className="text-slate-500" size={20} /> {t('cashflow.recurringTransactions')}
                </h2>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" className="border-slate-700 bg-slate-900/50 hover:bg-slate-800 text-slate-300 hover:text-white gap-2 transition-all">
                            <Plus size={16} /> {t('cashflow.addRecurring')}
                        </Button>
                    </DialogTrigger>
                    {/* ... (Dialog Content remains mostly same, can be modularized later) ... */}
                    <DialogContent className="glass-panel sm:max-w-[450px] bg-slate-950/90 backdrop-blur-2xl border-white/10 text-white">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold">{t('cashflow.addRecurringItem')}</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 py-4">
                            {/* Type */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-slate-400">{t('cashflow.type')}</Label>
                                    <Select
                                        value={newItem.category}
                                        onValueChange={(val: any) => setNewItem({ ...newItem, category: val })}
                                    >
                                        <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                            <SelectItem value="income">{t('cashflow.incomeOption')}</SelectItem>
                                            <SelectItem value="expense">{t('cashflow.expenseOption')}</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-slate-400">{t('cashflow.amount')}</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                        <Input
                                            type="number"
                                            placeholder="0.00"
                                            className="bg-slate-950/50 border-white/10 text-white pl-7 h-11 font-mono"
                                            value={newItem.amount || ''}
                                            onChange={e => setNewItem({ ...newItem, amount: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Name */}
                            <div className="space-y-2">
                                <Label className="text-slate-400">{t('cashflow.nameDesc')}</Label>
                                <Input
                                    placeholder="e.g. Salary, Rent, Spotify..."
                                    className="bg-slate-950/50 border-white/10 text-white h-11"
                                    value={newItem.name || ''}
                                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                                />
                            </div>

                            {/* Frequency */}
                            <div className="space-y-2">
                                <Label className="text-slate-400">{t('cashflow.frequency')}</Label>
                                <Select
                                    value={newItem.frequency}
                                    onValueChange={(val) => setNewItem({ ...newItem, frequency: val })}
                                >
                                    <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                        <SelectItem value="weekly">{t('cashflow.freqWeekly')}</SelectItem>
                                        <SelectItem value="biweekly">{t('cashflow.freqBiweekly')}</SelectItem>
                                        <SelectItem value="semi_monthly">{t('cashflow.freqSemiMonthly')}</SelectItem>
                                        <SelectItem value="monthly">{t('cashflow.freqMonthly')}</SelectItem>
                                        <SelectItem value="annually">{t('cashflow.freqAnnually')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Dynamic Fields */}
                            {(newItem.frequency === 'weekly' || newItem.frequency === 'biweekly') && (
                                <div className="space-y-2">
                                    <Label className="text-slate-400">{t('cashflow.whichDay')}</Label>
                                    <div className="flex justify-between gap-1">
                                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, idx) => (
                                            <Button
                                                key={day}
                                                type="button"
                                                variant={newItem.day_of_week === idx ? "default" : "outline"}
                                                className={`h-9 w-9 p-0 ${newItem.day_of_week === idx ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500' : 'bg-slate-950/50 border-white/10 text-slate-400 hover:text-white hover:bg-white/5'}`}
                                                onClick={() => setNewItem({ ...newItem, day_of_week: idx })}
                                            >
                                                {day[0]}
                                            </Button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {newItem.frequency === 'monthly' && (
                                <div className="space-y-2">
                                    <Label className="text-slate-400">{t('cashflow.dayOfMonth')}</Label>
                                    <Input
                                        type="number"
                                        min="1" max="31"
                                        className="bg-slate-950/50 border-white/10 text-white h-11"
                                        value={newItem.day_of_month || ''}
                                        onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                    />
                                </div>
                            )}

                            {newItem.frequency === 'semi_monthly' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-400">{t('cashflow.firstPayDay')}</Label>
                                        <Input
                                            type="number"
                                            min="1" max="15"
                                            placeholder="15"
                                            className="bg-slate-950/50 border-white/10 text-white h-11"
                                            value={newItem.date_specific_1 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_1: parseInt(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-400">{t('cashflow.secondPayDay')}</Label>
                                        <Input
                                            type="number"
                                            min="16" max="31"
                                            placeholder="30"
                                            className="bg-slate-950/50 border-white/10 text-white h-11"
                                            value={newItem.date_specific_2 || ''}
                                            onChange={e => setNewItem({ ...newItem, date_specific_2: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            {newItem.frequency === 'annually' && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-slate-400">{t('cashflow.month')}</Label>
                                        <Select
                                            value={newItem.month_of_year?.toString()}
                                            onValueChange={(val) => setNewItem({ ...newItem, month_of_year: parseInt(val) })}
                                        >
                                            <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-11">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                                                    <SelectItem key={m} value={m.toString()}>{new Date(0, m - 1).toLocaleString('default', { month: 'long' })}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-slate-400">{t('cashflow.day')}</Label>
                                        <Input
                                            type="number"
                                            min="1" max="31"
                                            className="bg-slate-950/50 border-white/10 text-white h-11"
                                            value={newItem.day_of_month || ''}
                                            onChange={e => setNewItem({ ...newItem, day_of_month: parseInt(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label className="text-slate-400">{t('cashflow.variable')}</Label>
                                <Select
                                    value={newItem.is_variable ? "yes" : "no"}
                                    onValueChange={(val) => setNewItem({ ...newItem, is_variable: val === 'yes' })}
                                >
                                    <SelectTrigger className="bg-slate-950/50 border-white/10 text-white h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-slate-950 border-slate-800 text-white">
                                        <SelectItem value="no">{t('cashflow.fixedAmount')}</SelectItem>
                                        <SelectItem value="yes">{t('cashflow.variableAvg')}</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <Button onClick={handleAdd} variant="premium" className="w-full h-12 text-lg mt-4">
                                {t('cashflow.saveItem')}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Income Column */}
                <div className="space-y-4">
                    <h3 className="text-emerald-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/5">
                        <TrendingUp size={16} /> {t('cashflow.incomeStreams')}
                    </h3>
                    {income.length === 0 && (
                        <div className="text-slate-600 italic text-sm p-4 border border-dashed border-white/5 rounded-lg text-center">
                            {t('cashflow.noIncome')}
                        </div>
                    )}
                    {income.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-emerald-900/20 group hover:border-emerald-500/30 hover:bg-slate-950/60 transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="bg-emerald-500/10 p-2.5 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                                    <TrendingUp size={18} className="text-emerald-500" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-emerald-200 transition-colors">{item.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{item.frequency}</span>
                                        <span>• {t('cashflow.dayPrefix')} {item.day_of_month}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-emerald-400 font-bold text-lg">+{formatMoney(item.amount)}</span> {/* Display raw amount here, maybe update later to show timeframe specific */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-8 w-8 text-slate-600 hover:text-rose-400 hover:bg-rose-900/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Expense Column */}
                <div className="space-y-4">
                    <h3 className="text-rose-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/5">
                        <TrendingDown size={16} /> {t('cashflow.recurringExpenses')}
                    </h3>
                    {expenses.length === 0 && debtItems.length === 0 && (
                        <div className="text-slate-600 italic text-sm p-4 border border-dashed border-white/5 rounded-lg text-center">
                            {t('cashflow.noExpenses')}
                        </div>
                    )}
                    {expenses.map(item => (
                        <div key={item.id} className="flex justify-between items-center p-4 rounded-xl bg-slate-950/40 border border-rose-900/20 group hover:border-rose-500/30 hover:bg-slate-950/60 transition-all duration-300">
                            <div className="flex items-center gap-4">
                                <div className="bg-rose-500/10 p-2.5 rounded-lg group-hover:bg-rose-500/20 transition-colors">
                                    <TrendingDown size={18} className="text-rose-500" />
                                </div>
                                <div>
                                    <div className="font-semibold text-white group-hover:text-rose-200 transition-colors">{item.name}</div>
                                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="bg-white/5 px-1.5 py-0.5 rounded text-slate-400">{item.frequency}</span>
                                        <span>• {t('cashflow.dayPrefix')} {item.day_of_month}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="font-mono text-rose-400 font-bold text-lg">{formatMoney(item.amount)}</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(item.id)}
                                    className="h-8 w-8 text-slate-600 hover:text-rose-400 hover:bg-rose-900/10 opacity-0 group-hover:opacity-100 transition-all"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Debt Obligations — Auto-generated from active debts */}
                    {debtItems.length > 0 && (
                        <>
                            <h3 className="text-amber-400 font-semibold text-sm uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-amber-900/20 mt-6">
                                <CreditCard size={16} /> {t('cashflow.debtObligations')}
                                <span className="text-xs font-normal text-amber-600 ml-auto">{t('cashflow.autoSynced')}</span>
                            </h3>
                            {debtItems.map(item => {
                                const isLocked = !!(item.source_account_id && lockedIds.has(item.source_account_id));
                                return (
                                    <div
                                        key={item.id}
                                        className={`relative flex justify-between items-center p-4 rounded-xl transition-all duration-300 ${isLocked
                                            ? 'bg-slate-950/60 border border-rose-500/15 opacity-50 cursor-pointer hover:opacity-70 hover:border-rose-500/30'
                                            : 'bg-amber-950/20 border border-amber-900/30 group hover:border-amber-500/40 hover:bg-amber-950/30'
                                            }`}
                                        onClick={isLocked && onUpgrade ? onUpgrade : undefined}
                                    >
                                        {/* Lock overlay for locked accounts */}
                                        {isLocked && (
                                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/40 backdrop-blur-[1px] rounded-xl">
                                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                                                    <Lock size={12} className="text-rose-400" />
                                                    <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">{t('cashflow.locked')}</span>
                                                </div>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-4">
                                            <div className={`p-2.5 rounded-lg transition-colors ${isLocked
                                                ? 'bg-rose-500/10'
                                                : 'bg-amber-500/10 group-hover:bg-amber-500/20'
                                                }`}>
                                                <CreditCard size={18} className={isLocked ? 'text-rose-500/60' : 'text-amber-500'} />
                                            </div>
                                            <div>
                                                <div className={`font-semibold transition-colors ${isLocked
                                                    ? 'text-slate-500'
                                                    : 'text-white group-hover:text-amber-200'
                                                    }`}>{item.name}</div>
                                                <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded ${isLocked
                                                        ? 'bg-rose-500/10 text-rose-400/60'
                                                        : 'bg-amber-500/10 text-amber-400/80'
                                                        }`}>{item.interest_rate}% APR</span>
                                                    <span>• {t('cashflow.dueDay')} {item.day_of_month}</span>
                                                </div>
                                                {item.debt_balance !== undefined && (
                                                    <div className={`text-xs mt-1 ${isLocked ? 'text-rose-500/40' : 'text-amber-500/60'}`}>
                                                        {formatMoney(item.debt_balance)} {t('cashflow.remaining')}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className={`font-mono font-bold text-lg ${isLocked ? 'text-slate-500' : 'text-amber-400'
                                                }`}>{formatMoney(item.amount)}</span>
                                            <div className={`h-8 w-8 flex items-center justify-center ${isLocked ? 'text-rose-500/60' : 'text-amber-700'
                                                }`} title={isLocked ? t('cashflow.upgradeToUnlock') : t('cashflow.autoManaged')}>
                                                <Lock size={14} />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
