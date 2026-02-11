import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoicesService, companiesService, notificationsService, assistantService, settingsService, subscriptionsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Sparkles, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import ChatMessage from "@/components/chat/ChatMessage";
import InvoicePreview from "@/components/chat/InvoicePreview";
import RecentFiles from "@/components/chat/RecentFiles";
import VoiceButton from "@/components/ui/VoiceButton";
import PaymentConfirmationModal from "@/components/chat/PaymentConfirmationModal";

export default function Assistant() {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState([]);
  const [pendingInvoice, setPendingInvoice] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesService.list({ limit: 10, sort: '-created_at' }),
  });

  // Get plan limits
  const { data: planLimits } = useQuery({
    queryKey: ['plan-limits'],
    queryFn: () => subscriptionsService.getLimits(),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  // Get user settings to find active company
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  // Get active company
  const { data: activeCompany } = useQuery({
    queryKey: ['company', settings?.active_company_id || 'default'],
    queryFn: async () => {
      const companies = await companiesService.list();
      if (settings?.active_company_id) {
        const company = companies.find(c => c.id === settings.active_company_id);
        if (company) return company;
      }
      return companies[0] || null;
    },
    enabled: !!settings,
  });

  // Default welcome message
  const welcomeMessage = {
    id: 1,
    isAI: true,
    content: "Olá! Sou seu assistente fiscal inteligente. Posso ajudá-lo a emitir notas fiscais, consultar documentos e gerenciar sua empresa.\n\nExemplos do que posso fazer:\n• \"Emitir nota de R$ 2.000 para Maria Silva\"\n• \"Qual meu faturamento este mês?\"\n• \"Listar minhas últimas notas fiscais\"",
    time: "Agora"
  };

  // Load conversation history on mount
  const { data: conversationHistory, isLoading: historyLoading, isError: historyError } = useQuery({
    queryKey: ['conversation-history'],
    queryFn: () => assistantService.getHistory(50),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: true,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    retry: 1
  });

  // Handle conversation history loading
  useEffect(() => {
    if (historyLoading) {
      return;
    }

    setIsLoadingHistory(false);

    if (historyError || !conversationHistory || conversationHistory.length === 0) {
      // Show welcome message on error or empty history
      setMessages([welcomeMessage]);
      return;
    }

    // Convert database format to frontend format
    const formattedMessages = conversationHistory.map(msg => ({
      id: msg.id || Date.now() + Math.random(),
      isAI: msg.role === 'assistant',
      content: msg.content,
      time: msg.createdAt 
        ? new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    }));
    setMessages(formattedMessages);
  }, [conversationHistory, historyLoading, historyError]);

  const createInvoiceMutation = useMutation({
    mutationFn: (data) => invoicesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    }
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const processMessage = async (text) => {
    const userMessage = {
      id: Date.now(),
      isAI: false,
      content: text,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMessage]);
    setIsProcessing(true);

    try {
      // Prepare conversation history for API (last 10 messages to avoid token limits)
      const recentMessages = messages.slice(-10).map(msg => ({
        role: msg.isAI ? 'assistant' : 'user',
        content: msg.content
      }));

      const data = await assistantService.processCommand({
        message: text,
        conversationHistory: recentMessages
      });

      // Try to parse JSON from response if it's a string
      let parsedData = data;
      let action = null;
      let explanation = null;

      // Check if response contains JSON (could be in explanation, message, or data fields)
      const responseText = data.explanation || data.message || data.data?.explanation || JSON.stringify(data);
      
      // Try to extract JSON from markdown code blocks
      const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || responseText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[1]);
          action = parsedData.action;
          explanation = parsedData.explanation;
        } catch (e) {
          // If JSON parsing fails, continue with original data
        }
      }

      // Also check if data itself has action structure
      if (!action) {
        action = data.action || data.data?.action || parsedData?.action;
      }

      // Get explanation - prefer parsed, then original
      explanation = explanation || parsedData?.explanation || data.explanation || data.message || data.data?.explanation || "Desculpe, não consegui processar sua mensagem.";

      // Only show explanation if it's not just JSON
      if (explanation && !explanation.trim().startsWith('{') && !explanation.trim().startsWith('```json')) {
        const aiResponse = {
          id: Date.now() + 1,
          isAI: true,
          content: explanation,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponse]);
      }

      // Keep conversation-history query in sync so refresh shows saved messages
      queryClient.invalidateQueries({ queryKey: ['conversation-history'] });

      // Handle invoice emission action - extract from action or parsed JSON
      if (action?.type === 'emitir_nfse' && action?.data) {
        const invoiceData = action.data;
        const newInvoice = {
          cliente_nome: invoiceData.cliente_nome,
          cliente_documento: invoiceData.cliente_documento || '',
          descricao_servico: invoiceData.descricao_servico || 'Serviço prestado',
          valor: parseFloat(invoiceData.valor) || 0,
          aliquota_iss: parseFloat(invoiceData.aliquota_iss) || 5,
          valor_iss: (parseFloat(invoiceData.valor) || 0) * (parseFloat(invoiceData.aliquota_iss) || 5) / 100,
          status: "pendente_confirmacao",
          municipio: invoiceData.municipio || ""
        };
        setPendingInvoice(newInvoice);
      } else if (parsedData?.action?.type === 'emitir_nfse' && parsedData?.action?.data) {
        // Fallback: check parsed data directly
        const invoiceData = parsedData.action.data;
        const newInvoice = {
          cliente_nome: invoiceData.cliente_nome,
          cliente_documento: invoiceData.cliente_documento || '',
          descricao_servico: invoiceData.descricao_servico || 'Serviço prestado',
          valor: parseFloat(invoiceData.valor) || 0,
          aliquota_iss: parseFloat(invoiceData.aliquota_iss) || 5,
          valor_iss: (parseFloat(invoiceData.valor) || 0) * (parseFloat(invoiceData.aliquota_iss) || 5) / 100,
          status: "pendente_confirmacao",
          municipio: invoiceData.municipio || ""
        };
        setPendingInvoice(newInvoice);
      }
    } catch (error) {
      console.error('Error processing message:', error);
      const errorResponse = {
        id: Date.now() + 1,
        isAI: true,
        content: "Desculpe, ocorreu um erro ao processar sua mensagem. Verifique se o servidor está conectado e tente novamente.",
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorResponse]);
    }
    
    setIsProcessing(false);
  };

  const handleSend = () => {
    if (!inputValue.trim() || isProcessing) return;
    processMessage(inputValue.trim());
    setInputValue("");
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleVoiceInput = (text) => {
    // Put transcribed text in the input box so user can review before sending
    setInputValue(text);
  };

  const handleConfirmInvoice = async () => {
    if (!pendingInvoice) return;
    
    // Check plan limits before confirming
    if (planLimits) {
      const { invoiceLimit } = planLimits;
      
      // For Pay Per Use plan, show payment modal instead of blocking
      if (planLimits.planId === 'pay_per_use' || planLimits.planName?.toLowerCase().includes('pay per use')) {
        setShowPaymentModal(true);
        return;
      }
      
      if (!invoiceLimit.allowed) {
        toast.error("Limite de notas fiscais atingido", {
          description: `Seu plano ${planLimits.planName} permite até ${invoiceLimit.max} ${invoiceLimit.max === 1 ? 'nota fiscal' : 'notas fiscais'} por mês. Faça upgrade para emitir mais notas.`,
          duration: 5000,
          action: {
            label: "Ver Planos",
            onClick: () => navigate(createPageUrl("Pricing"))
          }
        });
        return;
      }
    }
    
    setIsProcessing(true);
    
    // Use active company from query
    const company = activeCompany;
    
    try {
      if (!company) {
        throw new Error('Empresa não configurada. Por favor, selecione uma empresa no menu lateral.');
      }

      // Execute AI action via new endpoint (emits via real Nuvem Fiscal API)
      const result = await assistantService.executeAction({
        action_type: 'emitir_nfse',
        action_data: {
          cliente_nome: pendingInvoice.cliente_nome,
          cliente_documento: pendingInvoice.cliente_documento || '',
          descricao_servico: pendingInvoice.descricao_servico || 'Serviço prestado',
          valor: pendingInvoice.valor,
          aliquota_iss: pendingInvoice.aliquota_iss || 5,
          municipio: pendingInvoice.municipio || company.cidade,
          codigo_servico: '1401',
          data_prestacao: new Date().toISOString().split('T')[0]
        },
        company_id: company.id
      });

      if (result.status === 'success' && result.data?.invoice) {
        const notaFiscal = result.data.invoice;

        // Create success notification
        await notificationsService.create({
          titulo: "Nota fiscal emitida via IA",
          mensagem: `NFS-e #${notaFiscal?.numero || '---'} emitida com sucesso pela prefeitura. Valor: R$ ${pendingInvoice.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          tipo: "sucesso",
          invoice_id: notaFiscal?.id
        });

        const aiResponse = {
          id: Date.now(),
          isAI: true,
          content: `✅ Nota fiscal ${notaFiscal?.status === 'autorizada' ? 'autorizada' : 'emitida'} com sucesso via IA!\n\n📄 Número: ${notaFiscal?.numero || '---'}\n👤 Cliente: ${pendingInvoice.cliente_nome}\n💰 Valor: R$ ${pendingInvoice.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n${notaFiscal?.codigo_verificacao ? `🔐 Código de Verificação: ${notaFiscal.codigo_verificacao}\n` : ''}\n✨ A nota foi enviada para a prefeitura através da Nuvem Fiscal. ${notaFiscal?.pdf_url ? 'O PDF e XML estão disponíveis na seção "Notas Fiscais".' : ''}`,
          time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        };
        setMessages(prev => [...prev, aiResponse]);
        setPendingInvoice(null);
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      } else {
        throw new Error(result.message || 'Erro ao emitir nota fiscal');
      }
    } catch (error) {
      // Check if it's a payment-related error (402 status)
      const errorStatus = error.response?.status || error.status;
      const errorCode = error.response?.data?.code || error.code;
      
      if (errorStatus === 402 || errorCode === 'PAYMENT_METHOD_REQUIRED' || errorCode === 'PAYMENT_FAILED') {
        // Show payment modal for Pay Per Use users
        setShowPaymentModal(true);
        setIsProcessing(false);
        return;
      }
      
      // Translate error using error translation service
      const { handleError } = await import('@/services/errorTranslationService');
      const translation = await handleError(error, { 
        operation: 'emit_invoice',
        companyId: company?.id 
      });
      
      // Create error notification with translated message
      await notificationsService.create({
        titulo: translation.message,
        mensagem: `${translation.explanation}\n\n${translation.action}`,
        tipo: "erro"
      });

      // Use translated error for AI explanation
      let aiExplanation = `❌ ${translation.message}\n\n${translation.explanation}\n\n${translation.action}`;
      
      try {
        const errorExplainPrompt = `Explique de forma clara e em português brasileiro o seguinte erro de emissão de nota fiscal:\n\n"${translation.message}"\n\nForneça:\n1. Uma explicação simples do problema\n2. Possíveis causas\n3. Passos para resolver\n\nSeja conciso e direto, em no máximo 3-4 linhas.`;
        
        const explainResponse = await assistantService.processCommand({
          message: errorExplainPrompt,
          companyId: company?.id
        });
        
        if (explainResponse.explanation) {
          aiExplanation = `❌ Erro na emissão:\n\n${explainResponse.explanation}`;
        }
      } catch (explainError) {
        console.error('Error getting AI explanation:', explainError);
        // Use the original error message
      }

      const errorResponse = {
        id: Date.now(),
        isAI: true,
        content: aiExplanation,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorResponse]);
    }
    
    setIsProcessing(false);
  };

  // Handle successful payment from PaymentConfirmationModal
  const handlePaymentSuccess = async (result) => {
    setShowPaymentModal(false);
    
    if (result.status === 'success' && result.data?.invoice) {
      const notaFiscal = result.data.invoice;

      // Create success notification
      await notificationsService.create({
        titulo: "Nota fiscal emitida via IA",
        mensagem: `NFS-e #${notaFiscal?.numero || '---'} emitida com sucesso. Valor: R$ ${pendingInvoice.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        tipo: "sucesso",
        invoice_id: notaFiscal?.id
      });

      const aiResponse = {
        id: Date.now(),
        isAI: true,
        content: `✅ Pagamento confirmado e nota fiscal ${notaFiscal?.status === 'autorizada' ? 'autorizada' : 'emitida'} com sucesso!\n\n💳 Taxa de emissão: R$ 9,00\n📄 Número: ${notaFiscal?.numero || '---'}\n👤 Cliente: ${pendingInvoice.cliente_nome}\n💰 Valor: R$ ${pendingInvoice.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n${notaFiscal?.codigo_verificacao ? `🔐 Código de Verificação: ${notaFiscal.codigo_verificacao}\n` : ''}\n✨ A nota foi enviada para a prefeitura através da Nuvem Fiscal.`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, aiResponse]);
      setPendingInvoice(null);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['plan-limits'] });
    }
  };

  const handlePaymentCancel = () => {
    setShowPaymentModal(false);
    const aiResponse = {
      id: Date.now(),
      isAI: true,
      content: "Ok, o pagamento foi cancelado. A nota fiscal não foi emitida.\n\nQuando estiver pronto, clique em \"Confirmar\" novamente para processar o pagamento e emitir a nota.",
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, aiResponse]);
  };

  const handleEditInvoice = () => {
    // This is called when user clicks edit - now handled internally by InvoicePreview
    // Keep pendingInvoice to allow inline editing
  };

  const handleUpdateInvoice = (updatedInvoice) => {
    // Called when user saves edits in the InvoicePreview component
    setPendingInvoice(updatedInvoice);
    
    const aiResponse = {
      id: Date.now(),
      isAI: true,
      content: `✏️ Dados atualizados!\n\n👤 Cliente: ${updatedInvoice.cliente_nome}\n💰 Valor: R$ ${updatedInvoice.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n📝 Serviço: ${updatedInvoice.descricao_servico || 'Serviço prestado'}\n\nConfira a prévia atualizada e confirme a emissão quando estiver correto.`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, aiResponse]);
  };

  const handleCancelInvoice = () => {
    setPendingInvoice(null);
    const aiResponse = {
      id: Date.now(),
      isAI: true,
      content: "Ok, a pré-visualização da nota fiscal foi cancelada. Como posso ajudar agora?",
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, aiResponse]);
  };

  const handleClearHistory = async () => {
    if (!confirm('Tem certeza que deseja limpar o histórico de conversa?')) {
      return;
    }

    try {
      await assistantService.clearHistory();
      queryClient.invalidateQueries({ queryKey: ['conversation-history'] });
      
      // Reset to welcome message
      setMessages([{
        id: 1,
        isAI: true,
        content: "Olá! Sou seu assistente fiscal inteligente. Posso ajudá-lo a emitir notas fiscais, consultar documentos e gerenciar sua empresa.\n\nExemplos do que posso fazer:\n• \"Emitir nota de R$ 2.000 para Maria Silva\"\n• \"Qual meu faturamento este mês?\"\n• \"Listar minhas últimas notas fiscais\"",
        time: "Agora"
      }]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Main Chat Area */}
      <div className={cn(
        "flex-1 flex flex-col overflow-hidden",
        "relative rounded-3xl",
        "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
        "backdrop-blur-xl border border-white/10",
        "shadow-2xl shadow-black/50",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
      )}>
        {/* Header */}
        <div className={cn(
          "px-6 py-5 border-b border-white/10",
          "flex items-center gap-4",
          "bg-gradient-to-r from-white/5 via-transparent to-transparent",
          "backdrop-blur-sm relative z-10"
        )}>
          <div className={cn(
            "w-12 h-12 rounded-xl",
            "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
            "flex items-center justify-center",
            "shadow-lg shadow-orange-500/30",
            "border border-orange-400/30"
          )}>
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-0.5">Assistente Fiscal IA</h2>
            <p className="text-xs text-gray-400 font-medium">Pronto para ajudar</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearHistory}
              className={cn(
                "text-gray-400 hover:text-white",
                "hover:bg-gradient-to-r hover:from-white/10 hover:to-white/5",
                "border border-transparent hover:border-white/10",
                "rounded-xl px-4 py-2",
                "transition-all duration-200",
                "shadow-sm hover:shadow-md"
              )}
              title="Limpar histórico"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Limpar
            </Button>
            <div className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full",
              "bg-gradient-to-r from-green-500/20 to-emerald-500/10",
              "border border-green-500/30",
              "backdrop-blur-sm shadow-md shadow-green-500/20"
            )}>
              <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50"></span>
              <span className="text-xs text-green-300 font-semibold">Online</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className={cn(
                "w-16 h-16 rounded-2xl",
                "bg-gradient-to-br from-orange-500/20 to-orange-600/10",
                "border border-orange-500/30",
                "flex items-center justify-center",
                "shadow-xl shadow-orange-500/20"
              )}>
                <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
              </div>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((message) => (
                <ChatMessage key={message.id} message={message} isAI={message.isAI} />
              ))}
            </AnimatePresence>
          )}

          {/* Pending Invoice Preview */}
          {pendingInvoice && (
            <InvoicePreview
              invoice={pendingInvoice}
              onConfirm={handleConfirmInvoice}
              onEdit={handleEditInvoice}
              onUpdate={handleUpdateInvoice}
              onCancel={handleCancelInvoice}
              isProcessing={isProcessing}
            />
          )}

          {/* Processing Indicator */}
          {isProcessing && !pendingInvoice && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-4"
            >
              <div className={cn(
                "w-12 h-12 rounded-xl",
                "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
                "flex items-center justify-center",
                "shadow-lg shadow-orange-500/30",
                "border border-orange-400/30"
              )}>
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              </div>
              <div className={cn(
                "rounded-2xl px-6 py-4",
                "bg-gradient-to-br from-slate-800/80 via-slate-700/60 to-slate-800/80",
                "backdrop-blur-xl border border-white/10",
                "shadow-xl shadow-black/30"
              )}>
                <div className="flex gap-2">
                  <span className={cn(
                    "w-3 h-3 rounded-full",
                    "bg-gradient-to-br from-orange-400 to-orange-500",
                    "animate-bounce shadow-md shadow-orange-400/50"
                  )} style={{ animationDelay: '0ms' }}></span>
                  <span className={cn(
                    "w-3 h-3 rounded-full",
                    "bg-gradient-to-br from-orange-400 to-orange-500",
                    "animate-bounce shadow-md shadow-orange-400/50"
                  )} style={{ animationDelay: '150ms' }}></span>
                  <span className={cn(
                    "w-3 h-3 rounded-full",
                    "bg-gradient-to-br from-orange-400 to-orange-500",
                    "animate-bounce shadow-md shadow-orange-400/50"
                  )} style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            </motion.div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={cn(
          "p-5 border-t border-white/10",
          "bg-gradient-to-r from-white/5 via-transparent to-transparent",
          "backdrop-blur-sm relative z-10"
        )}>
          <div className="flex items-end gap-3">
            <VoiceButton onVoiceInput={handleVoiceInput} disabled={isProcessing} />
            <div className="flex-1 relative">
              <Textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem ou use o microfone..."
                className={cn(
                  "min-h-[56px] max-h-32 resize-none pr-14",
                  "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                  "backdrop-blur-xl border border-white/10",
                  "text-white placeholder:text-gray-400",
                  "rounded-2xl",
                  "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                  "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                  "focus:bg-gradient-to-br focus:from-slate-800/95 focus:via-slate-700/85 focus:to-slate-800/95",
                  "transition-all duration-200",
                  "shadow-lg shadow-black/20"
                )}
                style={{
                  color: '#ffffff',
                  backgroundColor: 'transparent'
                }}
                disabled={isProcessing}
              />
              <Button
                onClick={handleSend}
                disabled={!inputValue.trim() || isProcessing}
                size="icon"
                className={cn(
                  "absolute right-2 bottom-2 w-11 h-11",
                  "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
                  "hover:from-orange-600 hover:via-orange-500 hover:to-orange-600",
                  "rounded-xl disabled:opacity-50",
                  "shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40",
                  "border border-orange-400/30",
                  "transition-all duration-200"
                )}
              >
                <Send className="w-5 h-5 text-white" />
              </Button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 text-center font-medium">
            Dica: Diga "Emitir nota de R$ [valor] para [cliente]" para criar uma nota fiscal rapidamente
          </p>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 hidden xl:flex flex-col gap-6">
        {/* Quick Actions */}
        <div className={cn(
          "relative rounded-2xl p-6 overflow-hidden",
          "bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80",
          "backdrop-blur-xl border border-white/10",
          "shadow-2xl shadow-black/50",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
        )}>
          <h3 className={cn(
            "text-sm font-bold text-gray-300 mb-5 uppercase tracking-wider relative z-10"
          )}>Ações Rápidas</h3>
          <div className="space-y-3 relative z-10">
            {[
              { label: "Nova nota fiscal", action: "Emitir nova nota fiscal" },
              { label: "Consultar faturamento", action: "Qual meu faturamento?" },
              { label: "Ver impostos", action: "Mostrar impostos do mês" },
            ].map((item, index) => (
              <button
                key={index}
                onClick={() => processMessage(item.action)}
                disabled={isProcessing}
                className={cn(
                  "w-full text-left px-5 py-3.5 rounded-xl",
                  "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                  "border border-white/10",
                  "text-gray-200 text-sm font-medium",
                  "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
                  "hover:border-orange-500/30 hover:text-white",
                  "transition-all duration-200",
                  "shadow-md hover:shadow-lg hover:shadow-orange-500/10",
                  "backdrop-blur-sm",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recent Files */}
        <RecentFiles invoices={invoices} />
      </div>

      {/* Payment Confirmation Modal for Pay Per Use */}
      <PaymentConfirmationModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        invoice={pendingInvoice}
        company={activeCompany}
        onSuccess={handlePaymentSuccess}
        onCancel={handlePaymentCancel}
      />
    </div>
  );
}
