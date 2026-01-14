import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService, assistantService } from "@/api/services";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function FiscalStatusIndicator({ companyId }) {
  const queryClient = useQueryClient();
  const [gptExplanation, setGptExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['fiscalStatus', companyId],
    queryFn: () => companiesService.getFiscalStatus(companyId),
    enabled: !!companyId,
  });

  const verifyMutation = useMutation({
    mutationFn: () => companiesService.checkFiscalConnection(companyId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fiscalStatus'] });
      
      // If connection failed, get GPT explanation
      if (data.data?.connectionStatus === 'falha' || data.data?.status === 'falha') {
        explainError(data.data?.details || data.data?.message || data.message);
      } else {
        setGptExplanation(null);
      }
    },
    onError: (error) => {
      // Also explain errors from the mutation itself
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      explainError(errorMessage);
    }
  });

  const explainError = async (errorDetails) => {
    setIsExplaining(true);
    setGptExplanation(null);
    
    try {
      const prompt = `Explique de forma clara e em português brasileiro o seguinte erro de conexão fiscal:\n\n"${errorDetails}"\n\nForneça:\n1. Uma explicação simples do problema\n2. Possíveis causas\n3. Passos para resolver\n\nSeja conciso e direto.`;
      
      const response = await assistantService.processCommand({
        message: prompt,
        companyId: companyId
      });
      
      if (response.explanation) {
        setGptExplanation(response.explanation);
      }
    } catch (error) {
      console.error('Error getting GPT explanation:', error);
      // Fallback to showing the original error
      setGptExplanation(null);
    } finally {
      setIsExplaining(false);
    }
  };

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-400">Verificando...</span>
      </div>
    );
  }

  const statusConfig = {
    conectado: {
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20"
    },
    falha: {
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20"
    },
    verificando: {
      icon: Loader2,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20"
    }
  };

  const config = statusConfig[status.status] || statusConfig.verificando;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`p-4 rounded-xl ${config.bg} border ${config.border}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5 ${status.status === 'verificando' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>
            {status.status === 'conectado' ? '🟢 Conectado' : 
             status.status === 'falha' ? '🔴 Falha de conexão' : 
             '🟡 Verificando'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {status.mensagem || 'Verificando status da conexão com a prefeitura...'}
          </p>
          {status.ultima_verificacao && (
            <p className="text-xs text-gray-600 mt-2">
              Última verificação: {new Date(status.ultima_verificacao).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>
      <Button
        onClick={() => {
          setGptExplanation(null);
          verifyMutation.mutate();
        }}
        disabled={verifyMutation.isPending || isExplaining}
        size="sm"
        variant="outline"
        className="mt-3 w-full bg-transparent border-white/10 text-white hover:bg-white/5"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
        {verifyMutation.isPending ? 'Verificando...' : 'Verificar conexão com prefeitura'}
      </Button>

      {/* GPT Error Explanation */}
      <AnimatePresence>
        {(isExplaining || gptExplanation) && status?.status === 'falha' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20"
          >
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-blue-400 mb-1">
                  Explicação do erro:
                </p>
                {isExplaining ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                    <p className="text-xs text-gray-400">Analisando erro com IA...</p>
                  </div>
                ) : gptExplanation ? (
                  <p className="text-xs text-gray-300 whitespace-pre-wrap">
                    {gptExplanation}
                  </p>
                ) : null}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
