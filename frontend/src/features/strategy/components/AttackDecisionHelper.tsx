import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Swords, Shield, Scale, Star, Check } from "lucide-react";
import type { DecisionOptionsData } from "../hooks/useStrategyData";

interface Props {
    data: DecisionOptionsData;
    onSelect: (optionId: string) => void;
}

const OPTION_ICONS: Record<string, typeof Swords> = {
    attack: Swords,
    shield: Shield,
    split: Scale,
};

const OPTION_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
    attack: {
        bg: "bg-rose-500/5",
        border: "border-rose-500/20",
        text: "text-rose-400",
        glow: "hover:shadow-rose-500/10",
    },
    shield: {
        bg: "bg-emerald-500/5",
        border: "border-emerald-500/20",
        text: "text-emerald-400",
        glow: "hover:shadow-emerald-500/10",
    },
    split: {
        bg: "bg-blue-500/5",
        border: "border-blue-500/20",
        text: "text-blue-400",
        glow: "hover:shadow-blue-500/10",
    },
};

export default function AttackDecisionHelper({ data, onSelect }: Props) {
    const [selected, setSelected] = useState<string | null>(null);

    const handleSelect = (optionId: string) => {
        setSelected(optionId);
    };

    const handleConfirm = () => {
        if (selected) onSelect(selected);
    };

    return (
        <Card className="border-slate-800 bg-slate-950/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Scale className="h-5 w-5 text-blue-400" />
                    Decision Helper
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-3">
                {data.options.map((option) => {
                    const Icon = OPTION_ICONS[option.id] || Swords;
                    const colors = OPTION_COLORS[option.id] || OPTION_COLORS.attack;
                    const isRecommended = option.id === data.recommended;
                    const isSelected = option.id === selected;

                    return (
                        <button
                            key={option.id}
                            onClick={() => handleSelect(option.id)}
                            className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ${isSelected
                                    ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ${colors.border} shadow-lg ${colors.glow}`
                                    : `bg-slate-800/30 border-slate-700/30 hover:${colors.bg} hover:${colors.border}`
                                }`}
                        >
                            <div className="flex items-start gap-3">
                                <div
                                    className={`p-2 rounded-lg ${colors.bg} border ${colors.border} shrink-0`}
                                >
                                    <Icon className={`h-4 w-4 ${colors.text}`} />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <span className="text-sm font-semibold text-white">
                                            {option.label}
                                        </span>
                                        {isRecommended && (
                                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                                Recommended
                                            </Badge>
                                        )}
                                        {isSelected && (
                                            <Check className="h-4 w-4 text-emerald-400 ml-auto" />
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        {option.description}
                                    </p>
                                    <p className={`text-xs font-mono mt-1 ${colors.text}`}>
                                        {option.impact}
                                    </p>
                                </div>
                            </div>
                        </button>
                    );
                })}

                {/* Confirm Button */}
                {selected && (
                    <Button
                        onClick={handleConfirm}
                        className="w-full mt-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-semibold transition-all"
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Confirm: {data.options.find((o) => o.id === selected)?.label}
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}
