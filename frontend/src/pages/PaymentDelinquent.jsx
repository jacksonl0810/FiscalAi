import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, CreditCard, ArrowRight, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function PaymentDelinquent() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-red-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-orange-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 max-w-md w-full bg-white/5 border border-white/10 rounded-2xl p-8 text-center"
      >
        <div className="w-20 h-20 bg-gradient-to-br from-red-500/20 to-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-10 h-10 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-white mb-4">
          Problema com Pagamento
        </h1>

        <p className="text-gray-300 mb-6">
          Não conseguimos processar seu último pagamento. 
          Por favor, atualize seu método de pagamento para continuar usando a MAY.
        </p>

        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-8">
          <div className="flex items-start gap-3 text-left">
            <HelpCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-400 font-medium mb-1">
                Motivos comuns:
              </p>
              <ul className="text-xs text-red-300/80 space-y-1">
                <li>• Cartão expirado ou bloqueado</li>
                <li>• Saldo insuficiente</li>
                <li>• Dados de pagamento incorretos</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            onClick={() => navigate('/subscription')}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
          >
            <CreditCard className="w-5 h-5 mr-2" />
            Atualizar Pagamento
          </Button>

          <Button
            onClick={() => navigate('/pricing')}
            variant="outline"
            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Ver Planos
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>

        <p className="text-xs text-gray-500 mt-6">
          Precisa de ajuda? Entre em contato com nosso suporte.
        </p>
      </motion.div>
    </div>
  );
}
