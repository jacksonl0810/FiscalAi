import React from "react";
import { motion } from "framer-motion";
import { Building2, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { companiesService } from "@/api/services";
import { cn } from "@/lib/utils";

const regimeConfig = {
  'MEI': {
    name: 'Microempreendedor Individual',
    color: 'blue',
    icon: Building2,
    description: 'Regime simplificado com limite anual de R$ 81.000',
    features: ['ISS fixo 5%', 'DAS fixo ~R$ 69/mês', 'Limite anual R$ 81.000']
  },
  'Simples Nacional': {
    name: 'Simples Nacional',
    color: 'green',
    icon: CheckCircle,
    description: 'Regime simplificado com alíquotas variáveis',
    features: ['ISS variável', 'DAS mensal variável', 'Sem limite de faturamento']
  },
  'Lucro Presumido': {
    name: 'Lucro Presumido',
    color: 'orange',
    icon: Info,
    description: 'Regime com presunção de lucro',
    features: ['ISS variável', 'IRPJ, CSLL, PIS, COFINS', 'Presunção de lucro']
  },
  'Lucro Real': {
    name: 'Lucro Real',
    color: 'purple',
    icon: Building2,
    description: 'Regime com apuração de lucro real',
    features: ['ISS variável', 'IRPJ, CSLL sobre lucro real', 'Exige contabilidade']
  }
};

export default function RegimeIndicator({ companyId }) {
  const { data: company } = useQuery({
    queryKey: ['companyDetails', companyId || 'none'],
    queryFn: () => companiesService.get(companyId),
    enabled: !!companyId
  });

  const { data: regimeRecommendation } = useQuery({
    queryKey: ['regimeRecommendation', companyId || 'none'],
    queryFn: async () => {
      if (company?.regime_tributario === 'MEI') {
        const limitStatus = await companiesService.getMEILimitStatus(companyId);
        if (limitStatus?.status === 'exceeded' || limitStatus?.status === 'critical') {
          return {
            recommended: true,
            message: limitStatus.status === 'exceeded' 
              ? 'Você ultrapassou o limite anual do MEI. Considere migrar para Simples Nacional.'
              : 'Você está muito próximo do limite anual. Considere migrar para Simples Nacional.',
            suggestedRegime: 'Simples Nacional'
          };
        }
      }
      return { recommended: false };
    },
    enabled: !!companyId && company?.regime_tributario === 'MEI'
  });

  if (!company?.regime_tributario) {
    return null;
  }

  const config = regimeConfig[company.regime_tributario] || regimeConfig['MEI'];
  const Icon = config.icon;
  const colorClasses = {
    blue: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    green: 'bg-green-500/10 border-green-500/20 text-green-400',
    orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
    purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative rounded-2xl p-5 overflow-hidden",
        "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
        "backdrop-blur-xl border",
        colorClasses[config.color],
        "shadow-xl shadow-black/30",
        "before:absolute before:inset-0",
        config.color === 'blue' && "before:bg-gradient-to-br before:from-blue-500/5 before:via-transparent before:to-transparent",
        config.color === 'green' && "before:bg-gradient-to-br before:from-green-500/5 before:via-transparent before:to-transparent",
        config.color === 'orange' && "before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent",
        config.color === 'purple' && "before:bg-gradient-to-br before:from-purple-500/5 before:via-transparent before:to-transparent",
        "before:pointer-events-none"
      )}
    >
      <div className="flex items-start gap-4 relative z-10">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0",
          "backdrop-blur-sm border shadow-md",
          colorClasses[config.color]
        )}>
          <Icon className="w-6 h-6" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-white">{config.name}</h3>
            <span className={cn(
              "text-xs px-3 py-1 rounded-full font-semibold",
              "backdrop-blur-sm border shadow-sm",
              colorClasses[config.color]
            )}>
              {company.regime_tributario}
            </span>
          </div>
          <p className="text-sm text-gray-300 mb-3 leading-relaxed">{config.description}</p>
          
          {/* Features */}
          <div className="flex flex-wrap gap-2 mb-2">
            {config.features.map((feature, index) => (
              <span
                key={index}
                className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-br from-white/5 to-white/0 border border-white/10 text-gray-300 backdrop-blur-sm"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Regime Change Recommendation */}
          {regimeRecommendation?.recommended && (
            <div className={cn(
              "mt-4 p-4 rounded-xl",
              "bg-gradient-to-br from-yellow-500/20 to-amber-500/10",
              "border border-yellow-500/30",
              "backdrop-blur-sm shadow-md shadow-yellow-500/20"
            )}>
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-300 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-yellow-300 mb-1">
                    Recomendação de Migração
                  </p>
                  <p className="text-sm text-gray-200 leading-relaxed">
                    {regimeRecommendation.message}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
