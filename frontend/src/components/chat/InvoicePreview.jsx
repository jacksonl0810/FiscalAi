import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { FileText, User, Building2, Calculator, Check, Pencil, X, Save } from "lucide-react";
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

  // Render editing mode
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10"
        style={{ 
          position: 'relative', 
          zIndex: 9999,
          pointerEvents: 'auto',
          isolation: 'isolate'
        }}
      >
        {/* Card Glow Effect */}
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-blue-500/20 rounded-3xl blur-xl opacity-50" />
        
        {/* Main Card */}
        <div className="relative bg-gradient-to-br from-[#0f1419] via-[#1a1a2e] to-[#16213e] rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
          {/* Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
          
          {/* Noise Texture */}
          <div className="absolute inset-0 opacity-[0.015]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }} />

          <div className="relative p-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-indigo-500/20 rounded-2xl blur-md" />
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Pencil className="w-7 h-7 text-blue-400" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">Editar Nota Fiscal</h3>
                <p className="text-sm text-gray-400">Corrija as informações abaixo</p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Cliente Nome */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Nome do Cliente</label>
                <input
                  type="text"
                  value={editedInvoice.cliente_nome}
                  onChange={(e) => handleFieldChange('cliente_nome', e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl text-white text-base bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600"
                  placeholder="Nome do cliente"
                  autoComplete="off"
                />
              </div>

              {/* Cliente Documento */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">CPF/CNPJ do Cliente</label>
                <input
                  type="text"
                  value={editedInvoice.cliente_documento}
                  onChange={(e) => handleFieldChange('cliente_documento', e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl text-white text-base bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600 font-mono"
                  placeholder="CPF ou CNPJ (opcional)"
                  autoComplete="off"
                />
              </div>

              {/* Descrição do Serviço */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Descrição do Serviço</label>
                <textarea
                  value={editedInvoice.descricao_servico}
                  onChange={(e) => handleFieldChange('descricao_servico', e.target.value)}
                  rows={3}
                  className="w-full px-5 py-4 rounded-2xl text-white text-base resize-none bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600 leading-relaxed"
                  placeholder="Descreva o serviço prestado"
                />
              </div>

              {/* Valor e ISS */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Valor (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedInvoice.valor}
                    onChange={(e) => handleFieldChange('valor', e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl text-white text-base bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600"
                    placeholder="0,00"
                    autoComplete="off"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Alíquota ISS (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editedInvoice.aliquota_iss}
                    onChange={(e) => handleFieldChange('aliquota_iss', e.target.value)}
                    className="w-full px-5 py-4 rounded-2xl text-white text-base bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600"
                    placeholder="5"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Município */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider block mb-2">Município</label>
                <input
                  type="text"
                  value={editedInvoice.municipio}
                  onChange={(e) => handleFieldChange('municipio', e.target.value)}
                  className="w-full px-5 py-4 rounded-2xl text-white text-base bg-gradient-to-br from-white/8 via-white/5 to-white/8 border border-white/15 focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all duration-300 outline-none placeholder:text-gray-600"
                  placeholder="Cidade"
                  autoComplete="off"
                />
              </div>

              {/* Edit Actions */}
              <div className="flex gap-4 mt-8">
                <motion.button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelEdit(e);
                  }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex-1 py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group bg-gradient-to-br from-slate-800/50 via-slate-800/40 to-slate-900/50 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-600/80 hover:bg-slate-800/60 backdrop-blur-md shadow-lg shadow-black/20 hover:shadow-xl cursor-pointer"
                  type="button"
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                  <X className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
                  <span className="relative z-10 tracking-wide">Cancelar</span>
                </motion.button>
                <motion.button
                  onClick={handleSaveEdit}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex-1 py-4 px-6 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-500 hover:from-blue-400 hover:via-blue-500 hover:to-indigo-400 text-white border-2 border-blue-400/40 hover:border-blue-300/60 shadow-2xl shadow-blue-500/40 hover:shadow-blue-500/50 hover:shadow-[0_0_40px_rgba(59,130,246,0.4)] cursor-pointer"
                  type="button"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-300/30 via-indigo-300/30 to-blue-300/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 -z-10" />
                  <Save className="w-5 h-5 relative z-10 drop-shadow-lg transition-transform duration-300 group-hover:scale-110" />
                  <span className="relative z-10 drop-shadow-md tracking-wide">Salvar alterações</span>
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Render preview mode (default)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="relative z-10"
      style={{ pointerEvents: 'auto' }}
    >
      {/* Card Glow Effect */}
      <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/20 via-purple-500/20 to-orange-500/20 rounded-3xl blur-xl opacity-50" />
      
      {/* Main Card */}
      <div className="relative bg-gradient-to-br from-[#0f1419] via-[#1a1a2e] to-[#16213e] rounded-3xl border border-white/10 overflow-hidden backdrop-blur-xl shadow-2xl">
        {/* Top Accent Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        
        {/* Noise Texture */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
        }} />

        <div className="relative p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/30 to-amber-500/20 rounded-2xl blur-md" />
              <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 to-amber-500/10 border border-orange-500/30 flex items-center justify-center">
                <FileText className="w-7 h-7 text-orange-400" />
              </div>
            </div>
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">Pré-visualização da Nota</h3>
              <p className="text-sm text-gray-400">Confirme os dados antes de emitir</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Cliente */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="relative p-5 rounded-2xl bg-gradient-to-br from-white/5 via-white/3 to-transparent border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300 group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-orange-500/50 to-transparent rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
                  <p className="text-lg font-semibold text-white mb-1">{invoice.cliente_nome}</p>
                  {invoice.cliente_documento && (
                    <p className="text-sm text-gray-400 font-mono">{invoice.cliente_documento}</p>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Serviço */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="relative p-5 rounded-2xl bg-gradient-to-br from-white/5 via-white/3 to-transparent border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300 group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-purple-500/50 to-transparent rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Serviço</p>
                  <p className="text-base text-white leading-relaxed">{invoice.descricao_servico || 'Serviço prestado'}</p>
                </div>
              </div>
            </motion.div>

            {/* Valores */}
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="relative p-5 rounded-2xl bg-gradient-to-br from-white/5 via-white/3 to-transparent border border-white/10 backdrop-blur-sm hover:border-white/20 transition-all duration-300 group"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-emerald-500/50 to-transparent rounded-l-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Calculator className="w-6 h-6 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Valores</p>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2 border-b border-white/5">
                      <span className="text-sm text-gray-400">Valor do serviço</span>
                      <span className="text-lg font-bold text-white">
                        R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {invoice.aliquota_iss && (
                      <div className="flex justify-between items-center py-2">
                        <span className="text-sm text-gray-400">ISS ({invoice.aliquota_iss}%)</span>
                        <span className="text-base font-semibold text-orange-400">
                          R$ {(invoice.valor_iss || (invoice.valor * invoice.aliquota_iss / 100))?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Total - Premium Highlight */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="relative p-6 rounded-2xl bg-gradient-to-r from-orange-500/20 via-purple-500/15 to-orange-500/20 border-2 border-orange-500/30 overflow-hidden"
            >
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 via-purple-500/10 to-orange-500/10 animate-pulse" />
              
              {/* Glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/30 to-purple-500/30 rounded-2xl blur-xl opacity-50" />
              
              <div className="relative flex justify-between items-center">
                <div>
                  <p className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-1">Valor Total</p>
                  <p className="text-xs text-gray-400">Incluindo todos os impostos</p>
                </div>
                <div className="text-right">
                  <span className="text-3xl font-bold bg-gradient-to-r from-orange-400 via-amber-400 to-orange-400 bg-clip-text text-transparent drop-shadow-lg">
                    R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-8 relative z-20" style={{ pointerEvents: 'auto' }}>
            <motion.button
              onClick={handleStartEdit}
              disabled={isProcessing}
              whileHover={isProcessing ? {} : { scale: 1.02, y: -2 }}
              whileTap={isProcessing ? {} : { scale: 0.98 }}
              className={`relative flex-1 py-4 px-6 rounded-2xl text-base font-semibold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group ${
                isProcessing 
                  ? 'bg-slate-800/30 text-slate-500 cursor-not-allowed border border-slate-700/30' 
                  : 'bg-gradient-to-br from-slate-800/50 via-slate-800/40 to-slate-900/50 text-slate-200 hover:text-white border border-slate-700/60 hover:border-slate-600/80 hover:bg-slate-800/60 backdrop-blur-md shadow-lg shadow-black/20 hover:shadow-xl'
              }`}
              type="button"
              style={{ pointerEvents: isProcessing ? 'none' : 'auto' }}
            >
              {!isProcessing && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
              )}
              <Pencil className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-12" />
              <span className="relative z-10 tracking-wide">Corrigir informações</span>
            </motion.button>
            
            <motion.button
              onClick={handleConfirmClick}
              disabled={isProcessing || !isValidInvoice()}
              whileHover={(isProcessing || !isValidInvoice()) ? {} : { scale: 1.02, y: -2 }}
              whileTap={(isProcessing || !isValidInvoice()) ? {} : { scale: 0.98 }}
              className={`relative flex-1 py-4 px-6 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group ${
                isProcessing || !isValidInvoice()
                  ? 'bg-slate-700/40 text-slate-400 cursor-not-allowed border border-slate-700/30' 
                  : 'bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-400 hover:via-orange-500 hover:to-amber-400 text-white border-2 border-orange-400/40 hover:border-orange-300/60 shadow-2xl shadow-orange-500/40 hover:shadow-orange-500/50 hover:shadow-[0_0_40px_rgba(249,115,22,0.4)]'
              }`}
              type="button"
              style={{ pointerEvents: (isProcessing || !isValidInvoice()) ? 'none' : 'auto' }}
            >
              {!isProcessing && !isValidInvoice() && (
                <>
                  <div className="absolute inset-0 bg-gradient-to-r from-orange-300/30 via-amber-300/30 to-orange-300/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-300 -z-10" />
                </>
              )}
              <Check className={`w-5 h-5 relative z-10 drop-shadow-lg transition-transform duration-300 ${!isProcessing && isValidInvoice() ? 'group-hover:scale-110' : ''}`} />
              <span className="relative z-10 drop-shadow-md tracking-wide">
                {isProcessing ? 'Emitindo...' : 'Confirmar emissão'}
              </span>
            </motion.button>
          </div>
          
          {onCancel && (
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('[InvoicePreview] Cancel button clicked');
                onCancel();
              }}
              disabled={isProcessing}
              whileHover={isProcessing ? {} : { scale: 1.02 }}
              whileTap={isProcessing ? {} : { scale: 0.98 }}
              className={`w-full mt-4 py-3 px-6 rounded-xl text-sm font-medium transition-all duration-300 flex items-center justify-center gap-2 relative z-20 group ${
                isProcessing
                  ? 'text-slate-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
              }`}
              type="button"
              style={{ 
                pointerEvents: isProcessing ? 'none' : 'auto',
              }}
            >
              <X className="w-4 h-4 transition-transform duration-300 group-hover:rotate-90" />
              <span>Cancelar</span>
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
