import React, { useState } from "react";
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
  Star
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
    gradient: 'from-gray-600 to-gray-700'
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
    gradient: 'from-orange-500 to-orange-600'
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
    gradient: 'from-purple-500 to-purple-600'
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

  const handleSelectPlan = async (plan) => {
    if (!isAuthenticated) {
      // Redirect to login with plan info
      navigate('/login', { state: { selectedPlan: plan.id } });
      return;
    }

    if (plan.id === 'trial') {
      // Trial is free, just go to dashboard
      toast.success('Bem-vindo ao FiscalAI! Seu trial de 7 dias começou.');
      navigate('/');
      return;
    }

    setLoadingPlan(plan.id);

    try {
      // Create checkout session
      const result = await subscriptionsService.createCheckout({
        plan_id: plan.id,
        return_url: `${window.location.origin}/payment-success`,
        cancel_url: `${window.location.origin}/pricing`
      });

      if (result.checkout_url) {
        // Redirect to Pagar.me checkout
        window.location.href = result.checkout_url;
      } else {
        throw new Error('Checkout URL not received');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Erro ao criar checkout. Tente novamente.');
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-orange-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-purple-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="py-6 px-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <div 
              className="flex items-center gap-2 cursor-pointer"
              onClick={() => navigate('/')}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white">FiscalAI</span>
            </div>
            
            {isAuthenticated ? (
              <Button 
                onClick={() => navigate('/')}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Ir para Dashboard
              </Button>
            ) : (
              <Button 
                onClick={() => navigate('/login')}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Entrar
              </Button>
            )}
          </div>
        </header>

        {/* Hero Section */}
        <section className="py-16 px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Emita notas fiscais{" "}
              <span className="bg-gradient-to-r from-orange-500 to-purple-500 text-transparent bg-clip-text">
                apenas conversando
              </span>
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
              O assistente de IA que emite suas notas fiscais por comando de voz ou texto.
              Simples, rápido e sem burocracia.
            </p>
            <div className="flex items-center justify-center gap-4 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>7 dias grátis</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Sem cartão de crédito</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500" />
                <span>Cancele quando quiser</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Pricing Cards */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-3 gap-8">
              {plans.map((plan, index) => (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  className={`relative rounded-2xl p-8 ${
                    plan.popular 
                      ? 'bg-gradient-to-br from-orange-500/20 to-purple-500/20 border-2 border-orange-500/50' 
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold px-4 py-1 rounded-full flex items-center gap-1">
                        <Star className="w-3 h-3" />
                        Mais Popular
                      </div>
                    </div>
                  )}

                  <div className="mb-6">
                    <h3 className="text-2xl font-bold text-white mb-2">{plan.name}</h3>
                    <p className="text-gray-400 text-sm">{plan.description}</p>
                  </div>

                  <div className="mb-6">
                    <span className="text-4xl font-bold text-white">
                      {plan.price === 0 ? 'Grátis' : `R$ ${plan.price}`}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-gray-400">{plan.period}</span>
                    )}
                    {plan.price === 0 && (
                      <span className="text-gray-400 ml-2">por {plan.period}</span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-center gap-3 text-gray-300">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlan === plan.id}
                    className={`w-full py-6 text-lg font-semibold ${
                      plan.popular
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {loadingPlan === plan.id ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        {plan.buttonText}
                        <ArrowRight className="w-5 h-5" />
                      </div>
                    )}
                  </Button>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-16 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">
              Por que escolher o FiscalAI?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                  className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 flex items-center justify-center mb-4">
                    <feature.icon className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-gray-400">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-orange-500/30 rounded-2xl p-12"
            >
              <Zap className="w-12 h-12 text-orange-500 mx-auto mb-4" />
              <h2 className="text-3xl font-bold text-white mb-4">
                Comece agora gratuitamente
              </h2>
              <p className="text-xl text-gray-300 mb-8">
                7 dias de trial com todas as funcionalidades. Sem compromisso.
              </p>
              <Button
                onClick={() => handleSelectPlan(plans[0])}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-8 py-6 text-lg font-semibold"
              >
                Começar Trial Grátis
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </motion.div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-8 px-4 border-t border-white/10">
          <div className="max-w-6xl mx-auto text-center text-gray-400 text-sm">
            <p>© {new Date().getFullYear()} FiscalAI. Todos os direitos reservados.</p>
          </div>
        </footer>
      </div>
    </div>
  );
}
