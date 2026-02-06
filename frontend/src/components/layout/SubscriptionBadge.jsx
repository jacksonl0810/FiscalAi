import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, AlertTriangle, XCircle, Zap, Building2, Sparkles, CreditCard, Users, Clock } from "lucide-react";
import { subscriptionsService } from "@/api/services/subscriptions";
import { useAuth } from "@/lib/AuthContext";

// Plan configuration with rich styling
const statusConfig = {
  ativo: {
    pay_per_use: {
      icon: CreditCard,
      label: 'Pay per Use',
      gradient: 'from-slate-500 to-slate-600',
      bgGradient: 'from-slate-500/20 to-slate-600/10',
      borderColor: 'border-slate-500/40',
      textColor: 'text-slate-300',
      glowColor: 'shadow-slate-500/20',
      ringColor: 'ring-slate-500/30'
    },
    essential: {
      icon: Zap,
      label: 'Essential',
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-500/20 to-amber-500/10',
      borderColor: 'border-orange-500/40',
      textColor: 'text-orange-300',
      glowColor: 'shadow-orange-500/20',
      ringColor: 'ring-orange-500/30'
    },
    professional: {
      icon: Building2,
      label: 'Professional',
      gradient: 'from-violet-500 to-purple-500',
      bgGradient: 'from-violet-500/20 to-purple-500/10',
      borderColor: 'border-violet-500/40',
      textColor: 'text-violet-300',
      glowColor: 'shadow-violet-500/20',
      ringColor: 'ring-violet-500/30'
    },
    accountant: {
      icon: Users,
      label: 'Contador',
      gradient: 'from-purple-500 to-indigo-500',
      bgGradient: 'from-purple-500/20 to-indigo-500/10',
      borderColor: 'border-purple-500/40',
      textColor: 'text-purple-300',
      glowColor: 'shadow-purple-500/20',
      ringColor: 'ring-purple-500/30'
    },
    default: {
      icon: Crown,
      label: 'Essential',
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-500/20 to-amber-500/10',
      borderColor: 'border-orange-500/40',
      textColor: 'text-orange-300',
      glowColor: 'shadow-orange-500/20',
      ringColor: 'ring-orange-500/30'
    }
  },
  pending: {
    icon: Clock,
    label: 'Processando',
    gradient: 'from-amber-500 to-yellow-500',
    bgGradient: 'from-amber-500/20 to-yellow-500/10',
    borderColor: 'border-amber-500/40',
    textColor: 'text-amber-300',
    glowColor: 'shadow-amber-500/20',
    ringColor: 'ring-amber-500/30'
  },
  inadimplente: {
    icon: AlertTriangle,
    label: 'Pendente',
    gradient: 'from-yellow-500 to-orange-500',
    bgGradient: 'from-yellow-500/20 to-orange-500/10',
    borderColor: 'border-yellow-500/40',
    textColor: 'text-yellow-300',
    glowColor: 'shadow-yellow-500/20',
    ringColor: 'ring-yellow-500/30'
  },
  cancelado: {
    icon: XCircle,
    label: 'Inativo',
    gradient: 'from-red-500 to-rose-500',
    bgGradient: 'from-red-500/20 to-rose-500/10',
    borderColor: 'border-red-500/40',
    textColor: 'text-red-300',
    glowColor: 'shadow-red-500/20',
    ringColor: 'ring-red-500/30'
  }
};

export default function SubscriptionBadge() {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionsService.getStatus,
    staleTime: 2 * 60 * 1000, // 2 minutes - refetch sooner after payment
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true, // Refetch when user returns to tab (e.g. after payment success)
    refetchOnMount: true // Refetch when component mounts so badge updates after navigation
  });

  if (isLoading) {
    return (
      <div className="h-10 w-24 bg-gradient-to-r from-white/5 to-white/10 rounded-xl animate-pulse" />
    );
  }

  // ✅ PRIORITY: Prefer subscription-status API, then auth user (plan/subscription_status)
  // Auth now returns subscription_status: 'ativo' and plan: 'pay_per_use'|'essential'|'professional'|'accountant' when DB is ACTIVE
  let status = subscriptionStatus?.status ?? user?.subscription_status ?? null;
  let planId = subscriptionStatus?.plan_id ?? user?.plan ?? null;
  const daysRemaining = subscriptionStatus?.days_remaining;
  
  // ✅ Normalize: backend can return 'ACTIVE' (status API) or 'ativo' (auth); config expects 'ativo'
  if (status === 'ACTIVE') status = 'ativo';
  
  // ✅ When active, plan must be from API or user
  if (status === 'ativo') {
    const paidPlan = subscriptionStatus?.plan_id || user?.plan;
    if (paidPlan) planId = paidPlan;
  }

  // ✅ FIX: Don't show "pending" status if user is just browsing checkout
  // Only show pending if there's an actual payment transaction
  // If status is pending but no payment was attempted, treat as no subscription
  if (status === 'pending') {
    // Check if there's actually a payment attempt (subscription with pending status has plan_id)
    // If user is just on checkout page, don't show pending status
    if (!subscriptionStatus?.plan_id) {
      // No plan_id means no actual subscription record yet
      // Don't show pending, show as if no subscription
      status = null;
    }
  }

  // Get configuration based on status and plan
  let config;
  if (status === 'ativo') {
    config = statusConfig.ativo[planId] || statusConfig.ativo.default;
  } else if (status === null || status === undefined || status === 'no_subscription') {
    // No subscription - don't show badge
    return null;
  } else {
    config = statusConfig[status] || statusConfig.ativo.default;
  }

  const Icon = config.icon;

  const handleClick = () => {
    if (status === 'ativo') {
      navigate('/subscription');
    } else {
      navigate('/pricing');
    }
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative overflow-hidden
        flex items-center gap-2.5 px-4 py-2.5
        rounded-xl
        bg-gradient-to-r ${config.bgGradient}
        border ${config.borderColor}
        shadow-lg ${config.glowColor}
        ring-1 ${config.ringColor}
        transition-all duration-300
        hover:shadow-xl
        cursor-pointer
        group
      `}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
      </div>
      
      {/* Icon with gradient background */}
      <div className={`relative flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br ${config.gradient} shadow-md`}>
        <Icon className="w-3.5 h-3.5 text-white" />
      </div>
      
      {/* Label and duration */}
      <div className="flex flex-col items-start leading-none">
        <span className={`text-sm font-semibold ${config.textColor} tracking-wide`}>
          {config.label}
        </span>

        {/* Active subscription - show status */}
        {status === 'ativo' && (
          <span className="text-[10px] text-emerald-400 mt-0.5 font-medium flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Ativo
          </span>
        )}

        {/* Pending payment */}
        {status === 'pending' && (
          <span className="text-[10px] text-amber-400 mt-0.5 font-medium">
            Aguardando
          </span>
        )}

        {/* Delinquent */}
        {status === 'inadimplente' && (
          <span className="text-[10px] text-yellow-400 mt-0.5 font-medium">
            Pagamento pendente
          </span>
        )}

        {/* Canceled */}
        {status === 'cancelado' && (
          <span className="text-[10px] text-red-400 mt-0.5 font-medium">
            Clique para assinar
          </span>
        )}
      </div>

      {/* Sparkle decoration for active subscriptions */}
      {status === 'ativo' && (
        <Sparkles className={`w-3 h-3 ${config.textColor} opacity-50 absolute -top-0.5 -right-0.5`} />
      )}
    </motion.button>
  );
}
