import { ShieldAlert, X, DollarSign, AlertTriangle } from "lucide-react";
import type { FundsErrorData } from "@/hooks/useInsufficientFundsDialog";

// Re-export hook from dedicated file for convenience
export { useInsufficientFundsDialog } from "@/hooks/useInsufficientFundsDialog";
export type { FundsErrorData } from "@/hooks/useInsufficientFundsDialog";

// ── Dialog Component ─────────────────────────────────────────
interface InsufficientFundsDialogProps {
    data: FundsErrorData | null;
    onClose: () => void;
}

export function InsufficientFundsDialog({ data, onClose }: InsufficientFundsDialogProps) {
    if (!data) return null;

    const deficit = data.requested_amount - data.current_balance;

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-sm mx-4 bg-slate-950 border border-rose-500/40 rounded-2xl shadow-2xl shadow-rose-500/10 animate-in zoom-in-95 fade-in duration-300">
                {/* Close button */}
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-slate-500 hover:text-white transition-colors"
                >
                    <X size={18} />
                </button>

                {/* Icon header */}
                <div className="flex flex-col items-center pt-8 pb-4 px-6">
                    <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/30 mb-4">
                        <ShieldAlert className="h-8 w-8 text-rose-400" />
                    </div>
                    <h3 className="text-lg font-bold text-white text-center">
                        Fondos Insuficientes
                    </h3>
                    <p className="text-sm text-slate-400 text-center mt-1">
                        La operación no se puede completar
                    </p>
                </div>

                {/* Details */}
                <div className="px-6 pb-4 space-y-3">
                    <div className="bg-slate-900/80 rounded-xl p-4 space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium">Cuenta</span>
                            <span className="text-sm font-semibold text-white">{data.account_name}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1">
                                <DollarSign size={12} /> Saldo Actual
                            </span>
                            <span className="text-sm font-bold text-amber-400">
                                ${data.current_balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1">
                                <AlertTriangle size={12} /> Monto Solicitado
                            </span>
                            <span className="text-sm font-bold text-rose-400">
                                ${data.requested_amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                        <hr className="border-slate-800" />
                        <div className="flex justify-between items-center">
                            <span className="text-xs uppercase tracking-wider text-rose-400/80 font-medium">Déficit</span>
                            <span className="text-sm font-bold text-rose-500">
                                -${deficit.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Action button */}
                <div className="px-6 pb-6">
                    <button
                        onClick={onClose}
                        className="w-full py-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 font-semibold hover:bg-rose-500/30 transition-colors text-sm"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
