import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { RotateCcw, Zap } from "lucide-react";

export default function SimulationControls() {
    const [extraPayment, setExtraPayment] = useState(500);

    return (
        <Card className="border-zinc-800 bg-zinc-950/50 h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Scenario Lab
                </CardTitle>
                <CardDescription>
                    Adjust variables to see how they impact your freedom date.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
                {/* SLIDER INPUT */}
                <div className="space-y-4">
                    <div className="flex justify-between">
                        <label className="text-sm font-medium text-zinc-300">Monthly Velocity Injection</label>
                        <span className="text-sm font-bold text-emerald-400">${extraPayment}</span>
                    </div>
                    <Slider
                        defaultValue={[500]}
                        max={5000}
                        step={50}
                        onValueChange={(vals) => setExtraPayment(vals[0])}
                        className="py-4"
                    />
                    <p className="text-xs text-zinc-500">
                        Extra cashflow allocated to debt destruction.
                    </p>
                </div>

                {/* TEXT INPUTS */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">One-time Windfall</label>
                        <Input type="number" placeholder="0.00" className="bg-zinc-900 border-zinc-700 text-white" />
                        <p className="text-xs text-zinc-500">Bonus, tax return, or asset sale.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">New Monthly Expense</label>
                        <Input type="number" placeholder="0.00" className="bg-zinc-900 border-zinc-700 text-white" />
                        <p className="text-xs text-zinc-500">Simulate a new car payment or subscription.</p>
                    </div>
                </div>

                {/* ACTION BUTTON */}
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-6">
                    <RotateCcw className="mr-2 h-4 w-4" /> Recalculate Route
                </Button>

            </CardContent>
        </Card>
    );
}
