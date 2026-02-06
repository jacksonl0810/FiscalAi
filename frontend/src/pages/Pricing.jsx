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
  Crown,
  CreditCard,
  Users,
  Calculator,
  Mail
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { subscriptionsService } from "@/api/services/subscriptions";

/**
 * FINAL PLAN STRUCTURE:
 * 1. Pay per Use: R$9/invoice, 1 company, unlimited invoices
 * 2. Essential: R$79/month or R$39/month (annual), 2 companies, 30 invoices/month
 * 3. Professional: R$149/month or R$129/month (annual), 5 companies, 100 invoices/month
 * 4. Accountant: Custom pricing, unlimited
 */
const plans = [
  {
    id: 'pay_per_use',
    name: 'Pay per Use',
    price: 9,
    period: '/nota',
    description: 'Pague apenas quando emitir',
    features: [
      '1 empresa (CNPJ)',
      'Notas ilimitadas',
      'R$9 por nota emitida',
      'Assistente IA completo',
      'Comando por voz',
      'Uso sob demanda'
    ],
    buttonText: 'Começar Agora',
    popular: false,
    gradient: 'from-slate-600 to-slate-700',
    icon: CreditCard,
    monthlyPrice: null, // No monthly fee
    annualPrice: null,
    perInvoicePrice: 9,
    isPayPerUse: true
  },
  {
    id: 'essential',
    name: 'Essential',
    price: 79,
    period: '/mês',
    description: 'Para pequenos negócios',
    features: [
      'Até 2 empresas (CNPJs)',
      'Até 30 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Gestão fiscal básica',
      'Integrações fiscais'
    ],
    buttonText: 'Assinar Essential',
    popular: true,
    gradient: 'from-orange-500 to-orange-600',
    icon: Zap,
    monthlyPrice: 79,
    annualPrice: 468, // R$39/month × 12
    annualMonthlyEquivalent: 39,
    isPayPerUse: false
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 149,
    period: '/mês',
    description: 'Para empresas em crescimento',
    features: [
      'Até 5 empresas (CNPJs)',
      'Até 100 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Revisão contábil opcional',
      'Relatórios avançados',
      'Integrações fiscais avançadas'
    ],
    buttonText: 'Assinar Professional',
    popular: false,
    gradient: 'from-purple-500 to-purple-600',
    icon: Building2,
    monthlyPrice: 149,
    annualPrice: 1548, // R$129/month × 12
    annualMonthlyEquivalent: 129,
    isPayPerUse: false
  },
  {
    id: 'accountant',
    name: 'Contador',
    price: null,
    period: 'personalizado',
    description: 'Para contadores e escritórios',
    features: [
      'Empresas ilimitadas',
      'Notas fiscais ilimitadas',
      'Integrações avançadas',
      'API de integração',
      'Gestão de clientes',
      'Suporte dedicado',
      'Treinamento incluso'
    ],
    buttonText: 'Falar com Vendas',
    popular: false,
    gradient: 'from-emerald-500 to-emerald-600',
    icon: Users,
    monthlyPrice: null,
    annualPrice: null,
    isPayPerUse: false,
    isCustomPricing: true
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
  /** @type {['monthly' | 'annual', React.Dispatch<React.SetStateAction<'monthly' | 'annual'>>]} */
  const [selectedBillingCycle, setSelectedBillingCycle] = useState(/** @type {'monthly' | 'annual'} */ ('monthly'));

  const handleSelectPlan = async (plan) => {
    // Custom pricing - redirect to contact
    if (plan.isCustomPricing) {
      window.location.href = 'mailto:contato@mayassessorfiscal.com.br?subject=Interesse no Plano Contador&body=Olá, gostaria de saber mais sobre o plano Contador para escritórios de contabilidade.';
      return;
    }

    if (!isAuthenticated) {
      navigate('/login', { state: { selectedPlan: plan.id } });
      return;
    }

    setLoadingPlan(plan.id);

    try {
      const result = await subscriptionsService.createCheckout({
        plan_id: plan.id,
        billing_cycle: plan.isPayPerUse ? undefined : selectedBillingCycle,
        return_url: plan.isPayPerUse 
          ? `${window.location.origin}/payment-success?plan=pay_per_use`
          : `${window.location.origin}/subscription-pending?plan=${plan.id}`,
        cancel_url: `${window.location.origin}/pricing`
      });

      if (result.checkout_url) {
        const url = new URL(result.checkout_url, window.location.origin);
        if (!plan.isPayPerUse && selectedBillingCycle) {
          url.searchParams.set('billing_cycle', selectedBillingCycle);
        }
        window.location.href = url.toString();
      } else {
        throw new Error('Checkout URL not received');
      }
    } catch (error) {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'create_checkout', planId: plan.id });
    } finally {
      setLoadingPlan(null);
    }
  };

  // Get display price based on billing cycle
  const getDisplayPrice = (plan) => {
    if (plan.isPayPerUse) return plan.perInvoicePrice;
    if (plan.isCustomPricing) return null;
    
    if (selectedBillingCycle === 'annual' && plan.annualMonthlyEquivalent) {
      return plan.annualMonthlyEquivalent;
    }
    return plan.monthlyPrice;
  };

  // Get period text based on billing cycle
  const getPeriodText = (plan) => {
    if (plan.isPayPerUse) return '/nota';
    if (plan.isCustomPricing) return '';
    return '/mês';
  };

  return (
    <div className="min-h-screen bg-[#07070a]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[1000px] h-[1000px] bg-gradient-radial from-orange-500/8 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute top-1/3 left-0 w-[800px] h-[800px] bg-gradient-radial from-purple-500/6 via-purple-500/2 to-transparent blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-amber-500/5 via-transparent to-transparent blur-3xl" />
        
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
            backgroundSize: '100px 100px'
          }}
        />
        
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
              (() => {
                const status = user?.subscription_status;
                const plan = user?.plan;
                
                const planLower = plan ? String(plan).toLowerCase() : null;
                const statusLower = status ? String(status).toLowerCase() : null;
                
                const hasAccess = 
                  (planLower === 'pay_per_use' || planLower === 'essential' || planLower === 'professional' || planLower === 'accountant') ||
                  (statusLower === 'ativo' || statusLower === 'active') ||
                  (user?.days_remaining > 0);
                
                return hasAccess ? (
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
                  <div className="flex items-center gap-3">
                    <span className="text-slate-500 text-sm">{user?.name || user?.email}</span>
                  </div>
                );
              })()
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
                <span className="text-slate-300">A partir de R$9/nota</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Check className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-slate-300">Sem mensalidade obrigatória</span>
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

        {/* Billing Cycle Toggle (for subscription plans) */}
        <section className="px-4 pb-8">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-center gap-2 p-1.5 bg-slate-800/50 rounded-2xl border border-slate-700/50">
              <button
                type="button"
                onClick={() => setSelectedBillingCycle('monthly')}
                className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all ${
                  selectedBillingCycle === 'monthly'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Mensal
              </button>
              <button
                type="button"
                onClick={() => setSelectedBillingCycle('annual')}
                className={`flex-1 px-6 py-3 rounded-xl text-sm font-semibold transition-all relative ${
                  selectedBillingCycle === 'annual'
                    ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                Anual
                <span className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded-full">
                  -50%
                </span>
              </button>
            </div>
            {selectedBillingCycle === 'annual' && (
              <p className="text-center text-sm text-emerald-400 mt-3">
                💰 Economize até 50% pagando anualmente
              </p>
            )}
          </div>
        </section>

        {/* Pricing Cards */}
        <section className="py-12 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-6 items-start">
              {plans.map((plan, index) => {
                const PlanIcon = plan.icon;
                const displayPrice = getDisplayPrice(plan);
                
                return (
                <motion.div
                  key={plan.id}
                    initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.7, delay: index * 0.12, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`relative group ${plan.popular ? 'lg:-mt-4 lg:mb-4 z-10' : ''}`}
                  >
                    {/* Glow effect */}
                    <div className={`absolute -inset-[2px] rounded-[32px] opacity-0 group-hover:opacity-100 transition-all duration-700 blur-xl ${
                      plan.popular
                        ? 'bg-gradient-to-br from-orange-500/50 via-amber-400/30 to-orange-600/50'
                        : plan.id === 'professional'
                          ? 'bg-gradient-to-br from-violet-500/40 via-purple-400/20 to-violet-600/40'
                          : plan.id === 'accountant'
                            ? 'bg-gradient-to-br from-emerald-500/40 via-teal-400/20 to-emerald-600/40'
                            : 'bg-gradient-to-br from-slate-400/20 via-slate-300/10 to-slate-400/20'
                    }`} />
                    
                    {/* Popular badge glow */}
                    {plan.popular && (
                      <div className="absolute -inset-[3px] bg-gradient-to-b from-orange-400/60 via-amber-500/30 to-orange-600/60 rounded-[32px] blur-md" />
                    )}
                    
                    {/* Main card */}
                    <div className={`relative h-full rounded-[28px] overflow-hidden transition-all duration-500 group-hover:translate-y-[-4px] ${
                      plan.popular 
                        ? 'bg-gradient-to-b from-[#1a1208] via-[#14100a] to-[#0d0a06]' 
                        : plan.id === 'professional'
                          ? 'bg-gradient-to-b from-[#130d1a] via-[#0f0a14] to-[#0a070d]'
                          : plan.id === 'accountant'
                            ? 'bg-gradient-to-b from-[#0c1a14] via-[#0a1510] to-[#080f0c]'
                            : 'bg-gradient-to-b from-[#12141a] via-[#0e1015] to-[#0a0b0f]'
                  }`}
                >
                      {/* Inner border */}
                      <div className={`absolute inset-0 rounded-[28px] ${
                        plan.popular
                          ? 'ring-2 ring-inset ring-orange-500/30'
                          : plan.id === 'professional'
                            ? 'ring-1 ring-inset ring-violet-500/20'
                            : plan.id === 'accountant'
                              ? 'ring-1 ring-inset ring-emerald-500/20'
                              : 'ring-1 ring-inset ring-white/[0.08]'
                      }`} />
                      
                      {/* Top accent line */}
                      <div className={`absolute top-0 left-6 right-6 h-[1px] ${
                        plan.popular
                          ? 'bg-gradient-to-r from-transparent via-orange-400/60 to-transparent'
                          : plan.id === 'professional'
                            ? 'bg-gradient-to-r from-transparent via-violet-400/50 to-transparent'
                            : plan.id === 'accountant'
                              ? 'bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent'
                              : 'bg-gradient-to-r from-transparent via-white/10 to-transparent'
                      }`} />

                      {/* Card content */}
                      <div className="relative p-7 pt-6">
                        {/* Badge */}
                        <div className="flex justify-center mb-6">
                          <motion.div 
                            whileHover={{ scale: 1.05 }}
                            className={`inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-[10px] font-bold tracking-[0.1em] uppercase backdrop-blur-sm ${
                              plan.popular
                                ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg shadow-orange-500/30'
                                : plan.id === 'professional'
                                  ? 'bg-violet-950/80 text-violet-300 border border-violet-500/30'
                                  : plan.id === 'accountant'
                                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/30'
                                    : 'bg-slate-800/80 text-slate-400 border border-slate-600/30'
                            }`}
                          >
                            {plan.popular ? (
                              <>
                                <Crown className="w-3.5 h-3.5" />
                        Mais Popular
                              </>
                            ) : plan.id === 'professional' ? (
                              <>
                                <Building2 className="w-3.5 h-3.5" />
                                Empresas
                              </>
                            ) : plan.id === 'accountant' ? (
                              <>
                                <Users className="w-3.5 h-3.5" />
                                Escritórios
                              </>
                            ) : (
                              <>
                                <CreditCard className="w-3.5 h-3.5" />
                                Sob Demanda
                              </>
                            )}
                          </motion.div>
                    </div>

                        {/* Plan icon */}
                        <div className="flex justify-center mb-4">
                          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
                            plan.popular
                              ? 'bg-orange-500/20 border border-orange-500/30'
                              : plan.id === 'professional'
                                ? 'bg-violet-500/20 border border-violet-500/30'
                                : plan.id === 'accountant'
                                  ? 'bg-emerald-500/20 border border-emerald-500/30'
                                  : 'bg-slate-500/20 border border-slate-500/30'
                          }`}>
                            <PlanIcon className={`w-7 h-7 ${
                              plan.popular
                                ? 'text-orange-400'
                                : plan.id === 'professional'
                                  ? 'text-violet-400'
                                  : plan.id === 'accountant'
                                    ? 'text-emerald-400'
                                    : 'text-slate-400'
                            }`} />
                          </div>
                        </div>

                        {/* Plan name */}
                        <div className="text-center mb-2">
                          <h3 className="text-2xl font-bold tracking-tight text-white">
                            {plan.name}
                          </h3>
                  </div>

                        {/* Description */}
                        <p className="text-center text-sm text-slate-500 mb-6 leading-relaxed">
                          {plan.description}
                        </p>

                        {/* Price section */}
                        <div className="text-center mb-6">
                          {plan.isCustomPricing ? (
                            <div className="flex items-baseline justify-center">
                              <span className="text-3xl font-bold text-white">Personalizado</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline justify-center">
                                <span className="text-slate-500 text-lg mr-1">R$</span>
                                <span className="text-4xl font-bold tracking-tight text-white">
                                  {displayPrice}
                                </span>
                                <span className="text-slate-500 text-base ml-1">
                                  {getPeriodText(plan)}
                                </span>
                              </div>
                              {!plan.isPayPerUse && selectedBillingCycle === 'annual' && plan.annualMonthlyEquivalent && (
                                <p className="text-xs text-emerald-400 mt-2">
                                  💰 Economia de {Math.round((1 - plan.annualMonthlyEquivalent / plan.monthlyPrice) * 100)}% no plano anual
                                </p>
                              )}
                              {plan.isPayPerUse && (
                                <p className="text-xs text-slate-500 mt-2">
                                  Sem mensalidade • Pague apenas quando usar
                                </p>
                              )}
                            </>
                          )}
                  </div>

                        {/* Divider */}
                        <div className="relative mb-6">
                          <div className={`h-[1px] ${
                            plan.popular
                              ? 'bg-gradient-to-r from-transparent via-orange-500/30 to-transparent'
                              : plan.id === 'professional'
                                ? 'bg-gradient-to-r from-transparent via-violet-500/20 to-transparent'
                                : plan.id === 'accountant'
                                  ? 'bg-gradient-to-r from-transparent via-emerald-500/20 to-transparent'
                                  : 'bg-gradient-to-r from-transparent via-slate-700/50 to-transparent'
                          }`} />
                        </div>

                        {/* Features list */}
                        <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                            <motion.li 
                              key={idx} 
                              initial={{ opacity: 0, x: -15 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.4 + idx * 0.06, duration: 0.4 }}
                              className="flex items-center gap-3 group/item"
                            >
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                                plan.popular
                                  ? 'bg-orange-500/15 ring-1 ring-orange-500/30'
                                  : plan.id === 'professional'
                                    ? 'bg-violet-500/15 ring-1 ring-violet-500/30'
                                    : plan.id === 'accountant'
                                      ? 'bg-emerald-500/15 ring-1 ring-emerald-500/30'
                                      : 'bg-slate-500/10 ring-1 ring-slate-500/20'
                              }`}>
                                <Check className={`w-3 h-3 ${
                                  plan.popular
                                    ? 'text-orange-400'
                                    : plan.id === 'professional'
                                      ? 'text-violet-400'
                                      : plan.id === 'accountant'
                                        ? 'text-emerald-400'
                                        : 'text-slate-500'
                                }`} />
                              </div>
                              <span className="text-sm text-slate-400 group-hover/item:text-slate-300 transition-colors">
                                {feature}
                              </span>
                            </motion.li>
                    ))}
                  </ul>

                        {/* CTA Button */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlan === plan.id}
                          className={`w-full py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-2 ${
                      plan.popular
                              ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25'
                              : plan.id === 'professional'
                                ? 'bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-500/80 hover:to-purple-500/80 text-white shadow-xl shadow-violet-500/20'
                                : plan.id === 'accountant'
                                  ? 'bg-gradient-to-r from-emerald-600/80 to-teal-600/80 hover:from-emerald-500/80 hover:to-teal-500/80 text-white shadow-xl shadow-emerald-500/20'
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
                                {plan.isCustomPricing ? (
                                  <>
                                    <Mail className="w-4 h-4" />
                                    {plan.buttonText}
                                  </>
                                ) : (
                                  <>
                        {plan.buttonText}
                                    <ArrowRight className="w-4 h-4" />
                                  </>
                                )}
                              </>
                            )}
                          </motion.button>
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
                    <div 
                      className="relative h-full rounded-2xl overflow-hidden"
                      style={{ transformStyle: "preserve-3d" }}
                    >
                      <div className="absolute -inset-1 bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-orange-600/30 rounded-3xl blur-xl opacity-0 group-hover:opacity-60 transition-all duration-500" />
                      
                      <div className="relative h-full bg-[#0d0f14] rounded-2xl border border-slate-800/80 group-hover:border-orange-500/30 transition-all duration-500 overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-800/20 via-transparent to-slate-900/30 opacity-50" />
                        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-600/50 to-transparent" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
                        
                        <div className="relative p-7">
                          <div 
                            className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500/15 to-amber-500/10 border border-orange-500/20 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-lg shadow-orange-500/5 group-hover:shadow-orange-500/20"
                            style={{ transform: "translateZ(20px)" }}
                          >
                            <feature.icon className="w-6 h-6 text-orange-400 group-hover:text-orange-300 transition-colors duration-300" />
                          </div>
                          
                          <h3 
                            className="text-lg font-semibold text-white mb-2.5 group-hover:text-orange-50 transition-colors duration-300"
                            style={{ transform: "translateZ(10px)" }}
                          >
                            {feature.title}
                          </h3>
                          
                          <p 
                            className="text-sm text-slate-500 leading-relaxed group-hover:text-slate-400 transition-colors duration-300"
                            style={{ transform: "translateZ(5px)" }}
                          >
                            {feature.description}
                          </p>
                        </div>
                        
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
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-purple-500/20 blur-3xl" />
              
              <div className="relative rounded-3xl p-12 md:p-16 backdrop-blur-xl border bg-gradient-to-br from-slate-900/90 via-orange-950/20 to-slate-900/90 border-orange-500/40">
                <div className="absolute top-0 left-1/4 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl" />
                <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl" />
                
                <div className="relative">
                  <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center">
                    <Zap className="w-10 h-10 text-orange-400" />
                  </div>
                  <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                    Comece agora
                    <span className="block mt-2 bg-gradient-to-r from-orange-400 to-amber-400 text-transparent bg-clip-text">
                      a partir de R$9
                    </span>
              </h2>
                  <p className="text-lg text-slate-400 mb-10 max-w-xl mx-auto">
                    Pague apenas quando emitir ou escolha um plano mensal.
                    Sem compromisso. Cancele quando quiser.
              </p>
              <Button
                onClick={() => handleSelectPlan(plans[0])}
                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-10 py-6 text-lg font-semibold shadow-xl shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 hover:scale-105"
              >
                    <CreditCard className="w-5 h-5 mr-2" />
                    Começar com Pay per Use
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
                  <p className="text-sm text-slate-500 mt-6">
                    R$9 por nota fiscal emitida • Sem mensalidade
                  </p>
                </div>
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
