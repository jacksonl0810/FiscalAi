// @ts-nocheck
import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { companiesService, notificationsService, settingsService, subscriptionsService } from "@/api/services";
// Animation handled with CSS classes
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
import { cn } from "@/lib/utils";
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
    inscricao_municipal: "",
    // Address fields required by Nuvem Fiscal
    cep: "",
    logradouro: "",
    numero: "",
    bairro: "",
    codigo_municipio: ""
  });
  const [certificateFile, setCertificateFile] = useState(null);
  const [certificatePassword, setCertificatePassword] = useState("");
  const fileInputRef = React.useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // Check if creating new company
  const urlParams = new URLSearchParams(window.location.search);
  const isNewCompany = urlParams.get('new') === 'true';

  // Get user settings to find active company
  const { data: settings } = useQuery({
    queryKey: ['userSettings'],
    queryFn: () => settingsService.get(),
  });

  // Get plan limits
  const { data: planLimits } = useQuery({
    queryKey: ['plan-limits'],
    queryFn: () => subscriptionsService.getLimits(),
    staleTime: 2 * 60 * 1000, // Cache for 2 minutes
  });

  const { data: company, isLoading } = useQuery({
    queryKey: ['company', isNewCompany, settings?.active_company_id || 'default'],
    queryFn: async () => {
      if (isNewCompany) return null;
      const companies = await companiesService.list();
      
      // If there's an active company ID in settings, find that company
      if (settings?.active_company_id) {
        const activeCompany = companies.find(c => c.id === settings.active_company_id);
        if (activeCompany) return activeCompany;
      }
      
      // Fallback to first company
      return companies[0] || null;
    },
    enabled: !isNewCompany || !!settings,
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
        inscricao_municipal: company.inscricao_municipal || "",
        // Address fields
        cep: company.cep || "",
        logradouro: company.logradouro || "",
        numero: company.numero || "",
        bairro: company.bairro || "",
        codigo_municipio: company.codigo_municipio || ""
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
        inscricao_municipal: "",
        cep: "",
        logradouro: "",
        numero: "",
        bairro: "",
        codigo_municipio: ""
      });
      setCertificateFile(null);
      setCurrentStep(1);
    }
  }, [company, isNewCompany]);

  const saveMutation = useMutation({
    mutationFn: async (/** @type {import('@/types').CreateCompanyData} */ data) => {
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

          if (nuvemResult.status === 'success' || nuvemResult.nuvemFiscalId) {
            toast.success('✓ Integração Fiscal Ativada!\n\nEmpresa registrada com sucesso na Nuvem Fiscal', {
              duration: 5000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(34, 197, 94, 0.2)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
            await notificationsService.create({
              titulo: "Empresa registrada",
              mensagem: "Empresa registrada com sucesso na Nuvem Fiscal!",
              tipo: "sucesso"
            });
          } else if (nuvemResult.status === 'not_configured') {
            toast.info('ℹ️ Integração Fiscal Pendente\n\nNuvem Fiscal não configurado. Empresa salva localmente.', {
              duration: 5000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(59, 130, 246, 0.15)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
          }
        } catch (/** @type {any} */ error) {
          const { handleError } = await import('@/services/errorTranslationService');
          await handleError(error, { 
            operation: 'register_company',
            companyId: savedCompany.id 
          }, (message) => {
            toast.error(`⚠️ Erro na Integração Fiscal\n\n${message}\n\nA empresa foi salva, mas não registrada na Nuvem Fiscal.`, {
              duration: 8000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
          });
        }
      }

      // Upload certificate if a file was selected
      if (certificateFile && certificatePassword) {
        try {
          const certResult = await companiesService.uploadCertificate(savedCompany.id, certificateFile, certificatePassword);
          
          if (certResult?.nuvem_fiscal?.status === 'error') {
            toast.error(`⚠️ Erro no Certificado\n\n${certResult.nuvem_fiscal.message}`, {
            duration: 8000,
            style: {
              background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '16px',
              padding: '16px',
              boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2)',
              color: '#fff',
              whiteSpace: 'pre-line',
            },
            });
          } else if (certResult?.nuvem_fiscal?.status === 'warning') {
            toast.error(`⚠️ Aviso do Certificado\n\n${certResult.nuvem_fiscal.message}`, {
              duration: 6000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(251, 191, 36, 0.2)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
          } else {
            toast.success('✓ Certificado Digital Enviado!\n\nCertificado configurado com sucesso.', {
              duration: 4000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(34, 197, 94, 0.2)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
          }
        } catch (/** @type {any} */ certError) {
          const { handleError } = await import('@/services/errorTranslationService');
          await handleError(certError, { 
            operation: 'upload_certificate',
            companyId: savedCompany.id 
          }, (message) => {
            toast.error(`⚠️ Erro no Certificado\n\n${message}`, {
              duration: 8000,
              style: {
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2)',
                color: '#fff',
                whiteSpace: 'pre-line',
              },
            });
          });
        }
      }

      return { savedCompany, isNewCompany: isNew };
    },
    onSuccess: ({ isNewCompany }) => {
      queryClient.invalidateQueries({ queryKey: ['company'] });
      
      if (isNewCompany) {
        toast.success('✓ Empresa Criada!\n\nRedirecionando para o Dashboard...', {
          duration: 2000,
          style: {
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            boxShadow: '0 10px 40px rgba(34, 197, 94, 0.2)',
            color: '#fff',
            whiteSpace: 'pre-line',
          },
        });
        setTimeout(() => {
          navigate(createPageUrl('Dashboard'));
        }, 1500);
      }
    },
    onError: async (/** @type {any} */ error) => {
      const { handleError } = await import('@/services/errorTranslationService');
      await handleError(error, { 
        operation: 'save_company'
      }, (message) => {
        toast.error(`⚠️ Erro ao Salvar\n\n${message}`, {
          duration: 8000,
        style: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '16px',
          padding: '16px',
          boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2)',
          color: '#fff',
          whiteSpace: 'pre-line',
        },
        });
      });
    }
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const [cepLoading, setCepLoading] = useState(false);

  const fetchAddressFromCep = async (cep) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;

    setCepLoading(true);
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cleanCep}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          logradouro: data.street || prev.logradouro,
          bairro: data.neighborhood || prev.bairro,
          cidade: data.city || prev.cidade,
          uf: data.state || prev.uf,
          codigo_municipio: data.city_ibge || prev.codigo_municipio
        }));
        if (data.city_ibge) {
          toast.success(`Endereço preenchido automaticamente! IBGE: ${data.city_ibge}`);
        }
      } else {
        const viaResponse = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        if (viaResponse.ok) {
          const data = await viaResponse.json();
          if (!data.erro) {
            setFormData(prev => ({
              ...prev,
              logradouro: data.logradouro || prev.logradouro,
              bairro: data.bairro || prev.bairro,
              cidade: data.localidade || prev.cidade,
              uf: data.uf || prev.uf,
              codigo_municipio: data.ibge || prev.codigo_municipio
            }));
            if (data.ibge) {
              toast.success(`Endereço preenchido! IBGE: ${data.ibge}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching address:', error);
    } finally {
      setCepLoading(false);
    }
  };

  // Validation functions
  const validateStep1 = () => {
    const errors = [];
    
    // CNPJ validation - must be 14 digits
    const cleanCnpj = formData.cnpj?.replace(/\D/g, '') || '';
    if (!cleanCnpj) {
      errors.push({ field: 'CNPJ', message: 'CNPJ é obrigatório' });
    } else if (cleanCnpj.length !== 14) {
      errors.push({ field: 'CNPJ', message: `CNPJ deve ter 14 dígitos (atual: ${cleanCnpj.length})` });
    }
    
    // Razão Social
    if (!formData.razao_social?.trim()) {
      errors.push({ field: 'Razão Social', message: 'Razão Social é obrigatória' });
    }
    
    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email?.trim()) {
      errors.push({ field: 'Email', message: 'Email é obrigatório' });
    } else if (!emailRegex.test(formData.email)) {
      errors.push({ field: 'Email', message: 'Email inválido' });
    }
    
    // Telefone
    const cleanPhone = formData.telefone?.replace(/\D/g, '') || '';
    if (!cleanPhone) {
      errors.push({ field: 'Telefone', message: 'Telefone é obrigatório' });
    } else if (cleanPhone.length < 10) {
      errors.push({ field: 'Telefone', message: 'Telefone deve ter pelo menos 10 dígitos' });
    }
    
    return errors;
  };

  const validateStep2 = () => {
    const errors = [];
    
    // CEP - must be 8 digits
    const cleanCep = formData.cep?.replace(/\D/g, '') || '';
    if (!cleanCep) {
      errors.push({ field: 'CEP', message: 'CEP é obrigatório para integração fiscal' });
    } else if (cleanCep.length !== 8) {
      errors.push({ field: 'CEP', message: `CEP deve ter 8 dígitos (atual: ${cleanCep.length})` });
    }
    
    // Código do Município IBGE - must be exactly 7 digits
    const cleanCodigoMunicipio = formData.codigo_municipio?.replace(/\D/g, '') || '';
    if (!cleanCodigoMunicipio) {
      errors.push({ field: 'Código IBGE', message: 'Código do Município (IBGE) é obrigatório' });
    } else if (cleanCodigoMunicipio.length !== 7) {
      errors.push({ 
        field: 'Código IBGE', 
        message: `Código IBGE deve ter exatamente 7 dígitos (atual: ${cleanCodigoMunicipio.length}). Este NÃO é a inscrição municipal!` 
      });
    }
    
    // Cidade
    if (!formData.cidade?.trim()) {
      errors.push({ field: 'Cidade', message: 'Cidade é obrigatória' });
    }
    
    // UF
    if (!formData.uf) {
      errors.push({ field: 'UF', message: 'Estado (UF) é obrigatório' });
    }
    
    // Inscrição Municipal
    if (!formData.inscricao_municipal?.trim()) {
      errors.push({ field: 'Inscrição Municipal', message: 'Inscrição Municipal é obrigatória para NFS-e' });
    }
    
    return errors;
  };

  const validateStep3 = () => {
    const errors = [];
    
    if (!formData.regime_tributario) {
      errors.push({ field: 'Regime Tributário', message: 'Selecione um regime tributário' });
    }
    
    return errors;
  };

  const showValidationErrors = (errors) => {
    if (errors.length === 0) return true;
    
    // Build error message string
    const errorMessages = errors.map(e => `• ${e.field}: ${e.message}`).join('\n');
    
    // Use simple string content for toast messages
    toast.error(`⚠️ Dados incompletos\n\n${errorMessages}`, {
      duration: 6000,
      style: {
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '16px',
        padding: '16px',
        boxShadow: '0 10px 40px rgba(239, 68, 68, 0.2)',
        color: '#fff',
        whiteSpace: 'pre-line',
      },
    });
    
    return false;
  };

  const validateCurrentStep = () => {
    let errors = [];
    
    switch (currentStep) {
      case 1:
        errors = validateStep1();
        break;
      case 2:
        errors = validateStep2();
        break;
      case 3:
        errors = validateStep3();
        break;
      case 4:
        // Final validation - validate all steps
        errors = [...validateStep1(), ...validateStep2(), ...validateStep3()];
        break;
      default:
        break;
    }
    
    return showValidationErrors(errors);
  };

  const handleNext = async () => {
    // Validate current step before proceeding
    if (!validateCurrentStep()) {
      return;
    }
    
    if (currentStep < 4) {
      toast.success(`✓ Etapa ${currentStep} validada!`, {
        duration: 2000,
        style: {
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          border: '1px solid rgba(34, 197, 94, 0.3)',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(34, 197, 94, 0.15)',
          color: '#fff',
        },
      });
      setCurrentStep(prev => prev + 1);
    } else {
      // Final step - validate everything and save
      const allErrors = [...validateStep1(), ...validateStep2(), ...validateStep3()];
      if (allErrors.length > 0) {
        showValidationErrors(allErrors);
        return;
      }
      
      // Check plan limits before creating new company
      if (isNewCompany && planLimits) {
        const { companyLimit } = planLimits;
        
        if (!companyLimit.allowed) {
          toast.error("Limite de empresas atingido", {
            description: `Seu plano ${planLimits.planName} permite até ${companyLimit.max} ${companyLimit.max === 1 ? 'empresa' : 'empresas'}. Faça upgrade para adicionar mais empresas.`,
            duration: 5000,
            action: {
              label: "Ver Planos",
              onClick: () => navigate(createPageUrl("Pricing"))
            }
          });
          return;
        }
      }
      
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
    setCertificatePassword("");
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
      <div className="mb-8 animate-fade-in">
        <h1 className={cn(
          "text-4xl font-bold mb-2",
          "bg-gradient-to-r from-white via-white to-gray-300 bg-clip-text text-transparent",
          "drop-shadow-lg"
        )}>
          Configurar Empresa
        </h1>
        <p className="text-gray-400 mt-1 font-medium">Cadastre os dados da sua empresa para emissão de notas fiscais</p>
      </div>

      {/* Progress Steps */}
      <div className="mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div className={cn(
          "relative p-6 rounded-2xl overflow-hidden",
          "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
          "backdrop-blur-xl border border-white/10",
          "shadow-2xl shadow-black/50",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
        )}>
          <div className="flex items-center justify-between relative z-10">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-14 h-14 rounded-xl flex items-center justify-center transition-all",
                    currentStep >= step.id
                      ? cn(
                          "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
                          "shadow-lg shadow-orange-500/30",
                          "border border-orange-400/30"
                        )
                      : cn(
                          "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                          "border border-white/10",
                          "backdrop-blur-sm"
                        )
                  )}>
                    {currentStep > step.id ? (
                      <Check className="w-6 h-6 text-white" />
                    ) : (
                      <step.icon className={cn(
                        "w-6 h-6",
                        currentStep >= step.id ? 'text-white' : 'text-gray-400'
                      )} />
                    )}
                  </div>
                  <div className="hidden md:block">
                    <p className={cn(
                      "text-sm font-semibold mb-0.5",
                      currentStep >= step.id ? 'text-white' : 'text-gray-400'
                    )}>
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">{step.description}</p>
                  </div>
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "flex-1 h-1 mx-4 rounded-full transition-all duration-300",
                    currentStep > step.id 
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 shadow-md shadow-orange-500/30" 
                      : "bg-white/10"
                  )} />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div 
        className={cn(
          "relative rounded-3xl overflow-hidden animate-fade-in",
          "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
          "backdrop-blur-xl border border-white/10",
          "shadow-2xl shadow-black/50",
          "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
        )}
        style={{ animationDelay: '0.2s' }}
      >
        <div className="p-8 relative z-10">
          {/* Step 1: Company Data */}
          {currentStep === 1 && (
          <div 
            key="step-1"
            className="space-y-6 animate-fade-in"
          >
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">CNPJ *</Label>
                  <Input
                    value={formData.cnpj}
                    onChange={(e) => handleInputChange('cnpj', formatCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100",
                      formData.cnpj && formData.cnpj.replace(/\D/g, '').length !== 14 
                        ? 'border-yellow-500/50 focus:border-yellow-500 focus:ring-yellow-500/20' 
                        : formData.cnpj?.replace(/\D/g, '').length === 14 
                          ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20' 
                          : 'border-white/10'
                    )}
                    style={{ color: '#ffffff' }}
                    maxLength={18}
                  />
                  <p className="text-xs">
                    {formData.cnpj && formData.cnpj.replace(/\D/g, '').length !== 14 && (
                      <span className="text-yellow-400">
                        {formData.cnpj.replace(/\D/g, '').length}/14 dígitos
                      </span>
                    )}
                    {formData.cnpj?.replace(/\D/g, '').length === 14 && (
                      <span className="text-green-400">✓ CNPJ completo</span>
                    )}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Razão Social</Label>
                  <Input
                    value={formData.razao_social}
                    onChange={(e) => handleInputChange('razao_social', e.target.value)}
                    placeholder="Nome oficial da empresa"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border border-white/10 text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100"
                    )}
                    style={{ color: '#ffffff' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Nome Fantasia</Label>
                  <Input
                    value={formData.nome_fantasia}
                    onChange={(e) => handleInputChange('nome_fantasia', e.target.value)}
                    placeholder="Nome comercial (opcional)"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border border-white/10 text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100"
                    )}
                    style={{ color: '#ffffff' }}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">Email</Label>
                    <Input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="contato@empresa.com"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100"
                      )}
                      style={{ color: '#ffffff' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">Telefone</Label>
                    <Input
                      value={formData.telefone}
                      onChange={(e) => handleInputChange('telefone', e.target.value)}
                      placeholder="(00) 00000-0000"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100"
                      )}
                      style={{ color: '#ffffff' }}
                    />
                  </div>
                </div>
              </div>
          )}

          {/* Step 2: Address */}
          {currentStep === 2 && (
          <div 
            key="step-2"
            className="space-y-6 animate-fade-in"
          >
                {/* CEP and Código do Município - REQUIRED by Nuvem Fiscal */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">CEP * {cepLoading && <span className="text-orange-400 text-xs">(buscando...)</span>}</Label>
                    <Input
                      value={formData.cep}
                      onChange={(e) => {
                        const cleaned = e.target.value.replace(/\D/g, '').slice(0, 8);
                        const formatted = cleaned.replace(/(\d{5})(\d)/, '$1-$2');
                        handleInputChange('cep', formatted);
                        if (cleaned.length === 8) {
                          fetchAddressFromCep(cleaned);
                        }
                      }}
                      placeholder="00000-000"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:ring-2 transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100",
                        formData.cep && formData.cep.replace(/\D/g, '').length !== 8 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                          : formData.cep?.replace(/\D/g, '').length === 8 
                            ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20' 
                            : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20'
                      )}
                      style={{ color: '#ffffff' }}
                      maxLength={9}
                    />
                    <p className="text-xs">
                      {formData.cep && formData.cep.replace(/\D/g, '').length !== 8 && (
                        <span className="text-red-400 block">
                          ⚠️ Deve ter 8 dígitos ({formData.cep.replace(/\D/g, '').length}/8)
                        </span>
                      )}
                      {formData.cep?.replace(/\D/g, '').length === 8 && (
                        <span className="text-green-400 block">✓ CEP válido - endereço será preenchido</span>
                      )}
                      {!formData.cep && <span className="text-gray-500">Digite o CEP para preencher automaticamente</span>}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">Código do Município (IBGE) *</Label>
                    <Input
                      value={formData.codigo_municipio}
                      onChange={(e) => handleInputChange('codigo_municipio', e.target.value.replace(/\D/g, '').slice(0, 7))}
                      placeholder="Ex: 4202008 (exatamente 7 dígitos)"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:ring-2 transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100",
                        formData.codigo_municipio && formData.codigo_municipio.length !== 7 
                          ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/20' 
                          : formData.codigo_municipio?.length === 7 
                            ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20' 
                            : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20'
                      )}
                      style={{ color: '#ffffff' }}
                      maxLength={7}
                    />
                    <p className="text-xs text-gray-500">
                      {formData.codigo_municipio && formData.codigo_municipio.length !== 7 && (
                        <span className="text-red-400 block mb-1">
                          ⚠️ Deve ter exatamente 7 dígitos ({formData.codigo_municipio.length}/7)
                        </span>
                      )}
                      {formData.codigo_municipio?.length === 7 && (
                        <span className="text-green-400 block mb-1">✓ Formato válido</span>
                      )}
                      <span className="text-gray-500">Este NÃO é a inscrição municipal. </span>
                      <a 
                        href="https://www.ibge.gov.br/explica/codigos-dos-municipios.php" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-orange-400 hover:underline"
                      >
                        Consultar código IBGE →
                      </a>
                    </p>
                  </div>
                </div>

                {/* Street address */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="md:col-span-3 space-y-2">
                    <Label className="text-gray-300 font-semibold">Logradouro</Label>
                    <Input
                      value={formData.logradouro}
                      onChange={(e) => handleInputChange('logradouro', e.target.value)}
                      placeholder="Rua, Avenida, etc."
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100"
                      )}
                      style={{ color: '#ffffff' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">Número</Label>
                    <Input
                      value={formData.numero}
                      onChange={(e) => handleInputChange('numero', e.target.value)}
                      placeholder="123"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100"
                      )}
                      style={{ color: '#ffffff' }}
                    />
                  </div>
                </div>

                {/* Neighborhood */}
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Bairro</Label>
                  <Input
                    value={formData.bairro}
                    onChange={(e) => handleInputChange('bairro', e.target.value)}
                    placeholder="Nome do bairro"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border border-white/10 text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100"
                    )}
                    style={{ color: '#ffffff' }}
                  />
                </div>

                {/* City and State */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2 space-y-2">
                    <Label className="text-gray-300 font-semibold">Cidade/Município</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => handleInputChange('cidade', e.target.value)}
                      placeholder="Nome da cidade"
                      className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "placeholder:text-gray-400 placeholder:opacity-100"
                      )}
                      style={{ color: '#ffffff' }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-gray-300 font-semibold">UF</Label>
                    <Select
                      value={formData.uf || undefined}
                      onValueChange={(value) => handleInputChange('uf', value)}
                    >
                      <SelectTrigger className={cn(
                        "h-12",
                        "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                        "backdrop-blur-xl border border-white/10 text-white",
                        "hover:border-orange-500/30",
                        "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                        "transition-all duration-200",
                        "shadow-lg shadow-black/20",
                        "[&>span]:text-gray-400 [&>span[data-placeholder]]:text-gray-400 [&>span[data-placeholder]]:opacity-100"
                      )}>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className={cn(
                        "bg-gradient-to-br from-slate-900/95 via-slate-800/90 to-slate-900/95",
                        "backdrop-blur-xl border border-white/10",
                        "shadow-2xl shadow-black/50"
                      )}>
                        {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                          <SelectItem key={uf} value={uf} className="text-white hover:bg-white/10">{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Municipal Registration */}
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Inscrição Municipal *</Label>
                  <Input
                    value={formData.inscricao_municipal}
                    onChange={(e) => handleInputChange('inscricao_municipal', e.target.value)}
                    placeholder="Número da inscrição municipal"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border border-white/10 text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100"
                    )}
                    style={{ color: '#ffffff' }}
                  />
                  <p className="text-xs text-gray-500">Obrigatório para emissão de NFS-e</p>
                </div>

                <div className={cn(
                  "p-5 rounded-xl",
                  "bg-gradient-to-br from-blue-500/20 via-blue-600/10 to-blue-500/20",
                  "border border-blue-500/30",
                  "backdrop-blur-sm",
                  "shadow-lg shadow-blue-500/20"
                )}>
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-blue-400 font-medium">Campos obrigatórios para Nuvem Fiscal</p>
                      <p className="text-sm text-gray-400 mt-1">
                        O CEP e o Código do Município (IBGE) são obrigatórios para registrar a empresa na Nuvem Fiscal.
                        Você pode consultar o código IBGE do seu município no site oficial.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
          )}

          {/* Step 3: Tax Regime */}
          {currentStep === 3 && (
          <div 
            key="step-3"
            className="space-y-6 animate-fade-in"
          >
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">CNAE Principal</Label>
                  <Input
                    value={formData.cnae_principal}
                    onChange={(e) => handleInputChange('cnae_principal', e.target.value)}
                    placeholder="0000-0/00 - Descrição da atividade"
                    className={cn(
                      "h-12",
                      "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                      "backdrop-blur-xl border border-white/10 text-white",
                      "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                      "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20",
                      "transition-all duration-200",
                      "shadow-lg shadow-black/20",
                      "placeholder:text-gray-400 placeholder:opacity-100"
                    )}
                    style={{ color: '#ffffff' }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-gray-300 font-semibold">Regime Tributário</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {['MEI', 'Simples Nacional', 'Lucro Presumido', 'Lucro Real'].map((regime) => (
                      <button
                        key={regime}
                        onClick={() => handleInputChange('regime_tributario', regime)}
                        className={cn(
                          "p-5 rounded-xl border text-left transition-all duration-200",
                          "backdrop-blur-sm shadow-md hover:shadow-lg",
                          formData.regime_tributario === regime
                            ? cn(
                                "border-orange-500/50 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-orange-500/20",
                                "shadow-lg shadow-orange-500/20"
                              )
                            : cn(
                                "border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                                "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10"
                              )
                        )}
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
              </div>
          )}

          {/* Step 4: Digital Certificate */}
          {currentStep === 4 && (
          <div 
            key="step-4"
            className="space-y-6 animate-fade-in"
          >
                {/* Fiscal Status */}
                {company?.id && (
                  <FiscalStatusIndicator companyId={company.id} />
                )}
                <div className={cn(
                  "p-6 rounded-2xl",
                  "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
                  "backdrop-blur-xl border border-orange-500/30",
                  "shadow-2xl shadow-black/50",
                  "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-purple-500/5 before:to-transparent before:pointer-events-none relative"
                )}>
                  <div className="flex items-start gap-4 relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-xl flex items-center justify-center",
                      "bg-gradient-to-br from-orange-500/30 via-orange-600/20 to-orange-500/30",
                      "border border-orange-500/30",
                      "shadow-lg shadow-orange-500/20"
                    )}>
                      <Shield className="w-7 h-7 text-orange-300" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white mb-2">Certificado Digital</h3>
                      <p className="text-gray-300 mt-1 font-medium">
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
                    type="button"
                    onClick={handleCertificateUpload}
                    className={cn(
                      "w-full p-5 rounded-xl border text-left transition-all duration-200",
                      "backdrop-blur-sm shadow-md hover:shadow-lg",
                      certificateFile
                        ? cn(
                            "border-green-500/50 bg-gradient-to-br from-green-500/20 via-green-600/10 to-green-500/20",
                            "shadow-lg shadow-green-500/20"
                          )
                        : cn(
                            "border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                            "hover:bg-gradient-to-br hover:from-green-500/20 hover:via-green-600/10 hover:to-green-500/20",
                            "hover:border-green-500/50 hover:scale-[1.02]"
                          )
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Check className={`w-5 h-5 ${certificateFile ? 'text-green-400' : 'text-gray-500'}`} />
                        <span className="font-medium text-white">
                          {certificateFile ? certificateFile.name : 'Selecionar certificado A1 (.pfx)'}
                        </span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    </div>
                    <p className="text-sm text-gray-500 mt-2 ml-8">
                      {certificateFile ? 'Clique para alterar o certificado' : 'Faça upload do seu certificado A1 (.pfx)'}
                    </p>
                  </button>

                  {certificateFile && (
                    <div className={cn(
                      "p-5 rounded-xl border space-y-4",
                      "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                      "border-white/10 backdrop-blur-sm",
                      "shadow-md"
                    )}>
                      <div className="space-y-2">
                        <Label className="text-gray-300 font-semibold">Senha do Certificado *</Label>
                        <Input
                          type="password"
                          value={certificatePassword}
                          onChange={(e) => setCertificatePassword(e.target.value)}
                          placeholder="Digite a senha do certificado"
                          className={cn(
                            "h-12",
                            "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90",
                            "backdrop-blur-xl border text-white",
                            "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                            "focus:ring-2 transition-all duration-200",
                            "shadow-lg shadow-black/20",
                            "placeholder:text-gray-400 placeholder:opacity-100",
                            certificatePassword 
                              ? 'border-green-500/50 focus:border-green-500 focus:ring-green-500/20' 
                              : 'border-white/10 focus:border-orange-500/50 focus:ring-orange-500/20'
                          )}
                          style={{ color: '#ffffff' }}
                        />
                        <p className="text-xs text-gray-500">
                          {certificatePassword 
                            ? '✓ Senha informada' 
                            : 'Obrigatório para validar e enviar o certificado'}
                        </p>
                      </div>
                      {certificateFile && certificatePassword && (
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-green-400" />
                            <span className="text-sm text-green-400">Certificado pronto para envio</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleConfigureLater}
                    className={cn(
                      "w-full p-5 rounded-xl border text-left transition-all duration-200 hover:scale-[1.02]",
                      "backdrop-blur-sm shadow-md hover:shadow-lg",
                      !certificateFile
                        ? cn(
                            "border-orange-500/50 bg-gradient-to-br from-orange-500/20 via-orange-600/10 to-orange-500/20",
                            "hover:from-orange-500/30 hover:via-orange-600/20 hover:to-orange-500/30",
                            "hover:border-orange-500 shadow-lg shadow-orange-500/20"
                          )
                        : cn(
                            "border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-white/5",
                            "hover:bg-gradient-to-br hover:from-orange-500/20 hover:via-orange-600/10 hover:to-orange-500/20",
                            "hover:border-orange-500/50"
                          )
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <AlertCircle className={`w-5 h-5 ${!certificateFile ? 'text-orange-400' : 'text-gray-500'}`} />
                      <span className="font-medium text-white">Configurar depois</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-2 ml-8">
                      Você poderá adicionar o certificado posteriormente
                    </p>
                  </button>
                </div>
              </div>
          )}
        </div>

        {/* Footer */}
        <div className={cn(
          "px-8 py-6 border-t border-white/10 flex justify-between relative z-10",
          "bg-gradient-to-r from-white/5 via-transparent to-transparent",
          "backdrop-blur-sm"
        )}>
          <Button
            onClick={handlePrevious}
            variant="outline"
            className={cn(
              "bg-gradient-to-br from-white/5 via-white/3 to-white/5",
              "border border-white/10 text-white",
              "hover:bg-gradient-to-br hover:from-white/10 hover:via-white/5 hover:to-white/10",
              "hover:border-white/20",
              "transition-all duration-200",
              "shadow-md hover:shadow-lg",
              "backdrop-blur-sm",
              "font-semibold"
            )}
            disabled={currentStep === 1}
          >
            Voltar
          </Button>
          <Button
            onClick={handleNext}
            className={cn(
              "bg-gradient-to-br from-orange-500 via-orange-600 to-orange-500",
              "hover:from-orange-600 hover:via-orange-500 hover:to-orange-600",
              "text-white border-0",
              "shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40",
              "border border-orange-400/30",
              "transition-all duration-200",
              "font-semibold"
            )}
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
      </div>
    </div>
  );
}
