
import { useState, useEffect } from "react";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Calculator, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface WhatIfSimulatorProps {
    onSimulate: (extraCash: number) => void;
    currentExtra: number;
    isLoading?: boolean;
}

export function WhatIfSimulator({ onSimulate, currentExtra, isLoading }: WhatIfSimulatorProps) {
    const [sliderValue, setSliderValue] = useState([currentExtra]);
    const [debouncedValue, setDebouncedValue] = useState(currentExtra);

    // Debounce effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedValue(sliderValue[0]);
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, [sliderValue]);

    // Notify parent on debounce change
    useEffect(() => {
        if (debouncedValue !== currentExtra) {
            onSimulate(debouncedValue);
        }
    }, [debouncedValue]);

    // Update local state if prop changes upstream (reset)
    useEffect(() => {
        if (currentExtra !== sliderValue[0] && currentExtra !== debouncedValue) {
            setSliderValue([currentExtra]);
        }
    }, [currentExtra]);


    return (
        <Card className="border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/40 backdrop-blur-xl h-full flex flex-col">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-sm">
                        <Calculator className="h-4 w-4 text-purple-400" />
                        Simulador "What If?"
                    </CardTitle>
                    {isLoading && <Loader2 className="h-4 w-4 animate-spin text-purple-400" />}
                </div>
                <CardDescription className="text-slate-400 text-xs">
                    ¿Qué pasa si inyectas más capital mensualmente?
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 flex-1 flex flex-col justify-between px-4 pb-4">
                <div className={isLoading ? "opacity-50 pointer-events-none transition-opacity" : "transition-opacity"}>
                    <div className="mb-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-300">Inyección Extra Mensual</span>
                        <Badge variant="outline" className="border-purple-500/50 bg-purple-500/10 text-lg font-bold text-purple-400 px-3 py-1">
                            ${sliderValue[0].toLocaleString()}
                        </Badge>
                    </div>

                    <Slider
                        defaultValue={[0]}
                        value={sliderValue}
                        max={2000}
                        step={50}
                        onValueChange={setSliderValue}
                        className="py-4 cursor-pointer"
                    />

                    <div className="flex justify-between px-1 text-xs text-slate-500">
                        <span>$0</span>
                        <span>$1,000</span>
                        <span>$2,000</span>
                    </div>
                </div>

                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                    <div className="flex items-start gap-3">
                        <Sparkles className="mt-1 h-5 w-5 text-purple-400" />
                        <div className="space-y-1">
                            <p className="text-sm font-medium text-purple-200">
                                {sliderValue[0] > 0 ? "Poder de Aceleración Activo" : "Modo Estándar (Solo Mínimos)"}
                            </p>
                            <p className="text-xs text-purple-300/80 leading-relaxed">
                                {sliderValue[0] > 0
                                    ? `Inyectando $${sliderValue[0]} extra cada mes, el sistema recalculará tu fecha de libertad instantáneamente.`
                                    : "Mueve el control deslizante para ver cuánto tiempo e intereses podrías ahorrar."}
                            </p>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
