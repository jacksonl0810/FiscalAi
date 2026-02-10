import React, { useState } from "react";
import { motion } from "framer-motion";
import { 
  HelpCircle, 
  Mail, 
  MessageCircle, 
  Book, 
  Video, 
  FileText, 
  ArrowLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  Zap,
  Shield
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export default function Support() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const faqCategories = [
    {
      title: "Primeiros Passos",
      icon: Zap,
      questions: [
        {
          q: "Como criar minha conta na MAY?",
          a: "Para criar sua conta, clique em 'Criar conta' na página de login, preencha seus dados e escolha um plano. Você terá 7 dias grátis para testar todas as funcionalidades."
        },
        {
          q: "Como adicionar minha primeira empresa?",
          a: "Após fazer login, vá em 'Minhas Empresas' e clique em 'Nova Empresa'. Preencha os dados do CNPJ, razão social e informações fiscais necessárias."
        },
        {
          q: "Preciso de certificado digital?",
          a: "O certificado digital é necessário para emitir notas fiscais em alguns municípios. Você pode fazer upload do certificado na configuração da empresa."
        }
      ]
    },
    {
      title: "Emissão de Notas",
      icon: FileText,
      questions: [
        {
          q: "Como emitir uma nota fiscal?",
          a: "Use o Assistente IA e diga 'Emitir nota fiscal para [cliente] no valor de R$ [valor]'. O assistente guiará você através do processo."
        },
        {
          q: "Quais municípios são suportados?",
          a: "A MAY suporta a maioria dos municípios brasileiros que utilizam NFS-e. Verificamos automaticamente se seu município é suportado ao cadastrar a empresa."
        },
        {
          q: "Quanto tempo leva para emitir uma nota?",
          a: "A emissão é quase instantânea. Após você fornecer os dados ao assistente IA, a nota é processada e autorizada pela prefeitura em segundos."
        }
      ]
    },
    {
      title: "Planos e Pagamentos",
      icon: Shield,
      questions: [
        {
          q: "Qual plano escolher?",
          a: "Pay per Use: ideal para quem emite poucas notas. Essential: até 2 empresas e 30 notas/mês. Professional: até 5 empresas e 100 notas/mês. Accountant: para escritórios de contabilidade."
        },
        {
          q: "Como funciona o período de teste?",
          a: "Você tem 7 dias grátis para testar todas as funcionalidades. Não é necessário cartão de crédito para começar o teste."
        },
        {
          q: "Posso cancelar a qualquer momento?",
          a: "Sim, você pode cancelar sua assinatura a qualquer momento através das configurações da conta. O cancelamento entra em vigor no final do período de faturament."
        }
      ]
    },
    {
      title: "Assistente IA",
      icon: MessageCircle,
      questions: [
        {
          q: "Como usar o Assistente IA?",
          a: "O assistente entende comandos em português natural. Você pode pedir para emitir notas, consultar faturamento, verificar impostos e muito mais. Basta conversar normalmente!"
        },
        {
          q: "O assistente funciona por voz?",
          a: "Sim! Você pode usar comandos de voz para interagir com o assistente. Clique no ícone de microfone e fale seu comando."
        },
        {
          q: "Quais comandos o assistente entende?",
          a: "O assistente entende diversos comandos: 'Emitir nota fiscal', 'Consultar faturamento', 'Ver impostos do mês', 'Listar clientes', entre outros."
        }
      ]
    }
  ];

  const supportOptions = [
    {
      title: "Central de Ajuda",
      description: "Acesse nossa base de conhecimento com tutoriais e guias",
      icon: Book,
      color: "from-blue-500/20 to-blue-600/20",
      borderColor: "border-blue-500/30",
      iconColor: "text-blue-400",
      action: "Em breve"
    },
    {
      title: "Vídeos Tutoriais",
      description: "Aprenda com nossos vídeos passo a passo",
      icon: Video,
      color: "from-purple-500/20 to-purple-600/20",
      borderColor: "border-purple-500/30",
      iconColor: "text-purple-400",
      action: "Em breve"
    },
    {
      title: "Email de Suporte",
      description: "Envie sua dúvida por email e receba resposta em até 24h",
      icon: Mail,
      color: "from-orange-500/20 to-orange-600/20",
      borderColor: "border-orange-500/30",
      iconColor: "text-orange-400",
      action: "contato@mayassessorfiscal.com.br",
      href: "mailto:contato@mayassessorfiscal.com.br"
    },
    {
      title: "Chat ao Vivo",
      description: "Converse com nosso time de suporte em tempo real",
      icon: MessageCircle,
      color: "from-emerald-500/20 to-emerald-600/20",
      borderColor: "border-emerald-500/30",
      iconColor: "text-emerald-400",
      action: "Em breve"
    }
  ];

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(q => 
      q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.a.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-[#07070a]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-blue-500/10 via-blue-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-emerald-500/8 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className={cn(
              "mb-6 rounded-xl font-medium transition-all duration-200",
              "bg-transparent border border-white/10 text-gray-300",
              "hover:bg-white/5 hover:border-blue-500/40 hover:text-blue-200",
              "hover:shadow-md hover:shadow-blue-500/10",
              "active:scale-[0.98]"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-500/30">
              <HelpCircle className="w-8 h-8 text-blue-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Central de Suporte
              </h1>
              <p className="text-gray-400">
                Estamos aqui para ajudar você a aproveitar ao máximo a MAY Fiscal AI
              </p>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Input
              type="text"
              placeholder="Buscar na base de conhecimento..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 bg-white/5 border-white/10 h-14 text-white placeholder:text-gray-500 focus:border-blue-500/50"
            />
            <HelpCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          </div>
        </motion.div>

        {/* Support Options */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Canais de Suporte</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {supportOptions.map((option, index) => (
              <motion.a
                key={index}
                href={option.href}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 + index * 0.1 }}
                className={cn(
                  "glass-card rounded-2xl p-6 border transition-all duration-300",
                  "hover:scale-[1.02] hover:shadow-xl",
                  option.borderColor
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4",
                  option.color,
                  option.borderColor,
                  "border"
                )}>
                  <option.icon className={cn("w-6 h-6", option.iconColor)} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{option.title}</h3>
                <p className="text-gray-400 text-sm mb-4">{option.description}</p>
                <div className="flex items-center gap-2 text-sm">
                  <span className={cn("font-medium", option.iconColor)}>{option.action}</span>
                  {option.href && <ChevronRight className={cn("w-4 h-4", option.iconColor)} />}
                </div>
              </motion.a>
            ))}
          </div>
        </motion.div>

        {/* FAQ Sections */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h2 className="text-2xl font-bold text-white mb-6">Perguntas Frequentes</h2>
          <div className="space-y-8">
            {filteredFAQs.length > 0 ? (
              filteredFAQs.map((category, categoryIndex) => (
                <motion.div
                  key={categoryIndex}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 + categoryIndex * 0.1 }}
                  className="glass-card rounded-2xl p-6 border border-white/10"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 flex items-center justify-center border border-blue-500/30">
                      <category.icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">{category.title}</h3>
                  </div>
                  <div className="space-y-4">
                    {category.questions.map((faq, faqIndex) => (
                      <div
                        key={faqIndex}
                        className="p-4 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all"
                      >
                        <h4 className="text-white font-semibold mb-2 flex items-start gap-2">
                          <CheckCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          {faq.q}
                        </h4>
                        <p className="text-gray-400 text-sm ml-7 leading-relaxed">{faq.a}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ))
            ) : (
              <div className="glass-card rounded-2xl p-8 border border-white/10 text-center">
                <p className="text-gray-400">Nenhuma pergunta encontrada para "{searchQuery}"</p>
              </div>
            )}
          </div>
        </motion.div>

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1 }}
          className="mt-12 p-8 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20"
        >
          <div className="flex items-start gap-4">
            <Mail className="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-xl font-bold text-white mb-2">Não encontrou o que procura?</h3>
              <p className="text-gray-300 mb-4">
                Nossa equipe está pronta para ajudar. Entre em contato e receba suporte personalizado.
              </p>
              <a
                href="mailto:contato@mayassessorfiscal.com.br"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25"
              >
                <Mail className="w-4 h-4" />
                Enviar Email
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
