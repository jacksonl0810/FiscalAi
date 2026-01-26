import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const iconMap = {
  warning: AlertTriangle,
  info: Info,
  success: CheckCircle,
  error: XCircle,
};

const colorMap = {
  warning: {
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: "text-yellow-400",
    text: "text-yellow-400"
  },
  info: {
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: "text-blue-400",
    text: "text-blue-400"
  },
  success: {
    bg: "bg-green-500/10",
    border: "border-green-500/30",
    icon: "text-green-400",
    text: "text-green-400"
  },
  error: {
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: "text-red-400",
    text: "text-red-400"
  },
};

export default function AlertCard({ type = "info", title, message, action, onAction, delay = 0 }) {
  const Icon = iconMap[type];
  const colors = colorMap[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={cn(
        "relative rounded-2xl p-5 overflow-hidden",
        "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
        "backdrop-blur-xl border",
        colors.border,
        "shadow-xl shadow-black/30",
        "before:absolute before:inset-0",
        type === 'warning' && "before:bg-gradient-to-br before:from-yellow-500/5 before:via-transparent before:to-transparent",
        type === 'info' && "before:bg-gradient-to-br before:from-blue-500/5 before:via-transparent before:to-transparent",
        type === 'success' && "before:bg-gradient-to-br before:from-green-500/5 before:via-transparent before:to-transparent",
        type === 'error' && "before:bg-gradient-to-br before:from-red-500/5 before:via-transparent before:to-transparent",
        "before:pointer-events-none",
        "hover:scale-[1.02] hover:shadow-2xl transition-all duration-300"
      )}
    >
      <div className="flex gap-4 relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          "backdrop-blur-sm border shadow-md",
          colors.bg,
          colors.border,
          type === 'warning' && "shadow-yellow-500/20",
          type === 'info' && "shadow-blue-500/20",
          type === 'success' && "shadow-green-500/20",
          type === 'error' && "shadow-red-500/20"
        )}>
          <Icon className={cn("w-6 h-6", colors.icon)} />
        </div>
        <div className="flex-1">
          <h4 className={cn("font-bold text-base mb-2", colors.text)}>{title}</h4>
          <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
          {action && onAction && (
            <button
              onClick={onAction}
              className={cn(
                "mt-4 text-sm font-semibold",
                colors.text,
                "hover:underline",
                "transition-all duration-200",
                "flex items-center gap-1"
              )}
            >
              {action}
              <span className="text-lg">→</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}