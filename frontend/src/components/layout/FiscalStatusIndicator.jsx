import React, { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { companiesService, assistantService } from "@/api/services";
import { AlertCircle, CheckCircle, Loader2, RefreshCw, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

export default function FiscalStatusIndicator({ companyId }) {
  const queryClient = useQueryClient();
  const [gptExplanation, setGptExplanation] = useState(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [rateLimitError, setRateLimitError] = useState(null);
  const lastClickRef = useRef(0);

  const { data: status, isLoading } = useQuery({
    queryKey: ['fiscalStatus', companyId || 'none'],
    queryFn: () => companiesService.getFiscalStatus(companyId),
    enabled: !!companyId,
  });

  const verifyMutation = useMutation({
    mutationFn: () => companiesService.checkFiscalConnection(companyId),
    onSuccess: (response) => {
      console.log('[FiscalStatus] Mutation success, response:', response);
      setRateLimitError(null);
      queryClient.invalidateQueries({ queryKey: ['fiscalStatus'] });
      
      const responseData = response.data || response;
      const responseStatus = responseData.status || responseData.connectionStatus;
      console.log('[FiscalStatus] Extracted status:', responseStatus);
      
      // Only explain actual failures, not 'not_connected' (which is informational)
      const failedStatuses = ['falha', 'failed', 'expired'];
      
      if (failedStatuses.includes(responseStatus)) {
        explainError(responseData.error || responseData.details || responseData.message || response.message);
      } else {
        setGptExplanation(null);
      }
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['fiscalStatus'] });
      
      const isRateLimitError = error?.status === 429 || 
                               error?.code === 'RATE_LIMIT_EXCEEDED' ||
                               error?.message?.includes('Muitas requisições');
      
      if (isRateLimitError) {
        setRateLimitError('Muitas requisições. Aguarde alguns segundos antes de tentar novamente.');
        setGptExplanation(null);
        setTimeout(() => setRateLimitError(null), 30000);
        return;
      }
      
      const errorMessage = error?.response?.data?.message || error?.message || 'Erro desconhecido';
      explainError(errorMessage);
    }
  });

  const explainError = useCallback(async (errorDetails) => {
    // Don't try to explain if we recently hit rate limits
    if (rateLimitError) return;
    
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
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.code?.includes('RATE_LIMIT')) {
        setRateLimitError('Limite de requisições atingido. Aguarde antes de tentar novamente.');
        setTimeout(() => setRateLimitError(null), 30000);
      }
      setGptExplanation(null);
    } finally {
      setIsExplaining(false);
    }
  }, [companyId, rateLimitError]);

  // Debounce click handler to prevent rapid clicks
  const handleVerifyClick = useCallback(() => {
    const now = Date.now();
    if (now - lastClickRef.current < 3000) {
      // Prevent clicking more than once every 3 seconds
      return;
    }
    lastClickRef.current = now;
    setGptExplanation(null);
    setRateLimitError(null);
    verifyMutation.mutate();
  }, [verifyMutation]);

  if (isLoading || !status) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
        <span className="text-xs text-gray-400">Carregando status...</span>
      </div>
    );
  }

  const statusConfig = {
    conectado: {
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      label: "🟢 Conectado"
    },
    connected: {
      icon: CheckCircle,
      color: "text-green-400",
      bg: "bg-green-500/10",
      border: "border-green-500/20",
      label: "🟢 Conectado"
    },
    falha: {
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "🔴 Falha de conexão"
    },
    failed: {
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "🔴 Falha de conexão"
    },
    not_connected: {
      icon: AlertCircle,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      label: "🟠 Empresa cadastrada - Falta conectar"
    },
    not_configured: {
      icon: AlertCircle,
      color: "text-gray-400",
      bg: "bg-gray-500/10",
      border: "border-gray-500/20",
      label: "⚪ Nuvem Fiscal não configurado"
    },
    expired: {
      icon: AlertCircle,
      color: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-red-500/20",
      label: "🔴 Certificado expirado"
    },
    verificando: {
      icon: Loader2,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/20",
      label: "🟡 Verificando"
    },
    rate_limited: {
      icon: Clock,
      color: "text-orange-400",
      bg: "bg-orange-500/10",
      border: "border-orange-500/20",
      label: "🟠 Limite de requisições"
    }
  };

  console.log('[FiscalStatus] Current status from query:', status);
  
  const displayStatus = verifyMutation.isPending 
    ? 'verificando' 
    : rateLimitError 
      ? 'rate_limited' 
      : status.status;
  
  console.log('[FiscalStatus] Display status:', displayStatus, 'isPending:', verifyMutation.isPending);
  
  const config = statusConfig[displayStatus] || statusConfig.verificando;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`p-4 rounded-xl ${config.bg} border ${config.border}`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 ${config.color} flex-shrink-0 mt-0.5 ${displayStatus === 'verificando' ? 'animate-spin' : ''}`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${config.color}`}>
            {config.label || '🟡 Verificando'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {verifyMutation.isPending 
              ? 'Verificando conexão com a prefeitura...'
              : rateLimitError 
                ? rateLimitError 
                : displayStatus === 'not_connected'
                  ? 'Empresa cadastrada na Nuvem Fiscal. Configure certificado digital ou credenciais municipais para conectar.'
                : status.mensagem || (displayStatus === 'not_connected' ? 'Envie o certificado e clique em Salvar.' : 'Verificando status da conexão com a prefeitura.')}
          </p>
          {status.ultima_verificacao && !verifyMutation.isPending && !rateLimitError && (
            <p className="text-xs text-gray-600 mt-2">
              Última verificação: {new Date(status.ultima_verificacao).toLocaleString('pt-BR')}
            </p>
          )}
        </div>
      </div>
      <Button
        onClick={handleVerifyClick}
        disabled={verifyMutation.isPending || isExplaining}
        size="sm"
        variant="outline"
        className="mt-3 w-full bg-transparent border-white/10 text-white hover:bg-white/5"
      >
        <RefreshCw className={`w-4 h-4 mr-2 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
        {verifyMutation.isPending ? 'Verificando...' : 'Verificar conexão com prefeitura'}
      </Button>

      {/* Rate Limit Warning */}
      <AnimatePresence>
        {rateLimitError && !verifyMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20"
          >
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-orange-400 mb-1">
                  Limite de requisições
                </p>
                <p className="text-xs text-gray-300">
                  {rateLimitError}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GPT Error Explanation - only for actual failures */}
      <AnimatePresence>
        {(isExplaining || gptExplanation) && (displayStatus === 'falha' || displayStatus === 'failed') && !rateLimitError && (
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
