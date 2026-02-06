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

  // Render editing mode
  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10"
        style={{ 
          position: 'relative', 
          zIndex: 9999,
          pointerEvents: 'auto',
          isolation: 'isolate'
        }}
      >
        {/* Premium Glow Effect */}
        <div className="absolute -inset-2 bg-gradient-to-r from-blue-600/30 via-indigo-600/30 via-purple-600/30 to-blue-600/30 rounded-3xl blur-2xl opacity-60 animate-pulse" />
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 rounded-3xl blur-xl opacity-50" />
        
        {/* Main Card */}
        <div className="relative bg-gradient-to-br from-[#0a0e14] via-[#141824] to-[#1a1f2e] rounded-3xl border border-white/10 overflow-hidden backdrop-blur-2xl shadow-2xl">
          {/* Premium Top Accent Bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-500/80 via-indigo-500/80 via-purple-500/80 to-transparent" />
          
          {/* Animated Background Pattern */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
          }} />

          <div className="relative p-10">
            {/* Premium Header */}
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="flex items-center gap-5 mb-10"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/40 via-indigo-500/30 to-purple-500/40 rounded-2xl blur-lg animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/30 via-indigo-500/20 to-purple-500/30 border border-blue-400/40 flex items-center justify-center backdrop-blur-sm shadow-lg">
                  <FileEdit className="w-8 h-8 text-blue-300 drop-shadow-lg" />
                </div>
              </div>
              <div className="flex-1">
                <h3 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-300 via-indigo-300 to-purple-300 mb-2 tracking-tight">
                  Editar Nota Fiscal
                </h3>
                <p className="text-sm text-gray-400 font-medium">Confira as informações abaixo</p>
              </div>
            </motion.div>

            <div className="space-y-6">
              {/* Client Name Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                  <User className="w-4 h-4 text-blue-400" />
                  Nome do Cliente
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-indigo-500/5 to-purple-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <input
                  type="text"
                  value={editedInvoice.cliente_nome}
                  onChange={(e) => handleFieldChange('cliente_nome', e.target.value)}
                    className="relative w-full px-6 py-5 rounded-2xl text-white text-base font-semibold bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-blue-400/80 focus:ring-4 focus:ring-blue-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-blue-500/20 hover:border-blue-500/40 backdrop-blur-sm"
                    placeholder="Digite o nome completo do cliente"
                  autoComplete="off"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                />
              </div>
              </motion.div>

              {/* Client Document Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                  CPF/CNPJ do Cliente
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-purple-500/5 to-blue-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <input
                  type="text"
                  value={editedInvoice.cliente_documento}
                  onChange={(e) => handleFieldChange('cliente_documento', e.target.value)}
                    className="relative w-full px-6 py-5 rounded-2xl text-white text-base font-semibold bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-indigo-400/80 focus:ring-4 focus:ring-indigo-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-indigo-500/20 hover:border-indigo-500/40 backdrop-blur-sm font-mono tracking-wider"
                    placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  autoComplete="off"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                />
              </div>
              </motion.div>

              {/* Service Description Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.25 }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                  <FileText className="w-4 h-4 text-purple-400" />
                  Descrição do Serviço
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-blue-500/20 to-indigo-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-blue-500/5 to-indigo-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <textarea
                  value={editedInvoice.descricao_servico}
                  onChange={(e) => handleFieldChange('descricao_servico', e.target.value)}
                    rows={4}
                    className="relative w-full px-6 py-5 rounded-2xl text-white text-base font-semibold resize-none bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-purple-400/80 focus:ring-4 focus:ring-purple-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-purple-500/20 hover:border-purple-500/40 backdrop-blur-sm leading-relaxed"
                    placeholder="Descreva detalhadamente o serviço prestado"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                />
              </div>
              </motion.div>

              {/* Value and ISS Rate - Premium Grid */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                    <DollarSign className="w-4 h-4 text-emerald-400" />
                    Valor (R$)
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 via-teal-500/5 to-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editedInvoice.valor}
                    onChange={(e) => handleFieldChange('valor', e.target.value)}
                      className="relative w-full px-6 py-5 rounded-2xl text-white text-lg font-bold bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-emerald-400/80 focus:ring-4 focus:ring-emerald-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-emerald-500/20 hover:border-emerald-500/40 backdrop-blur-sm"
                    placeholder="0,00"
                    autoComplete="off"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                    <Percent className="w-4 h-4 text-amber-400" />
                    Alíquota ISS (%)
                  </label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-orange-500/5 to-amber-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={editedInvoice.aliquota_iss}
                    onChange={(e) => handleFieldChange('aliquota_iss', e.target.value)}
                      className="relative w-full px-6 py-5 rounded-2xl text-white text-lg font-bold bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-amber-400/80 focus:ring-4 focus:ring-amber-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-amber-500/20 hover:border-amber-500/40 backdrop-blur-sm"
                      placeholder="5,00"
                    autoComplete="off"
                      style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                  />
                </div>
              </div>
              </motion.div>

              {/* Municipality Field */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 }}
                className="space-y-3"
              >
                <label className="flex items-center gap-2 text-xs font-bold text-gray-300 uppercase tracking-widest">
                  <MapPin className="w-4 h-4 text-rose-400" />
                  Município
                </label>
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-rose-500/20 via-pink-500/20 to-rose-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 via-pink-500/5 to-rose-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <input
                  type="text"
                  value={editedInvoice.municipio}
                  onChange={(e) => handleFieldChange('municipio', e.target.value)}
                    className="relative w-full px-6 py-5 rounded-2xl text-white text-base font-semibold bg-gradient-to-br from-slate-800/90 via-slate-800/95 to-slate-900/90 border-2 border-slate-700/50 focus:border-rose-400/80 focus:ring-4 focus:ring-rose-500/30 transition-all duration-300 outline-none placeholder:text-gray-400/70 shadow-xl shadow-black/40 hover:shadow-2xl hover:shadow-rose-500/20 hover:border-rose-500/40 backdrop-blur-sm"
                    placeholder="Nome da cidade"
                  autoComplete="off"
                    style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}
                />
              </div>
              </motion.div>

              {/* Premium Action Buttons */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="flex gap-5 mt-10 pt-8 border-t border-white/10"
              >
                <motion.button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCancelEdit(e);
                  }}
                  whileHover={{ scale: 1.02, y: -2, x: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex-1 py-5 px-8 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group bg-gradient-to-br from-slate-800/60 via-slate-800/50 to-slate-900/60 text-slate-200 hover:text-white border-2 border-slate-700/60 hover:border-slate-500/80 hover:bg-slate-800/70 backdrop-blur-md shadow-xl shadow-black/30 hover:shadow-2xl cursor-pointer"
                  type="button"
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                  <X className="w-5 h-5 relative z-10 transition-transform duration-300 group-hover:rotate-90" />
                  <span className="relative z-10 tracking-wide">Cancelar</span>
                </motion.button>
                
                <motion.button
                  onClick={handleSaveEdit}
                  whileHover={{ scale: 1.02, y: -2, x: 2 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative flex-1 py-5 px-8 rounded-2xl text-base font-bold transition-all duration-300 flex items-center justify-center gap-3 overflow-hidden group bg-gradient-to-r from-blue-600 via-indigo-600 via-purple-600 to-blue-600 hover:from-blue-500 hover:via-indigo-500 hover:via-purple-500 hover:to-blue-500 text-white border-2 border-blue-400/50 hover:border-blue-300/70 shadow-2xl shadow-blue-500/50 hover:shadow-blue-500/60 hover:shadow-[0_0_50px_rgba(59,130,246,0.5)] cursor-pointer"
                  type="button"
                  style={{
                    backgroundSize: '200% 200%',
                    animation: 'gradientShift 3s ease infinite'
                  }}
                >
                  <style>{`
                    @keyframes gradientShift {
                      0%, 100% { background-position: 0% 50%; }
                      50% { background-position: 100% 50%; }
                    }
                  `}</style>
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-300/40 via-indigo-300/40 via-purple-300/40 to-blue-300/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 -translate-x-full group-hover:translate-x-full" />
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 via-purple-500 to-blue-500 rounded-2xl opacity-0 group-hover:opacity-50 blur-lg transition-opacity duration-300 -z-10" />
                  <Save className="w-5 h-5 relative z-10 drop-shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                  <span className="relative z-10 drop-shadow-md tracking-wide">Salvar alterações</span>
                </motion.button>
              </motion.div>
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
