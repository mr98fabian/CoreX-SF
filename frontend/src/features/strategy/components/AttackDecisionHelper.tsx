import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Swords, Shield, Scale, Star } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import type { DecisionOptionsData } from "../hooks/useStrategyData";

interface Props {
    data: DecisionOptionsData;
    onSelect?: (optionId: string) => void;
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

export default function AttackDecisionHelper({ data }: Props) {
    const { t } = useLanguage();

    return (
        <Card className="border-gray-200 dark:border-neutral-800 bg-white dark:bg-black/50 backdrop-blur-sm h-full">
            <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-sm">
                    <Scale className="h-4 w-4 text-blue-400" />
                    {t("strategy.decision.title")}
                </CardTitle>
            </CardHeader>

            <CardContent className="px-4 pb-4 space-y-2.5">
                {data.options.map((option) => {
                    const Icon = OPTION_ICONS[option.id] || Swords;
                    const colors = OPTION_COLORS[option.id] || OPTION_COLORS.attack;
                    const isRecommended = option.id === data.recommended;

                    return (
                        <div
                            key={option.id}
                            className={`w-full text-left rounded-xl p-4 border transition-all duration-200 ${isRecommended
                                ? `${colors.bg} ${colors.border} ring-1 ring-offset-0 ${colors.border} shadow-lg ${colors.glow}`
                                : `bg-gray-100 dark:bg-neutral-800/30 border-gray-200 dark:border-neutral-700/30`
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
                                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {option.label}
                                        </span>
                                        {isRecommended && (
                                            <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-xs">
                                                <Star className="h-2.5 w-2.5 mr-0.5" />
                                                {t("strategy.decision.recommended")}
                                            </Badge>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {option.description}
                                    </p>
                                    <p className={`text-xs font-mono mt-1 ${colors.text}`}>
                                        {option.impact}
                                    </p>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </CardContent>
        </Card>
    );
}
