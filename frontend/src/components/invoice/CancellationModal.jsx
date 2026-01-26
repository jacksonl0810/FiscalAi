import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, AlertTriangle, Clock, FileX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { invoicesService } from "@/api/services";
import { toast } from "sonner";
import { handleApiError } from "@/utils/errorHandler";

export default function CancellationModal({ invoice, isOpen, onClose, onSuccess }) {
  const [reason, setReason] = useState("");
  const [cancellationInfo, setCancellationInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-[#1a1a2e] border border-white/10 rounded-2xl p-6 max-w-md w-full shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                <FileX className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Cancelar Nota Fiscal</h3>
                <p className="text-sm text-gray-400">#{invoice?.numero || invoice?.id}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-gray-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {isChecking ? (
            <div className="py-8 text-center">
              <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Verificando possibilidade de cancelamento...</p>
            </div>
          ) : cancellationInfo ? (
            <div className="space-y-4">
              {/* Cancellation Info */}
              {cancellationInfo.canCancel ? (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  <div className="flex items-start gap-3">
                    <Clock className="w-5 h-5 text-yellow-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-yellow-400 font-medium mb-1">
                        Prazo para cancelamento
                      </p>
                      <p className="text-xs text-gray-400">
                        {cancellationInfo.hoursRemaining > 0
                          ? `Restam ${cancellationInfo.hoursRemaining} hora(s)`
                          : 'Prazo expirado'}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Limite: {cancellationInfo.deadline}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm text-red-400 font-medium mb-1">
                        Cancelamento não permitido
                      </p>
                      <p className="text-xs text-gray-400">
                        {cancellationInfo.isExpired
                          ? 'O prazo para cancelamento expirou'
                          : 'Esta nota fiscal não pode ser cancelada'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Warnings */}
              {cancellationInfo.warnings && cancellationInfo.warnings.length > 0 && (
                <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                  {cancellationInfo.warnings.map((warning, idx) => (
                    <p key={idx} className="text-sm text-yellow-400">
                      ⚠️ {warning.message}
                    </p>
                  ))}
                </div>
              )}

              {/* Rules Info */}
              {cancellationInfo.rules && (
                <div className="p-3 rounded-xl bg-white/5">
                  <p className="text-xs text-gray-500">
                    {cancellationInfo.rules.municipalityNotes || 
                     `Limite: ${cancellationInfo.rules.maxHours} horas após emissão`}
                  </p>
                </div>
              )}

              {/* Reason Input */}
              {cancellationInfo.canCancel && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Motivo do Cancelamento <span className="text-red-400">*</span>
                  </label>
                  <Textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva o motivo do cancelamento (mínimo 15 caracteres)..."
                    className="min-h-[100px] bg-white/5 border-white/10 text-white placeholder:text-gray-500 resize-none"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between text-xs">
                    <p className="text-gray-500">
                      {reason.length < 15 ? (
                        <span className="text-yellow-400">
                          Mínimo 15 caracteres ({15 - reason.length} restantes)
                        </span>
                      ) : (
                        <span className="text-green-400">✓ Motivo válido</span>
                      )}
                    </p>
                    <p className="text-gray-500">{reason.length}/500</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="flex-1 border-white/10 text-white hover:bg-white/10"
                  disabled={isCancelling}
                >
                  Fechar
                </Button>
                {cancellationInfo.canCancel && (
                  <Button
                    onClick={handleCancel}
                    disabled={isCancelling || reason.trim().length < 15}
                    className="flex-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 border-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCancelling ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin mr-2" />
                        Cancelando...
                      </>
                    ) : (
                      <>
                        <FileX className="w-4 h-4 mr-2" />
                        Confirmar Cancelamento
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-gray-400">Não foi possível verificar as informações de cancelamento</p>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
