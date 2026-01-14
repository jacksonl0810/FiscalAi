import React from "react";
import { useQuery } from "@tanstack/react-query";
import { taxesService, companiesService } from "@/api/services";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Receipt,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function Taxes() {
  const { data: dasPayments = [], isLoading } = useQuery({
    queryKey: ['das'],
    queryFn: () => taxesService.list({ sort: '-data_vencimento' }),
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await companiesService.list();
      return companies[0];
    },
  });

  const getStatusConfig = (status, vencimento) => {
    const isOverdue = new Date(vencimento) < new Date() && status === 'pendente';
    
    if (isOverdue) {
      return {
        label: "Atrasado",
        icon: AlertCircle,
        color: "text-red-400",
        bg: "bg-red-500/20",
        border: "border-red-500/30"
      };
    }
    
    const configs = {
      pendente: { label: "Pendente", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/20", border: "border-yellow-500/30" },
      pago: { label: "Pago", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20", border: "border-green-500/30" },
    };
    return configs[status] || configs.pendente;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Código copiado!');
  };

  const handleDownloadPdf = async (das) => {
    try {
      const blob = await taxesService.downloadPdf(das.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `das-${das.referencia.replace('/', '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erro ao baixar PDF');
    }
  };

  // Calculate stats
  const totalPending = dasPayments
    .filter(d => d.status === 'pendente')
    .reduce((sum, d) => sum + (d.valor_total || 0), 0);

  const totalPaid = dasPayments
    .filter(d => d.status === 'pago')
    .reduce((sum, d) => sum + (d.valor_total || 0), 0);

  const nextPayment = dasPayments.find(d => d.status === 'pendente');

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white">Impostos e Tributos</h1>
          <p className="text-gray-400 mt-1">
            {company?.regime_tributario === 'MEI' 
              ? 'Gerenciamento das guias DAS (Documento de Arrecadação do Simples Nacional)'
              : 'Gerenciamento de impostos e tributos'}
          </p>
        </motion.div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card rounded-2xl p-6 gradient-border"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Pendentes</h3>
          <p className="text-3xl font-bold text-white">
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {dasPayments.filter(d => d.status === 'pendente').length} guia(s)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Pagos este ano</h3>
          <p className="text-3xl font-bold text-white">
            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {dasPayments.filter(d => d.status === 'pago').length} guia(s)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-6"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-orange-400" />
            </div>
          </div>
          <h3 className="text-sm font-medium text-gray-400 mb-1">Próximo vencimento</h3>
          {nextPayment ? (
            <>
              <p className="text-2xl font-bold text-white">
                {format(new Date(nextPayment.data_vencimento), "dd MMM", { locale: ptBR })}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                R$ {nextPayment.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <p className="text-xl text-gray-500">Nenhuma pendência</p>
          )}
        </motion.div>
      </div>

      {/* DAS List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Guias DAS</h2>
          <p className="text-sm text-gray-500 mt-1">Histórico de pagamentos mensais</p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Carregando guias...</p>
          </div>
        ) : dasPayments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma guia cadastrada</h3>
            <p className="text-gray-500">As guias DAS aparecerão aqui automaticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {dasPayments.map((das, index) => {
              const config = getStatusConfig(das.status, das.data_vencimento);
              const StatusIcon = config.icon;
              const isOverdue = new Date(das.data_vencimento) < new Date() && das.status === 'pendente';

              return (
                <motion.div
                  key={das.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-6 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-start gap-6">
                    {/* Icon */}
                    <div className={`w-14 h-14 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}>
                      <StatusIcon className={`w-6 h-6 ${config.color}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="flex items-center gap-3">
                            <h3 className="text-white font-semibold">
                              DAS - {das.referencia}
                            </h3>
                            <Badge className={`${config.bg} ${config.color} border-0`}>
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            <Calendar className="w-4 h-4" />
                            Vencimento: {format(new Date(das.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            {isOverdue && (
                              <span className="text-red-400 font-medium">(Atrasado)</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">
                            R$ {das.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-white/5 mb-4">
                        {das.valor_inss && (
                          <div>
                            <p className="text-xs text-gray-500">INSS</p>
                            <p className="text-sm font-medium text-white mt-1">
                              R$ {das.valor_inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {das.valor_icms && (
                          <div>
                            <p className="text-xs text-gray-500">ICMS</p>
                            <p className="text-sm font-medium text-white mt-1">
                              R$ {das.valor_icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {das.valor_iss && (
                          <div>
                            <p className="text-xs text-gray-500">ISS</p>
                            <p className="text-sm font-medium text-white mt-1">
                              R$ {das.valor_iss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Code and Actions */}
                      {das.codigo_barras && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-gray-500 mb-1">Código de barras</p>
                            <p className="text-sm text-white font-mono">{das.codigo_barras}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(das.codigo_barras)}
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-3">
                        {das.pdf_url && (
                          <Button 
                            className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-0"
                            onClick={() => handleDownloadPdf(das)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Baixar Guia PDF
                          </Button>
                        )}
                        {das.status === 'pendente' && (
                          <Button variant="outline" className="bg-transparent border-white/10 text-white hover:bg-white/5">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marcar como pago
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Info Box */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="p-6 rounded-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20"
      >
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold mb-2">Sobre o DAS - MEI</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              O DAS (Documento de Arrecadação do Simples Nacional) é a guia mensal de pagamento dos tributos do MEI. 
              Inclui INSS, ISS (se for prestador de serviço) e ICMS (se for comércio/indústria). 
              O vencimento é sempre no dia 20 de cada mês.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
