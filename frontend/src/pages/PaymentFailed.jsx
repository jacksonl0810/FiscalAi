import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ArrowLeft, RefreshCw, HelpCircle, AlertCircle, CreditCard, Shield, Ban, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PaymentFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const errorMessage = searchParams.get('error') || 'Houve um problema com seu pagamento.';

  const reasons = [
    { icon: CreditCard, text: "Cartão recusado pelo banco" },
    { icon: AlertTriangle, text: "Dados do cartão incorretos" },
    { icon: Shield, text: "Limite insuficiente" },
    { icon: Ban, text: "Transação não autorizada" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0f] via-[#0f0f1a] to-[#0a0a0f] flex items-center justify-center p-4">
      {/* Premium Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="absolute top-0 right-0 w-[900px] h-[900px] bg-gradient-to-bl from-red-500/20 via-orange-500/10 to-transparent blur-3xl rounded-full"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1
          }}
          className="absolute bottom-0 left-0 w-[700px] h-[700px] bg-gradient-to-tr from-orange-500/15 via-red-500/5 to-transparent blur-3xl rounded-full"
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* Premium Glass Card */}
        <div className="relative">
          {/* Glow Effect */}
          <div className="absolute -inset-0.5 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 rounded-3xl blur-xl opacity-50" />
          
          <div className="relative bg-gradient-to-br from-white/[0.08] to-white/[0.03] backdrop-blur-xl border border-white/10 rounded-3xl p-10 text-center shadow-2xl">
            {/* Decorative Top Accent */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent rounded-full" />
            
            {/* Icon Container with Premium Animation */}
          <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ 
                type: "spring", 
                delay: 0.2,
                stiffness: 200,
                damping: 15
              }}
              className="relative mb-8"
            >
              <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500/30 via-red-600/20 to-red-500/10 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-red-500/40 to-transparent animate-pulse" />
                <XCircle className="w-12 h-12 text-red-400 relative z-10 drop-shadow-lg" strokeWidth={2.5} />
              </div>
              {/* Ripple Effect */}
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 rounded-full border-2 border-red-500/30"
              />
          </motion.div>

            {/* Title with Premium Typography */}
            <motion.h1
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-3xl font-bold text-white mb-3 tracking-tight"
            >
            Pagamento não concluído
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-gray-300 mb-8 text-base leading-relaxed"
            >
            {errorMessage}
            </motion.p>

            {/* Reasons Card with Premium Design */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative bg-gradient-to-br from-red-500/10 via-red-600/5 to-red-500/10 border border-red-500/20 rounded-2xl p-6 mb-8 backdrop-blur-sm"
            >
              {/* Inner Glow */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-red-500/5 to-transparent" />
              
              <div className="relative">
                <div className="flex items-center gap-2.5 mb-4">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <h3 className="font-semibold text-red-300 text-lg">Possíveis motivos:</h3>
                </div>
                <ul className="text-sm text-gray-300 text-left space-y-2.5">
                  {reasons.map((reason, index) => (
                    <motion.li
                      key={index}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 flex-shrink-0" />
                      <span className="leading-relaxed">{reason.text}</span>
                    </motion.li>
                  ))}
            </ul>
          </div>
            </motion.div>

            {/* Action Buttons with Premium Design */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-4"
            >
              {/* Primary Button - Try Again */}
            <Button
              onClick={() => navigate('/pricing')}
                className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500 hover:from-orange-600 hover:via-orange-700 hover:to-orange-600 text-white font-semibold py-7 rounded-xl shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 transition-all duration-300 text-base relative overflow-hidden group"
            >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              Tentar Novamente
                </span>
                {/* Shine effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  initial={{ x: '-100%' }}
                  animate={{ x: '200%' }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3,
                    ease: "linear"
                  }}
                />
            </Button>
            
              {/* Secondary Button - Back to Home - FIXED VISIBILITY */}
            <Button
              onClick={() => navigate('/')}
                className="w-full border-2 border-white/30 bg-white/[0.08] hover:bg-white/[0.15] hover:border-white/40 text-white font-semibold py-7 rounded-xl backdrop-blur-md transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-black/20 hover:shadow-white/5"
            >
                <ArrowLeft className="w-5 h-5 mr-2.5" />
              Voltar ao Início
            </Button>

              {/* Help Link with Better Visibility */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.7 }}
              onClick={() => window.open('mailto:suporte@fiscalai.com.br', '_blank')}
                className="w-full text-sm text-gray-300 hover:text-white flex items-center justify-center gap-2 py-3.5 rounded-lg hover:bg-white/5 transition-all duration-200 font-medium group"
            >
                <HelpCircle className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Precisa de ajuda? Entre em contato</span>
              </motion.button>
            </motion.div>

            {/* Security Badge - Premium Touch */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 pt-6 border-t border-white/5 flex items-center justify-center gap-2 text-xs text-gray-400"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Pagamentos seguros e criptografados</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
