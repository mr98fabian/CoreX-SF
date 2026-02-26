import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, ListTodo } from 'lucide-react';

export default function SmartActions() {
    const actions = [
        {
            id: 1,
            title: "Transfer $850 to HELOC",
            badge: "High Priority",
            variant: "destructive", // Red
            description: "Optimization opportunity detected.",
            btnText: "Execute",
            btnVariant: "default" as const
        },
        {
            id: 2,
            title: "Pay Chase Sapphire",
            badge: "Due Tomorrow",
            variant: "secondary", // Orange-ish visual handled via custom class if needed, using secondary for now
            description: "Minimum payment of $45.00 due.",
            btnText: "Pay",
            btnVariant: "outline" as const
        },
        {
            id: 3,
            title: "Review Weekly Spending",
            badge: "Routine",
            variant: "outline", // Gray
            description: "3 unclassified transactions.",
            btnText: "View",
            btnVariant: "ghost" as const
        }
    ];

    return (
        <Card className="h-full border-gray-200 dark:border-neutral-800 bg-white/50 dark:bg-black/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-slate-900 dark:text-gray-100 flex items-center gap-2">
                    <ListTodo className="w-5 h-5 text-blue-500" strokeWidth={1.5} />
                    Smart Actions
                </CardTitle>
                <Badge variant="outline" className="border-blue-300 dark:border-blue-900 text-blue-600 dark:text-blue-400">3 Pending</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
                {actions.map((action) => (
                    <div key={action.id} className="group flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-[#0f0f0f]/50 p-4 transition-all hover:bg-gray-100 dark:hover:bg-slate-900 hover:border-slate-300 dark:hover:border-neutral-700">
                        <div className="flex items-start justify-between">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-slate-900 dark:text-gray-100">{action.title}</h3>
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">{action.description}</p>
                            </div>
                            <Badge variant={action.variant as any} className="text-[10px] uppercase tracking-wider">
                                {action.badge}
                            </Badge>
                        </div>

                        <Button size="sm" variant={action.btnVariant} className="w-full justify-between mt-1">
                            {action.btnText}
                            <ArrowRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                        </Button>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
