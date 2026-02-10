import React from "react";
import { motion } from "framer-motion";
import { FileText, Shield, AlertCircle, CheckCircle, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Terms() {
  const navigate = useNavigate();

  const sections = [
    {
      id: "1",
      title: "Aceitação dos Termos",
      content: `Ao acessar e utilizar a plataforma MAY Fiscal AI, você concorda em cumprir e estar vinculado aos seguintes termos e condições de uso. Se você não concorda com qualquer parte destes termos, não deve utilizar nossos serviços.`
    },
    {
      id: "2",
      title: "Descrição do Serviço",
      content: `A MAY Fiscal AI é uma plataforma de gestão fiscal que oferece serviços de emissão de notas fiscais eletrônicas (NFS-e), assistente de IA para gestão fiscal, e ferramentas relacionadas à administração fiscal de empresas. Nossos serviços são fornecidos através de uma interface web e assistente de IA conversacional.`
    },
    {
      id: "3",
      title: "Cadastro e Conta de Usuário",
      content: `Para utilizar nossos serviços, você precisa criar uma conta fornecendo informações precisas e atualizadas. Você é responsável por manter a confidencialidade de suas credenciais de acesso e por todas as atividades que ocorram em sua conta. Você concorda em notificar-nos imediatamente sobre qualquer uso não autorizado de sua conta.`
    },
    {
      id: "4",
      title: "Planos e Pagamentos",
      content: `A MAY oferece diferentes planos de assinatura com funcionalidades e limites variados. Os preços, recursos e limites podem ser alterados a qualquer momento, com aviso prévio. Os pagamentos são processados de forma segura através de provedores de pagamento terceirizados. As assinaturas são renovadas automaticamente, a menos que canceladas pelo usuário.`
    },
    {
      id: "5",
      title: "Uso Aceitável",
      content: `Você concorda em usar nossos serviços apenas para fins legais e de acordo com todas as leis e regulamentos aplicáveis. É proibido usar nossos serviços para atividades ilegais, fraudulentas ou que violem direitos de terceiros. Você não deve tentar acessar áreas restritas do sistema ou interferir no funcionamento da plataforma.`
    },
    {
      id: "6",
      title: "Responsabilidades do Usuário",
      content: `Você é responsável por garantir que todas as informações fornecidas sejam precisas e atualizadas. Você deve manter seus dados fiscais e empresariais atualizados. A MAY não se responsabiliza por erros decorrentes de informações incorretas fornecidas pelo usuário.`
    },
    {
      id: "7",
      title: "Limitação de Responsabilidade",
      content: `A MAY não se responsabiliza por danos diretos, indiretos, incidentais ou consequenciais resultantes do uso ou incapacidade de usar nossos serviços. Nossa responsabilidade total não excederá o valor pago por você nos últimos 12 meses.`
    },
    {
      id: "8",
      title: "Propriedade Intelectual",
      content: `Todo o conteúdo da plataforma, incluindo design, textos, gráficos, logos e software, é propriedade da MAY ou de seus licenciadores e está protegido por leis de propriedade intelectual. Você não pode copiar, modificar ou distribuir qualquer parte do serviço sem autorização prévia.`
    },
    {
      id: "9",
      title: "Cancelamento e Reembolso",
      content: `Você pode cancelar sua assinatura a qualquer momento através das configurações da conta. O cancelamento entrará em vigor no final do período de faturament atual. Reembolsos são avaliados caso a caso e de acordo com nossa política de reembolso.`
    },
    {
      id: "10",
      title: "Modificações dos Termos",
      content: `Reservamo-nos o direito de modificar estes termos a qualquer momento. Alterações significativas serão comunicadas aos usuários com pelo menos 30 dias de antecedência. O uso continuado dos serviços após as modificações constitui aceitação dos novos termos.`
    },
    {
      id: "11",
      title: "Lei Aplicável",
      content: `Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será resolvida nos tribunais competentes do Brasil.`
    },
    {
      id: "12",
      title: "Contato",
      content: `Para questões sobre estes termos, entre em contato conosco através do email: contato@mayassessorfiscal.com.br ou através da página de Suporte em nossa plataforma.`
    }
  ];

  return (
    <div className="min-h-screen bg-[#07070a]">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[800px] h-[800px] bg-gradient-radial from-orange-500/10 via-orange-500/3 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-[600px] h-[600px] bg-gradient-radial from-amber-500/8 via-transparent to-transparent blur-3xl" />
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
              "hover:bg-white/5 hover:border-orange-500/40 hover:text-orange-200",
              "hover:shadow-md hover:shadow-orange-500/10",
              "active:scale-[0.98]"
            )}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>

          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/30">
              <FileText className="w-8 h-8 text-orange-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Termos de Serviço
              </h1>
              <p className="text-gray-400">
                Última atualização: {new Date().toLocaleDateString('pt-BR', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-gradient-to-br from-orange-500/10 via-orange-500/5 to-transparent border border-orange-500/20">
            <p className="text-gray-300 leading-relaxed">
              Estes Termos de Serviço regem o uso da plataforma MAY Fiscal AI. 
              Ao utilizar nossos serviços, você concorda em cumprir estes termos. 
              Leia atentamente antes de utilizar a plataforma.
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
              className="glass-card rounded-2xl p-8 border border-white/10 hover:border-orange-500/30 transition-all duration-300"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 flex items-center justify-center border border-orange-500/30 flex-shrink-0">
                  <span className="text-orange-400 font-bold text-sm">{section.id}</span>
                </div>
                <h2 className="text-2xl font-bold text-white flex-1">
                  {section.title}
                </h2>
              </div>
              <p className="text-gray-300 leading-relaxed ml-14">
                {section.content}
              </p>
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
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-white font-semibold mb-2">Importante</p>
              <p className="text-gray-400 text-sm leading-relaxed">
                Estes termos podem ser atualizados periodicamente. Recomendamos que você revise esta página regularmente 
                para se manter informado sobre quaisquer alterações. O uso continuado de nossos serviços após alterações 
                constitui sua aceitação dos termos revisados.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
