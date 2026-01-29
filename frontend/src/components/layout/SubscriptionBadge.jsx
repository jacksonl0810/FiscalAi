import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Crown, Clock, AlertTriangle, XCircle, Zap, Building2, Sparkles } from "lucide-react";
import { subscriptionsService } from "@/api/services/subscriptions";
import { useAuth } from "@/lib/AuthContext";

// Plan configuration with rich styling
const statusConfig = {
  trial: {
    icon: Clock,
    label: 'Trial',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/20 to-cyan-500/10',
    borderColor: 'border-blue-500/40',
    textColor: 'text-blue-300',
    glowColor: 'shadow-blue-500/20',
    ringColor: 'ring-blue-500/30'
  },
  ativo: {
    pro: {
      icon: Zap,
      label: 'Pro',
      gradient: 'from-orange-500 to-amber-500',
      bgGradient: 'from-orange-500/20 to-amber-500/10',
      borderColor: 'border-orange-500/40',
      textColor: 'text-orange-300',
      glowColor: 'shadow-orange-500/20',
      ringColor: 'ring-orange-500/30'
    },
    business: {
      icon: Building2,
      label: 'Business',
      gradient: 'from-violet-500 to-purple-500',
      bgGradient: 'from-violet-500/20 to-purple-500/10',
      borderColor: 'border-violet-500/40',
      textColor: 'text-violet-300',
      glowColor: 'shadow-violet-500/20',
      ringColor: 'ring-violet-500/30'
    },
    default: {
      icon: Crown,
      label: 'Pro',
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
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false
  });

  if (isLoading) {
    return (
      <div className="h-10 w-24 bg-gradient-to-r from-white/5 to-white/10 rounded-xl animate-pulse" />
    );
  }

  // ✅ PRIORITY: Active subscription status from API takes precedence over user data
  // Get status and plan from subscriptionStatus first (most accurate)
  let status = subscriptionStatus?.status || user?.subscription_status || 'trial';
  let planId = subscriptionStatus?.plan_id || user?.plan || 'trial';
  const daysRemaining = subscriptionStatus?.days_remaining ?? user?.trial_days_remaining;
  
  // ✅ CRITICAL FIX: If status is 'ativo' (active), always use the plan_id from subscription
  // Don't fallback to trial - user has a paid subscription!
  if (status === 'ativo' && subscriptionStatus?.plan_id) {
    planId = subscriptionStatus.plan_id; // Use the actual plan from subscription (pro/business)
  }
  
  // ✅ CRITICAL FIX: If we have an active subscription, never show trial status
  // Active paid subscription always takes priority over trial
  if (status === 'ativo') {
    // User has active paid subscription - ensure we're not showing trial
    // This prevents showing "Trial" when user has purchased a plan
  }

  // ✅ FIX: Don't show "pending" status if user is just browsing checkout
  // Only show pending if there's an actual payment transaction
  // If status is pending but no payment was attempted, treat as no subscription
  if (status === 'pending') {
    // Check if there's actually a payment attempt (subscription exists with pending status)
    // If user is just on checkout page, don't show pending status
    const hasActiveTrial = user?.is_in_trial && user?.trial_days_remaining > 0;
    if (hasActiveTrial) {
      // User has active trial, show trial status instead
      status = 'trial';
    } else if (!subscriptionStatus?.subscription_id) {
      // No subscription ID means no actual payment attempt yet
      // Don't show pending, show as if no subscription
      status = null;
    }
  }

  // Get configuration based on status and plan
  let config;
  if (status === 'ativo') {
    config = statusConfig.ativo[planId] || statusConfig.ativo.default;
  } else if (status === null || status === undefined) {
    // No subscription - don't show badge
    return null;
  } else {
    config = statusConfig[status] || statusConfig.trial;
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
        
        {/* Trial duration - always show for trial status */}
        {status === 'trial' && (
          <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
            {daysRemaining !== undefined && daysRemaining !== null
              ? `${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'} restantes`
              : '7 dias grátis'
            }
          </span>
        )}

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

      {/* Sparkle decoration for active pro/business */}
      {status === 'ativo' && (
        <Sparkles className={`w-3 h-3 ${config.textColor} opacity-50 absolute -top-0.5 -right-0.5`} />
      )}
    </motion.button>
  );
}
