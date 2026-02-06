import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  CreditCard, 
  Lock, 
  ArrowLeft, 
  Loader2,
  Shield,
  CheckCircle,
  User,
  Sparkles,
  Zap,
  Building2,
  Calendar,
  FileText,
  X,
  Phone
} from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { subscriptionsService } from '@/api/services/subscriptions';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { handleApiError, getTranslatedError } from '@/utils/errorHandler';

const planDetails = {
  // New production plans
  essential: {
    name: 'Essential',
    description: 'Para pequenos negócios',
    price: 79,
    annualPrice: 39, // R$39/month when annual (R$468/year)
    icon: Zap,
    color: 'orange',
    features: [
      'Até 2 empresas (CNPJs)',
      'Até 30 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Gestão fiscal básica'
    ]
  },
  professional: {
    name: 'Professional',
    description: 'Para empresas em crescimento',
    price: 149,
    annualPrice: 129, // R$129/month when annual (R$1,548/year)
    icon: Building2,
    color: 'purple',
    features: [
      'Até 5 empresas (CNPJs)',
      'Até 100 notas fiscais/mês',
      'Assistente IA completo',
      'Comando por voz',
      'Revisão contábil opcional',
      'Relatórios avançados'
    ]
  }
};

// Stripe CardElement styling
const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#ffffff',
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSmoothing: 'antialiased',
      '::placeholder': {
        color: '#64748b',
      },
      iconColor: '#f97316',
    },
    invalid: {
      color: '#ef4444',
      iconColor: '#ef4444',
    },
  },
  hidePostalCode: true,
};

// Inner checkout form that uses Stripe hooks
function CheckoutForm({ planId, plan }) {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const billingCycleParam = searchParams.get('billing_cycle') || searchParams.get('cycle') || 'monthly';
  
  const validBillingCycles = ['monthly', 'annual'];
  const getValidBillingCycle = (value) => {
    return validBillingCycles.includes(value) ? value : 'monthly';
  };
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [billingCycle, setBillingCycle] = useState(getValidBillingCycle(billingCycleParam));
  const [cardError, setCardError] = useState(null);
  const [cpfCnpj, setCpfCnpj] = useState(user?.cpf_cnpj || '');
  const [phone, setPhone] = useState('');
  const [billingAddress, setBillingAddress] = useState({
    line_1: '',
    line_2: '',
    city: '',
    state: '',
    zip_code: ''
  });

  const getPriceForBillingCycle = () => {
    if (billingCycle === 'annual') {
      // Annual price is the monthly equivalent (total/12)
      // Display the full year price for payment
      const annualMonthlyPrice = plan.annualPrice || plan.price;
      return annualMonthlyPrice * 12; // Full year price
    }
    return plan.price;
  };

  const getDisplayPrice = () => {
    if (billingCycle === 'annual') {
      return plan.annualPrice || plan.price;
    }
    return plan.price;
  };

  // Format CPF/CNPJ for display
  const formatCpfCnpj = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      return cleaned
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .slice(0, 18);
    }
  };

  // Format phone for display
  const formatPhone = (value) => {
    let cleaned = value.replace(/\D/g, '');
    if (cleaned.startsWith('55') && cleaned.length >= 12) {
      cleaned = cleaned.substring(2);
    }
    cleaned = cleaned.slice(0, 11);
    
    if (cleaned.length <= 10) {
      return cleaned
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d{1,4})$/, '$1-$2');
    } else {
      return cleaned
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d{1,4})$/, '$1-$2');
    }
  };

  // Format CEP for display
  const formatCep = (value) => {
    const cleaned = value.replace(/\D/g, '').slice(0, 8);
    return cleaned.replace(/(\d{5})(\d{1,3})$/, '$1-$2');
  };

  // Handle card element changes
  const handleCardChange = (event) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      toast.error('Stripe não carregado. Aguarde...');
      return;
    }
    
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Validate CPF/CNPJ
      const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
      if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
        throw new Error('CPF ou CNPJ inválido. CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.');
      }

      // Validate phone
      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
        cleanPhone = cleanPhone.substring(2);
      }
      if (!cleanPhone || cleanPhone.length < 10 || cleanPhone.length > 11) {
        throw new Error('Telefone obrigatório. Informe DDD + número (ex: 47999998888).');
      }
      const phoneWithCountryCode = `55${cleanPhone}`;

      // Validate billing address
      if (!billingAddress.line_1 || billingAddress.line_1.trim().length < 3) {
        throw new Error('Endereço de cobrança é obrigatório');
      }
      if (!billingAddress.city || billingAddress.city.trim().length < 2) {
        throw new Error('Cidade é obrigatória');
      }
      if (!billingAddress.state || billingAddress.state.trim().length !== 2) {
        throw new Error('Estado inválido. Use 2 letras (ex: SP, RJ)');
      }
      const cleanCep = billingAddress.zip_code.replace(/\D/g, '');
      if (!cleanCep || cleanCep.length !== 8) {
        throw new Error('CEP inválido. Deve ter 8 dígitos');
      }

      // Step 1: Create PaymentMethod using Stripe.js
      console.log('[Stripe] Creating PaymentMethod...');
      const cardElement = elements.getElement(CardElement);
      
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
        billing_details: {
          name: user?.name,
          email: user?.email,
          phone: phoneWithCountryCode,
          address: {
            line1: billingAddress.line_1.trim(),
            line2: billingAddress.line_2?.trim() || undefined,
            city: billingAddress.city.trim(),
            state: billingAddress.state.trim().toUpperCase(),
            postal_code: cleanCep,
            country: 'BR',
          },
        },
      });

      if (pmError) {
        throw new Error(pmError.message);
      }

      console.log('[Stripe] PaymentMethod created:', paymentMethod.id);

      // Step 2: Send to backend
      const response = await subscriptionsService.processPayment({
        plan_id: planId,
        billing_cycle: getValidBillingCycle(billingCycle),
        payment_method_id: paymentMethod.id,
        cpf_cnpj: cleanCpfCnpj,
        phone: phoneWithCountryCode,
        billing_address: {
          line_1: billingAddress.line_1.trim(),
          line_2: billingAddress.line_2?.trim() || '',
          city: billingAddress.city.trim(),
          state: billingAddress.state.trim().toUpperCase(),
          zip_code: cleanCep
        }
      });

      console.log('[Stripe] Backend response:', response);

      // Step 3: Handle 3D Secure if needed
      if (response?.client_secret && response?.status === 'incomplete') {
        console.log('[Stripe] Confirming payment with 3D Secure...');
        const { error: confirmError } = await stripe.confirmCardPayment(
          response.client_secret
        );

        if (confirmError) {
          throw new Error(confirmError.message);
        }
      }

      // Success!
      if (response?.is_paid) {
        toast.success('Assinatura ativada com sucesso!', {
          duration: 5000,
          description: 'Seu pagamento foi confirmado. Aproveite todos os recursos!'
        });
        navigate(`/payment-success?plan=${planId}&status=paid`);
      } else {
        toast.success('Pagamento enviado! Aguardando confirmação...', {
          duration: 5000,
          description: 'Você será notificado quando o pagamento for aprovado.'
        });
        navigate(`/subscription-pending?plan=${planId}&subscription_id=${response?.stripe_subscription_id || ''}`);
      }

    } catch (error) {
      console.error('[Stripe] Error:', error);
      const message = await getTranslatedError(error, { operation: 'process_payment', planId });
      toast.error('Pagamento não concluído', { description: message, duration: 6000 });
      navigate(`/payment-failed?error=${encodeURIComponent(message)}`, { replace: true });
    } finally {
      setIsProcessing(false);
    }
  };

  const PlanIcon = plan.icon;
  // Color scheme based on plan - orange for essential, violet/purple for professional
  const isPro = planId === 'essential';

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4 py-12">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial ${isPro ? 'from-orange-500/10' : 'from-violet-500/10'} via-transparent to-transparent blur-3xl`} />
        <div className={`absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial ${isPro ? 'from-amber-500/8' : 'from-purple-500/8'} via-transparent to-transparent blur-3xl`} />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-5xl"
      >
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left side - Plan Summary (2 columns) */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2 relative"
          >
            <div className={`absolute -inset-1 bg-gradient-to-br ${isPro ? 'from-orange-500/20 via-amber-500/10 to-orange-600/20' : 'from-violet-500/20 via-purple-500/10 to-violet-600/20'} rounded-[32px] blur-2xl opacity-50`} />
            
            <div className={`relative h-full rounded-3xl overflow-hidden bg-gradient-to-b ${isPro ? 'from-[#12100d] via-[#0d0b09] to-[#0a0908]' : 'from-[#110d14] via-[#0c0a0f] to-[#09070a]'} border ${isPro ? 'border-orange-500/20' : 'border-violet-500/20'}`}>
              <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${isPro ? 'via-orange-400/50' : 'via-violet-400/50'} to-transparent`} />
              
              <div className="relative p-8">
                {/* Back button */}
                <motion.button
                  whileHover={{ x: -4 }}
                  onClick={() => navigate('/pricing')}
                  className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para planos
                </motion.button>

                {/* Plan badge */}
                <div className="flex justify-start mb-6">
                  <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase ${isPro ? 'bg-orange-500/15 text-orange-300 border border-orange-500/30' : 'bg-violet-500/15 text-violet-300 border border-violet-500/30'}`}>
                    <PlanIcon className="w-3.5 h-3.5" />
                    Plano {plan.name}
                  </div>
                </div>

                {/* Plan name */}
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl ${isPro ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/10' : 'bg-gradient-to-br from-violet-500/20 to-purple-500/10'} flex items-center justify-center`}>
                      <Sparkles className={`w-5 h-5 ${isPro ? 'text-orange-400' : 'text-violet-400'}`} />
                    </span>
                    MAY {plan.name}
                  </h2>
                  <p className="text-slate-500">{plan.description}</p>
                </div>

                {/* Billing Cycle Selector */}
                <div className="mb-6">
                  <div className="flex items-center justify-center gap-2 p-1 bg-slate-800/30 rounded-xl border border-slate-700/50">
                    {['monthly', 'annual'].map((cycle) => (
                      <button
                        key={cycle}
                        type="button"
                        onClick={() => setBillingCycle(cycle)}
                        className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                          billingCycle === cycle
                            ? isPro
                              ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40'
                              : 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                            : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {cycle === 'monthly' ? 'Mensal' : 'Anual'}
                        {cycle === 'annual' && plan.annualPrice && plan.annualPrice < plan.price && (
                          <span className="ml-1 text-xs text-emerald-400">
                            ({Math.round((1 - plan.annualPrice / plan.price) * 100)}% off)
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline">
                    <span className="text-slate-500 text-xl">R$</span>
                    <span className="text-5xl font-bold text-white mx-1">{getDisplayPrice()}</span>
                    <span className="text-slate-500 text-lg">/mês</span>
                  </div>
                  {billingCycle === 'annual' && (
                    <p className="text-sm text-slate-400 mt-1">
                      Total: R$ {getPriceForBillingCycle()}/ano
                    </p>
                  )}
                  <p className={`text-xs ${isPro ? 'text-orange-400/70' : 'text-violet-400/70'} mt-2`}>
                    💳 {billingCycle === 'monthly' ? 'Cobrado mensalmente' : 'Cobrado anualmente'} • Cancele quando quiser
                  </p>
                </div>

                <div className={`h-px mb-6 bg-gradient-to-r from-transparent ${isPro ? 'via-orange-500/20' : 'via-violet-500/20'} to-transparent`} />

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, index) => (
                    <motion.div 
                      key={index} 
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + index * 0.1 }}
                      className="flex items-center gap-3"
                    >
                      <div className={`w-5 h-5 rounded-full ${isPro ? 'bg-orange-500/15 ring-1 ring-orange-500/30' : 'bg-violet-500/15 ring-1 ring-violet-500/30'} flex items-center justify-center flex-shrink-0`}>
                        <CheckCircle className={`w-3 h-3 ${isPro ? 'text-orange-400' : 'text-violet-400'}`} />
                      </div>
                      <span className="text-slate-400 text-sm">{feature}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Security badges */}
                <div className="space-y-3 pt-6 border-t border-white/5">
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <Shield className="w-4 h-4 text-emerald-500/70" />
                    <span>Pagamento seguro processado por Stripe</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <Lock className="w-4 h-4 text-emerald-500/70" />
                    <span>Dados criptografados com SSL 256-bit</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right side - Payment Form (3 columns) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-3 relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-br from-slate-500/10 via-slate-400/5 to-slate-500/10 rounded-[32px] blur-2xl opacity-30" />
            
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c] border border-slate-700/30">
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-500/30 to-transparent" />

              <div className="relative p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center border border-slate-600/30">
                    <CreditCard className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Dados do Cartão</h3>
                    <p className="text-xs text-slate-500">Pagamento seguro via Stripe</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Stripe Card Element */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Cartão de Crédito
                    </label>
                    <div className={`p-4 bg-slate-800/30 border rounded-2xl transition-all duration-300 ${
                      cardError 
                        ? 'border-red-500/50 ring-2 ring-red-500/20' 
                        : 'border-slate-700/50 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500/50'
                    }`}>
                      <CardElement 
                        options={CARD_ELEMENT_OPTIONS} 
                        onChange={handleCardChange}
                      />
                    </div>
                    {cardError && (
                      <p className="mt-2 text-sm text-red-400">{cardError}</p>
                    )}
                    <p className="mt-2 text-xs text-slate-600">
                      Número do cartão, validade e CVV
                    </p>
                  </div>

                  {/* CPF/CNPJ */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      CPF ou CNPJ
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                        required
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                    </div>
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      Telefone (com DDD)
                    </label>
                    <div className="relative group">
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        maxLength={15}
                        className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                        required
                      />
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                    </div>
                  </div>

                  {/* Billing Address Section */}
                  <div className="pt-5 mt-5 border-t border-slate-700/30">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-orange-400" />
                      Endereço de Cobrança
                    </h3>

                    <div className="space-y-4">
                      <input
                        type="text"
                        value={billingAddress.line_1}
                        onChange={(e) => setBillingAddress({ ...billingAddress, line_1: e.target.value })}
                        placeholder="Rua, número"
                        className="w-full px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                        required
                      />

                      <input
                        type="text"
                        value={billingAddress.line_2}
                        onChange={(e) => setBillingAddress({ ...billingAddress, line_2: e.target.value })}
                        placeholder="Complemento (opcional)"
                        className="w-full px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                      />

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input
                          type="text"
                          value={billingAddress.city}
                          onChange={(e) => setBillingAddress({ ...billingAddress, city: e.target.value })}
                          placeholder="Cidade"
                          className="md:col-span-1 px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                          required
                        />
                        <input
                          type="text"
                          value={billingAddress.state}
                          onChange={(e) => setBillingAddress({ ...billingAddress, state: e.target.value.toUpperCase().slice(0, 2) })}
                          placeholder="UF"
                          maxLength={2}
                          className="px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 uppercase"
                          required
                        />
                        <input
                          type="text"
                          value={billingAddress.zip_code}
                          onChange={(e) => setBillingAddress({ ...billingAddress, zip_code: formatCep(e.target.value) })}
                          placeholder="CEP"
                          maxLength={9}
                          className="px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                          required
                        />
                      </div>
                    </div>
                  </div>

                  {/* User Info Display */}
                  {user && (
                    <div className="pt-5 mt-5 border-t border-slate-700/30">
                      <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800/20 border border-slate-700/30">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                          <User className="w-6 h-6 text-orange-400" />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Assinatura para</p>
                          <p className="text-white font-medium">{user.name}</p>
                          <p className="text-sm text-slate-500">{user.email}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-4 mt-6">
                    <motion.button
                      type="button"
                      onClick={() => navigate('/pricing')}
                      disabled={isProcessing}
                      whileHover={isProcessing ? {} : { scale: 1.02 }}
                      whileTap={isProcessing ? {} : { scale: 0.98 }}
                      className="flex-1 py-5 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-3 bg-slate-800/50 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-600/80 disabled:opacity-50"
                    >
                      <X className="w-5 h-5" />
                      Cancelar
                    </motion.button>

                    <motion.button
                      type="submit"
                      disabled={isProcessing || !stripe}
                      whileHover={isProcessing ? {} : { scale: 1.02 }}
                      whileTap={isProcessing ? {} : { scale: 0.98 }}
                      className={`flex-1 py-5 px-6 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 ${
                        isProcessing || !stripe
                          ? 'bg-slate-700/40 text-slate-400 cursor-not-allowed'
                          : `bg-gradient-to-r ${isPro ? 'from-orange-500 via-orange-600 to-amber-500 hover:from-orange-400' : 'from-violet-500 via-violet-600 to-purple-500 hover:from-violet-400'} text-white shadow-2xl ${isPro ? 'shadow-orange-500/40' : 'shadow-violet-500/40'}`
                      }`}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processando...
                        </>
                      ) : (
                        <>
                          <Lock className="w-5 h-5" />
                          Confirmar — R$ {billingCycle === 'annual' ? getPriceForBillingCycle() : getDisplayPrice()},00
                          {billingCycle === 'annual' && <span className="text-xs opacity-75 ml-1">/ano</span>}
                        </>
                      )}
                    </motion.button>
                  </div>

                  {/* Terms */}
                  <p className="text-xs text-center text-slate-600 mt-4">
                    Ao confirmar, você concorda com nossos{' '}
                    <span className="text-slate-400 hover:text-white cursor-pointer">termos de serviço</span>
                  </p>

                  {/* Security footer */}
                  <div className="flex items-center justify-center gap-6 pt-4 mt-4 border-t border-slate-800/50">
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Shield className="w-4 h-4" />
                      SSL Seguro
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Lock className="w-4 h-4" />
                      Criptografado
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <CreditCard className="w-4 h-4" />
                      Stripe
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

// Main component that wraps everything with Stripe Elements
export default function CheckoutSubscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planId = searchParams.get('plan');
  const plan = planDetails[planId];

  // Redirect if invalid plan
  useEffect(() => {
    if (!planId || !plan) {
      toast.error('Plano inválido');
      navigate('/pricing');
    }
  }, [planId, plan, navigate]);

  if (!plan) {
    return null;
  }

  return (
    <Elements stripe={stripePromise}>
      <CheckoutForm planId={planId} plan={plan} />
    </Elements>
  );
}
