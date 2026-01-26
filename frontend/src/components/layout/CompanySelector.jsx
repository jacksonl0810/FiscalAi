import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService, settingsService, subscriptionsService } from "@/api/services";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function CompanySelector({ activeCompanyId, onCompanyChange }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ['companies'],
    queryFn: () => companiesService.list(),
  });

  const { data: planLimits } = useQuery({
    queryKey: ['plan-limits'],
    queryFn: () => subscriptionsService.getLimits(),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (/** @type {string} */ companyId) => {
      return settingsService.setActiveCompany(companyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    }
  });

  const activeCompany = companies.find(c => c.id === activeCompanyId) || companies[0];

  const handleCompanyChange = async (/** @type {string} */ companyId) => {
    onCompanyChange(companyId);
    await updateSettingsMutation.mutateAsync(companyId);
  };

  const handleAddNew = async () => {
    // Check plan limits before allowing navigation
    if (planLimits) {
      const { companyLimit } = planLimits;
      
      if (!companyLimit.allowed) {
        toast.error("Limite de empresas atingido", {
          description: `Seu plano ${planLimits.planName} permite até ${companyLimit.max} ${companyLimit.max === 1 ? 'empresa' : 'empresas'}. Faça upgrade para adicionar mais empresas.`,
          duration: 5000,
          action: {
            label: "Ver Planos",
            onClick: () => navigate(createPageUrl("Pricing"))
          }
        });
        return;
      }
    }
    
    navigate(createPageUrl("CompanySetup") + "?new=true");
  };

  if (companies.length === 0) {
    return (
      <Button
        onClick={handleAddNew}
        variant="outline"
        className={cn(
          "w-full justify-start",
          "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
          "border border-white/10",
          "text-white hover:text-white",
          "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
          "hover:border-orange-500/30",
          "transition-all duration-200",
          "shadow-md hover:shadow-lg hover:shadow-orange-500/10",
          "backdrop-blur-sm"
        )}
      >
        <Plus className="w-4 h-4 mr-2" />
        Adicionar empresa
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-between",
            "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
            "border border-white/10",
            "text-white hover:text-white",
            "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
            "hover:border-orange-500/30",
            "transition-all duration-200",
            "shadow-md hover:shadow-lg hover:shadow-orange-500/10",
            "backdrop-blur-sm"
          )}
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="truncate font-medium">
              {activeCompany?.nome_fantasia || activeCompany?.razao_social || 'Selecionar'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0 text-gray-400" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(
        "w-56",
        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50"
      )}>
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleCompanyChange(company.id)}
            className={cn(
              "text-white cursor-pointer",
              "hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5",
              "hover:text-white",
              "transition-all duration-200"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="truncate font-medium">
                {company.nome_fantasia || company.razao_social || 'Sem nome'}
              </span>
              {company.id === activeCompanyId && (
                <Check className="w-4 h-4 text-orange-400 ml-2 flex-shrink-0" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleAddNew}
          className={cn(
            "text-orange-400 cursor-pointer",
            "hover:bg-gradient-to-r hover:from-orange-500/20 hover:to-orange-600/10",
            "hover:text-orange-300",
            "transition-all duration-200"
          )}
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar nova empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
