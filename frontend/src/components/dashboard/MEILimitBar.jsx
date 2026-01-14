import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

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
      className="glass-card rounded-2xl p-6 border border-white/5"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Limite Anual MEI</h3>
          <p className="text-sm text-gray-500 mt-1">Acompanhe seu faturamento</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
          status.color === 'red' ? 'bg-red-500/20 text-red-400' :
          status.color === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
          'bg-green-500/20 text-green-400'
        }`}>
          <StatusIcon className="w-4 h-4" />
          <span className="text-xs font-medium">{status.text}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Faturado em {new Date().getFullYear()}</span>
          <span className="text-white font-semibold">
            {percentage.toFixed(1)}%
          </span>
        </div>
        
        <div className="relative h-3 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(percentage, 100)}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full ${getBarColor()} relative`}
          >
            <div className="absolute inset-0 bg-white/20 animate-pulse" />
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2">
          <div>
            <p className="text-xs text-gray-500">Faturado</p>
            <p className="text-lg font-bold text-white mt-1">
              R$ {yearlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Disponível</p>
            <p className="text-lg font-bold text-gray-400 mt-1">
              R$ {remaining.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {percentage >= 70 && (
        <div className={`mt-4 p-3 rounded-xl ${
          percentage >= 90 
            ? 'bg-red-500/10 border border-red-500/20' 
            : 'bg-yellow-500/10 border border-yellow-500/20'
        }`}>
          <p className={`text-xs ${percentage >= 90 ? 'text-red-400' : 'text-yellow-400'}`}>
            {percentage >= 90 
              ? '⚠️ Você está muito próximo do limite. Considere migrar para o Simples Nacional.'
              : '💡 Planeje-se: você já utilizou mais de 70% do limite anual do MEI.'}
          </p>
        </div>
      )}
    </motion.div>
  );
}