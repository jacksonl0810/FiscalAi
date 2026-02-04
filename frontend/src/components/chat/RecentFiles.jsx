import React from "react";
import { Link } from "react-router-dom";
import { FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";
import { invoicesService } from "@/api/services";
import { handleApiError } from "@/utils/errorHandler";

export default function RecentFiles({ invoices }) {
  if (!invoices || invoices.length === 0) {
    return null;
  }

  const recentInvoices = invoices.slice(0, 3);
  const documentsUrl = createPageUrl("Documents");

  const handleDownloadPdf = async (e, invoice) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const blob = await invoicesService.downloadPdf(invoice.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `nfse-${invoice.numero || invoice.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      await handleApiError(error, { operation: "download_pdf", invoiceId: invoice.id });
    }
  };

  return (
    <div className={cn(
      "relative rounded-2xl p-6 overflow-hidden",
      "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
      "backdrop-blur-xl border border-white/10",
      "shadow-2xl shadow-black/50",
      "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
    )}>
      <h3 className={cn(
        "text-sm font-bold text-gray-300 mb-5 uppercase tracking-wider relative z-10"
      )}>Arquivos Recentes</h3>
      <div className="space-y-3 relative z-10">
        {recentInvoices.map((invoice) => (
          <Link
            key={invoice.id}
            to={`${documentsUrl}?invoiceId=${invoice.id}`}
            className={cn(
              "flex items-center gap-3 p-4 rounded-xl",
              "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
              "border border-white/10",
              "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
              "hover:border-orange-500/30",
              "transition-all duration-200",
              "shadow-md hover:shadow-lg hover:shadow-orange-500/10",
              "backdrop-blur-sm",
              "group",
              "block no-underline"
            )}
          >
            <div className={cn(
              "w-12 h-12 rounded-xl",
              "bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-orange-500/30",
              "border border-orange-500/30",
              "flex items-center justify-center",
              "shadow-md shadow-orange-500/20",
              "group-hover:shadow-lg group-hover:shadow-orange-500/30",
              "transition-all duration-200"
            )}>
              <FileText className="w-6 h-6 text-orange-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate mb-1">
                NFS-e #{invoice.numero || '---'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {invoice.cliente_nome} • {invoice.data_emissao ? format(new Date(invoice.data_emissao), "dd MMM yyyy", { locale: ptBR }) : '---'}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "w-9 h-9 rounded-lg",
                  "text-gray-400 hover:text-white",
                  "hover:bg-gradient-to-br hover:from-white/10 hover:to-white/5",
                  "border border-transparent hover:border-white/10",
                  "transition-all duration-200"
                )}
                onClick={(e) => handleDownloadPdf(e, invoice)}
                title="Baixar PDF"
              >
                <Download className="w-4 h-4" />
              </Button>
              <span
                className={cn(
                  "inline-flex items-center justify-center w-9 h-9 rounded-lg",
                  "text-gray-400 group-hover:text-white",
                  "border border-transparent hover:border-white/10"
                )}
                title="Ver nota fiscal"
              >
                <ExternalLink className="w-4 h-4" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}