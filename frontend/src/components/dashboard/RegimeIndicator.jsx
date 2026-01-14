import React from "react";
import { motion } from "framer-motion";
import { Building2, AlertTriangle, Info, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { companiesService } from "@/api/services";

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
    queryKey: ['company', companyId],
    queryFn: () => companiesService.get(companyId),
    enabled: !!companyId
  });

  const { data: regimeRecommendation } = useQuery({
    queryKey: ['regimeRecommendation', companyId],
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
      className={`glass-card rounded-2xl p-4 border ${colorClasses[config.color]}`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${colorClasses[config.color]} flex items-center justify-center flex-shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold">{config.name}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full ${colorClasses[config.color]}`}>
              {company.regime_tributario}
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">{config.description}</p>
          
          {/* Features */}
          <div className="flex flex-wrap gap-2 mb-2">
            {config.features.map((feature, index) => (
              <span
                key={index}
                className="text-xs px-2 py-0.5 rounded bg-white/5 text-gray-300"
              >
                {feature}
              </span>
            ))}
          </div>

          {/* Regime Change Recommendation */}
          {regimeRecommendation?.recommended && (
            <div className="mt-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-yellow-400 mb-1">
                    Recomendação de Migração
                  </p>
                  <p className="text-xs text-gray-300">
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
