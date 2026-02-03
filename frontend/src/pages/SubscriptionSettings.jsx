import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Crown,
  Calendar,
  CreditCard,
  AlertTriangle,
  Check,
  ArrowRight,
  Loader2,
  Shield,
  Zap,
  Building2,
  X,
  ExternalLink,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { subscriptionsService } from "@/api/services/subscriptions";
import { toast } from "sonner";

const planDetails = {
  trial: {
    name: 'Trial',
    description: 'Experimente todas as funcionalidades',
    price: 0,
    features: ['Até 5 notas fiscais', 'Assistente IA completo', 'Comando por voz', '1 empresa']
  },
  pro: {
    name: 'Pro',
    description: 'Para profissionais autônomos e MEIs',
    price: 97,
    features: ['Notas fiscais ilimitadas', 'Assistente IA completo', 'Comando por voz', '1 empresa', 'Acompanhamento MEI', 'Relatórios mensais', 'Suporte prioritário']
  },
  business: {
    name: 'Business',
    description: 'Para empresas e escritórios contábeis',
    price: 197,
    features: ['Tudo do Pro +', 'Até 5 empresas', 'Multiusuários', 'API de integração', 'Relatórios avançados', 'Suporte dedicado', 'Treinamento incluso']
  }
};

export default function SubscriptionSettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const { data: subscriptionStatus, isLoading } = useQuery({
    queryKey: ['subscription-status'],
    queryFn: subscriptionsService.getStatus,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
    refetchOnWindowFocus: false,
    refetchOnMount: false, // Don't refetch when component mounts if data is fresh
    refetchOnReconnect: false
  });

  const cancelMutation = useMutation({
    mutationFn: () => subscriptionsService.cancel(),
    onSuccess: () => {
      toast.success('Assinatura cancelada com sucesso');
      queryClient.invalidateQueries({ queryKey: ['subscription-status'] });
      setShowCancelModal(false);
    },
    onError: async (error) => {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'cancel_subscription' });
    }
  });

  // Stripe Customer Portal - manage payment methods, view invoices, etc.
  const portalMutation = useMutation({
    mutationFn: () => subscriptionsService.getPortalUrl(),
    onSuccess: (data) => {
      if (data?.url) {
        window.location.href = data.url;
      } else {
        toast.error('Não foi possível abrir o portal de pagamento');
      }
    },
    onError: async (error) => {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'open_billing_portal' });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const status = subscriptionStatus?.status || 'trial';
  const planId = subscriptionStatus?.plan_id || 'trial';
  const plan = planDetails[planId] || planDetails.trial;
  const periodEnd = subscriptionStatus?.current_period_end;
  const daysRemaining = subscriptionStatus?.days_remaining || 0;

  const statusLabels = {
    trial: { label: 'Trial Ativo', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    ativo: { label: 'Assinatura Ativa', color: 'text-green-400', bg: 'bg-green-500/20' },
    inadimplente: { label: 'Pagamento Pendente', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    cancelado: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' }
  };

  const currentStatus = statusLabels[status] || statusLabels.trial;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white">Minha Assinatura</h1>
        <p className="text-gray-400 mt-1">Gerencie seu plano e configurações de pagamento</p>
      </motion.div>

      {/* Current Plan Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-6 mb-6 border border-orange-500/20"
      >
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <Crown className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">MAY {plan.name}</h2>
              <p className="text-gray-400">{plan.description}</p>
            </div>
          </div>
          <div className={`px-3 py-1.5 rounded-full ${currentStatus.bg}`}>
            <span className={`text-sm font-medium ${currentStatus.color}`}>
              {currentStatus.label}
            </span>
          </div>
        </div>

        {/* Price and Period */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <CreditCard className="w-4 h-4" />
              <span className="text-sm">Valor</span>
            </div>
            <p className="text-xl font-bold text-white">
              {plan.price === 0 ? 'Grátis' : `R$ ${plan.price},00`}
              {plan.price > 0 && <span className="text-sm font-normal text-gray-400">/mês</span>}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Próxima cobrança</span>
            </div>
            <p className="text-xl font-bold text-white">
              {periodEnd 
                ? format(new Date(periodEnd), "dd 'de' MMMM", { locale: ptBR })
                : 'N/A'}
            </p>
          </div>

          <div className="bg-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 text-gray-400 mb-1">
              <Zap className="w-4 h-4" />
              <span className="text-sm">Dias restantes</span>
            </div>
            <p className="text-xl font-bold text-white">
              {daysRemaining} dias
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="border-t border-white/10 pt-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">Recursos incluídos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {plan.features.map((feature, index) => (
              <div key={index} className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-gray-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Upgrade/Change Plan */}
        {status !== 'cancelado' && (
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Alterar Plano</h3>
                <p className="text-sm text-gray-400">Faça upgrade ou downgrade</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white"
            >
              Ver Planos
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Manage Billing - Stripe Customer Portal */}
        {(status === 'ativo' || status === 'inadimplente') && (
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Settings className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Gerenciar Pagamento</h3>
                <p className="text-sm text-gray-400">Atualizar cartão, ver faturas</p>
              </div>
            </div>
            <Button
              onClick={() => portalMutation.mutate()}
              disabled={portalMutation.isPending}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
            >
              {portalMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Abrir Portal de Pagamento
              <ExternalLink className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Cancel Subscription */}
        {status === 'ativo' && (
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Cancelar Assinatura</h3>
                <p className="text-sm text-gray-400">Você manterá acesso até o final do período</p>
              </div>
            </div>
              <Button
                onClick={() => setShowCancelModal(true)}
                className="w-full bg-gradient-to-r from-rose-600 to-red-600 border-0 text-white font-medium hover:from-amber-500 hover:via-orange-500 hover:to-rose-500 transition-all duration-300 transform hover:scale-[1.02]"
              >
                Cancelar Assinatura
            </Button>
          </div>
        )}

        {/* Reactivate */}
        {(status === 'cancelado' || status === 'inadimplente') && (
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Reativar Assinatura</h3>
                <p className="text-sm text-gray-400">Volte a ter acesso completo</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white"
            >
              Reativar Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}

        {/* Trial - Upgrade CTA */}
        {status === 'trial' && (
          <div className="glass-card rounded-2xl p-6 border border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-purple-500/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-white">Faça Upgrade</h3>
                <p className="text-sm text-gray-400">Acesso ilimitado a todas as funcionalidades</p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
            >
              Assinar Agora
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        )}
      </motion.div>

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#1a1a24] border border-white/10 rounded-2xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">Cancelar Assinatura</h3>
              <button
                onClick={() => setShowCancelModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="mb-6">
              <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl mb-4">
                <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />
                <p className="text-sm text-yellow-300">
                  Você manterá acesso à MAY até o final do período pago.
                </p>
              </div>
              <p className="text-gray-400">
                Tem certeza que deseja cancelar sua assinatura? Você perderá acesso às funcionalidades premium após o término do período atual.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 bg-white/10 border border-white/20 text-white hover:bg-white/20 hover:border-white/30 transition-all duration-300"
              >
                Manter Assinatura
              </Button>
              <Button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="flex-1 bg-gradient-to-r from-rose-600 to-red-600 text-white font-medium hover:from-rose-500 hover:to-red-500 hover:shadow-lg hover:shadow-rose-500/30 transition-all duration-300 disabled:opacity-50"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Confirmar Cancelamento'
                )}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
