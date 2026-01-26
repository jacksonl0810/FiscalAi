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
  KeyRound,
  FileText,
  X
} from 'lucide-react';
import { subscriptionsService } from '@/api/services/subscriptions';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { handleApiError } from '@/utils/errorHandler';

const planDetails = {
  pro: {
    name: 'Pro',
    description: 'Para profissionais autônomos e MEIs',
    price: 97,
    icon: Zap,
    color: 'orange',
    features: ['Notas fiscais ilimitadas', 'Assistente IA completo', 'Comando por voz', '1 empresa']
  },
  business: {
    name: 'Business',
    description: 'Para empresas e escritórios contábeis',
    price: 197,
    icon: Building2,
    color: 'violet',
    features: ['Tudo do Pro +', 'Até 5 empresas', 'Multiusuários', 'API de integração']
  }
};

export default function CheckoutSubscription() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const planId = searchParams.get('plan');
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [card, setCard] = useState({
    number: '',
    holder_name: '',
    exp_month: '',
    exp_year: '',
    cvv: ''
  });
  const [cpfCnpj, setCpfCnpj] = useState(user?.cpf_cnpj || '');

  const plan = planDetails[planId];

  // Format CPF/CNPJ for display
  const formatCpfCnpj = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 11) {
      // CPF: 000.000.000-00
      return cleaned
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    } else {
      // CNPJ: 00.000.000/0000-00
      return cleaned
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
        .slice(0, 18);
    }
  };

  // Redirect if invalid plan
  useEffect(() => {
    if (!planId || !plan) {
      toast.error('Plano inválido');
      navigate('/pricing');
    }
  }, [planId, plan, navigate]);

  // ✅ State for card_token (persistent, race-safe)
  const [cardToken, setCardToken] = useState(null);

  // ✅ Tokenize card via backend (v5-compliant)
  // Backend handles Pagar.me tokenization and returns token_xxxxx
  const tokenizeCard = async () => {
    // Normalize card data
    const cardNumber = card.number.replace(/\s/g, '');
    const holderName = card.holder_name.trim().toUpperCase();
    const expMonth = parseInt(card.exp_month.trim(), 10);
    const expYearRaw = parseInt(card.exp_year.trim(), 10);
    // Convert 2-digit year to 4-digit for Pagar.me (e.g., 24 -> 2024)
    const expYear = expYearRaw < 100 ? 2000 + expYearRaw : expYearRaw;
    const cvv = card.cvv.trim();

    // Final validation before API call
    if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
      throw new Error('Mês de validade inválido. Use um valor entre 01 e 12');
    }
    if (isNaN(expYear) || expYear < new Date().getFullYear()) {
      throw new Error('Ano de validade inválido ou expirado');
    }

    // ✅ Call backend tokenization endpoint
    const result = await subscriptionsService.tokenizeCard({
      number: cardNumber,
      holder_name: holderName,
      exp_month: expMonth,
      exp_year: expYear,
      cvv: cvv
    });

    // ✅ Backend returns token (token_xxxxx)
    // Pagar.me /tokens with public key returns token_xxxxx
    // Card will be created when token is attached to customer
    if (!result.token || !result.token.startsWith('token_')) {
      throw new Error('Falha ao tokenizar cartão: formato inválido recebido do backend');
    }

    // Store token in state (persistent, prevents re-tokenization)
    // Card will be created automatically when token is attached to customer
    setCardToken(result.token);

    console.log('[Card Tokenization] ✅ Card tokenized successfully:', {
      token: result.token.substring(0, 20) + '...',
      card_last4: result.card?.last_four_digits || 'N/A',
      card_brand: result.card?.brand || 'N/A'
    });

    return result.token;
  };

  const formatCardNumber = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const chunks = cleaned.match(/.{1,4}/g) || [];
    return chunks.join(' ').slice(0, 19); // 16 digits + 3 spaces
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ Race condition protection - prevent double submission
    if (isProcessing) return;
    
    setIsProcessing(true);

    try {
      // Validate CPF/CNPJ
      const cleanCpfCnpj = cpfCnpj.replace(/\D/g, '');
      if (!cleanCpfCnpj || (cleanCpfCnpj.length !== 11 && cleanCpfCnpj.length !== 14)) {
        throw new Error('CPF ou CNPJ inválido. CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.');
      }

      // Validate card data
      const cardNumber = card.number.replace(/\s/g, '');
      if (cardNumber.length !== 16) {
        throw new Error('Número do cartão inválido');
      }

      if (!card.holder_name || card.holder_name.length < 3) {
        throw new Error('Nome do titular inválido');
      }

      // Validate and normalize expiration month
      const expMonthRaw = card.exp_month.trim();
      const expMonth = parseInt(expMonthRaw, 10);
      
      if (isNaN(expMonth) || expMonth < 1 || expMonth > 12) {
        throw new Error('Mês de validade inválido. Use um valor entre 01 e 12');
      }

      // Validate and normalize expiration year
      const expYearRaw = card.exp_year.trim();
      const expYear = parseInt(expYearRaw, 10);
      
      // Convert 2-digit year to 4-digit (e.g., 24 -> 2024)
      const fullYear = expYear < 100 ? 2000 + expYear : expYear;
      const currentYear = new Date().getFullYear();
      
      if (isNaN(expYear) || fullYear < currentYear) {
        throw new Error('Ano de validade inválido ou expirado');
      }

      if (!card.cvv || card.cvv.length < 3) {
        throw new Error('CVV inválido');
      }

      // ✅ Step 1: Tokenize card via backend (if not already tokenized)
      // Uses cached token if available (prevents duplicate tokenization)
      const finalToken = cardToken ?? await tokenizeCard();

      // ✅ Step 2: Send only token to backend (no card data)
      // Backend will: create customer -> attach token (creates card) -> create subscription
      const response = await subscriptionsService.processPayment({
        plan_id: planId,
        billing_cycle: 'monthly', // TODO: Add UI selector for monthly/annual
        card_token: finalToken, // ✅ Must be token_xxxxx format
        cpf_cnpj: cleanCpfCnpj // ✅ Required for Pagar.me customer creation
      });

      // ✅ Step 3: Navigate based on payment status
      // Pagar.me returns 'active'/'paid' for immediate success, 'pending' otherwise
      const paymentStatus = response?.data?.status || response?.status;
      
      if (paymentStatus === 'active' || paymentStatus === 'paid') {
        // Payment confirmed immediately by Pagar.me
        toast.success('Pagamento confirmado com sucesso!');
        navigate(`/payment-success?plan=${planId}&status=paid`);
      } else {
        // Payment pending - needs webhook confirmation
        toast.info('Pagamento enviado! Aguardando confirmação...');
        navigate(`/payment-success?plan=${planId}&status=pending`);
      }

    } catch (error) {
      await handleApiError(error, { operation: 'process_payment', planId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!plan) {
    return null;
  }

  const PlanIcon = plan.icon;
  const isPro = planId === 'pro';

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4 py-12">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className={`absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial ${isPro ? 'from-orange-500/10' : 'from-violet-500/10'} via-transparent to-transparent blur-3xl`} />
        <div className={`absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial ${isPro ? 'from-amber-500/8' : 'from-purple-500/8'} via-transparent to-transparent blur-3xl`} />
        
        {/* Subtle grid */}
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
            {/* Card glow */}
            <div className={`absolute -inset-1 bg-gradient-to-br ${isPro ? 'from-orange-500/20 via-amber-500/10 to-orange-600/20' : 'from-violet-500/20 via-purple-500/10 to-violet-600/20'} rounded-[32px] blur-2xl opacity-50`} />
            
            <div className={`relative h-full rounded-3xl overflow-hidden bg-gradient-to-b ${isPro ? 'from-[#12100d] via-[#0d0b09] to-[#0a0908]' : 'from-[#110d14] via-[#0c0a0f] to-[#09070a]'} border ${isPro ? 'border-orange-500/20' : 'border-violet-500/20'}`}>
              {/* Top accent line */}
              <div className={`absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent ${isPro ? 'via-orange-400/50' : 'via-violet-400/50'} to-transparent`} />
              
              {/* Noise texture */}
              <div className="absolute inset-0 opacity-[0.015]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
              }} />

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

                {/* Plan name and description */}
                <div className="mb-8">
                  <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className={`w-10 h-10 rounded-xl ${isPro ? 'bg-gradient-to-br from-orange-500/20 to-amber-500/10' : 'bg-gradient-to-br from-violet-500/20 to-purple-500/10'} flex items-center justify-center`}>
                      <Sparkles className={`w-5 h-5 ${isPro ? 'text-orange-400' : 'text-violet-400'}`} />
                    </span>
                MAY {plan.name}
              </h2>
                  <p className="text-slate-500">{plan.description}</p>
            </div>

                {/* Price */}
                <div className="mb-8">
                  <div className="flex items-baseline">
                    <span className="text-slate-500 text-xl">R$</span>
                    <span className="text-5xl font-bold text-white mx-1">{plan.price}</span>
                    <span className="text-slate-500 text-lg">/mês</span>
              </div>
                  <p className={`text-xs ${isPro ? 'text-orange-400/70' : 'text-violet-400/70'} mt-2`}>
                    💳 Cobrado mensalmente • Cancele quando quiser
                  </p>
            </div>

                {/* Divider */}
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
                <span>Pagamento seguro processado por Pagar.me</span>
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
            {/* Card glow */}
            <div className="absolute -inset-1 bg-gradient-to-br from-slate-500/10 via-slate-400/5 to-slate-500/10 rounded-[32px] blur-2xl opacity-30" />
            
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c] border border-slate-700/30">
              {/* Top accent line */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-slate-500/30 to-transparent" />
              
              {/* Noise texture */}
              <div className="absolute inset-0 opacity-[0.015]" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
              }} />

              <div className="relative p-8">
                {/* Header */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 flex items-center justify-center border border-slate-600/30">
                    <CreditCard className="w-5 h-5 text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">Dados do Cartão</h3>
                    <p className="text-xs text-slate-500">Preencha os dados do seu cartão de crédito</p>
            </div>
          </div>

                <form onSubmit={handleSubmit} className="space-y-5">
              {/* Card Number */}
              <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                  Número do Cartão
                </label>
                    <div className="relative group">
                  <input
                    type="text"
                    id="card-number"
                    name="card_number"
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                        className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 text-lg tracking-wider"
                    required
                  />
                      <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                </div>
              </div>

              {/* Cardholder Name */}
              <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                  Nome do Titular
                </label>
                    <div className="relative group">
                  <input
                    type="text"
                    id="card-holder-name"
                    name="card_holder_name"
                    value={card.holder_name}
                    onChange={(e) => setCard({ ...card, holder_name: e.target.value.toUpperCase() })}
                    placeholder="NOME COMO NO CARTÃO"
                        className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 uppercase tracking-wide"
                    required
                  />
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                </div>
              </div>

                  {/* CPF/CNPJ */}
                  <div>
                    <label className="block text-sm font-medium text-slate-400 mb-2">
                      CPF ou CNPJ
                    </label>
                    <div className="relative group">
                      <input
                        type="text"
                        id="cpf-cnpj"
                        name="cpf_cnpj"
                        value={cpfCnpj}
                        onChange={(e) => setCpfCnpj(formatCpfCnpj(e.target.value))}
                        placeholder="000.000.000-00 ou 00.000.000/0000-00"
                        maxLength={18}
                        className="w-full px-4 py-4 pl-12 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300"
                        required
                      />
                      <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Necessário para emissão de notas fiscais</p>
                  </div>

              {/* Expiration and CVV */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                    Mês
                  </label>
                      <div className="relative group">
                  <input
                          type="text"
                    id="card-exp-month"
                    name="card_exp_month"
                    value={card.exp_month}
                          onChange={(e) => setCard({ ...card, exp_month: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    placeholder="MM"
                          maxLength={2}
                          className="w-full px-4 py-4 pl-11 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 text-center text-lg"
                    required
                  />
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
                      </div>
                </div>
                <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                    Ano
                  </label>
                  <input
                        type="text"
                    id="card-exp-year"
                    name="card_exp_year"
                    value={card.exp_year}
                        onChange={(e) => setCard({ ...card, exp_year: e.target.value.replace(/\D/g, '').slice(0, 2) })}
                    placeholder="AA"
                        maxLength={2}
                        className="w-full px-4 py-4 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 text-center text-lg"
                    required
                  />
                </div>
                <div>
                      <label className="block text-sm font-medium text-slate-400 mb-2">
                    CVV
                  </label>
                      <div className="relative group">
                  <input
                          type="password"
                    id="card-cvv"
                    name="card_cvv"
                    value={card.cvv}
                    onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                          placeholder="•••"
                    maxLength={4}
                          className="w-full px-4 py-4 pl-11 bg-slate-800/30 border border-slate-700/50 rounded-2xl text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all duration-300 text-center text-lg tracking-widest"
                    required
                  />
                        <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-orange-400 transition-colors" />
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
                {/* Cancel Button */}
                <motion.button
                  type="button"
                  onClick={() => navigate('/pricing')}
                  disabled={isProcessing}
                  whileHover={isProcessing ? {} : { scale: 1.02, y: -2 }}
                  whileTap={isProcessing ? {} : { scale: 0.98 }}
                  className={`relative flex-1 py-5 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group ${
                    isProcessing 
                      ? 'bg-slate-800/20 text-slate-500 cursor-not-allowed border border-slate-700/20' 
                      : 'bg-gradient-to-br from-slate-800/50 via-slate-800/40 to-slate-900/50 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-600/80 hover:bg-slate-800/60 backdrop-blur-md shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-black/30'
                  }`}
                >
                  {/* Subtle shine effect on hover */}
                  {!isProcessing && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                  )}
                  <X className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
                  <span className="relative z-10 tracking-wide">Cancelar</span>
                </motion.button>

                {/* Submit Button */}
                <motion.button
                  type="submit"
                  disabled={isProcessing}
                  whileHover={isProcessing ? {} : { scale: 1.02, y: -2 }}
                  whileTap={isProcessing ? {} : { scale: 0.98 }}
                  className={`relative flex-1 py-5 px-6 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group ${
                    isProcessing 
                      ? 'bg-slate-700/40 text-slate-400 cursor-not-allowed border border-slate-700/30' 
                      : `bg-gradient-to-r ${isPro ? 'from-orange-500 via-orange-600 to-amber-500 hover:from-orange-400 hover:via-orange-500 hover:to-amber-400' : 'from-violet-500 via-violet-600 to-purple-500 hover:from-violet-400 hover:via-violet-500 hover:to-purple-400'} text-white border-2 ${isPro ? 'border-orange-400/40 hover:border-orange-300/60' : 'border-violet-400/40 hover:border-violet-300/60'} shadow-2xl ${isPro ? 'shadow-orange-500/40 hover:shadow-orange-500/50' : 'shadow-violet-500/40 hover:shadow-violet-500/50'} hover:shadow-[0_0_40px_rgba(249,115,22,0.4)]`
                  }`}
                >
                  {/* Animated gradient overlay */}
                  {!isProcessing && (
                    <>
                      <div className={`absolute inset-0 bg-gradient-to-r ${isPro ? 'from-orange-300/30 via-amber-300/30 to-orange-300/30' : 'from-violet-300/30 via-purple-300/30 to-violet-300/30'} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                      <div className="absolute inset-0 bg-gradient-to-b from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </>
                  )}
                  
                  {/* Outer glow effect */}
                  {!isProcessing && (
                    <div className={`absolute -inset-0.5 bg-gradient-to-r ${isPro ? 'from-orange-500 to-amber-500' : 'from-violet-500 to-purple-500'} rounded-2xl opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 -z-10`} />
                  )}
                  
                  {/* Inner highlight */}
                  {!isProcessing && (
                    <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  )}
                  
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                      <span className="relative z-10">Processando pagamento...</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-5 h-5 relative z-10 drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
                      <span className="relative z-10 drop-shadow-md tracking-wide">
                        Confirmar Pagamento — R$ {plan.price},00
                      </span>
                    </>
                  )}
                </motion.button>
              </div>

                  {/* Terms */}
                  <p className="text-xs text-center text-slate-600 mt-4 leading-relaxed">
                    Ao confirmar, você concorda com nossos{' '}
                    <span className="text-slate-400 hover:text-white cursor-pointer">termos de serviço</span>
                    {' '}e autoriza a cobrança recorrente mensal de R$ {plan.price},00
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
                      Pagar.me
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
