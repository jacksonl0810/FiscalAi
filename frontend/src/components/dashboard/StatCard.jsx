import React from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function StatCard({ title, value, subtitle, icon: Icon, trend, trendUp, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "relative rounded-2xl p-6 overflow-hidden",
        "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
        "backdrop-blur-xl border border-white/10",
        "shadow-xl shadow-black/30",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
        "group hover:scale-[1.02] hover:shadow-2xl hover:shadow-orange-500/20",
        "transition-all duration-300"
      )}
    >
      <div className="flex items-start justify-between mb-4 relative z-10">
        <div className={cn(
          "w-14 h-14 rounded-xl",
          "bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-purple-500/20",
          "border border-orange-500/30",
          "flex items-center justify-center",
          "group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-orange-500/30",
          "transition-all duration-300",
          "backdrop-blur-sm"
        )}>
          <Icon className="w-7 h-7 text-orange-300" />
        </div>
        {trend && (
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full",
            "backdrop-blur-sm border shadow-md",
            trendUp 
              ? 'bg-gradient-to-r from-green-500/20 to-emerald-500/10 text-green-300 border-green-500/30 shadow-green-500/20' 
              : 'bg-gradient-to-r from-red-500/20 to-rose-500/10 text-red-300 border-red-500/30 shadow-red-500/20'
          )}>
            {trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {trend}
          </div>
        )}
      </div>
      <h3 className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">{title}</h3>
      <p className="text-3xl font-bold text-white mb-1 relative z-10 bg-gradient-to-r from-white to-gray-200 bg-clip-text text-transparent">{value}</p>
      {subtitle && (
        <p className="text-sm text-gray-400 relative z-10">{subtitle}</p>
      )}
    </motion.div>
  );
}