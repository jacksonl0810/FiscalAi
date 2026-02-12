import React from "react";
import { useQuery } from "@tanstack/react-query";
import { invoicesService, companiesService, settingsService, subscriptionsService } from "@/api/services";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  DollarSign, 
  FileText, 
  Receipt, 
  TrendingUp,
  ArrowRight,
  Sparkles,
  Crown,
  Building2,
  AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import StatCard from "@/components/dashboard/StatCard";
import AlertCard from "@/components/dashboard/AlertCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MEILimitBar from "@/components/dashboard/MEILimitBar";
import RegimeIndicator from "@/components/dashboard/RegimeIndicator";
import FiscalStatusIndicator from "@/components/layout/FiscalStatusIndicator";

function normalizeStatus(status) {
  if (status === 'autorizada') return 'autorizada';
  if (status === 'rejeitada') return 'rejeitada';
  if (status === 'cancelada') return 'cancelada';
  return 'processando';
}

function getStatusDisplay(status) {
  const normalized = normalizeStatus(status);
  const config = {
    processando: { label: 'Processando', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
    autorizada: { label: 'Autorizada', bg: 'bg-green-500/20', text: 'text-green-400' },
    rejeitada: { label: 'Rejeitada', bg: 'bg-red-500/20', text: 'text-red-400' },
    cancelada: { label: 'Cancelada', bg: 'bg-slate-500/20', text: 'text-slate-400' },
  };
  return config[normalized] || config.processando;
}

export default function Dashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.list({ sort: '-created_at' }),
    staleTime: 0, // Always consider data stale to ensure fresh data
    refetchOnMount: 'always', // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window gains focus
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
      
      // Fallback to first company or null
      return companies[0] || null;
    },
    enabled: settings !== undefined,
  });

  // Calculate stats
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const monthlyInvoices = invoices.filter(inv => {
    if (!inv.data_emissao) return false;
    const date = new Date(inv.data_emissao);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const monthlyRevenue = monthlyInvoices.reduce((sum, inv) => sum + (inv.valor || 0), 0);
  const monthlyTax = monthlyInvoices.reduce((sum, inv) => sum + (inv.valor_iss || 0), 0);
  const totalInvoices = monthlyInvoices.length;

  // Chart data - Calculate last 6 months revenue
  const chartData = React.useMemo(() => {
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const now = new Date();
    const last6Months = [];
    
    for (let i = 5; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthIndex = date.getMonth();
      const year = date.getFullYear();
      
      const monthRevenue = invoices
        .filter(inv => {
          if (!inv.data_emissao) return false;
          const invDate = new Date(inv.data_emissao);
          return invDate.getMonth() === monthIndex && invDate.getFullYear() === year;
        })
        .reduce((sum, inv) => sum + (inv.valor || 0), 0);
      
      last6Months.push({
        month: months[monthIndex],
        value: monthRevenue
      });
    }
    
    return last6Months;
  }, [invoices]);

  // MEI limit check - fetch from backend for accurate tracking
  const { data: meiLimitStatus } = useQuery({
    queryKey: ['meiLimitStatus', company?.id],
    queryFn: () => companiesService.getMEILimitStatus(company?.id || ''),
    enabled: !!company?.id && company?.regime_tributario === 'MEI',
  });

  // Get plan limits
  const { data: planLimits } = useQuery({
    queryKey: ['plan-limits'],
    queryFn: () => subscriptionsService.getLimits(),
    staleTime: 2 * 60 * 1000,
  });

  // Get all companies count
  const { data: allCompanies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.list(),
  });

  const meiLimit = 81000;
  const yearlyRevenue = meiLimitStatus?.yearlyRevenue ?? invoices
    .filter(inv => {
      if (!inv.data_emissao) return false;
      return new Date(inv.data_emissao).getFullYear() === currentYear;
    })
    .reduce((sum, inv) => sum + (inv.valor || 0), 0);
  const meiPercentage = meiLimitStatus?.percentage ?? (yearlyRevenue / meiLimit) * 100;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-orange-600/10 to-transparent blur-3xl -z-10" />
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-bold bg-gradient-to-r from-white via-orange-50 to-white bg-clip-text text-transparent"
          >
            Dashboard
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 mt-2 text-sm"
          >
            Bem-vindo de volta, {company?.nome_fantasia || 'Empresa'}
          </motion.p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link to={createPageUrl("Assistant")}>
            <Button className={cn(
              "relative overflow-hidden",
              "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500",
              "hover:from-orange-600 hover:via-orange-500 hover:to-orange-600",
              "text-white border-0",
              "shadow-xl shadow-orange-500/30",
              "hover:shadow-2xl hover:shadow-orange-500/40",
              "transition-all duration-300",
              "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
              "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-700",
              "rounded-xl px-6 py-3 h-auto font-semibold"
            )}>
              <Sparkles className="w-4 h-4 mr-2 relative z-10" />
              <span className="relative z-10">Emitir nota com IA</span>
            </Button>
          </Link>
        </motion.div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
        <StatCard
          title="Faturamento do Mês"
          value={`R$ ${monthlyRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={DollarSign}
          trend="+12%"
          trendUp={true}
          delay={0}
        />
        <StatCard
          title="Notas Emitidas"
          value={totalInvoices.toString()}
          subtitle="Este mês"
          icon={FileText}
          delay={0.1}
        />
        <StatCard
          title="Impostos (ISS)"
          value={`R$ ${monthlyTax.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          icon={Receipt}
          delay={0.2}
        />
        <StatCard
          title="Ticket Médio"
          value={`R$ ${totalInvoices ? (monthlyRevenue / totalInvoices).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}`}
          icon={TrendingUp}
          trend="+5%"
          trendUp={true}
          delay={0.3}
        />
      </div>

      {/* MEI Limit Bar */}
      {company?.regime_tributario === 'MEI' && (
        <MEILimitBar yearlyRevenue={yearlyRevenue} limit={meiLimit} />
      )}

      {/* Plan Limits Card */}
      {planLimits && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className={cn(
            "p-6 rounded-2xl",
            "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
            "border border-white/10",
            "shadow-xl"
          )}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                "bg-gradient-to-br from-purple-500/20 to-purple-600/20",
                "border border-purple-500/30"
              )}>
                <Crown className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Plano {planLimits.planName}</h3>
                <p className="text-sm text-gray-400">Uso do mês atual</p>
              </div>
            </div>
            <Link to={createPageUrl("Pricing")}>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  "group relative overflow-hidden rounded-xl",
                  "bg-gradient-to-br from-slate-800/90 via-purple-900/20 to-slate-800/90",
                  "border border-purple-500/40",
                  "text-purple-200 font-medium",
                  "shadow-lg shadow-purple-500/10",
                  "hover:border-purple-400/60 hover:text-white",
                  "hover:shadow-xl hover:shadow-purple-500/20",
                  "hover:bg-gradient-to-br hover:from-purple-600/30 hover:via-purple-500/20 hover:to-slate-800/90",
                  "active:scale-[0.98]",
                  "transition-all duration-300 ease-out",
                  "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
                  "before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500",
                  "h-9 px-4"
                )}
              >
                <span className="relative z-10 flex items-center gap-2">
                  Ver planos
                  <ArrowRight className="w-3.5 h-3.5 relative z-10 opacity-80 transition-transform duration-300 group-hover:translate-x-0.5" />
                </span>
              </Button>
            </Link>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Invoice limit */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-gray-300">Notas Fiscais</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {planLimits.invoiceLimit?.used || 0} / {planLimits.invoiceLimit?.max === null ? '∞' : planLimits.invoiceLimit?.max}
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all rounded-full",
                    (planLimits.invoiceLimit?.max && (planLimits.invoiceLimit?.used / planLimits.invoiceLimit?.max) > 0.8)
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : "bg-gradient-to-r from-blue-500 to-blue-600"
                  )}
                  style={{ 
                    width: planLimits.invoiceLimit?.max === null 
                      ? (planLimits.invoiceLimit?.used > 0 ? '10%' : '0%')
                      : `${Math.min((planLimits.invoiceLimit?.used / planLimits.invoiceLimit?.max) * 100, 100)}%` 
                  }}
                />
              </div>
              {planLimits.invoiceLimit?.max && !planLimits.invoiceLimit?.allowed && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  Limite atingido
                </div>
              )}
            </div>

            {/* Company limit */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-gray-300">Empresas</span>
                </div>
                <span className="text-sm font-medium text-white">
                  {allCompanies.length} / {planLimits.companyLimit?.max || 1}
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full transition-all rounded-full",
                    (planLimits.companyLimit?.max && (allCompanies.length / planLimits.companyLimit?.max) >= 1)
                      ? "bg-gradient-to-r from-red-500 to-orange-500"
                      : "bg-gradient-to-r from-green-500 to-green-600"
                  )}
                  style={{ 
                    width: `${Math.min((allCompanies.length / (planLimits.companyLimit?.max || 1)) * 100, 100)}%` 
                  }}
                />
              </div>
              {planLimits.companyLimit?.max && !planLimits.companyLimit?.allowed && (
                <div className="mt-2 flex items-center gap-1.5 text-xs text-yellow-400">
                  <AlertTriangle className="w-3 h-3" />
                  Limite atingido
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Regime and Fiscal Status */}
      {company && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RegimeIndicator companyId={company.id} />
          <FiscalStatusIndicator companyId={company.id} />
        </div>
      )}

      {/* Charts and Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2">
          <RevenueChart data={chartData} />
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-xl font-bold text-white mb-1"
          >
            Alertas e Avisos
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="text-sm text-gray-400 mb-4"
          >
            Notificações importantes do sistema
          </motion.p>

          {meiPercentage >= 80 && (
            <AlertCard
              type="warning"
              title="Limite MEI"
              message={`Você já utilizou ${meiPercentage.toFixed(1)}% do limite anual do MEI (R$ 81.000)`}
              action="Ver detalhes"
              delay={0.4}
            />
          )}

          <AlertCard
            type="info"
            title="DAS disponível"
            message="A guia DAS de dezembro já está disponível para pagamento"
            action="Visualizar guia"
            delay={0.5}
          />

          <AlertCard
            type="success"
            title="Certificado digital"
            message={company?.certificado_digital 
              ? "Seu certificado digital está ativo e válido" 
              : "Configure seu certificado digital para emitir notas"}
            action={company?.certificado_digital ? undefined : "Configurar"}
            delay={0.6}
          />
        </div>
      </div>

      {/* Recent Invoices */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative rounded-2xl p-6 overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
      >
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">Últimas Notas Emitidas</h3>
            <p className="text-sm text-gray-400">Histórico recente de emissões</p>
          </div>
          <Link to={createPageUrl("Documents")}>
            <Button
              variant="outline"
              className={cn(
                "group relative rounded-xl px-4 py-2.5 font-semibold",
                "bg-gradient-to-br from-slate-800/95 via-slate-700/90 to-slate-800/95",
                "border border-orange-500/40 text-orange-200",
                "shadow-lg shadow-orange-500/10",
                "hover:border-orange-400 hover:text-white",
                "hover:bg-gradient-to-br hover:from-orange-600/30 hover:via-orange-500/20 hover:to-slate-800/95",
                "hover:shadow-xl hover:shadow-orange-500/25",
                "active:scale-[0.98] transition-all duration-200 ease-out"
              )}
            >
              <span className="flex items-center">
                Ver todas
                <ArrowRight className="w-4 h-4 ml-2 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto relative z-10">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="pb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Número</th>
                <th className="pb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Cliente</th>
                <th className="pb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Valor</th>
                <th className="pb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="pb-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Data</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map((invoice, index) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="border-b border-white/5 hover:bg-gradient-to-r hover:from-white/5 hover:to-transparent transition-all duration-200 group"
                >
                  <td className="py-4 text-white font-semibold group-hover:text-orange-300 transition-colors">{invoice.numero || '---'}</td>
                  <td className="py-4 text-gray-300 group-hover:text-white transition-colors">{invoice.cliente_nome}</td>
                  <td className="py-4 text-white font-semibold group-hover:text-orange-300 transition-colors">
                    R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4">
                    {(() => {
                      const statusDisplay = getStatusDisplay(invoice.status);
                      return (
                        <span className={cn(
                          "px-3 py-1.5 rounded-lg text-xs font-semibold",
                          "border backdrop-blur-sm shadow-md",
                          statusDisplay.bg,
                          statusDisplay.text,
                          statusDisplay.text === 'text-yellow-400' && "border-yellow-500/30 shadow-yellow-500/20",
                          statusDisplay.text === 'text-green-400' && "border-green-500/30 shadow-green-500/20",
                          statusDisplay.text === 'text-red-400' && "border-red-500/30 shadow-red-500/20"
                        )}>
                          {statusDisplay.label}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-4 text-gray-400 group-hover:text-gray-300 transition-colors">{invoice.data_emissao || '---'}</td>
                </motion.tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 border border-white/10 flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-500" />
                      </div>
                      <p className="text-gray-400 font-medium">Nenhuma nota fiscal emitida ainda</p>
                      <p className="text-sm text-gray-500">Use o assistente IA para emitir sua primeira nota</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
