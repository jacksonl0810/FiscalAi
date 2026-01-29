import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { 
  Check, 
  Sparkles, 
  Zap, 
  Building2, 
  FileText, 
  Mic, 
  Bot,
  Shield,
  Clock,
  ArrowRight,
  Star,
  Lock,
  CheckCircle2,
  Crown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { subscriptionsService } from "@/api/services/subscriptions";

const plans = [
  {
    id: 'trial',
    name: 'Trial',
    price: 0,
    period: '7 dias',
    description: 'Experimente todas as funcionalidades',
    features: [
      'Até 5 notas fiscais',
      'Assistente IA completo',
      'Comando por voz',
      '1 empresa',
      'Suporte por email'
    ],
    buttonText: 'Começar Grátis',
    popular: false,
    gradient: 'from-gray-600 to-gray-700',
    monthlyPrice: 0,
    semiannualPrice: 0,
    annualPrice: 0
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 97,
    period: '/mês',
    description: 'Para profissionais autônomos e MEIs',
    features: [
      'Notas fiscais ilimitadas',
      'Assistente IA completo',
      'Comando por voz',
      '1 empresa',
      'Acompanhamento MEI',
      'Relatórios mensais',
      'Suporte prioritário'
    ],
    buttonText: 'Assinar Pro',
    popular: true,
    gradient: 'from-orange-500 to-orange-600',
    monthlyPrice: 97,
    semiannualPrice: 540,
    annualPrice: 970
  },
  {
    id: 'business',
    name: 'Business',
    price: 197,
    period: '/mês',
    description: 'Para empresas e escritórios contábeis',
    features: [
      'Tudo do Pro +',
      'Até 5 empresas',
      'Multiusuários',
      'API de integração',
      'Relatórios avançados',
      'Suporte dedicado',
      'Treinamento incluso'
    ],
    buttonText: 'Assinar Business',
    popular: false,
    gradient: 'from-purple-500 to-purple-600',
    monthlyPrice: 197,
    semiannualPrice: 1100,
    annualPrice: 1970
  }
];

const features = [
  {
    icon: Bot,
    title: 'Assistente IA',
    description: 'Emita notas fiscais apenas conversando com a IA'
  },
  {
    icon: Mic,
    title: 'Comando por Voz',
    description: 'Fale e deixe a IA fazer o resto'
  },
  {
    icon: FileText,
    title: 'NFS-e Automática',
    description: 'Emissão integrada com a prefeitura'
  },
  {
    icon: Shield,
    title: 'Segurança Total',
    description: 'Seus dados protegidos e criptografados'
  },
  {
    icon: Clock,
    title: 'Economia de Tempo',
    description: 'De 10 minutos para 10 segundos'
  },
  {
    icon: Building2,
    title: 'Multi-empresa',
    description: 'Gerencie várias empresas em um só lugar'
  }
];

export default function Pricing() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [selectedBillingCycle, setSelectedBillingCycle] = useState('monthly');
  const [trialEligibility, setTrialEligibility] = useState({
    eligible: true, // Default to eligible (for non-logged-in users)
    hasUsedTrial: false,
    loading: false
  });

  // Check trial eligibility when user is authenticated
  useEffect(() => {
    const checkTrialEligibility = async () => {
      if (!isAuthenticated) {
        setTrialEligibility({ eligible: true, hasUsedTrial: false, loading: false });
        return;
      }

      setTrialEligibility(prev => ({ ...prev, loading: true }));
      
      try {
        const result = await subscriptionsService.checkTrialEligibility();
        setTrialEligibility({
          eligible: result.eligible,
          hasUsedTrial: result.hasUsedTrial,
          trialStartedAt: result.trialStartedAt,
          loading: false
        });
      } catch (error) {
        // Silently handle trial eligibility check errors - default to eligible
        setTrialEligibility({ eligible: true, hasUsedTrial: false, loading: false });
      }
    };

    checkTrialEligibility();
  }, [isAuthenticated]);

  const handleSelectPlan = async (plan) => {
    if (!isAuthenticated) {
      // Redirect to login with plan info
      navigate('/login', { state: { selectedPlan: plan.id } });
      return;
    }

    // 🚫 Block trial if user has already used it
    if (plan.id === 'trial' && trialEligibility.hasUsedTrial) {
      toast.error('Você já utilizou seu período de teste gratuito. Por favor, escolha um plano pago.');
      return;
    }

    setLoadingPlan(plan.id);

    try {
      // Call /subscriptions/start endpoint
      // For trial: activates immediately
      // For paid plans: creates PENDING subscription and returns checkout_url
      const result = await subscriptionsService.createCheckout({
        plan_id: plan.id,
        billing_cycle: plan.id === 'trial' ? undefined : selectedBillingCycle,
        return_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/pricing`
      });

      if (result.checkout_url) {
        // Redirect to checkout URL (Pagar.me or success page for trial)
        const url = new URL(result.checkout_url, window.location.origin);
        if (plan.id !== 'trial' && selectedBillingCycle) {
          url.searchParams.set('billing_cycle', selectedBillingCycle);
        }
        window.location.href = url.toString();
      } else {
        throw new Error('Checkout URL not received');
      }
    } catch (error) {
      // Handle specific trial error
      if (error.code === 'TRIAL_ALREADY_USED') {
        toast.error('Você já utilizou seu período de teste gratuito. Por favor, escolha um plano pago.');
        setTrialEligibility(prev => ({ ...prev, eligible: false, hasUsedTrial: true }));
      } else {
        const { handleApiError } = await import('@/utils/errorHandler');
        await handleApiError(error, { operation: 'create_checkout', planId: plan.id });
      }
    } finally {
      setLoadingPlan(null);
    }
  };

  // Check if trial option should be disabled
  const isTrialDisabled = (planId) => {
    return planId === 'trial' && isAuthenticated && trialEligibility.hasUsedTrial;
  };

  return (
    <div className="min-h-screen bg-[#07070a]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main gradient orbs */}
        <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-gradient-radial from-orange-500/8 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute top-1/3 left-0 w-[800px] h-[800px] bg-gradient-radial from-purple-500/6 via-purple-500/2 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent blur-3xl" />
        
        {/* Subtle grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }}
        />
        
        {/* Top gradient line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="py-6 px-4 border-b border-white/5">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => navigate('/')}
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-amber-500 rounded-xl blur-md opacity-50 group-hover:opacity-80 transition-opacity" />
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-white tracking-tight">MAY</span>
                <span className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Fiscal AI</span>
            </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
            >
            {isAuthenticated ? (
              <Button 
                onClick={() => navigate('/')}
                  className="relative overflow-hidden bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 text-orange-300 hover:text-white hover:border-orange-500/50 hover:from-orange-500/20 hover:to-amber-500/20 transition-all duration-300 group px-6"
              >
                <span className="relative z-10 flex items-center gap-2">
                    Dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
            ) : (
              <Button 
                onClick={() => navigate('/login')}
                  className="relative overflow-hidden bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/30 text-orange-300 hover:text-white hover:border-orange-500/50 hover:from-orange-500/20 hover:to-amber-500/20 transition-all duration-300 px-6"
              >
                <span className="relative z-10">Entrar</span>
              </Button>
            )}
            </motion.div>
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-20 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 mb-8"
            >
              <Sparkles className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-orange-300 font-medium">Powered by AI</span>
            </motion.div>
            
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Emita notas fiscais{" "}
              <span className="block mt-2 bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 text-transparent bg-clip-text">
                apenas conversando
              </span>
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              O assistente de IA que emite suas notas fiscais por comando de voz ou texto.
              Simples, rápido e sem burocracia.
            </p>
            
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300">7 dias grátis</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300">Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300">Cancele quando quiser</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Pricing Cards */}
        <section className="py-20 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-5 lg:gap-6 items-start">
              {plans.map((plan, index) => {
                const trialDisabled = isTrialDisabled(plan.id);
                const trialCompleted = trialDisabled;
                
                // Define card theme colors
                const cardTheme = trialCompleted 
                  ? { primary: 'emerald', accent: 'teal' }
                  : plan.popular 
                    ? { primary: 'orange', accent: 'amber' }
                    : plan.id === 'business'
                      ? { primary: 'violet', accent: 'purple' }
                      : { primary: 'slate', accent: 'gray' };
                
                return (
                <motion.div
                  key={plan.id}
                    initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: index * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`relative group ${plan.popular ? 'md:-mt-6 md:mb-6 z-10' : ''}`}
                  >
                    {/* Luxury glow effect */}
                    <div className={`absolute -inset-[2px] rounded-[32px] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-xl ${
                      trialCompleted
                        ? 'bg-gradient-to-br from-emerald-500/40 via-teal-500/20 to-emerald-500/40'
                        : plan.popular
                          ? 'bg-gradient-to-br from-orange-500/50 via-amber-400/30 to-orange-600/50'
                          : plan.id === 'business'
                            ? 'bg-gradient-to-br from-violet-500/40 via-purple-400/20 to-violet-600/40'
                            : 'bg-gradient-to-br from-slate-400/20 via-slate-300/10 to-slate-400/20'
                    }`} />
                    
                    {/* Popular card permanent glow */}
                    {plan.popular && !trialCompleted && (
                      <div className="absolute -inset-[3px] bg-gradient-to-b from-orange-400/60 via-amber-500/30 to-orange-600/60 rounded-[32px] blur-md" />
                    )}
                    
                    {/* Main card */}
                    <div className={`relative h-full rounded-[28px] overflow-hidden transition-all duration-500 group-hover:translate-y-[-4px] ${
                      trialCompleted
                        ? 'bg-gradient-to-b from-[#0c1a14] via-[#0a1510] to-[#080f0c]'
                        : plan.popular 
                          ? 'bg-gradient-to-b from-[#1a1208] via-[#14100a] to-[#0d0a06]' 
                          : plan.id === 'business'
                            ? 'bg-gradient-to-b from-[#130d1a] via-[#0f0a14] to-[#0a070d]'
                            : 'bg-gradient-to-b from-[#12141a] via-[#0e1015] to-[#0a0b0f]'
                  }`}
                >
                      {/* Inner border effect */}
                      <div className={`absolute inset-0 rounded-[28px] ${
                        trialCompleted
                          ? 'ring-1 ring-inset ring-emerald-500/20'
                          : plan.popular
                            ? 'ring-2 ring-inset ring-orange-500/30'
                            : plan.id === 'business'
                              ? 'ring-1 ring-inset ring-violet-500/20'
                              : 'ring-1 ring-inset ring-white/[0.08]'
                      }`} />
                      
                      {/* Subtle noise texture overlay */}
                      <div className="absolute inset-0 opacity-[0.015]" style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
                      }} />
                      
                      {/* Top accent line */}
                      <div className={`absolute top-0 left-6 right-6 h-[1px] ${
                        trialCompleted
                          ? 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent'
                          : plan.popular
                            ? 'bg-gradient-to-r from-transparent via-orange-400/60 to-transparent'
                            : plan.id === 'business'
                              ? 'bg-gradient-to-r from-transparent via-violet-400/50 to-transparent'
                              : 'bg-gradient-to-r from-transparent via-white/10 to-transparent'
                      }`} />

                      {/* Card content */}
                      <div className="relative p-8 pt-6">
                        {/* Badge */}
                        <div className="flex justify-center mb-8">
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[11px] font-bold tracking-[0.1em] uppercase backdrop-blur-sm ${
                              trialCompleted
                                ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30 shadow-lg shadow-emerald-900/30'
                                : plan.popular
                                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                                  : plan.id === 'business'
                                    ? 'bg-violet-950/80 text-violet-300 border border-violet-500/30 shadow-lg shadow-violet-900/30'
                                    : 'bg-slate-800/80 text-slate-400 border border-slate-600/30'
                            }`}
                          >
                            {trialCompleted ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Concluído
                              </>
                            ) : plan.popular ? (
                              <>
                                <Crown className="w-3.5 h-3.5" />
                        Mais Popular
                              </>
                            ) : plan.id === 'business' ? (
                              <>
                                <Building2 className="w-3.5 h-3.5" />
                                Enterprise
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5" />
                                Starter
                              </>
                            )}
                          </motion.div>
                    </div>

                        {/* Plan name */}
                        <div className="text-center mb-2">
                          <h3 className={`text-3xl font-bold tracking-tight ${
                            trialCompleted 
                              ? 'text-emerald-200' 
                              : plan.popular 
                                ? 'text-white' 
                                : plan.id === 'business'
                                  ? 'text-violet-100'
                                  : 'text-white'
                          }`}>
                            {plan.name}
                          </h3>
                  </div>

                        {/* Description */}
                        <p className="text-center text-sm text-slate-500 mb-8 leading-relaxed max-w-[220px] mx-auto">
                          {trialCompleted 
                            ? 'Você aproveitou seu trial! Obrigado por experimentar.' 
                            : plan.description}
                        </p>

                        {/* Billing Cycle Selector (only for paid plans) */}
                        {!trialCompleted && plan.price > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center justify-center gap-2 p-1 bg-slate-800/30 rounded-xl border border-slate-700/50">
                              <button
                                type="button"
                                onClick={() => setSelectedBillingCycle('monthly')}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  selectedBillingCycle === 'monthly'
                                    ? plan.popular
                                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                      : plan.id === 'business'
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                        : 'bg-slate-700/50 text-white border border-slate-600/50'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Mensal
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedBillingCycle('semiannual')}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  selectedBillingCycle === 'semiannual'
                                    ? plan.popular
                                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                      : plan.id === 'business'
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                        : 'bg-slate-700/50 text-white border border-slate-600/50'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Semestral
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedBillingCycle('annual')}
                                className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                                  selectedBillingCycle === 'annual'
                                    ? plan.popular
                                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                                      : plan.id === 'business'
                                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                        : 'bg-slate-700/50 text-white border border-slate-600/50'
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                              >
                                Anual
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Price section */}
                        <div className="text-center mb-8">
                          {trialCompleted ? (
                            <div className="flex items-baseline justify-center gap-3">
                              <span className="text-4xl font-bold text-slate-600 line-through decoration-2 decoration-emerald-500/40">
                                Grátis
                              </span>
                              <span className="inline-flex items-center gap-1 text-sm text-emerald-400 font-semibold bg-emerald-500/10 px-3 py-1 rounded-full">
                                <Check className="w-3.5 h-3.5" />
                                Usado
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline justify-center">
                                {plan.price > 0 && (
                                  <span className="text-slate-500 text-lg mr-1">R$</span>
                                )}
                                <span className={`text-5xl font-bold tracking-tight ${
                                  plan.popular ? 'text-white' : 'text-white'
                                }`}>
                                  {plan.price === 0 ? 'Grátis' : (
                                    selectedBillingCycle === 'monthly' ? plan.monthlyPrice :
                                    selectedBillingCycle === 'semiannual' ? plan.semiannualPrice :
                                    plan.annualPrice
                                  )}
                    </span>
                    {plan.price > 0 && (
                                  <span className="text-slate-500 text-base ml-1">
                                    {selectedBillingCycle === 'monthly' ? '/mês' :
                                     selectedBillingCycle === 'semiannual' ? '/semestre' :
                                     '/ano'}
                                  </span>
                    )}
                              </div>
                    {plan.price === 0 && (
                                <span className="text-slate-500 text-sm">por {plan.period}</span>
                              )}
                              {plan.popular && selectedBillingCycle === 'annual' && (
                                <p className="text-xs text-orange-400/90 mt-3 font-medium">
                                  💰 Economize 20% no plano anual
                                </p>
                              )}
                              {plan.price > 0 && selectedBillingCycle !== 'monthly' && (
                                <p className="text-xs text-slate-500 mt-2">
                                  {selectedBillingCycle === 'semiannual' 
                                    ? `R$ ${(plan.semiannualPrice / 6).toFixed(2)}/mês equivalente`
                                    : `R$ ${(plan.annualPrice / 12).toFixed(2)}/mês equivalente`}
                                </p>
                              )}
                            </>
                    )}
                  </div>

                        {/* Elegant divider */}
                        <div className="relative mb-8">
                          <div className={`h-[1px] ${
                            trialCompleted
                              ? 'bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent'
                              : plan.popular
                                ? 'bg-gradient-to-r from-transparent via-orange-500/30 to-transparent'
                                : plan.id === 'business'
                                  ? 'bg-gradient-to-r from-transparent via-violet-500/20 to-transparent'
                                  : 'bg-gradient-to-r from-transparent via-slate-700/50 to-transparent'
                          }`} />
                          <div className={`absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 rounded-full ${
                            trialCompleted
                              ? 'bg-emerald-500/30'
                              : plan.popular
                                ? 'bg-orange-500/40'
                                : plan.id === 'business'
                                  ? 'bg-violet-500/30'
                                  : 'bg-slate-600/30'
                          }`} />
                        </div>

                        {/* Features list */}
                        <ul className="space-y-4 mb-10">
                    {plan.features.map((feature, idx) => (
                            <motion.li 
                              key={idx} 
                              initial={{ opacity: 0, x: -15 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + idx * 0.06, duration: 0.4 }}
                              className="flex items-center gap-3.5 group/item"
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover/item:scale-110 ${
                                trialCompleted
                                  ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                                  : plan.popular
                                    ? 'bg-orange-500/15 ring-1 ring-orange-500/30'
                                    : plan.id === 'business'
                                      ? 'bg-violet-500/15 ring-1 ring-violet-500/30'
                                      : 'bg-slate-500/10 ring-1 ring-slate-500/20'
                              }`}>
                                <Check className={`w-3 h-3 ${
                                  trialCompleted
                                    ? 'text-emerald-400'
                                    : plan.popular
                                      ? 'text-orange-400'
                                      : plan.id === 'business'
                                        ? 'text-violet-400'
                                        : 'text-slate-500'
                                }`} />
                              </div>
                              <span className={`text-sm transition-colors duration-300 ${
                                trialCompleted 
                                  ? 'text-slate-500' 
                                  : 'text-slate-400 group-hover/item:text-slate-300'
                              }`}>
                                {feature}
                              </span>
                            </motion.li>
                    ))}
                  </ul>

                        {/* CTA Button */}
                        {trialCompleted ? (
                          <div className="space-y-4">
                            <div className="w-full py-3.5 px-5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 flex items-center justify-center gap-2.5">
                              <Lock className="w-4 h-4 text-emerald-500/70" />
                              <span className="text-emerald-400/80 text-sm font-medium">Trial já utilizado</span>
                            </div>
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleSelectPlan(plans[1])}
                              className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2"
                            >
                              <Zap className="w-4 h-4" />
                              Migrar para Pro
                              <ArrowRight className="w-4 h-4" />
                            </motion.button>
                          </div>
                        ) : (
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlan === plan.id}
                            className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                      plan.popular
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25'
                                : plan.id === 'business'
                                  ? 'bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-500/80 hover:to-purple-500/80 text-white shadow-xl shadow-violet-500/20'
                                  : 'bg-white/[0.03] hover:bg-white/[0.06] text-white ring-1 ring-white/10 hover:ring-white/20'
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                              </>
                    ) : (
                              <>
                        {plan.buttonText}
                                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
                              </>
                            )}
                          </motion.button>
                        )}
                      </div>
                    </div>
                </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-16"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                Por que escolher a{" "}
                <span className="bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text">
                  MAY?
                </span>
            </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">
                Tecnologia de ponta para simplificar sua gestão fiscal
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-3 gap-5">
              {features.map((feature, index) => {
                // Calculate row and column for staggered animation
                const row = Math.floor(index / 3);
                const col = index % 3;
                
                return (
                <motion.div
                  key={index}
                    initial={{ opacity: 0, y: 30, rotateX: -15 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    transition={{ 
                      duration: 0.6, 
                      delay: 0.2 + (row * 0.15) + (col * 0.08),
                      ease: [0.25, 0.46, 0.45, 0.94]
                    }}
                    whileHover={{ 
                      y: -8,
                      rotateX: 5,
                      rotateY: -5,
                      scale: 1.02,
                      transition: { duration: 0.3, ease: "easeOut" }
                    }}
                    style={{ 
                      perspective: 1000,
                      transformStyle: "preserve-3d"
                    }}
                    className="group cursor-pointer"
                  >
                    {/* 3D Card Container */}
                    <div 
                      className="relative h-full rounded-2xl overflow-hidden"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      {/* Glow effect on hover */}
                      <div className="absolute -inset-1 bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-orange-600/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-60 transition-all duration-500" />
                      
                      {/* Card */}
                      <div className="relative h-full bg-[#0d0f14] rounded-2xl border border-slate-800/80 group-hover:border-orange-500/30 transition-all duration-500 overflow-hidden">
                        {/* Inner gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-900/30 opacity-50" />
                        
                        {/* Top shine effect */}
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent" />
                        
                        {/* Hover shine sweep effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                        
                        {/* Content */}
                        <div className="relative p-7">
                          {/* Icon container with 3D effect */}
                          <div 
                            className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-orange-500/5 group-hover:shadow-orange-500/20"
                            style={{ transform: "translateZ(20px)" }}
                          >
                            <feature.icon className="w-6 h-6 text-orange-400 group-hover:text-orange-300 transition-colors duration-300" />
                          </div>
                          
                          {/* Title */}
                          <h3 
                            className="text-lg font-semibold text-white mb-2.5 group-hover:text-orange-50 transition-colors duration-300"
                            style={{ transform: "translateZ(10px)" }}
                          >
                            {feature.title}
                          </h3>
                          
                          {/* Description */}
                          <p 
                            className="text-sm text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors duration-300"
                            style={{ transform: "translateZ(5px)" }}
                          >
                            {feature.description}
                          </p>
                        </div>
                        
                        {/* Bottom accent line on hover */}
                        <div className="absolute bottom-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      </div>
                  </div>
                </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="relative overflow-hidden"
            >
              {/* Background glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-purple-500/20 blur-3xl" />
              
              <div className={`relative rounded-3xl p-12 md:p-16 backdrop-blur-xl border ${
                trialEligibility.hasUsedTrial && isAuthenticated
                  ? 'bg-gradient-to-br from-slate-900/90 via-emerald-950/20 to-slate-900/90 border-emerald-500/30'
                  : 'bg-gradient-to-br from-slate-900/90 via-orange-950/20 to-slate-900/90 border-orange-500/40'
              }`}>
                {/* Decorative elements */}
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                
                {trialEligibility.hasUsedTrial && isAuthenticated ? (
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center">
                      <Crown className="w-10 h-10 text-emerald-400" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      Continue sua jornada
                      <span className="block mt-2 bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text">
                        com a MAY
                      </span>
                    </h2>
                    <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
                      Seu período de trial foi concluído com sucesso. 
                      Desbloqueie todo o potencial com um plano premium.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                      <Button
                        onClick={() => handleSelectPlan(plans[1])}
                        className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-10 py-6 text-lg font-semibold shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 hover:scale-105"
                      >
                        <Zap className="w-5 h-5 mr-2" />
                        Assinar Pro — R$ 97/mês
                      </Button>
                      <Button
                        onClick={() => handleSelectPlan(plans[2])}
                        className="bg-gradient-to-r from-purple-600/20 to-violet-600/20 border-2 border-purple-500/40 text-purple-200 hover:from-purple-600/30 hover:to-violet-600/30 hover:border-purple-400/60 hover:text-white px-8 py-6 text-lg font-semibold transition-all duration-300 shadow-lg shadow-purple-500/10 hover:shadow-purple-500/20"
                      >
                        <Building2 className="w-5 h-5 mr-2" />
                        Ver Business
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                      <Zap className="w-10 h-10 text-orange-400" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                      Comece agora
                      <span className="block mt-2 bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text">
                        gratuitamente
                      </span>
              </h2>
                    <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
                      7 dias de trial com todas as funcionalidades premium.
                      Sem cartão de crédito. Sem compromisso.
              </p>
              <Button
                onClick={() => handleSelectPlan(plans[0])}
                      className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-10 py-6 text-lg font-semibold shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 hover:scale-105"
              >
                      <Sparkles className="w-5 h-5 mr-2" />
                Começar Trial Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
                    <p className="text-sm text-slate-500 mt-6">
                      Junte-se a milhares de profissionais que já automatizaram suas notas fiscais
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                </div>
                <span className="text-slate-400 font-medium">MAY Fiscal AI</span>
              </div>
              
              <p className="text-slate-500 text-sm">
                © {new Date().getFullYear()} MAY. Todos os direitos reservados.
              </p>
              
              <div className="flex items-center gap-6 text-sm text-slate-500">
                <a href="#" className="hover:text-orange-400 transition-colors">Termos</a>
                <a href="#" className="hover:text-orange-400 transition-colors">Privacidade</a>
                <a href="#" className="hover:text-orange-400 transition-colors">Suporte</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
