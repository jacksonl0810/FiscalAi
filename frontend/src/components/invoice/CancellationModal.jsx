import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, FileX, AlertCircle, CheckCircle, Shield, Info } from "lucide-react";
import { invoicesService } from "@/api/services";
import { toast } from "sonner";
import { handleApiError } from "@/utils/errorHandler";

export default function CancellationModal({ invoice, isOpen, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    if (isOpen && invoice) {
      checkCancellationInfo();
    } else {
      setReason("");
      setCancellationInfo(null);
    }
  }, [isOpen, invoice]);

  const checkCancellationInfo = async () => {
    if (!invoice?.id) return;
    
    setIsChecking(true);
    try {
      const info = await invoicesService.getCancellationInfo(invoice.id);
      setCancellationInfo(info);
    } catch (error) {
      await handleApiError(error, { operation: 'get_cancellation_info', invoiceId: invoice.id });
      onClose();
    } finally {
      setIsChecking(false);
    }
  };

  const handleCancel = async () => {
    if (!reason.trim() || reason.trim().length < 15) {
      toast.error('O motivo do cancelamento deve ter pelo menos 15 caracteres');
      return;
    }

    if (!cancellationInfo?.canCancel) {
      toast.error('Esta nota fiscal não pode ser cancelada');
      return;
    }

    setIsCancelling(true);
    try {
      await invoicesService.cancel(invoice.id, reason.trim());
      toast.success('Nota fiscal cancelada com sucesso');
      onSuccess?.();
      onClose();
    } catch (error) {
      await handleApiError(error, { operation: 'cancel_invoice', invoiceId: invoice.id });
    } finally {
      setIsCancelling(false);
    }
  };

  const formatDeadline = (deadline) => {
    if (!deadline) return null;
    try {
      const date = new Date(deadline);
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return deadline;
    }
  };

  const getMaxHours = () => {
    if (cancellationInfo?.rules?.maxHours !== undefined && cancellationInfo?.rules?.maxHours !== null) {
      return cancellationInfo.rules.maxHours;
    }
    return 24; // Default fallback
  };

  if (!isOpen) return null;

  const minChars = 15;
  const remainingChars = Math.max(0, minChars - reason.length);
  const isReasonValid = reason.trim().length >= minChars;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop with blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 30 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 30 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Glow effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 via-orange-500/10 to-red-500/20 rounded-[28px] blur-xl opacity-60" />
          
          {/* Card */}
          <div className="relative bg-gradient-to-b from-[#1a1525] via-[#151020] to-[#0f0a18] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
            {/* Top accent line */}
            <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
            
            {/* Noise texture */}
            <div className="absolute inset-0 opacity-[0.015]" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
            }} />

            <div className="relative p-6 sm:p-8">
          {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/30 rounded-2xl blur-lg" />
                    <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 flex items-center justify-center">
                      <FileX className="w-7 h-7 text-red-400" />
                    </div>
              </div>
                  
                  {/* Title */}
              <div>
                    <h3 className="text-xl font-bold text-white mb-1">
                      Cancelar Nota Fiscal
                    </h3>
                    <p className="text-sm text-slate-400 font-mono">
                      #{invoice?.numero || invoice?.id}
                    </p>
              </div>
            </div>

                {/* Close button */}
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
              onClick={onClose}
                  className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 flex items-center justify-center text-slate-400 hover:text-white transition-all duration-200"
            >
                  <X className="w-5 h-5" />
                </motion.button>
          </div>

          {isChecking ? (
                /* Loading State */
                <div className="py-12 text-center">
                  <div className="relative w-16 h-16 mx-auto mb-6">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-2 border-dashed border-orange-500/30"
                    />
                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 flex items-center justify-center">
                      <Clock className="w-6 h-6 text-orange-400" />
                    </div>
                  </div>
                  <p className="text-slate-400 text-sm">Verificando possibilidade de cancelamento...</p>
                </div>
              ) : cancellationInfo ? (
                <div className="space-y-5">
                  {/* Cancellation Status Card */}
                  {cancellationInfo.canCancel ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-yellow-500/5 to-orange-500/10 border border-amber-500/20 overflow-hidden"
                    >
                      {/* Subtle glow */}
                      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl" />
                      
                      <div className="relative flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-6 h-6 text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-semibold text-amber-300 mb-1">
                            Prazo para cancelamento
                          </p>
                          <p className="text-sm text-slate-300">
                            {cancellationInfo.hoursRemaining !== undefined && cancellationInfo.hoursRemaining !== null
                              ? cancellationInfo.hoursRemaining > 0
                                ? `Restam ${cancellationInfo.hoursRemaining} hora(s)`
                                : 'Prazo expirando em breve'
                              : 'Verificando prazo...'}
                          </p>
                          {cancellationInfo.deadline && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5" />
                              Limite: {formatDeadline(cancellationInfo.deadline)}
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative p-5 rounded-2xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-rose-500/10 border border-red-500/20 overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 rounded-full blur-3xl" />
                      
                      <div className="relative flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-6 h-6 text-red-400" />
                        </div>
                    <div className="flex-1">
                          <p className="text-base font-semibold text-red-300 mb-1">
                        Cancelamento não permitido
                      </p>
                          <p className="text-sm text-slate-400">
                        {cancellationInfo.isExpired
                              ? 'O prazo para cancelamento desta nota fiscal expirou.'
                              : cancellationInfo.reason || 'Esta nota fiscal não pode ser cancelada.'}
                      </p>
                    </div>
                  </div>
                    </motion.div>
              )}

              {/* Warnings */}
              {cancellationInfo.warnings && cancellationInfo.warnings.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 }}
                      className="space-y-2"
                    >
                  {cancellationInfo.warnings.map((warning, idx) => (
                        <div 
                          key={idx} 
                          className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10"
                        >
                          <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-yellow-300/80">{warning.message}</p>
                        </div>
                  ))}
                    </motion.div>
              )}

              {/* Rules Info */}
              {cancellationInfo.rules && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="flex items-center gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/5"
                    >
                      <Shield className="w-4 h-4 text-slate-500 flex-shrink-0" />
                      <p className="text-xs text-slate-500">
                    {cancellationInfo.rules.municipalityNotes || 
                         `Prazo máximo: ${getMaxHours()} horas após emissão`}
                  </p>
                    </motion.div>
              )}

              {/* Reason Input */}
              {cancellationInfo.canCancel && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-3"
                    >
                      <label className="flex items-center gap-2 text-sm font-medium text-white">
                        Motivo do Cancelamento
                        <span className="text-red-400">*</span>
                  </label>
                      
                      <div className="relative">
                        <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                          placeholder="Descreva detalhadamente o motivo do cancelamento..."
                          className="w-full min-h-[120px] px-4 py-3.5 bg-white/[0.03] hover:bg-white/[0.05] border border-white/10 focus:border-orange-500/50 rounded-xl text-white placeholder:text-slate-600 resize-none transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                    maxLength={500}
                  />
                        
                        {/* Character indicator floating in textarea */}
                        <div className="absolute bottom-3 right-3 px-2 py-1 rounded-md bg-black/30 text-[10px] text-slate-500 font-mono">
                          {reason.length}/500
                        </div>
                      </div>
                      
                      {/* Validation feedback */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isReasonValid ? (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center gap-1.5 text-emerald-400"
                            >
                              <CheckCircle className="w-4 h-4" />
                              <span className="text-xs font-medium">Motivo válido</span>
                            </motion.div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-amber-400">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-xs">
                                Mínimo {minChars} caracteres ({remainingChars} restantes)
                        </span>
                            </div>
                      )}
                  </div>
                </div>
                    </motion.div>
              )}

                  {/* Divider */}
                  <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

              {/* Actions */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="flex gap-3 pt-2"
                  >
                    {/* Close Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  disabled={isCancelling}
                      className="flex-1 py-3.5 px-5 rounded-xl text-sm font-semibold text-slate-300 bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 hover:border-white/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </motion.button>

                    {/* Confirm Button */}
                {cancellationInfo.canCancel && (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    onClick={handleCancel}
                        disabled={isCancelling || !isReasonValid}
                        className="flex-1 py-3.5 px-5 rounded-xl text-sm font-semibold text-red-300 bg-gradient-to-r from-red-500/20 to-rose-500/20 hover:from-red-500/30 hover:to-rose-500/30 border border-red-500/30 hover:border-red-500/50 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:from-red-500/20 disabled:hover:to-rose-500/20 flex items-center justify-center gap-2 shadow-lg shadow-red-500/10"
                  >
                    {isCancelling ? (
                      <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full"
                            />
                            <span>Cancelando...</span>
                      </>
                    ) : (
                      <>
                            <FileX className="w-4 h-4" />
                            <span>Confirmar Cancelamento</span>
                      </>
                        )}
                      </motion.button>
                    )}
                  </motion.div>
            </div>
          ) : (
                /* Error State */
                <div className="py-12 text-center">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <AlertTriangle className="w-8 h-8 text-red-400" />
                  </div>
                  <p className="text-slate-400 text-sm">
                    Não foi possível verificar as informações de cancelamento
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="mt-4 px-6 py-2.5 rounded-xl text-sm font-medium text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
                  >
                    Fechar
                  </motion.button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
