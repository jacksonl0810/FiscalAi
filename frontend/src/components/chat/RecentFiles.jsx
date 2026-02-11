import React from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { createPageUrl } from "@/utils";

export default function RecentFiles({ invoices }) {
  if (!invoices || invoices.length === 0) {
    return null;
  }

  const recentInvoices = invoices.slice(0, 3);
  const documentsUrl = createPageUrl("Documents");

  return (
    <div className="rounded-2xl bg-[#1a1d24] border border-white/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          Arquivos Recentes
        </h3>
      </div>
      <div className="p-2">
        {recentInvoices.map((invoice) => (
          <Link
            key={invoice.id}
            to={`${documentsUrl}?invoiceId=${invoice.id}`}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg",
              "hover:bg-white/5",
              "transition-colors duration-150",
              "group block no-underline"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-lg flex-shrink-0",
              "bg-gradient-to-br from-orange-500 to-orange-600",
              "flex items-center justify-center"
            )}>
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                NFS-e #{invoice.numero || '---'}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {invoice.clienteNome || invoice.cliente_nome || '---'} • {invoice.dataEmissao || invoice.data_emissao ? format(new Date(invoice.dataEmissao || invoice.data_emissao), "dd MMM yyyy", { locale: ptBR }) : '---'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}