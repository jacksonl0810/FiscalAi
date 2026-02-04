import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { taxesService, companiesService, settingsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
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
  Copy,
  Plus,
  X,
  Loader2,
  Info,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// DAS MEI values for 2026 (based on minimum wage of R$ 1,518.00)
// INSS: 5% of minimum wage = R$ 75.90
// ISS: R$ 5.00 (for service providers)
// ICMS: R$ 1.00 (for commerce/industry)
const DAS_VALUES_2026 = {
  INSS: 75.90,
  ISS: 5.00,
  ICMS: 1.00,
  TOTAL_SERVICOS: 80.90, // INSS + ISS
  TOTAL_COMERCIO: 76.90, // INSS + ICMS
  TOTAL_INDUSTRIA: 81.90 // INSS + ISS + ICMS (rare case)
};

export default function Taxes() {
  const queryClient = useQueryClient();
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [markingPaidId, setMarkingPaidId] = useState(null);

  const { data: dasPayments = [], isLoading, refetch } = useQuery({
    queryKey: ['das'],
    queryFn: () => taxesService.list({ sort: '-data_vencimento' }),
  });

  // Get user settings to find active company
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.list(),
  });

  const { data: company } = useQuery({
    queryKey: ['company', settings?.active_company_id || 'default'],
    queryFn: async () => {
      const allCompanies = await companiesService.list();
      
      // If there's an active company ID in settings, find that company
      if (settings?.active_company_id) {
        const activeCompany = allCompanies.find(c => c.id === settings.active_company_id);
        if (activeCompany) return activeCompany;
      }
      
      // Fallback to first company
      return allCompanies[0] || null;
    },
    enabled: settings !== undefined,
  });

  /**
   * Mark DAS as paid mutation
   * @type {import('@tanstack/react-query').UseMutationResult<import('@/types').DAS, Error, {id: string, paymentDate: string}>}
   */
  const markAsPaidMutation = useMutation({
    mutationFn: async (/** @type {{id: string, paymentDate: string}} */ params) => {
      return taxesService.markAsPaid(params.id, params.paymentDate);
    },
    onSuccess: (data) => {
      toast.success(`✅ DAS ${data.referencia} marcado como pago!`, {
        description: `Pagamento registrado em ${format(new Date(data.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}`
      });
      queryClient.invalidateQueries({ queryKey: ['das'] });
      setMarkingPaidId(null);
    },
    onError: (error) => {
      toast.error('Erro ao marcar como pago', {
        description: error?.message || 'Tente novamente'
      });
      setMarkingPaidId(null);
    }
  });

  /**
   * Generate DAS mutation
   * @type {import('@tanstack/react-query').UseMutationResult<import('@/types').DAS, Error, {companyId: string, referencia: string}>}
   */
  const generateDASMutation = useMutation({
    mutationFn: async (/** @type {{companyId: string, referencia: string}} */ params) => {
      return taxesService.generate(params.companyId, params.referencia);
    },
    onSuccess: (data) => {
      toast.success(`✅ DAS ${data.referencia} gerado com sucesso!`, {
        description: `Valor: R$ ${data.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
      });
      queryClient.invalidateQueries({ queryKey: ['das'] });
      setShowGenerateModal(false);
      setSelectedMonth('');
    },
    onError: (error) => {
      // @ts-ignore - axios error type
      const message = error?.response?.data?.message || error?.message;
      if (message?.includes('already exists')) {
        toast.error('DAS já existe', {
          description: 'Já existe uma guia DAS para este mês.'
        });
      } else {
        toast.error('Erro ao gerar DAS', {
          description: message || 'Tente novamente'
        });
      }
    }
  });

  const handleMarkAsPaid = (das) => {
    setMarkingPaidId(das.id);
    markAsPaidMutation.mutate({ 
      id: das.id, 
      paymentDate: new Date().toISOString().split('T')[0] 
    });
  };

  const handleGenerateDAS = () => {
    if (!selectedMonth || !company?.id) {
      toast.error('Selecione um mês e certifique-se de ter uma empresa ativa');
      return;
    }

    const referencia = `${selectedMonth.padStart(2, '0')}/${selectedYear}`;
    generateDASMutation.mutate({
      companyId: company.id,
      referencia
    });
  };

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
      toast.loading('Gerando PDF...', { id: 'pdf-download' });
      const blob = await taxesService.downloadPdf(das.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `das-${das.referencia.replace('/', '-')}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('PDF baixado!', { id: 'pdf-download' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Erro ao baixar PDF', { 
        id: 'pdf-download',
        description: 'Funcionalidade em desenvolvimento' 
      });
    }
  };

  // Calculate stats
  const totalPending = dasPayments
    .filter(d => d.status === 'pendente')
    .reduce((sum, d) => sum + (d.valor_total || 0), 0);

  const totalPaid = dasPayments
    .filter(d => d.status === 'pago')
    .reduce((sum, d) => sum + (d.valor_total || 0), 0);

  const overdueCount = dasPayments.filter(d => 
    d.status === 'pendente' && new Date(d.data_vencimento) < new Date()
  ).length;

  const nextPayment = dasPayments.find(d => d.status === 'pendente');

  // Generate available months for DAS
  const getAvailableMonths = () => {
    const months = [
      { value: '01', label: 'Janeiro' },
      { value: '02', label: 'Fevereiro' },
      { value: '03', label: 'Março' },
      { value: '04', label: 'Abril' },
      { value: '05', label: 'Maio' },
      { value: '06', label: 'Junho' },
      { value: '07', label: 'Julho' },
      { value: '08', label: 'Agosto' },
      { value: '09', label: 'Setembro' },
      { value: '10', label: 'Outubro' },
      { value: '11', label: 'Novembro' },
      { value: '12', label: 'Dezembro' }
    ];

    // Filter out months that already have DAS for the selected year
    const existingMonths = dasPayments
      .filter(d => d.referencia?.includes(`/${selectedYear}`))
      .map(d => d.referencia?.split('/')[0]);

    return months.filter(m => !existingMonths.includes(m.value));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className={cn(
            "text-4xl font-bold mb-2",
            "bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent",
            "drop-shadow-lg"
          )}>
            Impostos e Tributos
          </h1>
          <p className="text-gray-400 mt-1 font-medium">
            {company?.regime_tributario === 'MEI' 
              ? 'Gerenciamento das guias DAS (Documento de Arrecadação do Simples Nacional)'
              : 'Gerenciamento de impostos e tributos'}
          </p>
        </motion.div>

        {/* Generate DAS Button */}
        {company?.regime_tributario === 'MEI' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <Button
              onClick={() => setShowGenerateModal(true)}
              className={cn(
                "bg-gradient-to-r from-orange-500 to-orange-600",
                "hover:from-orange-600 hover:to-orange-700",
                "text-white font-semibold",
                "shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40",
                "transition-all duration-200",
                "px-6 py-3"
              )}
            >
              <Plus className="w-5 h-5 mr-2" />
              Gerar Guia DAS
            </Button>
          </motion.div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className={cn(
            "relative rounded-2xl p-6 overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-yellow-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
            "hover:shadow-yellow-500/20 hover:border-yellow-500/20",
            "transition-all duration-300"
          )}
        >
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-yellow-500/30 via-yellow-600/20 to-yellow-500/30",
              "border border-yellow-500/30",
              "shadow-lg shadow-yellow-500/20"
            )}>
              <Clock className="w-7 h-7 text-yellow-300" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">Pendentes</h3>
          <p className={cn(
            "text-3xl font-bold mb-2 relative z-10",
            "bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
          )}>
            R$ {totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-400 mt-1 font-medium relative z-10">
            {dasPayments.filter(d => d.status === 'pendente').length} guia(s)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className={cn(
            "relative rounded-2xl p-6 overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-red-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
            overdueCount > 0 && "hover:shadow-red-500/20 hover:border-red-500/20",
            "transition-all duration-300"
          )}
        >
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-red-500/30 via-red-600/20 to-red-500/30",
              "border border-red-500/30",
              "shadow-lg shadow-red-500/20"
            )}>
              <AlertCircle className="w-7 h-7 text-red-300" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">Atrasados</h3>
          <p className={cn(
            "text-3xl font-bold mb-2 relative z-10",
            overdueCount > 0 ? "text-red-400" : "bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
          )}>
            {overdueCount}
          </p>
          <p className="text-sm text-gray-400 mt-1 font-medium relative z-10">
            {overdueCount > 0 ? 'Regularize!' : 'Tudo em dia'}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "relative rounded-2xl p-6 overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-green-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
            "hover:shadow-green-500/20 hover:border-green-500/20",
            "transition-all duration-300"
          )}
        >
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-green-500/30 via-emerald-600/20 to-green-500/30",
              "border border-green-500/30",
              "shadow-lg shadow-green-500/20"
            )}>
              <CheckCircle className="w-7 h-7 text-green-300" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">Pagos este ano</h3>
          <p className={cn(
            "text-3xl font-bold mb-2 relative z-10",
            "bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
          )}>
            R$ {totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-sm text-gray-400 mt-1 font-medium relative z-10">
            {dasPayments.filter(d => d.status === 'pago').length} guia(s)
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className={cn(
            "relative rounded-2xl p-6 overflow-hidden",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "backdrop-blur-xl border border-white/10",
            "shadow-2xl shadow-black/50",
            "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none",
            "hover:shadow-orange-500/20 hover:border-orange-500/20",
            "transition-all duration-300"
          )}
        >
          <div className="flex items-start justify-between mb-4 relative z-10">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              "bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-orange-500/30",
              "border border-orange-500/30",
              "shadow-lg shadow-orange-500/20"
            )}>
              <Calendar className="w-7 h-7 text-orange-300" />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-gray-400 mb-2 uppercase tracking-wider relative z-10">Próximo vencimento</h3>
          {nextPayment ? (
            <>
              <p className={cn(
                "text-2xl font-bold mb-2 relative z-10",
                "bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
              )}>
                {format(new Date(nextPayment.data_vencimento), "dd MMM", { locale: ptBR })}
              </p>
              <p className="text-sm text-gray-400 mt-1 font-medium relative z-10">
                R$ {nextPayment.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </>
          ) : (
            <p className="text-xl text-gray-400 font-medium relative z-10">Nenhuma pendência</p>
          )}
        </motion.div>
      </div>

      {/* DAS List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
          "backdrop-blur-xl border border-white/10",
          "shadow-2xl shadow-black/50",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
        )}
      >
        <div className={cn(
          "px-6 py-5 border-b border-white/10 relative z-10",
          "bg-gradient-to-r from-white/5 via-transparent to-transparent",
          "backdrop-blur-sm",
          "flex items-center justify-between"
        )}>
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Guias DAS</h2>
            <p className="text-sm text-gray-400 font-medium">Histórico de pagamentos mensais</p>
          </div>
          {company && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
              <Building2 className="w-4 h-4 text-orange-400" />
              <span className="text-sm text-gray-300 font-medium">
                {company.nome_fantasia || company.razao_social}
              </span>
            </div>
          )}
        </div>

        {isLoading ? (
          <div className="p-12 text-center relative z-10">
            <div className={cn(
              "w-12 h-12 border-3 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4",
              "shadow-lg shadow-orange-500/20"
            )} />
            <p className="text-gray-400 font-medium">Carregando guias...</p>
          </div>
        ) : dasPayments.length === 0 ? (
          <div className="p-16 text-center relative z-10">
            <div className={cn(
              "w-20 h-20 rounded-2xl mx-auto mb-6",
              "bg-gradient-to-br from-white/10 via-white/5 to-white/10",
              "border border-white/10",
              "flex items-center justify-center",
              "shadow-xl shadow-black/30"
            )}>
              <Receipt className="w-10 h-10 text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Nenhuma guia cadastrada</h3>
            <p className="text-gray-400 font-medium mb-6">Gere sua primeira guia DAS clicando no botão acima</p>
            {company?.regime_tributario === 'MEI' && (
              <Button
                onClick={() => setShowGenerateModal(true)}
                className={cn(
                  "bg-gradient-to-r from-orange-500 to-orange-600",
                  "hover:from-orange-600 hover:to-orange-700",
                  "text-white font-semibold",
                  "shadow-lg shadow-orange-500/30"
                )}
              >
                <Plus className="w-5 h-5 mr-2" />
                Gerar Primeira Guia
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {dasPayments.map((das, index) => {
              const config = getStatusConfig(das.status, das.data_vencimento);
              const StatusIcon = config.icon;
              const isOverdue = new Date(das.data_vencimento) < new Date() && das.status === 'pendente';
              const isMarkingThisPaid = markingPaidId === das.id;

              return (
                <motion.div
                  key={das.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "p-6 relative z-10",
                    "hover:bg-gradient-to-r hover:from-white/5 hover:via-white/3 hover:to-white/5",
                    "transition-all duration-200"
                  )}
                >
                  <div className="flex items-start gap-6">
                    {/* Icon */}
                    <div className={cn(
                      "w-16 h-16 rounded-xl flex items-center justify-center flex-shrink-0",
                      "bg-gradient-to-br",
                      config.bg.includes('yellow') ? "from-yellow-500/30 via-yellow-600/20 to-yellow-500/30 border-yellow-500/30" :
                      config.bg.includes('green') ? "from-green-500/30 via-emerald-600/20 to-green-500/30 border-green-500/30" :
                      "from-red-500/30 via-red-600/20 to-red-500/30 border-red-500/30",
                      "border shadow-lg",
                      config.bg.includes('yellow') ? "shadow-yellow-500/20" :
                      config.bg.includes('green') ? "shadow-green-500/20" :
                      "shadow-red-500/20"
                    )}>
                      <StatusIcon className={cn(
                        "w-7 h-7",
                        config.color
                      )} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-white font-bold text-lg">
                              DAS - {das.referencia}
                            </h3>
                            <Badge 
                              variant="outline"
                              className={cn(
                                "font-semibold border",
                                config.bg.includes('yellow') ? "bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 text-yellow-300 border-yellow-500/40 shadow-md shadow-yellow-500/20" :
                                config.bg.includes('green') ? "bg-gradient-to-br from-green-500/30 to-emerald-600/20 text-green-300 border-green-500/40 shadow-md shadow-green-500/20" :
                                "bg-gradient-to-br from-red-500/30 to-red-600/20 text-red-300 border-red-500/40 shadow-md shadow-red-500/20"
                              )}
                            >
                              {config.label}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2 font-medium">
                            <Calendar className="w-4 h-4" />
                            Vencimento: {format(new Date(das.data_vencimento), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                            {isOverdue && (
                              <span className="text-red-300 font-semibold">(Atrasado)</span>
                            )}
                          </p>
                          {das.status === 'pago' && das.data_pagamento && (
                            <p className="text-sm text-green-400 mt-1 flex items-center gap-2 font-medium">
                              <CheckCircle className="w-4 h-4" />
                              Pago em: {format(new Date(das.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-2xl font-bold",
                            "bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                          )}>
                            R$ {das.valor_total?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                      </div>

                      {/* Breakdown */}
                      <div className={cn(
                        "grid grid-cols-3 gap-4 p-5 rounded-xl mb-4",
                        "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                        "border border-white/10",
                        "backdrop-blur-sm",
                        "shadow-md"
                      )}>
                        {das.valor_inss && (
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">INSS</p>
                            <p className="text-sm font-bold text-white mt-2">
                              R$ {das.valor_inss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {das.valor_icms && das.valor_icms > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ICMS</p>
                            <p className="text-sm font-bold text-white mt-2">
                              R$ {das.valor_icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {das.valor_iss && das.valor_iss > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ISS</p>
                            <p className="text-sm font-bold text-white mt-2">
                              R$ {das.valor_iss.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Code and Actions */}
                      {das.codigo_barras && (
                        <div className="flex items-center gap-3 mb-4">
                          <div className={cn(
                            "flex-1 px-4 py-3 rounded-xl",
                            "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                            "border border-white/10",
                            "backdrop-blur-sm"
                          )}>
                            <p className="text-xs text-gray-400 mb-1.5 font-semibold uppercase tracking-wider">Código de barras</p>
                            <p className="text-sm text-white font-mono font-medium">{das.codigo_barras}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyToClipboard(das.codigo_barras)}
                            className={cn(
                              "text-gray-400 hover:text-white",
                              "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                              "border border-transparent hover:border-white/10",
                              "rounded-xl transition-all duration-200",
                              "shadow-sm hover:shadow-md"
                            )}
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-3">
                        <Button 
                          className={cn(
                            "bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-orange-500/30",
                            "text-orange-300 hover:text-orange-200",
                            "border border-orange-500/40",
                            "hover:from-orange-500/40 hover:via-orange-600/30 hover:to-orange-500/40",
                            "shadow-lg shadow-orange-500/20 hover:shadow-xl hover:shadow-orange-500/30",
                            "transition-all duration-200",
                            "font-semibold"
                          )}
                          onClick={() => handleDownloadPdf(das)}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Baixar Guia PDF
                        </Button>
                        {das.status === 'pendente' && (
                          <Button 
                            variant="outline" 
                            onClick={() => handleMarkAsPaid(das)}
                            disabled={isMarkingThisPaid}
                            className={cn(
                              "bg-gradient-to-br from-green-500/20 via-green-600/10 to-green-500/20",
                              "border border-green-500/30 text-green-300",
                              "hover:bg-gradient-to-br hover:from-green-500/30 hover:via-green-600/20 hover:to-green-500/30",
                              "hover:border-green-500/40 hover:text-green-200",
                              "transition-all duration-200",
                              "shadow-md hover:shadow-lg hover:shadow-green-500/20",
                              "backdrop-blur-sm",
                              "font-semibold",
                              "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                          >
                            {isMarkingThisPaid ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Marcar como pago
                              </>
                            )}
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
        transition={{ delay: 0.4 }}
        className={cn(
          "relative p-6 rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
          "backdrop-blur-xl border border-white/10",
          "shadow-2xl shadow-black/50",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-blue-500/5 before:via-purple-500/5 before:to-transparent before:pointer-events-none"
        )}
      >
        <div className="flex gap-4 relative z-10">
          <div className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
            "bg-gradient-to-br from-blue-500/30 via-blue-600/20 to-blue-500/30",
            "border border-blue-500/30",
            "shadow-lg shadow-blue-500/20"
          )}>
            <Info className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h3 className="text-white font-bold mb-3 text-lg">Sobre o DAS - MEI</h3>
            <div className="space-y-2">
              <p className="text-sm text-gray-300 leading-relaxed font-medium">
                O DAS (Documento de Arrecadação do Simples Nacional) é a guia mensal de pagamento dos tributos do MEI. 
                O vencimento é sempre no dia 20 de cada mês.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4 p-4 rounded-xl bg-white/5 border border-white/10">
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">INSS (5% do SM)</p>
                  <p className="text-lg font-bold text-white mt-1">R$ {DAS_VALUES_2026.INSS.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ISS (Serviços)</p>
                  <p className="text-lg font-bold text-white mt-1">R$ {DAS_VALUES_2026.ISS.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ICMS (Comércio)</p>
                  <p className="text-lg font-bold text-white mt-1">R$ {DAS_VALUES_2026.ICMS.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Generate DAS Modal */}
      <AnimatePresence>
        {showGenerateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            onClick={() => setShowGenerateModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "w-full max-w-lg rounded-2xl overflow-hidden",
                "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
                "border border-white/10",
                "shadow-2xl shadow-black/50"
              )}
            >
              {/* Modal Header */}
              <div className={cn(
                "px-6 py-5 border-b border-white/10",
                "bg-gradient-to-r from-orange-500/10 via-transparent to-transparent"
              )}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      "bg-gradient-to-br from-orange-500/30 to-orange-600/20",
                      "border border-orange-500/30"
                    )}>
                      <Receipt className="w-5 h-5 text-orange-300" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Gerar Guia DAS</h2>
                      <p className="text-sm text-gray-400">Selecione o mês de referência</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowGenerateModal(false)}
                    className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-6">
                {/* Company Info */}
                {company && (
                  <div className={cn(
                    "p-4 rounded-xl",
                    "bg-gradient-to-br from-white/5 to-white/3",
                    "border border-white/10"
                  )}>
                    <div className="flex items-center gap-3">
                      <Building2 className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-white font-semibold">{company.nome_fantasia || company.razao_social}</p>
                        <p className="text-sm text-gray-400">CNPJ: {company.cnpj?.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Year Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Ano</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className={cn(
                      "w-full px-4 py-3 rounded-xl",
                      "bg-slate-800/80 text-white",
                      "border border-white/10 focus:border-orange-500/50",
                      "focus:ring-2 focus:ring-orange-500/20",
                      "outline-none transition-all duration-200"
                    )}
                  >
                    {[2024, 2025, 2026].map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                {/* Month Selection */}
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-2">Mês de Referência</label>
                  <div className="grid grid-cols-4 gap-2">
                    {getAvailableMonths().map((month) => (
                      <button
                        key={month.value}
                        onClick={() => setSelectedMonth(month.value)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200",
                          selectedMonth === month.value
                            ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/30"
                            : "bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white"
                        )}
                      >
                        {month.label.substring(0, 3)}
                      </button>
                    ))}
                  </div>
                  {getAvailableMonths().length === 0 && (
                    <p className="text-sm text-yellow-400 mt-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Todos os meses já possuem guia DAS para {selectedYear}
                    </p>
                  )}
                </div>

                {/* Value Preview */}
                {selectedMonth && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "p-4 rounded-xl",
                      "bg-gradient-to-br from-green-500/10 to-green-600/5",
                      "border border-green-500/20"
                    )}
                  >
                    <p className="text-sm text-gray-400 mb-2">Valor estimado da guia:</p>
                    <p className="text-2xl font-bold text-white">
                      R$ {DAS_VALUES_2026.TOTAL_SERVICOS.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-gray-400 mt-2">
                      Vencimento: 20/{(parseInt(selectedMonth) + 1).toString().padStart(2, '0')}/{parseInt(selectedMonth) === 12 ? parseInt(selectedYear) + 1 : selectedYear}
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Modal Footer */}
              <div className={cn(
                "px-6 py-4 border-t border-white/10",
                "bg-gradient-to-r from-white/5 via-transparent to-transparent",
                "flex items-center justify-end gap-3"
              )}>
                <Button
                  variant="ghost"
                  onClick={() => setShowGenerateModal(false)}
                  className="border border-white/10 text-gray-300 hover:bg-white/5 bg-transparent"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleGenerateDAS}
                  disabled={!selectedMonth || generateDASMutation.isPending}
                  className={cn(
                    "bg-gradient-to-r from-orange-500 to-orange-600",
                    "hover:from-orange-600 hover:to-orange-700",
                    "text-white font-semibold",
                    "shadow-lg shadow-orange-500/30",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {generateDASMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Gerar Guia
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
