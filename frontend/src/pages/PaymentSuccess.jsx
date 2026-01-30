import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Sparkles, ArrowRight, Loader2, Zap, Building2, Gift, Shield, Star } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { subscriptionsService } from "@/api/services/subscriptions";

const planConfig = {
  'trial': {
    name: 'MAY Trial',
    icon: Gift,
    features: ['7 dias grátis', 'Até 5 notas fiscais', 'Assistente IA completo'],
  },
  'pro': {
    name: 'MAY Pro',
    icon: Zap,
    features: ['Notas ilimitadas', 'Assistente IA', 'Comando por voz'],
  },
  'business': {
    name: 'MAY Business',
    icon: Building2,
    features: ['Até 5 empresas', 'Multiusuários', 'API de integração'],
  }
};

const LIFECYCLE_STATES = {
  INIT: 'init',
  LOADING: 'loading',
  CONFIRMING: 'confirming',
  SUCCESS: 'success',
  REDIRECTING: 'redirecting',
  ERROR: 'error'
};

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser, isLoadingAuth } = useAuth();
  const [lifecycle, setLifecycle] = useState(LIFECYCLE_STATES.INIT);
  const hasRunRef = useRef(false);
  const processingRef = useRef(false);

  const planId = searchParams.get('plan') || 'pro';
  const sessionId = searchParams.get('session_id');
  const paymentStatusParam = searchParams.get('status');
  const plan = planConfig[planId] || planConfig.pro;
  const PlanIcon = plan.icon;

  useEffect(() => {
    if (hasRunRef.current) return;
    if (isLoadingAuth) return;
    if (processingRef.current) return;
    
    processingRef.current = true;
    hasRunRef.current = true;

    const processPayment = async () => {
      setLifecycle(LIFECYCLE_STATES.CONFIRMING);

      try {
        if (paymentStatusParam === 'pending') {
          setLifecycle(LIFECYCLE_STATES.REDIRECTING);
          navigate('/subscription-pending', { replace: true });
          return;
        }

        if (paymentStatusParam === 'paid') {
          setLifecycle(LIFECYCLE_STATES.SUCCESS);
          refreshUser?.().catch(() => {});
          return;
        }

        if (planId === 'trial') {
          if (user?.subscription_status === 'trial' || user?.is_in_trial) {
            setLifecycle(LIFECYCLE_STATES.SUCCESS);
            refreshUser?.().catch(() => {});
            return;
          }

          if (sessionId) {
            try {
              await subscriptionsService.confirmCheckout(planId, sessionId);
            } catch (err) {
              if (err?.status === 429) {
                if (user?.subscription_status === 'trial' || user?.is_in_trial) {
                  setLifecycle(LIFECYCLE_STATES.SUCCESS);
                  return;
                }
              }
              console.error('[PaymentSuccess] Error confirming trial:', err);
            }
          }
          
          setLifecycle(LIFECYCLE_STATES.SUCCESS);
          refreshUser?.().catch(() => {});
          return;
        }

        if (user?.subscription_status === 'ativo' && user?.plan === planId) {
          setLifecycle(LIFECYCLE_STATES.SUCCESS);
          return;
        }

        if (sessionId?.startsWith('sim_') || sessionId?.startsWith('trial_')) {
          try {
            await subscriptionsService.confirmCheckout(planId, sessionId);
            setLifecycle(LIFECYCLE_STATES.SUCCESS);
            refreshUser?.().catch(() => {});
            return;
          } catch (err) {
            console.error('[PaymentSuccess] Error confirming:', err);
          }
        }

        setLifecycle(LIFECYCLE_STATES.REDIRECTING);
        navigate('/subscription-pending', { replace: true });

      } catch (error) {
        console.error('[PaymentSuccess] Unexpected error:', error);
        setLifecycle(LIFECYCLE_STATES.ERROR);
        setTimeout(() => navigate('/subscription-pending', { replace: true }), 2000);
      }
    };

    processPayment();
  }, [isLoadingAuth]);

  if (lifecycle === LIFECYCLE_STATES.INIT || lifecycle === LIFECYCLE_STATES.LOADING || lifecycle === LIFECYCLE_STATES.CONFIRMING) {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-orange-500/15 via-transparent to-transparent blur-3xl animate-pulse" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="relative w-24 h-24 mx-auto mb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/30"
            />
            <div className="absolute inset-2 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
              <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Confirmando pagamento...</h2>
          <p className="text-slate-500">Aguarde um momento</p>
        </motion.div>
      </div>
    );
  }

  if (lifecycle === LIFECYCLE_STATES.REDIRECTING) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[700px] h-[700px] bg-gradient-radial from-emerald-500/15 via-emerald-500/5 to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 max-w-lg w-full"
      >
        <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/30 via-teal-500/15 to-emerald-500/30 rounded-[36px] blur-2xl opacity-60" />
        
        <div className="relative bg-gradient-to-b from-[#0c1410] via-[#0a100d] to-[#080c0a] rounded-[32px] border border-emerald-500/20 overflow-hidden">
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
          
          <div className="relative p-10 text-center">
            <div className="relative w-28 h-28 mx-auto mb-8">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/20"
              />
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
                className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30"
              />
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.4, stiffness: 150 }}
                className="absolute inset-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="absolute top-20 left-1/2 -translate-x-1/2"
            >
              <span className="text-4xl">🎉</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 mb-6"
            >
              <Star className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-300 tracking-wide">
                {planId === 'trial' ? 'TRIAL ATIVADO' : 'PAGAMENTO CONFIRMADO'}
              </span>
            </motion.div>

            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-3"
            >
              {planId === 'trial' ? 'Bem-vindo à MAY!' : 'Parabéns!'}
            </motion.h1>

            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-slate-400 mb-8 max-w-sm mx-auto"
            >
              {planId === 'trial' 
                ? 'Seu trial de 7 dias está ativo. Explore todas as funcionalidades!'
                : 'Sua assinatura está ativa. Você agora tem acesso completo à MAY.'}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className={`relative rounded-2xl p-6 mb-8 overflow-hidden ${
                planId === 'trial' 
                  ? 'bg-gradient-to-br from-emerald-500/10 to-teal-500/5 border border-emerald-500/20'
                  : planId === 'business'
                    ? 'bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20'
                    : 'bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20'
              }`}
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  planId === 'trial' 
                    ? 'bg-emerald-500/20'
                    : planId === 'business'
                      ? 'bg-violet-500/20'
                      : 'bg-orange-500/20'
                }`}>
                  <PlanIcon className={`w-5 h-5 ${
                    planId === 'trial' 
                      ? 'text-emerald-400'
                      : planId === 'business'
                        ? 'text-violet-400'
                        : 'text-orange-400'
                  }`} />
                </div>
                <span className={`text-xl font-bold ${
                  planId === 'trial' 
                    ? 'text-emerald-300'
                    : planId === 'business'
                      ? 'text-violet-300'
                      : 'text-orange-300'
                }`}>
                  {plan.name}
                </span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                {plan.features.map((feature, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5"
                  >
                    <CheckCircle className={`w-3.5 h-3.5 ${
                      planId === 'trial' 
                        ? 'text-emerald-400'
                        : planId === 'business'
                          ? 'text-violet-400'
                          : 'text-orange-400'
                    }`} />
                    <span className="text-xs text-slate-400">{feature}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/')}
                className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-xl shadow-emerald-500/25 transition-all duration-300 flex items-center justify-center gap-2"
              >
                Ir para o Dashboard
                <ArrowRight className="w-5 h-5" />
              </motion.button>
                
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/CompanySetup?new=true')}
                className="w-full py-4 px-6 rounded-2xl text-base font-medium bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Building2 className="w-5 h-5" />
                Cadastrar Empresa
              </motion.button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-600"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Pagamento processado com segurança</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
