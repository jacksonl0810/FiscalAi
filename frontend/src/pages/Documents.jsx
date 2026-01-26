import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invoicesService, notificationsService, companiesService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { handleApiError } from "@/utils/errorHandler";
import { cn } from "@/lib/utils";
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
  TrendingUp,
  FileX,
  Building2,
  User,
  X
} from "lucide-react";
import CancellationModal from "@/components/invoice/CancellationModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

const statusConfig = {
  processando: { label: "Processando", icon: Clock, color: "text-yellow-400", bg: "bg-yellow-500/20" },
  autorizada: { label: "Autorizada", icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/20" },
  rejeitada: { label: "Rejeitada", icon: XCircle, color: "text-red-400", bg: "bg-red-500/20" },
};

function normalizeStatus(status) {
  if (status === 'autorizada') return 'autorizada';
  if (status === 'rejeitada') return 'rejeitada';
  return 'processando';
}

export default function Documents() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cancellationInvoice, setCancellationInvoice] = useState(null);
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.list(),
  });

  const filterParams = useMemo(() => {
    const params = { sort: '-created_at' };
    if (statusFilter !== "all") {
      params.status = statusFilter;
    }
    if (companyFilter !== "all") {
      params.companyId = companyFilter;
    }
    if (clientFilter) {
      params.cliente_nome = clientFilter;
    }
    if (startDate) {
      params.startDate = startDate;
    }
    if (endDate) {
      params.endDate = endDate;
    }
    return params;
  }, [statusFilter, companyFilter, clientFilter, startDate, endDate]);

  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['invoices', filterParams],
    queryFn: () => invoicesService.list(filterParams),
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
      await handleApiError(error, { operation: 'refresh_invoice_status', invoiceId: invoice.id });
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
      await handleApiError(error, { operation: 'download_pdf', invoiceId: invoice.id });
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
      await handleApiError(error, { operation: 'download_xml', invoiceId: invoice.id });
    }
  };

  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      const matchesSearch = 
        invoice.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        invoice.numero?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [invoices, searchTerm]);

  const clearFilters = () => {
    setStatusFilter("all");
    setCompanyFilter("all");
    setClientFilter("");
    setStartDate("");
    setEndDate("");
    setSearchTerm("");
  };

  const hasActiveFilters = statusFilter !== "all" || companyFilter !== "all" || clientFilter || startDate || endDate;

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
        className="space-y-4"
      >
        {/* Main Search and Quick Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 group">
            <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-transparent rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-orange-400 transition-colors z-10" />
            <Input
              placeholder="Buscar por cliente ou número da nota..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "relative pl-12 h-12 rounded-xl",
                "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                "backdrop-blur-xl",
                "border border-white/10",
                "text-white placeholder:text-gray-400",
                "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 focus:bg-gradient-to-br focus:from-slate-800/95 focus:via-slate-700/85 focus:to-slate-800/95",
                "transition-all duration-200",
                "shadow-lg shadow-black/20",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:to-transparent before:pointer-events-none before:rounded-xl"
              )}
              style={{
                color: '#ffffff',
                backgroundColor: 'transparent'
              }}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="bg-gradient-to-br from-white/5 via-white/3 to-white/5 border-white/10 text-white hover:bg-white/10 hover:border-orange-500/30 h-12 rounded-xl backdrop-blur-sm transition-all duration-200 shadow-lg shadow-black/20">
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
          <Button
            variant="outline"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="bg-gradient-to-br from-white/5 via-white/3 to-white/5 border-white/10 text-white hover:bg-white/10 hover:border-orange-500/30 h-12 rounded-xl backdrop-blur-sm transition-all duration-200 shadow-lg shadow-black/20"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros Avançados
            {hasActiveFilters && (
              <span className="ml-2 px-2.5 py-1 bg-gradient-to-r from-orange-500/30 to-orange-600/20 text-orange-300 rounded-full text-xs font-semibold border border-orange-500/30 shadow-lg shadow-orange-500/20">
                Ativo
              </span>
            )}
          </Button>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              onClick={clearFilters}
              className="text-gray-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/30 border border-transparent h-12 rounded-xl transition-all duration-200"
            >
              <X className="w-4 h-4 mr-2" />
              Limpar
            </Button>
          )}
        </div>

        {/* Advanced Filters */}
        <AnimatePresence>
          {showAdvancedFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="relative rounded-2xl p-6 overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Company Filter */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 font-semibold">
                    <Building2 className="w-3.5 h-3.5 text-orange-400/70" />
                    Empresa
                  </label>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="w-full justify-between bg-gradient-to-br from-white/5 via-white/3 to-white/5 border-white/10 text-white hover:bg-white/10 hover:border-orange-500/30 h-10 rounded-xl backdrop-blur-sm transition-all duration-200 shadow-md shadow-black/10">
                        {companyFilter === "all" 
                          ? "Todas as empresas" 
                          : companies.find(c => c.id === companyFilter)?.nomeFantasia || companies.find(c => c.id === companyFilter)?.razaoSocial || "Empresa"}
                        <ChevronDown className="w-4 h-4 opacity-70" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="bg-[#1a1a2e] border-white/10 max-h-60 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setCompanyFilter("all")} className="text-white hover:bg-white/10">
                        Todas as empresas
                      </DropdownMenuItem>
                      {companies.map((company) => (
                        <DropdownMenuItem 
                          key={company.id}
                          onClick={() => setCompanyFilter(company.id)}
                          className="text-white hover:bg-white/10"
                        >
                          {company.nomeFantasia || company.razaoSocial}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Client Filter */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 font-semibold">
                    <User className="w-3.5 h-3.5 text-orange-400/70" />
                    Cliente
                  </label>
                  <Input
                    placeholder="Filtrar por cliente..."
                    value={clientFilter}
                    onChange={(e) => setClientFilter(e.target.value)}
                    className={cn(
                      "h-10 rounded-xl",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl",
                      "border border-white/10",
                      "text-white placeholder:text-gray-400",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 focus:bg-gradient-to-br focus:from-slate-800/95 focus:via-slate-700/85 focus:to-slate-800/95",
                      "transition-all duration-200",
                      "shadow-md shadow-black/10"
                    )}
                    style={{
                      color: '#ffffff',
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>

                {/* Start Date */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-orange-400/70" />
                    Data Inicial
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 rounded-xl backdrop-blur-sm",
                          "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                          "border-white/10 hover:border-orange-500/30",
                          "text-white hover:text-white",
                          "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                          "transition-all duration-200 shadow-md shadow-black/10",
                          !startDate && "text-gray-500"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {startDate ? (
                          format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span className="text-gray-500">Selecione a data</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 bg-transparent border-0 shadow-none"
                      align="start"
                    >
                      <CalendarComponent
                        mode="single"
                        selected={startDate ? new Date(startDate + "T00:00:00") : undefined}
                        onSelect={(date) => {
                          if (date) {
                            // Fix timezone issue: create date at local midnight
                            const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            setStartDate(format(localDate, "yyyy-MM-dd"));
                            if (endDate) {
                              const endDateObj = new Date(endDate + "T00:00:00");
                              if (localDate > endDateObj) {
                                setEndDate("");
                              }
                            }
                          } else {
                            setStartDate("");
                          }
                        }}
                        locale={ptBR}
                        className="rounded-2xl"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End Date */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 uppercase tracking-wider flex items-center gap-2 font-semibold">
                    <Calendar className="w-3.5 h-3.5 text-orange-400/70" />
                    Data Final
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        type="button"
                        className={cn(
                          "w-full justify-start text-left font-normal h-10 rounded-xl backdrop-blur-sm",
                          "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                          "border-white/10 hover:border-orange-500/30",
                          "text-white hover:text-white",
                          "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                          "transition-all duration-200 shadow-md shadow-black/10",
                          !endDate && "text-gray-500",
                          !startDate && "opacity-60"
                        )}
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {endDate ? (
                          format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR })
                        ) : (
                          <span className="text-gray-500">
                            {!startDate ? "Selecione a data inicial primeiro" : "Selecione a data"}
                          </span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent 
                      className="w-auto p-0 bg-transparent border-0 shadow-none"
                      align="start"
                    >
                      <CalendarComponent
                        mode="single"
                        selected={endDate ? new Date(endDate + "T00:00:00") : undefined}
                        onSelect={(date) => {
                          if (date) {
                            // Fix timezone issue: create date at local midnight
                            const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                            setEndDate(format(localDate, "yyyy-MM-dd"));
                          } else {
                            setEndDate("");
                          }
                        }}
                        disabled={(date) => {
                          if (!startDate) {
                            return true; // Disable all dates if no start date
                          }
                          // Fix timezone issue: compare dates at local midnight
                          const start = new Date(startDate + "T00:00:00");
                          const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                          return checkDate < start;
                        }}
                        locale={ptBR}
                        className="rounded-2xl"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {[
          { label: "Total", value: invoices.length, color: "text-white", bg: "from-blue-500/20 to-cyan-500/10", border: "border-blue-500/30" },
          { label: "Processando", value: invoices.filter(i => normalizeStatus(i.status) === "processando").length, color: "text-yellow-400", bg: "from-yellow-500/20 to-amber-500/10", border: "border-yellow-500/30" },
          { label: "Autorizadas", value: invoices.filter(i => normalizeStatus(i.status) === "autorizada").length, color: "text-green-400", bg: "from-green-500/20 to-emerald-500/10", border: "border-green-500/30" },
          { label: "Rejeitadas", value: invoices.filter(i => normalizeStatus(i.status) === "rejeitada").length, color: "text-red-400", bg: "from-red-500/20 to-rose-500/10", border: "border-red-500/30" },
        ].map((stat) => (
          <div 
            key={stat.label} 
            className={cn(
              "relative rounded-2xl p-5 overflow-hidden",
              "bg-gradient-to-br", stat.bg,
              "border", stat.border,
              "backdrop-blur-xl shadow-xl shadow-black/30",
              "before:absolute before:inset-0 before:bg-gradient-to-br before:from-white/5 before:to-transparent before:pointer-events-none",
              "hover:scale-105 transition-transform duration-300"
            )}
          >
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 font-semibold">{stat.label}</p>
            <p className={`text-3xl font-bold ${stat.color} relative z-10`}>{stat.value}</p>
          </div>
        ))}
      </motion.div>

      {/* Invoice List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
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
                const normalizedStatus = normalizeStatus(invoice.status);
                const status = statusConfig[normalizedStatus] || statusConfig.processando;
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
                        {normalizeStatus(invoice.status) === 'autorizada' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCancellationInvoice(invoice);
                            }}
                            title="Cancelar nota fiscal"
                          >
                            <FileX className="w-4 h-4" />
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
                            {normalizeStatus(invoice.status) === 'autorizada' && (
                              <Button 
                                variant="outline" 
                                className="bg-transparent border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                                onClick={() => setCancellationInvoice(invoice)}
                              >
                                <FileX className="w-4 h-4 mr-2" />
                                Cancelar Nota
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

      {/* Cancellation Modal */}
      <CancellationModal
        invoice={cancellationInvoice}
        isOpen={!!cancellationInvoice}
        onClose={() => setCancellationInvoice(null)}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['invoices'] });
          setCancellationInvoice(null);
        }}
      />
    </div>
  );
}
