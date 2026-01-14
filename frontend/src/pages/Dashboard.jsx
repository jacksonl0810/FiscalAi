import React from "react";
import { useQuery } from "@tanstack/react-query";
import { invoicesService, companiesService } from "@/api/services";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  DollarSign, 
  FileText, 
  Receipt, 
  TrendingUp,
  ArrowRight,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/dashboard/StatCard";
import AlertCard from "@/components/dashboard/AlertCard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import MEILimitBar from "@/components/dashboard/MEILimitBar";
import RegimeIndicator from "@/components/dashboard/RegimeIndicator";

export default function Dashboard() {
  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.list({ sort: '-created_at' }),
  });

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: async () => {
      const companies = await companiesService.list();
      return companies[0];
    },
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
        <div>
          <motion.h1 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-white"
          >
            Dashboard
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 mt-1"
          >
            Bem-vindo de volta, {company?.nome_fantasia || 'Empresa'}
          </motion.p>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Link to={createPageUrl("Assistant")}>
            <Button className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0">
              <Sparkles className="w-4 h-4 mr-2" />
              Emitir nota com IA
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
            className="text-lg font-semibold text-white"
          >
            Alertas e Avisos
          </motion.h3>

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
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white">Últimas Notas Emitidas</h3>
          <Link to={createPageUrl("Documents")}>
            <Button variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10">
              Ver todas
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left border-b border-white/5">
                <th className="pb-4 text-sm font-medium text-gray-500">Número</th>
                <th className="pb-4 text-sm font-medium text-gray-500">Cliente</th>
                <th className="pb-4 text-sm font-medium text-gray-500">Valor</th>
                <th className="pb-4 text-sm font-medium text-gray-500">Status</th>
                <th className="pb-4 text-sm font-medium text-gray-500">Data</th>
              </tr>
            </thead>
            <tbody>
              {invoices.slice(0, 5).map((invoice, index) => (
                <motion.tr
                  key={invoice.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="py-4 text-white font-medium">{invoice.numero || '---'}</td>
                  <td className="py-4 text-gray-300">{invoice.cliente_nome}</td>
                  <td className="py-4 text-white font-medium">
                    R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </td>
                  <td className="py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      invoice.status === 'autorizada' 
                        ? 'bg-green-500/20 text-green-400'
                        : invoice.status === 'enviada'
                        ? 'bg-blue-500/20 text-blue-400'
                        : invoice.status === 'pendente_confirmacao'
                        ? 'bg-yellow-500/20 text-yellow-400'
                        : invoice.status === 'rejeitada'
                        ? 'bg-red-500/20 text-red-400'
                        : invoice.status === 'cancelada'
                        ? 'bg-gray-500/20 text-gray-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {invoice.status === 'autorizada' ? 'Autorizada' :
                       invoice.status === 'enviada' ? 'Enviada' :
                       invoice.status === 'pendente_confirmacao' ? 'Pendente' :
                       invoice.status === 'rejeitada' ? 'Rejeitada' :
                       invoice.status === 'cancelada' ? 'Cancelada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="py-4 text-gray-400">{invoice.data_emissao || '---'}</td>
                </motion.tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-500">
                    Nenhuma nota fiscal emitida ainda
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
