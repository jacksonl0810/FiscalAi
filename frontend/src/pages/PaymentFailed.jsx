import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, RefreshCw, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('error') || 'Houve um problema com seu pagamento.';

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-red-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tr from-orange-500/10 via-transparent to-transparent blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-md w-full"
      >
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-6"
          >
            <XCircle className="w-10 h-10 text-red-500" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-4">
            Pagamento não concluído
          </h1>

          <p className="text-gray-400 mb-8">
            {errorMessage}
          </p>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-8">
            <h3 className="font-semibold text-red-400 mb-2">Possíveis motivos:</h3>
            <ul className="text-sm text-gray-400 text-left space-y-1">
              <li>• Cartão recusado pelo banco</li>
              <li>• Dados do cartão incorretos</li>
              <li>• Limite insuficiente</li>
              <li>• Transação não autorizada</li>
            </ul>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-6"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10 py-6"
            >
              <ArrowLeft className="w-5 h-5 mr-2" />
              Voltar ao Início
            </Button>

            <button 
              onClick={() => window.open('mailto:suporte@fiscalai.com.br', '_blank')}
              className="text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 w-full py-2"
            >
              <HelpCircle className="w-4 h-4" />
              Precisa de ajuda? Entre em contato
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
