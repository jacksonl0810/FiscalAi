import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService, settingsService } from "@/api/services";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Building2, ChevronDown, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
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

  const handleAddNew = () => {
    navigate(createPageUrl("CompanySetup") + "?new=true");
  };

  if (companies.length === 0) {
    return (
      <Button
        onClick={handleAddNew}
        variant="outline"
        className="w-full justify-start bg-white/5 border-white/10 text-white hover:bg-white/10"
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
          className="w-full justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <span className="truncate">
              {activeCompany?.nome_fantasia || activeCompany?.razao_social || 'Selecionar'}
            </span>
          </div>
          <ChevronDown className="w-4 h-4 ml-2 flex-shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56 bg-[#1a1a2e] border-white/10">
        {companies.map((company) => (
          <DropdownMenuItem
            key={company.id}
            onClick={() => handleCompanyChange(company.id)}
            className="text-white hover:bg-white/10 cursor-pointer"
          >
            <div className="flex items-center justify-between w-full">
              <span className="truncate">
                {company.nome_fantasia || company.razao_social || 'Sem nome'}
              </span>
              {company.id === activeCompanyId && (
                <Check className="w-4 h-4 text-orange-400 ml-2" />
              )}
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={handleAddNew}
          className="text-orange-400 hover:bg-orange-500/10 cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Adicionar nova empresa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
