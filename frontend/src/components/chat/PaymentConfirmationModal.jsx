import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CreditCard,
  Lock,
  CheckCircle,
  AlertCircle,
  Loader2,
  FileText,
  User,
  DollarSign,
  Shield,
  Sparkles,
  Receipt
} from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '@/lib/stripe';
import { subscriptionsService } from '@/api/services/subscriptions';
import { assistantService } from '@/api/services/assistant';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

// Inner form component with Stripe hooks
function PaymentForm({ invoice, company, onSuccess, onCancel, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasPaymentMethod, setHasPaymentMethod] = useState(false);
  const [checkingPaymentMethod, setCheckingPaymentMethod] = useState(true);
  const [cardError, setCardError] = useState(null);
  const [step, setStep] = useState('confirm'); // 'confirm', 'add_card', 'processing', 'success'

  const INVOICE_FEE = 9.00; // R$ 9.00 per invoice

  // Check if user has a payment method on file by getting plan limits
  useEffect(() => {
    const checkPaymentMethod = async () => {
      try {
        // Get current subscription which should have stripeSubscriptionId if payment configured
        const current = await subscriptionsService.getCurrent();
        // If user has a stripeSubscriptionId or is on pay_per_use with active status, they likely have payment
        const hasPM = !!(current?.stripeSubscriptionId || (current?.planId === 'pay_per_use' && current?.status === 'ACTIVE'));
        setHasPaymentMethod(hasPM);
      } catch (_error) {
        console.log('No subscription found, checking if new user...');
        // For new users or users without subscription, assume they need to add card
        setHasPaymentMethod(false);
      } finally {
        setCheckingPaymentMethod(false);
      }
    };
    checkPaymentMethod();
  }, []);

  const handleCardChange = (event) => {
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  };

  const handleAddCard = async () => {
    if (!stripe || !elements) {
      toast.error('⏳ Carregando...', {
        description: 'O sistema de pagamento está carregando. Aguarde um momento.',
        duration: 3000
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Create SetupIntent
      const setupData = await subscriptionsService.createSetupIntent();
      
      // Get card element
      const cardElement = elements.getElement(CardElement);
      
      // Confirm setup intent to save the card
      const { error: setupError } = await stripe.confirmCardSetup(
        setupData.clientSecret,
        {
          payment_method: {
            card: cardElement,
          },
        }
      );

      if (setupError) {
        // Translate Stripe error messages
        const errorMessage = translateStripeError(setupError.message, setupError.code);
        throw new Error(errorMessage);
      }

      // Card saved successfully
      setHasPaymentMethod(true);
      setStep('confirm');
      toast.success('✅ Cartão Cadastrado!', {
        description: 'Seu cartão foi salvo com segurança. Agora você pode emitir notas.',
        duration: 4000
      });

    } catch (error) {
      console.error('Error adding card:', error);
      
      // Get user-friendly error message
      const friendlyMessage = getCardErrorMessage(error.message);
      
      toast.error(friendlyMessage.title, {
        description: friendlyMessage.description,
        duration: 5000
      });
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Helper function to translate Stripe error codes
  const translateStripeError = (message, code) => {
    const translations = {
      'card_declined': 'Cartão recusado pelo banco',
      'expired_card': 'Cartão expirado',
      'incorrect_cvc': 'Código de segurança incorreto',
      'incorrect_number': 'Número do cartão incorreto',
      'invalid_expiry_month': 'Mês de validade inválido',
      'invalid_expiry_year': 'Ano de validade inválido',
      'invalid_number': 'Número do cartão inválido',
      'processing_error': 'Erro de processamento',
    };
    return translations[code] || message;
  };
  
  // Helper function to get user-friendly card error messages
  const getCardErrorMessage = (message) => {
    const lowerMessage = message?.toLowerCase() || '';
    
    if (lowerMessage.includes('declined') || lowerMessage.includes('recusado')) {
      return {
        title: '❌ Cartão Recusado',
        description: 'Seu banco recusou o cartão. Verifique os dados ou tente outro cartão.'
      };
    }
    if (lowerMessage.includes('expired') || lowerMessage.includes('expirado')) {
      return {
        title: '📅 Cartão Vencido',
        description: 'Este cartão está vencido. Use um cartão válido.'
      };
    }
    if (lowerMessage.includes('cvc') || lowerMessage.includes('cvv') || lowerMessage.includes('segurança')) {
      return {
        title: '🔢 Código Incorreto',
        description: 'O código de segurança (CVV) está incorreto. Verifique os 3 números no verso do cartão.'
      };
    }
    if (lowerMessage.includes('number') || lowerMessage.includes('número')) {
      return {
        title: '🔢 Número Inválido',
        description: 'O número do cartão está incorreto. Verifique e tente novamente.'
      };
    }
    if (lowerMessage.includes('insufficient') || lowerMessage.includes('insuficiente')) {
      return {
        title: '💰 Saldo Insuficiente',
        description: 'Seu cartão não tem limite disponível. Tente outro cartão.'
      };
    }
    
    return {
      title: '⚠️ Erro no Cartão',
      description: message || 'Não foi possível adicionar o cartão. Verifique os dados e tente novamente.'
    };
  };

  const handleConfirmPayment = async () => {
    // Validate required data before proceeding
    if (!company?.id) {
      toast.error('🏢 Empresa Não Selecionada', {
        description: 'Selecione uma empresa no menu lateral para emitir notas fiscais.',
        duration: 5000
      });
      return;
    }
    
    if (!invoice?.cliente_nome || !invoice?.valor) {
      toast.error('📝 Dados Incompletos', {
        description: 'Preencha o nome do cliente e o valor da nota fiscal.',
        duration: 5000
      });
      return;
    }

    setIsProcessing(true);
    setStep('processing');

    try {
      // Execute the invoice emission action - backend will charge automatically for pay per use
      const result = await assistantService.executeAction({
        action_type: 'emitir_nfse',
        action_data: {
          cliente_nome: invoice.cliente_nome,
          cliente_documento: invoice.cliente_documento || '',
          descricao_servico: invoice.descricao_servico || 'Serviço prestado',
          valor: invoice.valor,
          aliquota_iss: invoice.aliquota_iss || 5,
          municipio: invoice.municipio || company?.cidade,
          codigo_servico: '1401',
          data_prestacao: new Date().toISOString().split('T')[0]
        },
        company_id: company.id
      });

      if (result.status === 'success') {
        setStep('success');
        toast.success('Nota fiscal emitida!', {
          description: `Pagamento de R$ ${INVOICE_FEE.toFixed(2)} processado com sucesso.`
        });
        setTimeout(() => {
          onSuccess(result);
        }, 1500);
      } else {
        throw new Error(result.message || 'Erro ao emitir nota fiscal');
      }

    } catch (error) {
      console.error('Payment/Invoice error:', error);
      
      // Extract error info
      const errorCode = error.response?.data?.code || error.code;
      const errorStatus = error.response?.status || error.status;
      const errorMessage = error.response?.data?.message || error.message;
      
      // User-friendly error messages mapping
      const getErrorInfo = () => {
        // Payment method issues
        if (errorStatus === 402 || errorCode === 'PAYMENT_METHOD_REQUIRED') {
          return {
            step: 'add_card',
            title: '💳 Cartão Necessário',
            message: 'Para emitir notas fiscais, você precisa cadastrar um cartão de crédito.',
            action: 'add_card'
          };
        }
        
        if (errorCode === 'PAYMENT_FAILED') {
          return {
            step: 'add_card',
            title: '❌ Pagamento Recusado',
            message: 'Seu cartão foi recusado. Verifique o saldo ou tente outro cartão.',
            action: 'add_card'
          };
        }
        
        if (errorCode === 'PAYMENT_REQUIRES_ACTION') {
          return {
            step: 'confirm',
            title: '🔐 Autenticação Necessária',
            message: 'Seu banco requer confirmação adicional. Verifique seu app do banco.',
            action: '3ds'
          };
        }
        
        // Card errors
        if (errorCode === 'card_declined' || errorMessage?.includes('declined')) {
          return {
            step: 'add_card',
            title: '❌ Cartão Recusado',
            message: 'Seu cartão foi recusado. Verifique os dados ou use outro cartão.',
            action: 'retry'
          };
        }
        
        if (errorCode === 'insufficient_funds' || errorMessage?.includes('insufficient')) {
          return {
            step: 'add_card',
            title: '💰 Saldo Insuficiente',
            message: 'Seu cartão não tem saldo suficiente. Tente outro cartão.',
            action: 'retry'
          };
        }
        
        if (errorCode === 'expired_card' || errorMessage?.includes('expired')) {
          return {
            step: 'add_card',
            title: '📅 Cartão Expirado',
            message: 'Seu cartão está vencido. Por favor, cadastre um novo cartão.',
            action: 'add_card'
          };
        }
        
        // Invoice/Fiscal errors
        if (errorCode === 'COMPANY_NOT_CONFIGURED' || errorMessage?.includes('empresa')) {
          return {
            step: 'confirm',
            title: '🏢 Empresa Não Configurada',
            message: 'Configure sua empresa antes de emitir notas. Acesse as configurações.',
            action: 'retry'
          };
        }
        
        if (errorCode === 'FISCAL_ERROR' || errorMessage?.includes('prefeitura')) {
          return {
            step: 'confirm',
            title: '🏛️ Erro na Prefeitura',
            message: 'A prefeitura está temporariamente indisponível. Tente novamente em alguns minutos.',
            action: 'retry'
          };
        }
        
        if (errorCode === 'INVALID_CLIENT' || errorMessage?.includes('cliente')) {
          return {
            step: 'confirm',
            title: '👤 Cliente Inválido',
            message: 'Verifique os dados do cliente (nome e CPF/CNPJ).',
            action: 'retry'
          };
        }
        
        // Network errors
        if (errorCode === 'NETWORK_ERROR' || errorMessage?.includes('network')) {
          return {
            step: 'confirm',
            title: '📶 Sem Conexão',
            message: 'Verifique sua conexão com a internet e tente novamente.',
            action: 'retry'
          };
        }
        
        // Default error
        return {
          step: 'confirm',
          title: '⚠️ Ops! Algo deu errado',
          message: 'Não foi possível processar sua solicitação. Tente novamente.',
          action: 'retry'
        };
      };
      
      const errorInfo = getErrorInfo();
      
      // Handle 3D Secure authentication
      if (errorInfo.action === '3ds') {
        const clientSecret = error.response?.data?.data?.clientSecret;
        if (clientSecret && stripe) {
          try {
            const { error: confirmError } = await stripe.confirmCardPayment(clientSecret);
            if (confirmError) {
              throw new Error(confirmError.message);
            }
            // Retry after 3D Secure confirmation
            await handleConfirmPayment();
            return;
          } catch (_secureError) {
            setStep('confirm');
            toast.error('🔐 Autenticação Falhou', {
              description: 'A verificação do banco não foi concluída. Tente novamente ou use outro cartão.',
              duration: 6000
            });
            return;
          }
        }
      }
      
      // Update UI state
      setStep(errorInfo.step);
      if (errorInfo.action === 'add_card') {
        setHasPaymentMethod(false);
      }
      
      // Show user-friendly toast
      toast.error(errorInfo.title, {
        description: errorInfo.message,
        duration: 6000
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (checkingPaymentMethod) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  // Show error if company is not available
  if (!company?.id) {
    return (
      <div className="py-8 text-center">
        <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/10 flex items-center justify-center">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        <h4 className="text-xl font-bold text-white mb-2">Empresa não selecionada</h4>
        <p className="text-slate-400 mb-4">Por favor, selecione uma empresa no menu lateral.</p>
        <button
          onClick={onClose}
          className="px-6 py-2 rounded-xl font-semibold bg-slate-800/50 text-slate-300 hover:text-white border border-slate-700/50 transition-all"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-12 h-12 rounded-xl",
            "bg-gradient-to-br from-orange-500/20 to-amber-500/10",
            "flex items-center justify-center",
            "border border-orange-500/30"
          )}>
            <Receipt className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Confirmar Pagamento</h3>
            <p className="text-sm text-slate-400">Plano Pay per Use</p>
          </div>
        </div>
        <button
          onClick={onClose}
          disabled={isProcessing}
          className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-white transition-all"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Success State */}
      {step === 'success' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">Pagamento Confirmado!</h4>
          <p className="text-slate-400">Emitindo sua nota fiscal...</p>
        </motion.div>
      )}

      {/* Processing State */}
      {step === 'processing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="py-8 text-center"
        >
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
            <Loader2 className="w-10 h-10 text-orange-400 animate-spin" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">Processando Pagamento</h4>
          <p className="text-slate-400">Por favor, aguarde...</p>
        </motion.div>
      )}

      {/* Add Card State */}
      {step === 'add_card' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
              <div>
                <p className="text-amber-200 font-medium">Cartão necessário</p>
                <p className="text-sm text-amber-300/70 mt-1">
                  Para emitir notas no plano Pay per Use, você precisa adicionar um cartão de crédito.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Dados do Cartão
            </label>
            <div className={cn(
              "p-4 bg-slate-800/30 border rounded-2xl transition-all duration-300",
              cardError 
                ? 'border-red-500/50 ring-2 ring-red-500/20' 
                : 'border-slate-700/50 focus-within:ring-2 focus-within:ring-orange-500/50 focus-within:border-orange-500/50'
            )}>
              <CardElement 
                options={CARD_ELEMENT_OPTIONS} 
                onChange={handleCardChange}
              />
            </div>
            {cardError && (
              <p className="mt-2 text-sm text-red-400">{cardError}</p>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setStep('confirm')}
              disabled={isProcessing}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-semibold",
                "bg-slate-800/50 text-slate-300 hover:text-white",
                "border border-slate-700/50 hover:border-slate-600/50",
                "transition-all duration-200"
              )}
            >
              Voltar
            </button>
            <button
              onClick={handleAddCard}
              disabled={isProcessing || !stripe}
              className={cn(
                "flex-1 py-3 px-4 rounded-xl font-semibold",
                "bg-gradient-to-r from-orange-500 to-amber-500",
                "text-white shadow-lg shadow-orange-500/25",
                "hover:shadow-xl hover:shadow-orange-500/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200",
                "flex items-center justify-center gap-2"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  Adicionar Cartão
                </>
              )}
            </button>
          </div>
        </motion.div>
      )}

      {/* Confirm State */}
      {step === 'confirm' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Invoice Summary */}
          <div className="mb-6 p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
            <h4 className="text-sm font-semibold text-slate-400 mb-3 uppercase tracking-wider">
              Resumo da Nota Fiscal
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <User className="w-4 h-4" />
                  <span>Cliente</span>
                </div>
                <span className="text-white font-medium">{invoice.cliente_nome}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <FileText className="w-4 h-4" />
                  <span>Serviço</span>
                </div>
                <span className="text-white font-medium truncate max-w-[200px]">
                  {invoice.descricao_servico || 'Serviço prestado'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-400">
                  <DollarSign className="w-4 h-4" />
                  <span>Valor da Nota</span>
                </div>
                <span className="text-white font-bold text-lg">
                  R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Payment Fee */}
          <div className="mb-6 p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-amber-500/5 border border-orange-500/20">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-white font-semibold">Taxa de Emissão</h4>
                <p className="text-sm text-slate-400 mt-0.5">Plano Pay per Use</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold text-orange-400">R$ {INVOICE_FEE.toFixed(2)}</span>
                <p className="text-xs text-slate-500">por nota</p>
              </div>
            </div>
          </div>

          {/* Payment Method Status */}
          {hasPaymentMethod ? (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                <div>
                  <p className="text-emerald-200 font-medium">Cartão cadastrado</p>
                  <p className="text-sm text-emerald-300/70">O pagamento será cobrado no seu cartão</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-400" />
                  <div>
                    <p className="text-amber-200 font-medium">Nenhum cartão cadastrado</p>
                    <p className="text-sm text-amber-300/70">Adicione um cartão para continuar</p>
                  </div>
                </div>
                <button
                  onClick={() => setStep('add_card')}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-semibold",
                    "bg-amber-500/20 text-amber-300 hover:bg-amber-500/30",
                    "border border-amber-500/40",
                    "transition-all duration-200"
                  )}
                >
                  Adicionar
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              disabled={isProcessing}
              className={cn(
                "flex-1 py-4 px-4 rounded-xl font-semibold",
                "bg-slate-800/50 text-slate-300 hover:text-white",
                "border border-slate-700/50 hover:border-slate-600/50",
                "transition-all duration-200"
              )}
            >
              Cancelar
            </button>
            <button
              onClick={hasPaymentMethod ? handleConfirmPayment : () => setStep('add_card')}
              disabled={isProcessing}
              className={cn(
                "flex-1 py-4 px-4 rounded-xl font-bold",
                "bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500",
                "text-white shadow-lg shadow-orange-500/25",
                "hover:shadow-xl hover:shadow-orange-500/30",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-all duration-200",
                "flex items-center justify-center gap-2"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processando...
                </>
              ) : hasPaymentMethod ? (
                <>
                  <Lock className="w-5 h-5" />
                  Confirmar — R$ {INVOICE_FEE.toFixed(2)}
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  Adicionar Cartão
                </>
              )}
            </button>
          </div>

          {/* Security Badge */}
          <div className="flex items-center justify-center gap-4 mt-6 pt-4 border-t border-slate-800/50">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Shield className="w-4 h-4" />
              SSL Seguro
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Lock className="w-4 h-4" />
              Criptografado
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Sparkles className="w-4 h-4" />
              Stripe
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Main Modal Component
export default function PaymentConfirmationModal({ 
  isOpen, 
  onClose, 
  invoice, 
  company, 
  onSuccess, 
  onCancel 
}) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className={cn(
              "relative w-full max-w-lg",
              "rounded-3xl overflow-hidden",
              "bg-gradient-to-b from-[#0f1014] via-[#0c0d10] to-[#09090c]",
              "border border-slate-700/30",
              "shadow-2xl shadow-black/50"
            )}>
              {/* Top glow */}
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
              
              {/* Content */}
              <div className="relative p-6">
                <Elements stripe={stripePromise}>
                  <PaymentForm
                    invoice={invoice}
                    company={company}
                    onSuccess={onSuccess}
                    onCancel={onCancel}
                    onClose={onClose}
                  />
                </Elements>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
