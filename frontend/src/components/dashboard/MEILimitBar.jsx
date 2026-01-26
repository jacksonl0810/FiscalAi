import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MEILimitBar({ yearlyRevenue = 0, limit = 81000 }) {
  const percentage = (yearlyRevenue / limit) * 100;
  const remaining = limit - yearlyRevenue;
  
  const getStatus = () => {
    if (percentage >= 90) return { color: "red", icon: AlertTriangle, text: "Atenção: Próximo ao limite!" };
    if (percentage >= 70) return { color: "yellow", icon: TrendingUp, text: "Fique atento ao limite" };
    return { color: "green", icon: CheckCircle, text: "Dentro do limite" };
  };

  const status = getStatus();
  const StatusIcon = status.icon;

  const getBarColor = () => {
    if (percentage >= 90) return "bg-gradient-to-r from-red-500 to-red-600";
    if (percentage >= 70) return "bg-gradient-to-r from-yellow-500 to-orange-500";
    return "bg-gradient-to-r from-green-500 to-emerald-500";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn(
        "relative rounded-2xl p-6 overflow-hidden",
        "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50",
        "before:absolute before:inset-0",
        status.color === 'red' && "before:bg-gradient-to-br before:from-red-500/5 before:via-transparent before:to-transparent",
        status.color === 'yellow' && "before:bg-gradient-to-br before:from-yellow-500/5 before:via-transparent before:to-transparent",
        status.color === 'green' && "before:bg-gradient-to-br before:from-green-500/5 before:via-transparent before:to-transparent",
        "before:pointer-events-none"
      )}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Limite Anual MEI</h3>
          <p className="text-sm text-gray-400">Acompanhe seu faturamento</p>
        </div>
        <div className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-full",
          "backdrop-blur-sm border shadow-md",
          status.color === 'red' && 'bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-300 border-red-500/30 shadow-red-500/20',
          status.color === 'yellow' && 'bg-gradient-to-r from-yellow-500/20 to-amber-500/10 text-yellow-300 border-yellow-500/30 shadow-yellow-500/20',
          status.color === 'green' && 'bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-300 border-green-500/30 shadow-green-500/20'
        )}>
          <StatusIcon className="w-4 h-4" />
          <span className="text-xs font-semibold">{status.text}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-4 relative z-10">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400 font-medium">Faturado em {new Date().getFullYear()}</span>
          <span className="text-white font-bold text-lg">
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        <div className="relative h-4 bg-gradient-to-r from-white/5 via-white/3 to-white/5 rounded-full overflow-hidden border border-white/10 backdrop-blur-sm">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={cn(
              "h-full relative",
              getBarColor(),
              "shadow-lg",
              status.color === 'red' && "shadow-red-500/30",
              status.color === 'yellow' && "shadow-yellow-500/30",
              status.color === 'green' && "shadow-green-500/30"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div className="p-3 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 backdrop-blur-sm">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Faturado</p>
            <p className="text-xl font-bold text-white">
              R$ {yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="p-3 rounded-xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 backdrop-blur-sm text-right">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Disponível</p>
            <p className="text-xl font-bold text-gray-300">
              R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {percentage >= 70 && (
        <div className={cn(
          "mt-4 p-4 rounded-xl relative z-10",
          "backdrop-blur-sm border shadow-md",
          percentage >= 90 
            ? 'bg-gradient-to-br from-red-500/20 to-rose-500/10 border-red-500/30 shadow-red-500/20' 
            : 'bg-gradient-to-br from-yellow-500/20 to-amber-500/10 border-yellow-500/30 shadow-yellow-500/20'
        )}>
          <p className={cn(
            "text-sm font-medium leading-relaxed",
            percentage >= 90 ? 'text-red-300' : 'text-yellow-300'
          )}>
            {percentage >= 90 
              ? '⚠️ Você está muito próximo do limite. Considere migrar para o Simples Nacional.'
              : '💡 Planeje-se: você já utilizou mais de 70% do limite anual do MEI.'}
          </p>
        </div>
      )}
    </motion.div>
  );
}