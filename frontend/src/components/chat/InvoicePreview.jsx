import React from "react";
import { motion } from "framer-motion";
import { FileText, User, Building2, Calculator, Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoicePreview({ invoice, onConfirm, onEdit, isProcessing }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-2xl p-6 gradient-border"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Pré-visualização da Nota</h3>
          <p className="text-sm text-gray-500">Confirme os dados antes de emitir</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Cliente */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
          <User className="w-5 h-5 text-gray-400 mt-0.5" />
          <div>
            <p className="text-xs text-gray-500 mb-1">Cliente</p>
            <p className="text-white font-medium">{invoice.cliente_nome}</p>
            <p className="text-sm text-gray-400">{invoice.cliente_documento}</p>
          </div>
        </div>

        {/* Serviço */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
          <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Serviço</p>
            <p className="text-white">{invoice.descricao_servico}</p>
          </div>
        </div>

        {/* Valores */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
          <Calculator className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Valores</p>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Valor do serviço</span>
              <span className="text-white font-semibold">
                R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            {invoice.aliquota_iss && (
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-400">ISS ({invoice.aliquota_iss}%)</span>
                <span className="text-orange-400">
                  R$ {invoice.valor_iss?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Total */}
        <div className="p-4 rounded-xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20">
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-medium">Valor Total</span>
            <span className="text-2xl font-bold text-gradient">
              R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 mt-6">
        <Button
          onClick={onEdit}
          variant="outline"
          className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
          disabled={isProcessing}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Corrigir informações
        </Button>
        <Button
          onClick={onConfirm}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0"
          disabled={isProcessing}
        >
          <Check className="w-4 h-4 mr-2" />
          {isProcessing ? 'Emitindo...' : 'Confirmar emissão'}
        </Button>
      </div>
    </motion.div>
  );
}