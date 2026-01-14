import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesService, notificationsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  Download,
  Eye,
  Search,
  Filter,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  ChevronDown,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const statusConfig = {
  rascunho: { label: "Rascunho", icon: FileText, color: "text-gray-400", bg: "bg-gray-500/20" },
  pendente_confirmacao: { label: "Aguardando confirmação", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  enviada: { label: "Enviada", icon: TrendingUp, color: "text-blue-400", bg: "bg-blue-500/20" },
  autorizada: { label: "Autorizada", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20" },
  rejeitada: { label: "Rejeitada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/20" },
  cancelada: { label: "Cancelada", icon: XCircle, color: "text-gray-400", bg: "bg-gray-500/20" },
};

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.list({ sort: '-created_at' }),
  });

  const handleRefreshStatus = async (invoice) => {
    if (!invoice.id) return;
    
    setIsRefreshing(true);
    try {
      const data = await invoicesService.checkStatus(invoice.id);

      if (data.status === 'success') {
        await notificationsService.create({
          titulo: "Status atualizado",
          mensagem: `Status da nota ${invoice.numero} atualizado`,
          tipo: "info",
          invoice_id: invoice.id
        });
        // Refresh invoices list
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
    } catch (error) {
      console.error('Error refreshing status:', error);
    }
    setIsRefreshing(false);
  };

  const handleDownloadPdf = async (invoice) => {
    try {
      const blob = await invoicesService.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${invoice.numero || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
    }
  };

  const handleDownloadXml = async (invoice) => {
    try {
      const blob = await invoicesService.downloadXml(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${invoice.numero || invoice.id}.xml`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading XML:', error);
    }
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.numero?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white">Notas Fiscais</h1>
          <p className="text-gray-400 mt-1">Gerencie todas as suas notas fiscais emitidas</p>
        </motion.div>
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col md:flex-row gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por cliente ou número da nota..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 bg-white/5 border-white/10 text-white placeholder:text-gray-500 h-12"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="bg-white/5 border-white/10 text-white hover:bg-white/10 h-12">
              <Filter className="w-4 h-4 mr-2" />
              {statusFilter === "all" ? "Todos os status" : statusConfig[statusFilter]?.label}
              <ChevronDown className="w-4 h-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="bg-[#1a1a2e] border-white/10">
            <DropdownMenuItem onClick={() => setStatusFilter("all")} className="text-white hover:bg-white/10">
              Todos os status
            </DropdownMenuItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <DropdownMenuItem 
                key={key} 
                onClick={() => setStatusFilter(key)}
                className="text-white hover:bg-white/10"
              >
                <config.icon className={`w-4 h-4 mr-2 ${config.color}`} />
                {config.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: "Total", value: invoices.length, color: "text-white" },
          { label: "Autorizadas", value: invoices.filter(i => i.status === "autorizada").length, color: "text-green-400" },
          { label: "Enviadas", value: invoices.filter(i => i.status === "enviada").length, color: "text-blue-400" },
          { label: "Rejeitadas", value: invoices.filter(i => i.status === "rejeitada").length, color: "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card rounded-xl p-4">
            <p className="text-sm text-gray-500">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Invoice List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl overflow-hidden"
      >
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Carregando notas fiscais...</p>
          </div>
        ) : filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Nenhuma nota encontrada</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== "all" 
                ? "Tente ajustar os filtros de busca" 
                : "Use o assistente IA para emitir sua primeira nota fiscal"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {filteredInvoices.map((invoice, index) => {
                const status = statusConfig[invoice.status] || statusConfig.rascunho;
                const StatusIcon = status.icon;
                
                return (
                  <motion.div
                    key={invoice.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-6 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => setSelectedInvoice(selectedInvoice?.id === invoice.id ? null : invoice)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Icon */}
                      <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center`}>
                        <StatusIcon className={`w-6 h-6 ${status.color}`} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <h3 className="text-white font-medium truncate">
                            {invoice.cliente_nome}
                          </h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${status.bg} ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                          <span>#{invoice.numero || '---'}</span>
                          {invoice.data_emissao && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {format(new Date(invoice.data_emissao), "dd MMM yyyy", { locale: ptBR })}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Value */}
                      <div className="text-right">
                        <p className="text-xl font-bold text-white">
                          R$ {invoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                        {invoice.valor_iss && (
                          <p className="text-xs text-gray-500">
                            ISS: R$ {invoice.valor_iss?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRefreshStatus(invoice);
                          }}
                          disabled={isRefreshing}
                          title="Atualizar status"
                        >
                          <TrendingUp className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-gray-400 hover:text-white hover:bg-white/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedInvoice(invoice);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {invoice.pdf_url && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-gray-400 hover:text-white hover:bg-white/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadPdf(invoice);
                            }}
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Expanded Details */}
                    <AnimatePresence>
                      {selectedInvoice?.id === invoice.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-6 pt-6 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">CPF/CNPJ</p>
                              <p className="text-white">{invoice.cliente_documento || '---'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Descrição</p>
                              <p className="text-white text-sm">{invoice.descricao_servico || '---'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Código de Verificação</p>
                              <p className="text-white font-mono text-sm">{invoice.codigo_verificacao || '---'}</p>
                            </div>
                          </div>
                          <div className="flex gap-3 mt-6">
                            {invoice.pdf_url && (
                              <Button 
                                className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border-0"
                                onClick={() => handleDownloadPdf(invoice)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Baixar PDF
                              </Button>
                            )}
                            {invoice.xml_url && (
                              <Button 
                                variant="outline" 
                                className="bg-transparent border-white/10 text-white hover:bg-white/5"
                                onClick={() => handleDownloadXml(invoice)}
                              >
                                <Download className="w-4 h-4 mr-2" />
                                Baixar XML
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>
    </div>
  );
}
