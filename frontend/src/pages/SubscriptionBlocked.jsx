import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Lock, CreditCard, ArrowRight, LogOut, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function SubscriptionBlocked() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-gradient-to-bl from-yellow-500/10 via-transparent to-transparent blur-3xl" />
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
            className="w-20 h-20 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-6"
          >
            <Lock className="w-10 h-10 text-yellow-500" />
          </motion.div>

          <h1 className="text-2xl font-bold text-white mb-4">
            Acesso Bloqueado
          </h1>

          <p className="text-gray-400 mb-6">
            Olá {user?.name || 'Usuário'}, sua assinatura expirou ou está com pagamento pendente.
          </p>

          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8">
            <div className="flex items-center justify-center gap-2 text-yellow-400 mb-2">
              <Clock className="w-5 h-5" />
              <span className="font-semibold">Período de teste encerrado</span>
            </div>
            <p className="text-sm text-gray-400">
              Para continuar usando a MAY e emitir notas fiscais, 
              escolha um plano de assinatura.
            </p>
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3 text-left p-3 bg-white/5 rounded-lg">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="text-white font-medium">Renove sua assinatura</p>
                <p className="text-sm text-gray-400">A partir de R$ 97/mês</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => navigate('/pricing')}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-6"
            >
              Ver Planos
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <Button
              onClick={handleLogout}
              variant="ghost"
              className="w-full text-gray-400 hover:text-white hover:bg-white/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair da Conta
            </Button>
          </div>

          <p className="text-xs text-gray-500 mt-6">
            Seus dados estão salvos e estarão disponíveis quando você renovar sua assinatura.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
