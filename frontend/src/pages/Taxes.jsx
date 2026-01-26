import React from "react";
import { useQuery } from "@tanstack/react-query";
import { taxesService, companiesService, settingsService } from "@/api/services";
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
import { cn } from "@/lib/utils";

export default function Taxes() {
  const { data: dasPayments = [], isLoading } = useQuery({
    queryKey: ['das'],
    queryFn: () => taxesService.list({ sort: '-data_vencimento' }),
  });

  // Get user settings to find active company
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  const { data: company } = useQuery({
    queryKey: ['company', settings?.active_company_id || 'default'],
    queryFn: async () => {
      const companies = await companiesService.list();
      
      // If there's an active company ID in settings, find that company
      if (settings?.active_company_id) {
        const activeCompany = companies.find(c => c.id === settings.active_company_id);
        if (activeCompany) return activeCompany;
      }
      
      // Fallback to first company
      return companies[0] || null;
    },
    enabled: settings !== undefined,
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
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
          transition={{ delay: 0.3 }}
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
        transition={{ delay: 0.4 }}
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
          "backdrop-blur-sm"
        )}>
          <h2 className="text-xl font-bold text-white mb-1">Guias DAS</h2>
          <p className="text-sm text-gray-400 font-medium">Histórico de pagamentos mensais</p>
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
            <p className="text-gray-400 font-medium">As guias DAS aparecerão aqui automaticamente</p>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
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
                            <Badge className={cn(
                              "font-semibold border",
                              config.bg.includes('yellow') ? "bg-gradient-to-br from-yellow-500/30 to-yellow-600/20 text-yellow-300 border-yellow-500/40 shadow-md shadow-yellow-500/20" :
                              config.bg.includes('green') ? "bg-gradient-to-br from-green-500/30 to-emerald-600/20 text-green-300 border-green-500/40 shadow-md shadow-green-500/20" :
                              "bg-gradient-to-br from-red-500/30 to-red-600/20 text-red-300 border-red-500/40 shadow-md shadow-red-500/20"
                            )}>
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
                        {das.valor_icms && (
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">ICMS</p>
                            <p className="text-sm font-bold text-white mt-2">
                              R$ {das.valor_icms.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                        )}
                        {das.valor_iss && (
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
                        {das.pdf_url && (
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
                        )}
                        {das.status === 'pendente' && (
                          <Button 
                            variant="outline" 
                            className={cn(
                              "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                              "border border-white/10 text-white",
                              "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
                              "hover:border-white/20",
                              "transition-all duration-200",
                              "shadow-md hover:shadow-lg",
                              "backdrop-blur-sm",
                              "font-semibold"
                            )}
                          >
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
            <FileText className="w-6 h-6 text-blue-300" />
          </div>
          <div>
            <h3 className="text-white font-bold mb-3 text-lg">Sobre o DAS - MEI</h3>
            <p className="text-sm text-gray-300 leading-relaxed font-medium">
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
