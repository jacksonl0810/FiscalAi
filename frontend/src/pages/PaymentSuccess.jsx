import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Sparkles, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { subscriptionsService } from "@/api/services/subscriptions";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshUser } = useAuth();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        // Give Pagar.me webhook time to process
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Refresh user to get updated subscription status
        if (refreshUser) {
          await refreshUser();
        }

        // Check subscription status
        const status = await subscriptionsService.getStatus();
        if (status.status === 'ativo' || status.status === 'trial') {
          setVerified(true);
        }
      } catch (error) {
        console.error('Error verifying payment:', error);
        // Still show success, webhook might be processing
        setVerified(true);
      } finally {
        setIsVerifying(false);
      }
    };

    verifyPayment();
  }, [refreshUser]);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-green-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-orange-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-md w-full"
      >
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          {isVerifying ? (
            <>
              <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">
                Processando pagamento...
              </h1>
              <p className="text-gray-400">
                Aguarde enquanto confirmamos seu pagamento.
              </p>
            </>
          ) : (
            <>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-10 h-10 text-green-500" />
              </motion.div>

              <h1 className="text-2xl font-bold text-white mb-4">
                Pagamento Confirmado! 🎉
              </h1>

              <p className="text-gray-400 mb-8">
                Sua assinatura está ativa. Você agora tem acesso completo ao FiscalAI.
              </p>

              <div className="bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20 rounded-xl p-4 mb-8">
                <div className="flex items-center justify-center gap-2 text-orange-400">
                  <Sparkles className="w-5 h-5" />
                  <span className="font-semibold">FiscalAI Pro</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Notas fiscais ilimitadas • Assistente IA • Comando por voz
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => navigate('/')}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-6"
                >
                  Ir para o Dashboard
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                
                <Button
                  onClick={() => navigate('/company-setup')}
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10 py-6"
                >
                  Cadastrar Empresa
                </Button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
