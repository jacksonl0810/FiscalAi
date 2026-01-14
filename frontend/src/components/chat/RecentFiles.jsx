import React from "react";
import { FileText, Download, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function RecentFiles({ invoices }) {
  if (!invoices || invoices.length === 0) {
    return null;
  }

  const recentInvoices = invoices.slice(0, 3);

  return (
    <div className="glass-card rounded-2xl p-5">
      <h3 className="text-sm font-medium text-gray-400 mb-4">Arquivos Recentes</h3>
      <div className="space-y-3">
        {recentInvoices.map((invoice) => (
          <div
            key={invoice.id}
            className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                NFS-e #{invoice.numero || '---'}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {invoice.cliente_nome} • {invoice.data_emissao ? format(new Date(invoice.data_emissao), "dd MMM yyyy", { locale: ptBR }) : '---'}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {invoice.pdf_url && (
                <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-white">
                  <Download className="w-4 h-4" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="w-8 h-8 text-gray-400 hover:text-white">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}