import React, { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Sparkles, ArrowRight, Loader2, Clock, Zap, Building2, Crown, Shield, Gift, Star } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { subscriptionsService } from "@/api/services/subscriptions";

const planConfig = {
  'trial': {
    name: 'MAY Trial',
    icon: Gift,
    color: 'emerald',
    features: ['7 dias grátis', 'Até 5 notas fiscais', 'Assistente IA completo'],
    gradient: 'from-emerald-500 to-teal-500'
  },
  'pro': {
    name: 'MAY Pro',
    icon: Zap,
    color: 'orange',
    features: ['Notas ilimitadas', 'Assistente IA', 'Comando por voz'],
    gradient: 'from-orange-500 to-amber-500'
  },
  'business': {
    name: 'MAY Business',
    icon: Building2,
    color: 'violet',
    features: ['Até 5 empresas', 'Multiusuários', 'API de integração'],
    gradient: 'from-violet-500 to-purple-500'
  }
};

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshUser } = useAuth();
  const [paymentStatus, setPaymentStatus] = useState('confirming');
  const [errorMessage, setErrorMessage] = useState('');
  const hasProcessed = useRef(false);

  const planId = searchParams.get('plan') || 'pro';
  const sessionId = searchParams.get('session_id');
  const paymentStatusParam = searchParams.get('status'); // 'paid', 'pending', or null
  const plan = planConfig[planId] || planConfig.pro;
  const PlanIcon = plan.icon;

  useEffect(() => {
    // ✅ Prevent multiple executions
    if (hasProcessed.current) return;
    if (paymentStatus !== 'confirming') return; // Don't run if already processed

    const verifyPayment = async () => {
      // Mark as processing immediately to prevent re-triggers
      hasProcessed.current = true;

      try {
        // Case 1: URL has explicit status parameter 'paid' - webhook confirmed payment
        if (paymentStatusParam === 'paid') {
          // Payment confirmed by Pagar.me webhook
          setPaymentStatus('confirmed');
          if (refreshUser) {
            await refreshUser();
          }
          return;
        }

        // Case 2: URL has explicit status parameter 'pending' - redirect to pending page
        if (paymentStatusParam === 'pending') {
          // Real Pagar.me payment is pending - redirect to pending page
          navigate('/subscription-pending', { replace: true });
          return;
        }

        // Case 3: Trial plan - activate immediately (no payment needed)
        if (planId === 'trial') {
          try {
            // ✅ Check if user already has trial before making request
            if (user?.subscription_status === 'trial' && user?.plan === 'trial') {
              // Already has trial, skip API call
              setPaymentStatus('confirmed');
              if (refreshUser) {
                setTimeout(() => {
                  refreshUser().catch(console.error);
                }, 500);
              }
              return;
            }

            if (sessionId) {
              await subscriptionsService.confirmCheckout(planId, sessionId);
            }
            setPaymentStatus('confirmed');
            // Refresh user after a short delay to avoid re-triggering
            if (refreshUser) {
              setTimeout(() => {
                refreshUser().catch(console.error);
              }, 500);
            }
          } catch (error) {
            console.error('Error confirming trial:', error);
            
            // ✅ Handle rate limit errors gracefully
            if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED' || error?.code === 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED') {
              // If rate limited but user already has trial, show success
              if (user?.subscription_status === 'trial') {
                setPaymentStatus('confirmed');
                if (refreshUser) {
                  setTimeout(() => {
                    refreshUser().catch(console.error);
                  }, 500);
                }
                return;
              }
              // Otherwise show error message
              setErrorMessage('Muitas requisições. Aguarde alguns minutos e tente novamente.');
              setPaymentStatus('error');
              return;
            }
            
            // Even if confirmCheckout fails, show success if user already has trial
            if (user?.subscription_status === 'trial') {
              setPaymentStatus('confirmed');
            } else {
              throw error;
            }
          }
          return;
        }

        // Case 4: Check if subscription is ALREADY active with matching plan (page refresh scenario)
        // Only show confirmed if user has ACTIVE paid subscription, not trial
        if (user?.subscription_status === 'ativo' && user?.plan === planId) {
          setPaymentStatus('confirmed');
          return;
        }

        // Case 5: Simulated payment (development/test) - confirm immediately
        if (sessionId?.startsWith('sim_') || sessionId?.startsWith('trial_')) {
          try {
            await subscriptionsService.confirmCheckout(planId, sessionId);
            setPaymentStatus('confirmed');
            if (refreshUser) {
              setTimeout(() => {
                refreshUser().catch(console.error);
              }, 500);
            }
          } catch (error) {
            console.error('Error confirming simulated payment:', error);
            
            // ✅ Handle rate limit errors gracefully for all plan types
            if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED' || error?.code === 'SUBSCRIPTION_RATE_LIMIT_EXCEEDED') {
              // If rate limited but user already has the plan, show success
              if (user?.subscription_status === 'ativo' && user?.plan === planId) {
                setPaymentStatus('confirmed');
                if (refreshUser) {
                  setTimeout(() => {
                    refreshUser().catch(console.error);
                  }, 500);
                }
                return;
              }
              // Otherwise show error message
              setErrorMessage('Muitas requisições. Aguarde alguns minutos e tente novamente.');
              setPaymentStatus('error');
              return;
            }
            throw error;
          }
          return;
        }

        // Case 6: Default - redirect to pending page for real Pagar.me payments
        // Real payments need webhook confirmation before showing success
        console.log('[PaymentSuccess] No confirmation found, redirecting to pending page');
        navigate('/subscription-pending', { replace: true });

      } catch (error) {
        // Reset hasProcessed on error so user can retry
        hasProcessed.current = false;
        const { handleApiError } = await import('@/utils/errorHandler');
        await handleApiError(error, { operation: 'confirm_payment' });
        // On error, redirect to pending page instead of showing false success
        navigate('/subscription-pending', { replace: true });
      }
    };

    const timer = setTimeout(() => verifyPayment(), 300);
    return () => {
      clearTimeout(timer);
    };
  }, [planId, sessionId, paymentStatusParam, navigate, user, refreshUser, paymentStatus]);

  // Loading state
  if (paymentStatus === 'confirming') {
    return (
      <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-orange-500/15 via-transparent to-transparent blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-3xl" />
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

  // Pending state - redirect to pending page
  if (paymentStatus === 'pending') {
    navigate('/subscription-pending');
    return null;
  }

  // Success state
  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 right-1/4 w-[700px] h-[700px] bg-gradient-radial from-emerald-500/15 via-emerald-500/5 to-transparent blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-emerald-600/5 via-transparent to-transparent blur-3xl" />
        
        {/* Celebration particles */}
        <div className="absolute inset-0">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              initial={{ 
                opacity: 0, 
                y: Math.random() * 100,
                x: Math.random() * window.innerWidth 
              }}
              animate={{ 
                opacity: [0, 1, 0],
                y: -100,
              }}
              transition={{ 
                duration: 3 + Math.random() * 2,
                repeat: Infinity,
                delay: Math.random() * 2
              }}
              className={`absolute w-2 h-2 rounded-full ${
                i % 3 === 0 ? 'bg-emerald-400' : i % 3 === 1 ? 'bg-orange-400' : 'bg-amber-400'
              }`}
              style={{ left: `${Math.random() * 100}%`, top: `${50 + Math.random() * 50}%` }}
            />
          ))}
        </div>

        {/* Subtle grid */}
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
        {/* Card glow */}
        <div className="absolute -inset-1 bg-gradient-to-br from-emerald-500/30 via-teal-500/15 to-emerald-500/30 rounded-[36px] blur-2xl opacity-60" />
        
        {/* Main Card */}
        <div className="relative bg-gradient-to-b from-[#0c1410] via-[#0a100d] to-[#080c0a] rounded-[32px] border border-emerald-500/20 overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />
          
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }} />

          <div className="relative p-10 text-center">
            {/* Success Icon with Animation */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              {/* Outer pulsing ring */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-500/30 to-teal-500/20"
              />
              
              {/* Middle ring */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
                className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-500/30"
              />
              
              {/* Inner icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", delay: 0.4, stiffness: 150 }}
                className="absolute inset-6 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30"
              >
                <CheckCircle className="w-10 h-10 text-white" />
              </motion.div>
            </div>

            {/* Confetti burst */}
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.6 }}
              className="absolute top-20 left-1/2 -translate-x-1/2"
            >
              <span className="text-4xl">🎉</span>
            </motion.div>

            {/* Success Badge */}
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

            {/* Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-3"
            >
              {planId === 'trial' ? 'Bem-vindo à MAY!' : 'Parabéns!'}
            </motion.h1>

            {/* Subtitle */}
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

            {/* Error Message */}
        {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-4 mb-6"
              >
            <p className="text-sm text-yellow-400">{errorMessage}</p>
              </motion.div>
        )}

            {/* Plan Card */}
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
              {/* Plan icon and name */}
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

              {/* Features */}
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

            {/* Action Buttons */}
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

            {/* Security footer */}
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
