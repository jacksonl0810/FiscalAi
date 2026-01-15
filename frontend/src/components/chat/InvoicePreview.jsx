import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, User, Building2, Calculator, Check, Pencil, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoicePreview({ invoice, onConfirm, onEdit, onUpdate, isProcessing }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(invoice);

  // Update local state when invoice prop changes
  useEffect(() => {
    setEditedInvoice(invoice);
  }, [invoice]);

  const handleFieldChange = (field, value) => {
    setEditedInvoice(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSaveEdit = () => {
    // Calculate ISS value
    const valor = parseFloat(editedInvoice.valor) || 0;
    const aliquota = parseFloat(editedInvoice.aliquota_iss) || 5;
    const valorIss = (valor * aliquota) / 100;

    const updatedInvoice = {
      ...editedInvoice,
      valor: valor,
      aliquota_iss: aliquota,
      valor_iss: valorIss
    };

    // Call onUpdate to update the parent's pendingInvoice state
    if (onUpdate) {
      onUpdate(updatedInvoice);
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedInvoice(invoice); // Reset to original
    setIsEditing(false);
  };

  const handleStartEdit = (e) => {
    e.preventDefault();
    e.stopPropagation();
    console.log('[InvoicePreview] Edit button clicked');
    setIsEditing(true);
  };

  // Validate invoice data
  const isValidInvoice = () => {
    if (!invoice) return false;
    const valor = parseFloat(invoice.valor) || 0;
    return invoice.cliente_nome && valor > 0;
  };

  const handleConfirmClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('[InvoicePreview] Confirm button clicked', {
      isValid: isValidInvoice(),
      invoice,
      onConfirm: typeof onConfirm,
      isProcessing
    });
    
    if (!isValidInvoice()) {
      console.warn('Invoice data is invalid:', invoice);
      alert('Por favor, preencha todos os campos obrigatórios (nome do cliente e valor) antes de confirmar.');
      return;
    }
    
    if (isProcessing) {
      console.warn('Already processing, ignoring click');
      return;
    }
    
    if (onConfirm && typeof onConfirm === 'function') {
      onConfirm();
    } else {
      console.error('onConfirm is not a function:', onConfirm);
      alert('Erro: função de confirmação não disponível. Por favor, recarregue a página.');
    }
  };

  // Render editing mode
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card rounded-2xl p-6 gradient-border"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Pencil className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Editar Nota Fiscal</h3>
            <p className="text-sm text-gray-500">Corrija as informações abaixo</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Cliente Nome */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Nome do Cliente</label>
            <input
              type="text"
              value={editedInvoice.cliente_nome || ''}
              onChange={(e) => handleFieldChange('cliente_nome', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="Nome do cliente"
            />
          </div>

          {/* Cliente Documento */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">CPF/CNPJ do Cliente</label>
            <input
              type="text"
              value={editedInvoice.cliente_documento || ''}
              onChange={(e) => handleFieldChange('cliente_documento', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="CPF ou CNPJ"
            />
          </div>

          {/* Descrição do Serviço */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Descrição do Serviço</label>
            <textarea
              value={editedInvoice.descricao_servico || ''}
              onChange={(e) => handleFieldChange('descricao_servico', e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all resize-none"
              placeholder="Descreva o serviço prestado"
            />
          </div>

          {/* Valor e ISS */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={editedInvoice.valor || ''}
                onChange={(e) => handleFieldChange('valor', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-gray-500 uppercase tracking-wider">Alíquota ISS (%)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={editedInvoice.aliquota_iss || 5}
                onChange={(e) => handleFieldChange('aliquota_iss', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
                placeholder="5"
              />
            </div>
          </div>

          {/* Município */}
          <div className="space-y-2">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Município</label>
            <input
              type="text"
              value={editedInvoice.municipio || ''}
              onChange={(e) => handleFieldChange('municipio', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all"
              placeholder="Cidade"
            />
          </div>
        </div>

        {/* Edit Actions */}
        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleCancelEdit}
            variant="outline"
            className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white cursor-pointer"
            type="button"
          >
            <X className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSaveEdit}
            className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white border-0 cursor-pointer"
            type="button"
          >
            <Save className="w-4 h-4 mr-2" />
            Salvar alterações
          </Button>
        </div>
      </motion.div>
    );
  }

  // Render preview mode (default)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card rounded-2xl p-6 gradient-border relative z-10"
      style={{ pointerEvents: 'auto' }}
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
            {invoice.cliente_documento && (
              <p className="text-sm text-gray-400">{invoice.cliente_documento}</p>
            )}
          </div>
        </div>

        {/* Serviço */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5">
          <Building2 className="w-5 h-5 text-gray-400 mt-0.5" />
          <div className="flex-1">
            <p className="text-xs text-gray-500 mb-1">Serviço</p>
            <p className="text-white">{invoice.descricao_servico || 'Serviço prestado'}</p>
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
                  R$ {(invoice.valor_iss || (invoice.valor * invoice.aliquota_iss / 100))?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
      <div className="flex gap-3 mt-6 relative z-20" style={{ pointerEvents: 'auto' }}>
        <Button
          onClick={handleStartEdit}
          variant="outline"
          className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white cursor-pointer relative z-10"
          disabled={isProcessing}
          type="button"
          style={{ pointerEvents: isProcessing ? 'none' : 'auto' }}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Corrigir informações
        </Button>
        <Button
          onClick={handleConfirmClick}
          className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 cursor-pointer relative z-10"
          disabled={isProcessing || !isValidInvoice()}
          type="button"
          style={{ pointerEvents: (isProcessing || !isValidInvoice()) ? 'none' : 'auto' }}
        >
          <Check className="w-4 h-4 mr-2" />
          {isProcessing ? 'Emitindo...' : 'Confirmar emissão'}
        </Button>
      </div>
    </motion.div>
  );
}
