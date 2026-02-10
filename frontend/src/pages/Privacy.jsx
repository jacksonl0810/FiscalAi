import React from "react";
import { motion } from "framer-motion";
import { Shield, Lock, Eye, Database, FileCheck, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Privacy() {
  const navigate = useNavigate();

  const sections = [
    {
      id: "1",
      title: "Introdução",
      icon: Shield,
      content: `A MAY Fiscal AI ("nós", "nosso" ou "MAY") está comprometida em proteger sua privacidade. Esta Política de Privacidade descreve como coletamos, usamos, armazenamos e protegemos suas informações pessoais quando você utiliza nossa plataforma de gestão fiscal.`
    },
    {
      id: "2",
      title: "Informações que Coletamos",
      icon: Database,
      content: `Coletamos informações que você nos fornece diretamente, incluindo:
• Dados de cadastro: nome, email, senha (criptografada)
• Dados empresariais: CNPJ, razão social, endereço, telefone
• Dados fiscais: inscrição municipal, regime tributário, certificados digitais
• Dados de pagamento: processados de forma segura através de provedores terceirizados
• Dados de uso: logs de acesso, interações com o assistente IA, notas fiscais emitidas`
    },
    {
      id: "3",
      title: "Como Usamos suas Informações",
      icon: Eye,
      content: `Utilizamos suas informações para:
• Fornecer e melhorar nossos serviços de gestão fiscal
• Processar emissões de notas fiscais eletrônicas
• Comunicar-nos com você sobre sua conta e serviços
• Enviar notificações importantes sobre sua conta
• Personalizar sua experiência na plataforma
• Detectar e prevenir fraudes ou atividades suspeitas
• Cumprir obrigações legais e regulatórias`
    },
    {
      id: "4",
      title: "Compartilhamento de Informações",
      icon: FileCheck,
      content: `Não vendemos suas informações pessoais. Podemos compartilhar suas informações apenas nas seguintes situações:
• Com prestadores de serviços terceirizados (processamento de pagamentos, hospedagem)
• Com autoridades fiscais quando necessário para emissão de notas fiscais
• Com autoridades legais quando exigido por lei
• Em caso de fusão, aquisição ou venda de ativos (com aviso prévio)
• Com seu consentimento explícito`
    },
    {
      id: "5",
      title: "Segurança dos Dados",
      icon: Lock,
      content: `Implementamos medidas de segurança técnicas e organizacionais para proteger suas informações:
• Criptografia de dados em trânsito (HTTPS/TLS)
• Criptografia de dados sensíveis em repouso
• Acesso restrito a informações pessoais apenas para funcionários autorizados
• Monitoramento contínuo de segurança
• Backups regulares e sistemas de recuperação
• Certificados digitais protegidos com criptografia avançada`
    },
    {
      id: "6",
      title: "Retenção de Dados",
      icon: Database,
      content: `Mantemos suas informações pelo tempo necessário para:
• Fornecer nossos serviços
• Cumprir obrigações legais e fiscais (conforme legislação brasileira)
• Resolver disputas e fazer cumprir nossos acordos
• Dados fiscais podem ser retidos por até 5 anos conforme exigências legais`
    },
    {
      id: "7",
      title: "Seus Direitos (LGPD)",
      icon: CheckCircle,
      content: `De acordo com a Lei Geral de Proteção de Dados (LGPD), você tem direito a:
• Acesso aos seus dados pessoais
• Correção de dados incompletos ou desatualizados
• Exclusão de dados desnecessários ou excessivos
• Portabilidade dos dados
• Revogação do consentimento
• Informação sobre compartilhamento de dados
• Revisão de decisões automatizadas
Para exercer esses direitos, entre em contato através do email: privacidade@mayassessorfiscal.com.br`
    },
    {
      id: "8",
      title: "Cookies e Tecnologias Similares",
      icon: Eye,
      content: `Utilizamos cookies e tecnologias similares para:
• Manter sua sessão ativa
• Lembrar suas preferências
• Analisar o uso da plataforma
• Melhorar a experiência do usuário
Você pode gerenciar as preferências de cookies através das configurações do seu navegador.`
    },
    {
      id: "9",
      title: "Privacidade de Menores",
      icon: AlertCircle,
      content: `Nossos serviços são destinados a empresas e profissionais. Não coletamos intencionalmente informações de menores de 18 anos. Se descobrirmos que coletamos informações de um menor sem consentimento dos pais, tomaremos medidas para excluir essas informações.`
    },
    {
      id: "10",
      title: "Alterações nesta Política",
      icon: FileCheck,
      content: `Podemos atualizar esta Política de Privacidade periodicamente. Notificaremos você sobre alterações significativas através de email ou notificação na plataforma. Recomendamos que você revise esta política regularmente.`
    },
    {
      id: "11",
      title: "Contato",
      icon: Shield,
      content: `Para questões sobre privacidade ou para exercer seus direitos sob a LGPD, entre em contato:
• Email: privacidade@mayassessorfiscal.com.br
• Suporte: contato@mayassessorfiscal.com.br
• Endereço: [Endereço da empresa]`
    }
  ];

  return (
    <div className="min-h-screen bg-[#07070a]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-purple-500/10 via-purple-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-blue-500/8 via-transparent to-transparent blur-3xl" />
      </div>

      <div className="relative max-w-4xl mx-auto px-6 py-12">
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
              "hover:bg-white/5 hover:border-purple-500/40 hover:text-purple-200",
              "hover:shadow-md hover:shadow-purple-500/10",
              "active:scale-[0.98]"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center border border-purple-500/30">
              <Shield className="w-8 h-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Política de Privacidade
              </h1>
              <p className="text-gray-400">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border border-purple-500/20">
            <p className="text-gray-300 leading-relaxed">
              Sua privacidade é importante para nós. Esta política descreve como coletamos, 
              usamos e protegemos suas informações pessoais em conformidade com a Lei Geral de 
              Proteção de Dados (LGPD) do Brasil.
            </p>
          </div>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-6">
          {sections.map((section, index) => (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="glass-card rounded-2xl p-8 border border-white/10 hover:border-purple-500/30 transition-all duration-300"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 flex items-center justify-center border border-purple-500/30 flex-shrink-0">
                  <section.icon className="w-6 h-6 text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-purple-400 font-bold text-sm bg-purple-500/10 px-2 py-1 rounded">§{section.id}</span>
                    <h2 className="text-2xl font-bold text-white">
                      {section.title}
                    </h2>
                  </div>
                  <p className="text-gray-300 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer Note */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-white/10"
        >
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold mb-2">Compromisso com a Privacidade</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Estamos comprometidos em proteger sua privacidade e cumprir todas as disposições da LGPD. 
                Se você tiver dúvidas ou preocupações sobre como tratamos seus dados pessoais, 
                não hesite em entrar em contato conosco.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
