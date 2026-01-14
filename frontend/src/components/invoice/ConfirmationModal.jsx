import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  AlertCircle, 
  User, 
  Building2, 
  Calculator, 
  MapPin,
  FileText,
  Check
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfirmationModal({ invoice, onConfirm, onCancel, isProcessing }) {
  if (!invoice) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-2xl glass-card rounded-3xl overflow-hidden"
        >
          {/* Header */}
          <div className="px-8 py-6 border-b border-white/5 bg-gradient-to-r from-orange-500/10 to-purple-500/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-orange-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Confirmar Emissão de NFS-e</h2>
                  <p className="text-sm text-gray-400 mt-1">Revise os dados antes de enviar para a prefeitura</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onCancel}
                className="text-gray-400 hover:text-white hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto">
            {/* Warning */}
            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-400 font-medium">Atenção</p>
                  <p className="text-sm text-gray-400 mt-1">
                    Após a confirmação, a nota será enviada para processamento na prefeitura. 
                    Verifique todos os dados com atenção.
                  </p>
                </div>
              </div>
            </div>

            {/* Tomador (Cliente) */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Tomador do Serviço</h3>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{invoice.cliente_nome}</p>
                  <p className="text-sm text-gray-400 mt-1">
                    {invoice.cliente_documento?.length === 14 ? 'CPF' : 'CNPJ'}: {invoice.cliente_documento}
                  </p>
                </div>
              </div>
            </div>

            {/* Serviço */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Descrição do Serviço</h3>
              <div className="flex items-start gap-4 p-5 rounded-xl bg-white/5">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-purple-400" />
                </div>
                <p className="text-white flex-1">{invoice.descricao_servico}</p>
              </div>
            </div>

            {/* Valores */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Valores e Impostos</h3>
              <div className="p-5 rounded-xl bg-white/5 space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-400">Valor do Serviço</span>
                  <span className="text-white font-semibold">
                    R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                {invoice.aliquota_iss && (
                  <>
                    <div className="h-px bg-white/5" />
                    <div className="flex justify-between">
                      <span className="text-gray-400">
                        ISS ({invoice.aliquota_iss}%)
                        {invoice.iss_retido && (
                          <span className="ml-2 text-xs text-yellow-400">(Retido na fonte)</span>
                        )}
                      </span>
                      <span className="text-orange-400">
                        R$ {invoice.valor_iss?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </>
                )}
                <div className="h-px bg-white/5" />
                <div className="flex justify-between items-center pt-2">
                  <span className="text-white font-medium text-lg">Valor Total da Nota</span>
                  <span className="text-2xl font-bold text-gradient">
                    R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Município */}
            {invoice.municipio && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Local de Prestação</h3>
                <div className="flex items-center gap-4 p-5 rounded-xl bg-white/5">
                  <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                    <MapPin className="w-5 h-5 text-green-400" />
                  </div>
                  <p className="text-white">{invoice.municipio}</p>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-8 py-6 border-t border-white/5 flex gap-4">
            <Button
              onClick={onCancel}
              variant="outline"
              className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white h-12"
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 h-12"
              disabled={isProcessing}
            >
              <Check className="w-5 h-5 mr-2" />
              {isProcessing ? 'Enviando...' : 'Confirmar e Enviar'}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}