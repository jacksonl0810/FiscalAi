import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Bell, Sparkles, CreditCard, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";

export default function SubscriptionPending() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#07070a] flex items-center justify-center p-4">
      {/* Luxury Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Main gradient orbs */}
        <div className="absolute top-1/4 right-1/4 w-[600px] h-[600px] bg-gradient-radial from-orange-500/15 via-orange-500/5 to-transparent blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-gradient-radial from-amber-500/10 via-transparent to-transparent blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-radial from-orange-600/5 via-transparent to-transparent blur-3xl" />
        
        {/* Subtle grid */}
        <div 
          className="absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 max-w-lg w-full"
      >
        {/* Card glow effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-orange-500/20 rounded-[32px] blur-2xl opacity-60" />
        
        {/* Main Card */}
        <div className="relative bg-gradient-to-b from-[#12100d] via-[#0d0b09] to-[#0a0908] rounded-3xl border border-orange-500/20 overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-orange-400/50 to-transparent" />
          
          {/* Noise texture */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }} />
          
          <div className="relative p-10 text-center">
            {/* Animated Icon Container */}
            <div className="relative w-28 h-28 mx-auto mb-8">
              {/* Outer rotating ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/20"
              />
              
              {/* Middle pulsing ring */}
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="absolute inset-2 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10"
              />
              
              {/* Inner icon container */}
              <div className="absolute inset-4 rounded-full bg-gradient-to-br from-orange-500/30 to-amber-600/20 flex items-center justify-center border border-orange-500/30 shadow-2xl shadow-orange-500/20">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Clock className="w-10 h-10 text-orange-400" />
                </motion.div>
              </div>
              
              {/* Floating particles */}
              <motion.div
                animate={{ y: [-5, 5, -5], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-1 right-2 w-2 h-2 bg-orange-400 rounded-full blur-[1px]"
              />
              <motion.div
                animate={{ y: [5, -5, 5], opacity: [0.3, 0.8, 0.3] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-0 left-1 w-1.5 h-1.5 bg-amber-400 rounded-full blur-[1px]"
              />
            </div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 mb-6"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-2 h-2 bg-orange-400 rounded-full"
              />
              <span className="text-xs font-semibold text-orange-300 tracking-wide uppercase">Aguardando confirmação</span>
            </motion.div>

            {/* Title */}
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="text-3xl font-bold text-white mb-3"
            >
              Processando Pagamento
            </motion.h1>

            {/* Subtitle */}
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-slate-400 mb-8 leading-relaxed max-w-sm mx-auto"
            >
              Seu pagamento está sendo processado com segurança. 
              Assim que for confirmado, você terá acesso completo à MAY.
            </motion.p>

            {/* Progress Steps */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-center gap-3 mb-8"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                </div>
                <span className="text-xs text-emerald-400">Dados enviados</span>
              </div>
              <div className="w-8 h-px bg-gradient-to-r from-emerald-500/50 to-orange-500/50" />
              <div className="flex items-center gap-2">
                <motion.div 
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/40 flex items-center justify-center"
                >
                  <Shield className="w-4 h-4 text-orange-400" />
                </motion.div>
                <span className="text-xs text-orange-400">Verificando</span>
              </div>
              <div className="w-8 h-px bg-gradient-to-r from-orange-500/50 to-slate-600/30" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-slate-700/30 border border-slate-600/30 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-slate-500" />
                </div>
                <span className="text-xs text-slate-500">Ativação</span>
              </div>
            </motion.div>

            {/* Info box */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="relative bg-gradient-to-r from-orange-500/5 via-amber-500/5 to-orange-500/5 rounded-2xl p-5 mb-8 border border-orange-500/10"
            >
              <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-orange-500/20 to-transparent" />
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                  <Bell className="w-5 h-5 text-orange-400" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-slate-300 font-medium mb-1">Fique tranquilo!</p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    O processo normalmente leva alguns minutos. Você receberá uma notificação 
                    assim que o pagamento for confirmado.
                  </p>
                </div>
              </div>
            </motion.div>

            {/* Buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="space-y-3"
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/pricing')}
                className="w-full py-4 px-6 rounded-2xl text-base font-semibold bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-xl shadow-orange-500/25 transition-all duration-300 flex items-center justify-center gap-2"
              >
                Ver Planos
                <ArrowRight className="w-5 h-5" />
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/notifications')}
                className="w-full py-4 px-6 rounded-2xl text-base font-medium bg-white/[0.03] hover:bg-white/[0.06] text-slate-300 hover:text-white ring-1 ring-white/10 hover:ring-white/20 transition-all duration-300 flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4" />
                Ver Notificações
              </motion.button>
            </motion.div>

            {/* Security badge */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="mt-8 flex items-center justify-center gap-2 text-xs text-slate-600"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Pagamento processado com segurança via Pagar.me</span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
