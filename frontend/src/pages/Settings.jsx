import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService } from "@/api/services";
import { motion } from "framer-motion";
import {
  Palette,
  Type,
  HelpCircle,
  Check,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  const [localSettings, setLocalSettings] = useState({
    theme: 'dark',
    font_size: 'medium'
  });

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        theme: settings.theme || 'dark',
        font_size: settings.font_size || 'medium'
      });
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => settingsService.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    }
  });

  const handleThemeChange = async (theme) => {
    setLocalSettings(prev => ({ ...prev, theme }));
    await updateSettingsMutation.mutateAsync({ ...localSettings, theme });
  };

  const handleFontSizeChange = async (font_size) => {
    setLocalSettings(prev => ({ ...prev, font_size }));
    await updateSettingsMutation.mutateAsync({ ...localSettings, font_size });
    
    // Apply font size to root
    const sizes = { small: '14px', medium: '16px', large: '18px' };
    document.documentElement.style.fontSize = sizes[font_size];
  };

  const faqItems = [
    {
      question: "Como emitir uma nota fiscal?",
      answer: "Use o Assistente IA na página principal. Digite ou fale o que você precisa, como 'Emitir nota de R$ 1.500 para João Silva'. O assistente vai guiar você pelo processo."
    },
    {
      question: "O que é o DAS?",
      answer: "DAS (Documento de Arrecadação do Simples Nacional) é a guia mensal de pagamento de impostos do MEI e Simples Nacional. Inclui INSS, ISS e ICMS. Vence todo dia 20 do mês."
    },
    {
      question: "Qual a diferença entre MEI e Simples Nacional?",
      answer: "MEI tem limite anual de R$ 81.000 e paga valor fixo mensal. Simples Nacional permite faturar até R$ 4,8 milhões/ano mas os impostos são variáveis conforme o faturamento."
    },
    {
      question: "Como adicionar outra empresa?",
      answer: "Clique no seletor de empresas na barra lateral e depois em 'Adicionar nova empresa'. Você pode gerenciar múltiplas empresas e alternar entre elas facilmente."
    },
    {
      question: "O que significa cada status de nota fiscal?",
      answer: "Rascunho: ainda em edição. Enviada: enviada para a prefeitura. Autorizada: aprovada e válida. Rejeitada: recusada pela prefeitura (precisa correção). Cancelada: nota cancelada."
    },
    {
      question: "Como verifico se estou conectado à prefeitura?",
      answer: "Na página da empresa, há um indicador de status fiscal. Use o botão 'Verificar conexão' para testar a integração com a prefeitura."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-white">Configurações</h1>
        <p className="text-gray-400 mt-1">Personalize sua experiência no FiscalAI</p>
      </motion.div>

      {/* Theme */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
            <Palette className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Tema</h2>
            <p className="text-sm text-gray-500">Escolha o tema da interface</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { value: 'dark', label: 'Escuro', desc: 'Tema padrão' },
            { value: 'light', label: 'Claro', desc: 'Em breve' }
          ].map((theme) => (
            <button
              key={theme.value}
              onClick={() => theme.value === 'dark' && handleThemeChange(theme.value)}
              disabled={theme.value === 'light'}
              className={`p-4 rounded-xl border text-left transition-all ${
                localSettings.theme === theme.value
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              } ${theme.value === 'light' ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-medium ${localSettings.theme === theme.value ? 'text-orange-400' : 'text-white'}`}>
                  {theme.label}
                </span>
                {localSettings.theme === theme.value && (
                  <Check className="w-5 h-5 text-orange-400" />
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">{theme.desc}</p>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Font Size */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Type className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Tamanho da Fonte</h2>
            <p className="text-sm text-gray-500">Ajuste o tamanho do texto</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { value: 'small', label: 'Pequeno' },
            { value: 'medium', label: 'Médio' },
            { value: 'large', label: 'Grande' }
          ].map((size) => (
            <button
              key={size.value}
              onClick={() => handleFontSizeChange(size.value)}
              className={`p-4 rounded-xl border text-center transition-all ${
                localSettings.font_size === size.value
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <span className={`font-medium ${localSettings.font_size === size.value ? 'text-orange-400' : 'text-white'}`}>
                  {size.label}
                </span>
                {localSettings.font_size === size.value && (
                  <Check className="w-4 h-4 text-orange-400" />
                )}
              </div>
            </button>
          ))}
        </div>
      </motion.div>

      {/* FAQ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
            <HelpCircle className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Perguntas Frequentes</h2>
            <p className="text-sm text-gray-500">Dúvidas comuns sobre o sistema</p>
          </div>
        </div>

        <div className="space-y-3">
          {faqItems.map((item, index) => (
            <div
              key={index}
              className="border border-white/10 rounded-xl overflow-hidden"
            >
              <button
                onClick={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-white font-medium">{item.question}</span>
                {expandedFAQ === index ? (
                  <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
              </button>
              {expandedFAQ === index && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 pb-4 text-gray-400 text-sm border-t border-white/5"
                >
                  <p className="pt-4">{item.answer}</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center text-sm text-gray-500"
      >
        <p>FiscalAI • Versão 1.0 • © 2025</p>
      </motion.div>
    </div>
  );
}
