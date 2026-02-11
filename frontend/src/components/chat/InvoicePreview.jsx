import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, User, Building2, Calculator, Check, Pencil, X, Save, DollarSign, Percent, MapPin, FileEdit } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InvoicePreview({ invoice, onConfirm, onEdit, onUpdate, onCancel, isProcessing }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedInvoice, setEditedInvoice] = useState(() => ({
    cliente_nome: '',
    cliente_documento: '',
    descricao_servico: '',
    valor: 0,
    aliquota_iss: 5,
    municipio: '',
    ...invoice
  }));

  useEffect(() => {
    if (invoice) {
      setEditedInvoice({
        cliente_nome: invoice.cliente_nome || '',
        cliente_documento: invoice.cliente_documento || '',
        descricao_servico: invoice.descricao_servico || '',
        valor: invoice.valor || 0,
        aliquota_iss: invoice.aliquota_iss || 5,
        municipio: invoice.municipio || '',
        ...invoice
      });
    }
  }, [invoice]);

  const handleFieldChange = useCallback((field, value) => {
    console.log(`[InvoicePreview] Field change: ${field} = ${value}`);
    setEditedInvoice(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

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

  const handleCancelEdit = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    console.log('[InvoicePreview] Cancel edit clicked');
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

  // Render editing mode - COMPACT VERSION
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 max-w-md"
        style={{ 
          position: 'relative', 
          zIndex: 9999,
          pointerEvents: 'auto',
          isolation: 'isolate'
        }}
      >
        {/* Glow Effect - Subtle */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-600/20 via-indigo-600/20 to-purple-600/20 rounded-2xl blur-lg opacity-50" />
        
        {/* Main Card - Compact */}
        <div className="relative bg-gradient-to-br from-[#0a0e14] via-[#141824] to-[#1a1f2e] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-xl">
          {/* Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/60 to-transparent" />

          <div className="relative p-4">
            {/* Header - Compact */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-purple-500/30 rounded-xl blur-sm" />
                <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/40 flex items-center justify-center">
                  <FileEdit className="w-5 h-5 text-blue-300" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-purple-300 tracking-tight">
                  Editar Nota Fiscal
                </h3>
                <p className="text-xs text-gray-400">Confira as informações</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Client Name */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <User className="w-3 h-3 text-blue-400" />
                  Nome do Cliente
                </label>
                <input
                  type="text"
                  value={editedInvoice.cliente_nome}
                  onChange={(e) => handleFieldChange('cliente_nome', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-800/80 border border-slate-700/50 focus:border-blue-400/80 focus:ring-1 focus:ring-blue-500/30 transition-all outline-none placeholder:text-gray-500"
                  placeholder="Nome completo do cliente"
                  autoComplete="off"
                />
              </div>

              {/* Client Document */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <Building2 className="w-3 h-3 text-indigo-400" />
                  CPF/CNPJ do Cliente
                </label>
                <input
                  type="text"
                  value={editedInvoice.cliente_documento}
                  onChange={(e) => handleFieldChange('cliente_documento', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-800/80 border border-slate-700/50 focus:border-indigo-400/80 focus:ring-1 focus:ring-indigo-500/30 transition-all outline-none placeholder:text-gray-500 font-mono"
                  placeholder="000.000.000-00"
                  autoComplete="off"
                />
              </div>

              {/* Service Description */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <FileText className="w-3 h-3 text-purple-400" />
                  Descrição do Serviço
                </label>
                <textarea
                  value={editedInvoice.descricao_servico}
                  onChange={(e) => handleFieldChange('descricao_servico', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm resize-none bg-slate-800/80 border border-slate-700/50 focus:border-purple-400/80 focus:ring-1 focus:ring-purple-500/30 transition-all outline-none placeholder:text-gray-500"
                  placeholder="Descrição do serviço"
                />
              </div>

              {/* Value and ISS Rate - Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <DollarSign className="w-3 h-3 text-emerald-400" />
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedInvoice.valor}
                    onChange={(e) => handleFieldChange('valor', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm font-bold bg-slate-800/80 border border-slate-700/50 focus:border-emerald-400/80 focus:ring-1 focus:ring-emerald-500/30 transition-all outline-none placeholder:text-gray-500"
                    placeholder="0,00"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <Percent className="w-3 h-3 text-amber-400" />
                    ISS (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editedInvoice.aliquota_iss}
                    onChange={(e) => handleFieldChange('aliquota_iss', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-white text-sm font-bold bg-slate-800/80 border border-slate-700/50 focus:border-amber-400/80 focus:ring-1 focus:ring-amber-500/30 transition-all outline-none placeholder:text-gray-500"
                    placeholder="5,00"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Municipality */}
              <div className="space-y-1.5">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <MapPin className="w-3 h-3 text-rose-400" />
                  Município
                </label>
                <input
                  type="text"
                  value={editedInvoice.municipio}
                  onChange={(e) => handleFieldChange('municipio', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-white text-sm bg-slate-800/80 border border-slate-700/50 focus:border-rose-400/80 focus:ring-1 focus:ring-rose-500/30 transition-all outline-none placeholder:text-gray-500"
                  placeholder="Nome da cidade"
                  autoComplete="off"
                />
              </div>

              {/* Action Buttons - Compact */}
              <div className="flex gap-2 mt-4 pt-3 border-t border-white/10">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelEdit(e);
                  }}
                  className="flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-slate-800/60 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-500/80 hover:bg-slate-800/80 transition-all flex items-center justify-center gap-2"
                  type="button"
                  style={{ pointerEvents: 'auto' }}
                >
                  <X className="w-4 h-4" />
                  <span>Cancelar</span>
                </button>
                
                <button
                  onClick={handleSaveEdit}
                  className="flex-1 py-2 px-4 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-500/30 transition-all flex items-center justify-center gap-2"
                  type="button"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Render preview mode (default) - COMPACT VERSION
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative z-10 max-w-md"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Card Glow Effect - Subtle */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500/15 via-purple-500/15 to-orange-500/15 rounded-2xl blur-lg opacity-40" />
      
      {/* Main Card - Compact */}
      <div className="relative bg-gradient-to-br from-[#0f1419] via-[#1a1a2e] to-[#16213e] rounded-2xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-xl">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />

        <div className="relative p-4">
          {/* Header - Compact */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-amber-500/20 rounded-xl blur-sm" />
              <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-base font-bold text-white tracking-tight">Pré-visualização da Nota</h3>
              <p className="text-xs text-gray-400">Confirme os dados antes de emitir</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Cliente - Compact */}
            <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Cliente</p>
                  <p className="text-sm font-semibold text-white truncate">{invoice.cliente_nome}</p>
                  {invoice.cliente_documento && (
                    <p className="text-xs text-gray-400 font-mono">{invoice.cliente_documento}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Serviço - Compact */}
            <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Serviço</p>
                  <p className="text-sm text-white truncate">{invoice.descricao_servico || 'Serviço prestado'}</p>
                </div>
              </div>
            </div>

            {/* Valores - Compact */}
            <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Valores</p>
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-400">Valor do serviço</span>
                    <span className="text-sm font-bold text-white">
                      R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  {invoice.aliquota_iss && (
                    <div className="flex justify-between items-center mt-0.5">
                      <span className="text-xs text-gray-400">ISS ({invoice.aliquota_iss}%)</span>
                      <span className="text-xs font-semibold text-orange-400">
                        R$ {(invoice.valor_iss || (invoice.valor * invoice.aliquota_iss / 100))?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Total - Compact Highlight */}
            <div className="relative p-3 rounded-xl bg-gradient-to-r from-orange-500/15 via-purple-500/10 to-orange-500/15 border border-orange-500/30">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Valor Total</p>
                  <p className="text-[10px] text-gray-500">Incluindo todos os impostos</p>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent">
                  R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Actions - Compact */}
          <div className="flex gap-2 mt-4 relative z-20" style={{ pointerEvents: 'auto' }}>
            <motion.button
              onClick={handleStartEdit}
              disabled={isProcessing}
              whileHover={isProcessing ? {} : { scale: 1.02 }}
              whileTap={isProcessing ? {} : { scale: 0.98 }}
              className={`relative flex-1 py-2.5 px-4 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 ${
                isProcessing 
                  ? 'bg-slate-800/30 text-slate-500 cursor-not-allowed border border-slate-700/30' 
                  : 'bg-slate-800/50 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-600/80 hover:bg-slate-800/70'
              }`}
              type="button"
              style={{ pointerEvents: isProcessing ? 'none' : 'auto' }}
            >
              <Pencil className="w-4 h-4" />
              <span>Corrigir informações</span>
            </motion.button>
            
            <motion.button
              onClick={handleConfirmClick}
              disabled={isProcessing || !isValidInvoice()}
              whileHover={(isProcessing || !isValidInvoice()) ? {} : { scale: 1.02 }}
              whileTap={(isProcessing || !isValidInvoice()) ? {} : { scale: 0.98 }}
              className={`relative flex-1 py-2.5 px-4 rounded-xl text-sm font-bold transition-all duration-300 flex items-center justify-center gap-2 ${
                isProcessing || !isValidInvoice()
                  ? 'bg-slate-700/40 text-slate-400 cursor-not-allowed border border-slate-700/30' 
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-lg shadow-orange-500/30'
              }`}
              type="button"
              style={{ pointerEvents: (isProcessing || !isValidInvoice()) ? 'none' : 'auto' }}
            >
              <Check className="w-4 h-4" />
              <span>{isProcessing ? 'Emitindo...' : 'Confirmar emissão'}</span>
            </motion.button>
          </div>
          
          {onCancel && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onCancel();
              }}
              disabled={isProcessing}
              className={`w-full mt-2 py-2 text-xs font-medium flex items-center justify-center gap-1.5 ${
                isProcessing ? 'text-slate-600 cursor-not-allowed' : 'text-gray-400 hover:text-white'
              }`}
              type="button"
              style={{ pointerEvents: isProcessing ? 'none' : 'auto' }}
            >
              <X className="w-3 h-3" />
              <span>Cancelar</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
