import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService, authService } from "@/api/services";
import { motion } from "framer-motion";
import {
  Palette,
  Type,
  HelpCircle,
  Check,
  ChevronDown,
  ChevronUp,
  User,
  Save
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function Settings() {
  const queryClient = useQueryClient();
  const [expandedFAQ, setExpandedFAQ] = useState(null);

  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => authService.me(),
  });

  const [localSettings, setLocalSettings] = useState({
    theme: 'dark',
    font_size: 'medium'
  });

  const [cpfCnpj, setCpfCnpj] = useState('');

  useEffect(() => {
    if (settings) {
      setLocalSettings({
        theme: settings.theme || 'dark',
        font_size: settings.font_size || 'medium'
      });
    }
  }, [settings]);

  useEffect(() => {
    if (user?.cpf_cnpj) {
      // Format CPF/CNPJ for display
      const formatted = user.cpf_cnpj.replace(/\D/g, '');
      if (formatted.length === 11) {
        // CPF: 000.000.000-00
        setCpfCnpj(formatted.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4'));
      } else if (formatted.length === 14) {
        // CNPJ: 00.000.000/0000-00
        setCpfCnpj(formatted.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5'));
      } else {
        setCpfCnpj(formatted);
      }
    }
  }, [user]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => settingsService.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userSettings'] });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data) => authService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      toast.success('CPF/CNPJ atualizado com sucesso');
    },
    onError: async (error) => {
      const { handleApiError } = await import('@/utils/errorHandler');
      await handleApiError(error, { operation: 'update_cpf_cnpj' });
    }
  });

  const handleCpfCnpjChange = (value) => {
    // Remove non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format based on length
    let formatted = digits;
    if (digits.length <= 11) {
      // CPF: 000.000.000-00
      formatted = digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
      if (digits.length < 11) {
        formatted = digits.replace(/(\d{0,3})(\d{0,3})(\d{0,3})(\d{0,2})/, (_, a, b, c, d) => {
          let result = a;
          if (b) result += '.' + b;
          if (c) result += '.' + c;
          if (d) result += '-' + d;
          return result;
        });
      }
    } else {
      // CNPJ: 00.000.000/0000-00
      formatted = digits.substring(0, 14).replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    
    setCpfCnpj(formatted);
  };

  const handleSaveCpfCnpj = async () => {
    const digits = cpfCnpj.replace(/\D/g, '');
    if (digits.length !== 11 && digits.length !== 14) {
      toast.error('CPF deve ter 11 dígitos ou CNPJ deve ter 14 dígitos');
      return;
    }
    await updateProfileMutation.mutateAsync({ cpf_cnpj: digits });
  };

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
        <p className="text-gray-400 mt-1">Personalize sua experiência na MAY</p>
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

      {/* Profile - CPF/CNPJ */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card rounded-2xl p-6"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">Dados Pessoais</h2>
            <p className="text-sm text-gray-500">CPF/CNPJ necessário para assinaturas</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              CPF ou CNPJ
            </label>
            <div className="flex gap-3">
              <Input
                type="text"
                value={cpfCnpj}
                onChange={(e) => handleCpfCnpjChange(e.target.value)}
                placeholder="000.000.000-00 ou 00.000.000/0000-00"
                className="flex-1 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
                maxLength={18}
              />
              <Button
                onClick={handleSaveCpfCnpj}
                disabled={updateProfileMutation.isPending || !cpfCnpj}
                className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white"
              >
                {updateProfileMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Save className="w-4 h-4" />
                    Salvar
                  </span>
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {!cpfCnpj && (
                <span className="text-yellow-400">
                  ⚠️ CPF/CNPJ é necessário para criar assinaturas. Por favor, complete seu cadastro.
                </span>
              )}
              {cpfCnpj && (
                <span className="text-green-400">
                  ✓ CPF/CNPJ cadastrado. Você pode criar assinaturas.
                </span>
              )}
            </p>
          </div>
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
        <p>MAY • Versão 1.0 • © 2025</p>
      </motion.div>
    </div>
  );
}
