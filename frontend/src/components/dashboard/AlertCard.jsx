import React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Info, CheckCircle, XCircle } from "lucide-react";

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
      className={`${colors.bg} ${colors.border} border rounded-2xl p-5`}
    >
      <div className="flex gap-4">
        <div className={`w-10 h-10 rounded-xl ${colors.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${colors.icon}`} />
        </div>
        <div className="flex-1">
          <h4 className={`font-semibold ${colors.text} mb-1`}>{title}</h4>
          <p className="text-sm text-gray-400">{message}</p>
          {action && onAction && (
            <button
              onClick={onAction}
              className={`mt-3 text-sm font-medium ${colors.text} hover:underline`}
            >
              {action} →
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}