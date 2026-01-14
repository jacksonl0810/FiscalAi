import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { invoicesService, notificationsService } from "@/api/services";
import { motion } from "framer-motion";
import { 
  FileText, 
  User, 
  Building2, 
  Calculator, 
  Check, 
  Pencil,
  ArrowLeft,
  AlertCircle,
  Receipt
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function InvoiceConfirmation() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [invoice, setInvoice] = useState({
    cliente_nome: "João Silva",
    cliente_documento: "123.456.789-00",
    descricao_servico: "Consultoria em marketing digital e gestão de redes sociais",
    valor: 2500,
    aliquota_iss: 5,
    valor_iss: 125,
    iss_retido: false
  });

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => invoicesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const createdInvoice = await createInvoiceMutation.mutateAsync({
        ...invoice,
        status: "enviada",
        numero: `NFS${Date.now().toString().slice(-8)}`,
        data_emissao: new Date().toISOString().split('T')[0]
      });
      
      // Create notification
      await notificationsService.create({
        titulo: "Nota fiscal emitida",
        mensagem: `Nota fiscal de R$ ${invoice.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} emitida para ${invoice.cliente_nome}`,
        tipo: "sucesso",
        invoice_id: createdInvoice.id
      });

      navigate(createPageUrl("Documents"));
    } catch (error) {
      console.error(error);
    }
    setIsProcessing(false);
  };

  const handleInputChange = (field, value) => {
    setInvoice(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'valor' || field === 'aliquota_iss') {
        updated.valor_iss = (parseFloat(updated.valor) || 0) * ((parseFloat(updated.aliquota_iss) || 0) / 100);
      }
      return updated;
    });
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(createPageUrl("Assistant"))}
          className="text-gray-400 hover:text-white hover:bg-white/5"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-white">Confirmar Emissão</h1>
          <p className="text-gray-400">Revise os dados antes de emitir a nota fiscal</p>
        </div>
      </motion.div>

      {/* Invoice Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-3xl overflow-hidden"
      >
        {/* Card Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Nota Fiscal de Serviço</h2>
              <p className="text-sm text-gray-500">NFS-e Eletrônica</p>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={() => setIsEditing(!isEditing)}
            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
          >
            <Pencil className="w-4 h-4 mr-2" />
            {isEditing ? 'Visualizar' : 'Editar'}
          </Button>
        </div>

        {/* Card Body */}
        <div className="p-8 space-y-6">
          {isEditing ? (
            /* Edit Mode */
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400">Nome do Cliente</Label>
                  <Input
                    value={invoice.cliente_nome}
                    onChange={(e) => handleInputChange('cliente_nome', e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">CPF/CNPJ</Label>
                  <Input
                    value={invoice.cliente_documento}
                    onChange={(e) => handleInputChange('cliente_documento', e.target.value)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-gray-400">Descrição do Serviço</Label>
                <Textarea
                  value={invoice.descricao_servico}
                  onChange={(e) => handleInputChange('descricao_servico', e.target.value)}
                  className="bg-white/5 border-white/10 text-white min-h-24"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-gray-400">Valor do Serviço (R$)</Label>
                  <Input
                    type="number"
                    value={invoice.valor}
                    onChange={(e) => handleInputChange('valor', parseFloat(e.target.value))}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Alíquota ISS (%)</Label>
                  <Input
                    type="number"
                    value={invoice.aliquota_iss}
                    onChange={(e) => handleInputChange('aliquota_iss', parseFloat(e.target.value))}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* View Mode */
            <div className="space-y-6">
              {/* Cliente */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 mb-1">Cliente</p>
                  <p className="text-lg font-medium text-white">{invoice.cliente_nome}</p>
                  <p className="text-sm text-gray-400">{invoice.cliente_documento}</p>
                </div>
              </div>

              {/* Serviço */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-1">Descrição do Serviço</p>
                  <p className="text-white">{invoice.descricao_servico}</p>
                </div>
              </div>

              {/* Valores */}
              <div className="flex items-start gap-4 p-5 rounded-2xl bg-white/5">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                  <Calculator className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-500 mb-3">Valores</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Valor do serviço</span>
                      <span className="text-white font-medium">
                        R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">ISS ({invoice.aliquota_iss}%)</span>
                      <span className="text-orange-400">
                        R$ {invoice.valor_iss?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {invoice.iss_retido && (
                      <div className="flex items-center gap-2 text-sm text-yellow-400">
                        <AlertCircle className="w-4 h-4" />
                        ISS retido na fonte
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Receipt className="w-5 h-5 text-orange-400" />
                <span className="text-gray-300 font-medium">Valor Total da Nota</span>
              </div>
              <span className="text-3xl font-bold text-gradient">
                R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="px-8 py-6 border-t border-white/5 flex gap-4">
          <Button
            onClick={() => navigate(createPageUrl("Assistant"))}
            variant="outline"
            className="flex-1 bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white h-12"
            disabled={isProcessing}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0 h-12"
            disabled={isProcessing}
          >
            <Check className="w-4 h-4 mr-2" />
            {isProcessing ? 'Emitindo...' : 'Confirmar Emissão'}
          </Button>
        </div>
      </motion.div>

      {/* Info */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-center text-sm text-gray-500 mt-6"
      >
        Ao confirmar, a nota fiscal será enviada para processamento na prefeitura
      </motion.p>
    </div>
  );
}
