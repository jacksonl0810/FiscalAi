import React from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Crown, Clock, AlertTriangle, XCircle } from "lucide-react";
import { subscriptionsService } from "@/api/services/subscriptions";

const statusConfig = {
  trial: {
    label: 'Trial',
    icon: Clock,
    color: 'text-blue-400',
    bg: 'bg-blue-500/20',
    border: 'border-blue-500/30'
  },
  ativo: {
    label: 'Pro',
    icon: Crown,
    color: 'text-orange-400',
    bg: 'bg-orange-500/20',
    border: 'border-orange-500/30'
  },
  inadimplente: {
    label: 'Pendente',
    icon: AlertTriangle,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/20',
    border: 'border-yellow-500/30'
  },
  cancelado: {
    label: 'Inativo',
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-500/20',
    border: 'border-red-500/30'
  }
};

export default function SubscriptionBadge() {
  const navigate = useNavigate();
  
  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionsService.getStatus,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false
  });

  if (isLoading) {
    return (
      <div className="h-8 w-20 bg-white/5 rounded-full animate-pulse" />
    );
  }

  const status = subscriptionStatus?.status || 'trial';
  const config = statusConfig[status] || statusConfig.trial;
  const daysRemaining = subscriptionStatus?.days_remaining;
  const Icon = config.icon;

  const handleClick = () => {
    if (status === 'inadimplente' || status === 'cancelado' || status === 'trial') {
      navigate('/pricing');
    }
  };

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${config.bg} ${config.border} border transition-all hover:scale-105 cursor-pointer`}
    >
      <Icon className={`w-4 h-4 ${config.color}`} />
      <span className={`text-sm font-medium ${config.color}`}>
        {config.label}
        {status === 'trial' && daysRemaining !== undefined && (
          <span className="ml-1 text-xs opacity-70">
            ({daysRemaining}d)
          </span>
        )}
      </span>
    </button>
  );
}
