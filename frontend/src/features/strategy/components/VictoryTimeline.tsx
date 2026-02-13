import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Flag, Trophy, Target, Calendar } from "lucide-react";

export default function VictoryTimeline() {
    const events = [
        {
            date: "Today",
            title: "Strategy Activated",
            description: "Velocity Banking System initialized.",
            icon: Target,
            color: "blue",
            status: "completed"
        },
        {
            date: "Nov 2025",
            title: "Chase Sapphire PAID OFF",
            description: "First milestone achieved. Cashflow liberated: $230/mo",
            icon: Trophy,
            color: "emerald",
            status: "upcoming"
        },
        {
            date: "Aug 2026",
            title: "Toyota Loan PAID OFF",
            description: "Major liability eliminated. Cashflow liberated: $450/mo",
            icon: Trophy,
            color: "emerald",
            status: "upcoming"
        },
        {
            date: "Oct 2029",
            title: "DEBT FREE DATE",
            description: "Financial Independence Day. Total Interest Saved: $86,400",
            icon: Flag,
            color: "yellow",
            status: "goal"
        }
    ];

    return (
        <Card className="border-zinc-800 bg-zinc-950/50 h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    Predicted Freedom Roadmap
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="relative border-l border-zinc-800 ml-3 space-y-8 py-2">
                    {events.map((event, index) => (
                        <div key={index} className="relative pl-8">
                            {/* TIMELINE DOT */}
                            <div className={`absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full border border-zinc-950 ${event.status === 'completed' ? 'bg-blue-500' :
                                    event.status === 'goal' ? 'bg-yellow-500 animate-pulse' : 'bg-zinc-700'
                                }`}></div>

                            {/* CONTENT */}
                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`text-sm font-mono font-bold ${event.color === 'yellow' ? 'text-yellow-500' : 'text-zinc-400'
                                            }`}>{event.date}</span>
                                        {event.status === 'goal' && <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">ULTIMATE GOAL</Badge>}
                                    </div>
                                    <h3 className={`text-lg font-bold ${event.color === 'emerald' ? 'text-emerald-400' :
                                            event.color === 'yellow' ? 'text-yellow-400' : 'text-white'
                                        }`}>
                                        {event.title}
                                    </h3>
                                    <p className="text-sm text-zinc-500 mt-1 max-w-md">
                                        {event.description}
                                    </p>
                                </div>
                                <div className={`p-3 rounded-full bg-zinc-900/50 border border-zinc-800 ${event.color === 'emerald' ? 'text-emerald-500' :
                                        event.color === 'yellow' ? 'text-yellow-500' : 'text-blue-500'
                                    }`}>
                                    <event.icon className="h-5 w-5" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
}
