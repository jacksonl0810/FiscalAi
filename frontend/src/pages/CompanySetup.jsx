import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { companiesService, notificationsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Building2,
  FileText,
  MapPin,
  Shield,
  ChevronRight,
  Check,
  Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FiscalStatusIndicator from "@/components/layout/FiscalStatusIndicator";

const steps = [
  { id: 1, title: "Dados da Empresa", icon: Building2, description: "CNPJ e identificação" },
  { id: 2, title: "Endereço", icon: MapPin, description: "Localização fiscal" },
  { id: 3, title: "Regime Tributário", icon: FileText, description: "Enquadramento fiscal" },
  { id: 4, title: "Certificado Digital", icon: Shield, description: "Configuração de segurança" },
];

export default function CompanySetup() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    cnpj: "",
    razao_social: "",
    nome_fantasia: "",
    cidade: "",
    uf: "",
    cnae_principal: "",
    regime_tributario: "",
    certificado_digital: false,
    email: "",
    telefone: "",
    inscricao_municipal: ""
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const fileInputRef = React.useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if creating new company
  const urlParams = new URLSearchParams(window.location.search);
  const isNewCompany = urlParams.get('new') === 'true';

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', isNewCompany],
    queryFn: async () => {
      if (isNewCompany) return null;
      const companies = await companiesService.list();
      return companies[0];
    },
  });

  useEffect(() => {
    if (company && !isNewCompany) {
      setFormData({
        cnpj: company.cnpj || "",
        razao_social: company.razao_social || "",
        nome_fantasia: company.nome_fantasia || "",
        cidade: company.cidade || "",
        uf: company.uf || "",
        cnae_principal: company.cnae_principal || "",
        regime_tributario: company.regime_tributario || "",
        certificado_digital: company.certificado_digital || false,
        email: company.email || "",
        telefone: company.telefone || "",
        inscricao_municipal: company.inscricao_municipal || ""
      });
    } else if (isNewCompany || !company) {
      setFormData({
        cnpj: "",
        razao_social: "",
        nome_fantasia: "",
        cidade: "",
        uf: "",
        cnae_principal: "",
        regime_tributario: "",
        certificado_digital: false,
        email: "",
        telefone: "",
        inscricao_municipal: ""
      });
      setCertificateFile(null);
      setCurrentStep(1);
    }
  }, [company, isNewCompany]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      let savedCompany;
      const isNew = !company?.id;
      
      if (company?.id) {
        savedCompany = await companiesService.update(company.id, data);
      } else {
        savedCompany = await companiesService.create(data);
      }

      // If company has required data and not registered in Nuvem Fiscal yet
      if (savedCompany.cnpj && savedCompany.inscricao_municipal && !savedCompany.nuvem_fiscal_id) {
        try {
          const nuvemResult = await companiesService.registerInFiscalCloud(savedCompany.id);

          if (nuvemResult.status === 'success') {
            await notificationsService.create({
              titulo: "Empresa registrada",
              mensagem: "Empresa registrada com sucesso na Nuvem Fiscal!",
              tipo: "sucesso"
            });
          }
        } catch (error) {
          console.error('Error registering in Nuvem Fiscal:', error);
        }
      }

      return { savedCompany, isNewCompany: isNew };
    },
    onSuccess: ({ isNewCompany }) => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      
      if (isNewCompany) {
        toast.success('Nova empresa registrada com sucesso!');
        setTimeout(() => {
          navigate(createPageUrl('Dashboard'));
        }, 1500);
      }
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = async () => {
    if (currentStep < 4) {
      setCurrentStep(prev => prev + 1);
    } else {
      await saveMutation.mutateAsync(formData);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleCertificateUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file && file.name.endsWith('.pfx')) {
      setCertificateFile(file);
      handleInputChange('certificado_digital', true);
      toast.success(`Certificado ${file.name} selecionado com sucesso!`);
    } else if (file) {
      toast.error('Por favor, selecione um arquivo .pfx válido');
    }
  };

  const handleConfigureLater = () => {
    setCertificateFile(null);
    handleInputChange('certificado_digital', false);
  };

  const formatCNPJ = (value) => {
    const cleaned = value.replace(/\D/g, '');
    const match = cleaned.match(/^(\d{0,2})(\d{0,3})(\d{0,3})(\d{0,4})(\d{0,2})$/);
    if (match) {
      return [match[1], match[2], match[3], match[4], match[5]]
        .filter(Boolean)
        .join('')
        .replace(/(\d{2})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return value;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-white">Configurar Empresa</h1>
        <p className="text-gray-400 mt-1">Cadastre os dados da sua empresa para emissão de notas fiscais</p>
      </motion.div>

      {/* Progress Steps */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                  currentStep >= step.id
                    ? 'bg-gradient-to-br from-orange-500 to-orange-600'
                    : 'bg-white/5 border border-white/10'
                }`}>
                  {currentStep > step.id ? (
                    <Check className="w-5 h-5 text-white" />
                  ) : (
                    <step.icon className={`w-5 h-5 ${currentStep >= step.id ? 'text-white' : 'text-gray-500'}`} />
                  )}
                </div>
                <div className="hidden md:block">
                  <p className={`text-sm font-medium ${currentStep >= step.id ? 'text-white' : 'text-gray-500'}`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-gray-600">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  currentStep > step.id ? 'bg-orange-500' : 'bg-white/10'
                }`} />
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Form Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card rounded-3xl overflow-hidden"
      >
        <div className="p-8">
          <AnimatePresence mode="wait">
            {/* Step 1: Company Data */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label className="text-gray-400">CNPJ</Label>
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => handleInputChange('cnpj', formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className="bg-white/5 border-white/10 text-white h-12"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Razão Social</Label>
                  <Input
                    value={formData.razao_social}
                    onChange={(e) => handleInputChange('razao_social', e.target.value)}
                    placeholder="Nome oficial da empresa"
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Nome Fantasia</Label>
                  <Input
                    value={formData.nome_fantasia}
                    onChange={(e) => handleInputChange('nome_fantasia', e.target.value)}
                    placeholder="Nome comercial (opcional)"
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-400">Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="contato@empresa.com"
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400">Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => handleInputChange('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Address */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-gray-400">Cidade/Município</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => handleInputChange('cidade', e.target.value)}
                      placeholder="Nome da cidade"
                      className="bg-white/5 border-white/10 text-white h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-400">UF</Label>
                    <Select
                      value={formData.uf}
                      onValueChange={(value) => handleInputChange('uf', value)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white h-12">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#1a1a2e] border-white/10">
                        {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                          <SelectItem key={uf} value={uf} className="text-white hover:bg-white/10">{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Inscrição Municipal *</Label>
                  <Input
                    value={formData.inscricao_municipal}
                    onChange={(e) => handleInputChange('inscricao_municipal', e.target.value)}
                    placeholder="Número da inscrição municipal"
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                  <p className="text-xs text-gray-500">Obrigatório para emissão de NFS-e</p>
                </div>
                <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-400 font-medium">Importante</p>
                      <p className="text-sm text-gray-400 mt-1">
                        A cidade informada será usada para determinar a prefeitura responsável pela emissão das notas fiscais.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 3: Tax Regime */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="space-y-2">
                  <Label className="text-gray-400">CNAE Principal</Label>
                  <Input
                    value={formData.cnae_principal}
                    onChange={(e) => handleInputChange('cnae_principal', e.target.value)}
                    placeholder="0000-0/00 - Descrição da atividade"
                    className="bg-white/5 border-white/10 text-white h-12"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-400">Regime Tributário</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'].map((regime) => (
                      <button
                        key={regime}
                        onClick={() => handleInputChange('regime_tributario', regime)}
                        className={`p-4 rounded-xl border text-left transition-all ${
                          formData.regime_tributario === regime
                            ? 'border-orange-500 bg-orange-500/10'
                            : 'border-white/10 bg-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`font-medium ${
                            formData.regime_tributario === regime ? 'text-orange-400' : 'text-white'
                          }`}>
                            {regime}
                          </span>
                          {formData.regime_tributario === regime && (
                            <Check className="w-5 h-5 text-orange-400" />
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {regime === 'MEI' && 'Limite de R$ 81.000/ano'}
                          {regime === 'Simples Nacional' && 'Limite de R$ 4,8 milhões/ano'}
                          {regime === 'Lucro Presumido' && 'Acima de R$ 4,8 milhões/ano'}
                          {regime === 'Lucro Real' && 'Obrigatório acima de R$ 78 milhões'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 4: Digital Certificate */}
            {currentStep === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                {/* Fiscal Status */}
                {company?.id && (
                  <FiscalStatusIndicator companyId={company.id} />
                )}
                <div className="p-6 rounded-2xl bg-gradient-to-r from-orange-500/10 to-purple-500/10 border border-orange-500/20">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                      <Shield className="w-6 h-6 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">Certificado Digital</h3>
                      <p className="text-gray-400 mt-1">
                        O certificado digital é necessário para autenticar as notas fiscais emitidas. 
                        Você pode configurá-lo agora ou posteriormente.
                      </p>
                    </div>
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pfx"
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                <div className="space-y-4">
                  <button
                    onClick={handleCertificateUpload}
                    className={`w-full p-5 rounded-xl border text-left transition-all duration-200 ${
                      formData.certificado_digital
                        ? 'border-green-500 bg-green-500/10'
                        : 'border-white/10 bg-white/5 hover:bg-green-500/10 hover:border-green-500/50 hover:scale-[1.02]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Check className={`w-5 h-5 ${formData.certificado_digital ? 'text-green-400' : 'text-gray-500'}`} />
                        <span className="font-medium text-white">
                          {certificateFile ? certificateFile.name : 'Configurar certificado agora'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2 ml-8">
                      Faça upload do seu certificado A1 (.pfx)
                    </p>
                  </button>

                  <button
                    onClick={handleConfigureLater}
                    className={`w-full p-5 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02] ${
                      !formData.certificado_digital
                        ? 'border-orange-500 bg-orange-500/10 hover:bg-orange-500/20 hover:border-orange-500'
                        : 'border-white/10 bg-white/5 hover:bg-orange-500/10 hover:border-orange-500/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className={`w-5 h-5 ${!formData.certificado_digital ? 'text-orange-400' : 'text-gray-500'}`} />
                      <span className="font-medium text-white">Configurar depois</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 ml-8">
                      Você poderá adicionar o certificado posteriormente
                    </p>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-white/5 flex justify-between">
          <Button
            onClick={handlePrevious}
            variant="outline"
            className="bg-transparent border-white/10 text-white hover:bg-white/5 hover:text-white"
            disabled={currentStep === 1}
          >
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            className="bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white border-0"
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : currentStep === 4 ? (
              <Check className="w-4 h-4 mr-2" />
            ) : (
              <ChevronRight className="w-4 h-4 mr-2" />
            )}
            {currentStep === 4 ? 'Salvar' : 'Continuar'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
