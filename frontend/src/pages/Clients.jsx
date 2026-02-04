/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck - UI components (Dialog, Input, Label, etc.) lack proper .d.ts; state and mutations are typed via JSDoc below.
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { clientsService } from "@/api/services";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { handleApiError } from "@/utils/errorHandler";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Users,
  UserPlus,
  Search,
  Edit2,
  Trash2,
  RotateCcw,
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  MoreVertical,
  X,
  Check,
  FileText,
  AlertTriangle,
  ChevronDown,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * @typedef {{
 *   nome: string;
 *   documento: string;
 *   tipo_pessoa: 'pf' | 'pj';
 *   email: string;
 *   telefone: string;
 *   cep: string;
 *   logradouro: string;
 *   numero: string;
 *   complemento: string;
 *   bairro: string;
 *   cidade: string;
 *   uf: string;
 *   apelido: string;
 *   notas: string;
 * }} ClientFormState
 */

/**
 * @typedef {ClientFormState & { id: string; ativo?: boolean; created_at?: string; updated_at?: string }} Client
 */

// Format document for display
function formatDocument(doc, tipo) {
  if (!doc) return '';
  const cleaned = doc.replace(/\D/g, '');
  if (tipo === 'pf' || cleaned.length === 11) {
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  } else {
    return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  }
}

// Format phone for display
function formatPhone(phone) {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }
  return phone;
}

// Client form initial state
const initialFormState = {
  nome: '',
  documento: '',
  tipo_pessoa: 'pf',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  apelido: '',
  notas: ''
};

// UF list for Brazil
const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function Clients() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  /** @type {[Client | null, React.Dispatch<React.SetStateAction<Client | null>>]} */
  const [editingClient, setEditingClient] = useState(null);
  /** @type {[ClientFormState, React.Dispatch<React.SetStateAction<ClientFormState>>]} */
  const [formData, setFormData] = useState(initialFormState);
  /** @type {[Partial<Record<keyof ClientFormState, string>>, React.Dispatch<React.SetStateAction<Partial<Record<keyof ClientFormState, string>>>>]} */
  const [formErrors, setFormErrors] = useState(/** @type {Partial<Record<keyof ClientFormState, string>>} */ ({}));
  /** @type {[Client | null, React.Dispatch<React.SetStateAction<Client | null>>]} */
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [activeTab, setActiveTab] = useState('basic');
  const queryClient = useQueryClient();

  // Fetch clients
  const { data: clients = [], isLoading, refetch } = useQuery({
    queryKey: ['clients', { search: searchTerm, ativo: showArchived ? undefined : true }],
    queryFn: () => clientsService.list({ 
      search: searchTerm || undefined, 
      ativo: showArchived ? undefined : true,
      limit: 100 
    }),
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (data) => clientsService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado com sucesso!');
      closeForm();
    },
    onError: (error) => {
      handleApiError(error, { operation: 'create_client' });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => clientsService.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente atualizado com sucesso!');
      closeForm();
    },
    onError: (error) => {
      handleApiError(error, { operation: 'update_client' });
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => clientsService.delete(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (result.archived) {
        toast.success('Cliente arquivado (possui notas fiscais)');
      } else {
        toast.success('Cliente excluído com sucesso!');
      }
      setDeleteConfirm(null);
    },
    onError: (error) => {
      handleApiError(error, { operation: 'delete_client' });
    }
  });

  // Restore mutation
  const restoreMutation = useMutation({
    mutationFn: (id) => clientsService.restore(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente restaurado com sucesso!');
    },
    onError: (error) => {
      handleApiError(error, { operation: 'restore_client' });
    }
  });

  // Open form for new client
  const openNewForm = () => {
    setEditingClient(null);
    setFormData(initialFormState);
    setFormErrors({});
    setActiveTab('basic');
    setIsFormOpen(true);
  };

  // Open form for editing
  const openEditForm = (client) => {
    setEditingClient(client);
    setFormData({
      nome: client.nome || '',
      documento: client.documento || '',
      tipo_pessoa: client.tipo_pessoa || 'pf',
      email: client.email || '',
      telefone: client.telefone || '',
      cep: client.cep || '',
      logradouro: client.logradouro || '',
      numero: client.numero || '',
      complemento: client.complemento || '',
      bairro: client.bairro || '',
      cidade: client.cidade || '',
      uf: client.uf || '',
      apelido: client.apelido || '',
      notas: client.notas || ''
    });
    setFormErrors({});
    setActiveTab('basic');
    setIsFormOpen(true);
  };

  // Close form
  const closeForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
    setFormData(initialFormState);
    setFormErrors({});
  };

  // Handle form field change
  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when field is modified
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Auto-detect document type
  const handleDocumentoChange = (value) => {
    const cleaned = value.replace(/\D/g, '');
    let tipoPessoa = formData.tipo_pessoa;
    
    if (cleaned.length <= 11) {
      tipoPessoa = 'pf';
    } else if (cleaned.length > 11) {
      tipoPessoa = 'pj';
    }
    
    setFormData(prev => ({
      ...prev,
      documento: cleaned,
      tipo_pessoa: tipoPessoa
    }));
  };

  // Validate form
  const validateForm = () => {
    const errors = {};
    
    if (!formData.nome.trim()) {
      errors.nome = 'Nome é obrigatório';
    }
    
    if (!formData.documento.trim()) {
      errors.documento = 'Documento é obrigatório';
    } else {
      const docLen = formData.documento.replace(/\D/g, '').length;
      if (formData.tipo_pessoa === 'pf' && docLen !== 11) {
        errors.documento = 'CPF deve ter 11 dígitos';
      } else if (formData.tipo_pessoa === 'pj' && docLen !== 14) {
        errors.documento = 'CNPJ deve ter 14 dígitos';
      }
    }
    
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email inválido';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit form
  const handleSubmit = () => {
    if (!validateForm()) return;
    
    const payload = {
      ...formData,
      documento: formData.documento.replace(/\D/g, ''),
      cep: formData.cep?.replace(/\D/g, '') || undefined,
      telefone: formData.telefone?.replace(/\D/g, '') || undefined,
    };
    
    // Remove empty optional fields
    Object.keys(payload).forEach(key => {
      if (payload[key] === '' || payload[key] === undefined) {
        delete payload[key];
      }
    });
    
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  // Fetch address by CEP
  const fetchAddressByCep = async (cep) => {
    const cleaned = cep.replace(/\D/g, '');
    if (cleaned.length !== 8) return;
    
    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleaned}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
      }
    } catch (err) {
      // Silently fail - user can fill manually
    }
  };

  // Filter clients by search
  const filteredClients = useMemo(() => {
    if (!searchTerm) return clients;
    const term = searchTerm.toLowerCase();
    return clients.filter(c => 
      c.nome?.toLowerCase().includes(term) ||
      c.apelido?.toLowerCase().includes(term) ||
      c.documento?.includes(term.replace(/\D/g, '')) ||
      c.email?.toLowerCase().includes(term)
    );
  }, [clients, searchTerm]);

  const activeClients = filteredClients.filter(c => c.ativo);
  const archivedClients = filteredClients.filter(c => !c.ativo);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
              "bg-gradient-to-br from-orange-500/25 to-orange-600/20",
              "border border-orange-500/30",
              "shadow-lg shadow-orange-500/15"
            )}>
              <Users className="w-5 h-5 text-orange-400" />
            </div>
            Clientes
          </h1>
          <p className="text-gray-400 mt-1">
            Gerencie os destinatários das suas notas fiscais
          </p>
        </div>
        <Button
          onClick={openNewForm}
          className={cn(
            "relative overflow-hidden rounded-xl font-semibold",
            "bg-gradient-to-r from-orange-500 via-orange-600 to-orange-500",
            "border border-orange-400/30 text-white",
            "shadow-lg shadow-orange-500/25",
            "hover:shadow-xl hover:shadow-orange-500/30 hover:from-orange-600 hover:via-orange-500 hover:to-orange-600",
            "hover:border-orange-400/50 active:scale-[0.98] transition-all duration-300",
            "before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/15 before:to-transparent before:opacity-0 hover:before:opacity-100 before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-all before:duration-500"
          )}
        >
          <span className="relative z-10 flex items-center">
            <UserPlus className="w-4 h-4 mr-2" />
            Novo Cliente
          </span>
        </Button>
      </div>

      {/* Search and filters */}
      <div className={cn(
        "relative rounded-2xl p-4 overflow-hidden",
        "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
        "border border-white/10 shadow-xl",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
      )}>
        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <div className="relative flex-1 group/input">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 z-10 pointer-events-none" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ, apelido..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={cn(
                "relative pl-12 h-12 rounded-xl",
                "bg-gradient-to-br from-slate-800/90 via-slate-700/80 to-slate-800/90 backdrop-blur-xl",
                "border border-white/10 text-white placeholder:text-gray-400",
                "hover:border-orange-500/30 hover:bg-gradient-to-br hover:from-slate-800/95 hover:via-slate-700/85 hover:to-slate-800/95",
                "focus:border-orange-500/50 focus:ring-2 focus:ring-orange-500/20 focus:bg-gradient-to-br focus:from-slate-800/95 focus:via-slate-700/85 focus:to-slate-800/95",
                "transition-all duration-200 shadow-lg shadow-black/20",
                "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:to-transparent before:pointer-events-none before:rounded-xl"
              )}
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setShowArchived(!showArchived)}
              className={cn(
                "h-11 rounded-xl font-medium transition-all duration-200 ease-out border active:scale-[0.98]",
                showArchived
                  ? [
                      "bg-gradient-to-br from-purple-900/50 via-purple-800/40 to-slate-800/90",
                      "border-purple-500/50 text-purple-100 shadow-lg shadow-purple-500/20",
                      "hover:border-purple-400 hover:text-white hover:from-purple-700/40 hover:via-purple-600/30 hover:to-slate-800/95 hover:shadow-xl hover:shadow-purple-500/25"
                    ]
                  : [
                      "bg-gradient-to-br from-slate-800/95 via-slate-700/80 to-slate-800/95",
                      "border-white/15 text-gray-300",
                      "hover:text-white hover:border-orange-500/50 hover:from-slate-800 hover:via-orange-950/30 hover:to-slate-800 hover:shadow-xl hover:shadow-orange-500/15"
                    ]
              )}
            >
              <Filter className="w-4 h-4 mr-2 shrink-0" />
              {showArchived ? 'Mostrando arquivados' : 'Mostrar arquivados'}
            </Button>
          </div>
        </div>
      </div>

      {/* Clients list */}
      <div className={cn(
        "relative rounded-2xl overflow-hidden",
        "bg-gradient-to-br from-slate-900/90 via-slate-800/70 to-slate-900/90",
        "border border-white/10 shadow-xl",
        "before:absolute before:inset-0 before:bg-gradient-to-br before:from-orange-500/5 before:via-transparent before:to-transparent before:pointer-events-none"
      )}>
        {isLoading ? (
          <div className="p-12 text-center relative z-10">
            <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto" />
            <p className="text-gray-400 mt-4">Carregando clientes...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="p-12 text-center relative z-10">
            <Users className="w-12 h-12 text-gray-500 mx-auto mb-4 opacity-80" />
            <p className="text-gray-400 mb-2">
              {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            </p>
            {!searchTerm && (
              <Button
                onClick={openNewForm}
                variant="outline"
                className={cn(
                  "group relative mt-4 rounded-xl font-semibold",
                  "bg-gradient-to-br from-slate-800/95 via-orange-950/30 to-slate-800/95",
                  "border border-orange-500/40 text-orange-200",
                  "shadow-lg shadow-orange-500/15",
                  "hover:border-orange-400 hover:text-white",
                  "hover:bg-gradient-to-br hover:from-orange-600/30 hover:via-orange-500/20 hover:to-slate-800/95",
                  "hover:shadow-xl hover:shadow-orange-500/25",
                  "active:scale-[0.98] transition-all duration-200 ease-out"
                )}
              >
                <span className="flex items-center">
                  <UserPlus className="w-4 h-4 mr-2" />
                  Cadastrar primeiro cliente
                </span>
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-white/10 relative z-10">
            {/* Active clients */}
            {activeClients.map((client) => (
              <ClientRow 
                key={client.id}
                client={client}
                onEdit={() => openEditForm(client)}
                onDelete={() => setDeleteConfirm(client)}
                onRestore={undefined}
                isArchived={false}
              />
            ))}
            
            {/* Archived clients */}
            {showArchived && archivedClients.length > 0 && (
              <>
                <div className="px-6 py-3 bg-gray-800/50">
                  <span className="text-sm font-medium text-gray-400">
                    Arquivados ({archivedClients.length})
                  </span>
                </div>
                {archivedClients.map((client) => (
                  <ClientRow 
                    key={client.id}
                    client={client}
                    onEdit={() => openEditForm(client)}
                    onDelete={() => setDeleteConfirm(client)}
                    onRestore={() => restoreMutation.mutate(client.id)}
                    isArchived
                  />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Client form dialog */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className={cn(
          "sm:max-w-[600px] max-h-[90vh] overflow-y-auto",
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
          "border border-white/10"
        )}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              {editingClient ? (
                <>
                  <Edit2 className="w-5 h-5 text-orange-400" />
                  Editar Cliente
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 text-orange-400" />
                  Novo Cliente
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              {editingClient 
                ? 'Atualize os dados do cliente.'
                : 'Cadastre um novo cliente para emitir notas fiscais.'
              }
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
            <TabsList className="grid w-full grid-cols-2 bg-white/5">
              <TabsTrigger value="basic" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
                Dados Básicos
              </TabsTrigger>
              <TabsTrigger value="address" className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-300">
                Endereço
              </TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              {/* Nome */}
              <div className="space-y-2">
                <Label htmlFor="nome" className="text-gray-300">
                  Nome / Razão Social *
                </Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(e) => handleFieldChange('nome', e.target.value)}
                  placeholder="Nome completo ou razão social"
                  className={cn(
                    "bg-white/5 border-white/10 text-white",
                    formErrors.nome && "border-red-500/50"
                  )}
                />
                {formErrors.nome && (
                  <p className="text-xs text-red-400">{formErrors.nome}</p>
                )}
              </div>

              {/* Apelido */}
              <div className="space-y-2">
                <Label htmlFor="apelido" className="text-gray-300">
                  Apelido (para busca rápida)
                </Label>
                <Input
                  id="apelido"
                  value={formData.apelido}
                  onChange={(e) => handleFieldChange('apelido', e.target.value)}
                  placeholder="Ex: Gabriel, Dr. Silva, Empresa ABC"
                  className="bg-white/5 border-white/10 text-white"
                />
                <p className="text-xs text-gray-500">
                  Use um nome curto para encontrar rapidamente via IA
                </p>
              </div>

              {/* Tipo pessoa e documento */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-gray-300">Tipo</Label>
                  <Select
                    value={formData.tipo_pessoa}
                    onValueChange={(value) => handleFieldChange('tipo_pessoa', value)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pf">
                        <span className="flex items-center gap-2">
                          <User className="w-4 h-4" /> CPF
                        </span>
                      </SelectItem>
                      <SelectItem value="pj">
                        <span className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" /> CNPJ
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="documento" className="text-gray-300">
                    {formData.tipo_pessoa === 'pf' ? 'CPF *' : 'CNPJ *'}
                  </Label>
                  <Input
                    id="documento"
                    value={formatDocument(formData.documento, formData.tipo_pessoa)}
                    onChange={(e) => handleDocumentoChange(e.target.value)}
                    placeholder={formData.tipo_pessoa === 'pf' ? '000.000.000-00' : '00.000.000/0000-00'}
                    className={cn(
                      "bg-white/5 border-white/10 text-white",
                      formErrors.documento && "border-red-500/50"
                    )}
                  />
                  {formErrors.documento && (
                    <p className="text-xs text-red-400">{formErrors.documento}</p>
                  )}
                </div>
              </div>

              {/* Email and phone */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-gray-300">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleFieldChange('email', e.target.value)}
                      placeholder="email@exemplo.com"
                      className={cn(
                        "pl-10 bg-white/5 border-white/10 text-white",
                        formErrors.email && "border-red-500/50"
                      )}
                    />
                  </div>
                  {formErrors.email && (
                    <p className="text-xs text-red-400">{formErrors.email}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telefone" className="text-gray-300">Telefone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <Input
                      id="telefone"
                      value={formatPhone(formData.telefone)}
                      onChange={(e) => handleFieldChange('telefone', e.target.value.replace(/\D/g, ''))}
                      placeholder="(00) 00000-0000"
                      className="pl-10 bg-white/5 border-white/10 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notas" className="text-gray-300">Observações</Label>
                <Textarea
                  id="notas"
                  value={formData.notas}
                  onChange={(e) => handleFieldChange('notas', e.target.value)}
                  placeholder="Anotações internas sobre o cliente..."
                  rows={3}
                  className="bg-white/5 border-white/10 text-white resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="address" className="space-y-4 mt-4">
              {/* CEP */}
              <div className="space-y-2">
                <Label htmlFor="cep" className="text-gray-300">CEP</Label>
                <Input
                  id="cep"
                  value={formData.cep?.replace(/(\d{5})(\d{3})/, '$1-$2') || ''}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    handleFieldChange('cep', value);
                    if (value.length === 8) {
                      fetchAddressByCep(value);
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                  className="bg-white/5 border-white/10 text-white"
                />
                <p className="text-xs text-gray-500">
                  Digite o CEP para preencher automaticamente
                </p>
              </div>

              {/* Street and number */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="logradouro" className="text-gray-300">Logradouro</Label>
                  <Input
                    id="logradouro"
                    value={formData.logradouro}
                    onChange={(e) => handleFieldChange('logradouro', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="numero" className="text-gray-300">Número</Label>
                  <Input
                    id="numero"
                    value={formData.numero}
                    onChange={(e) => handleFieldChange('numero', e.target.value)}
                    placeholder="123"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              {/* Complement and neighborhood */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="complemento" className="text-gray-300">Complemento</Label>
                  <Input
                    id="complemento"
                    value={formData.complemento}
                    onChange={(e) => handleFieldChange('complemento', e.target.value)}
                    placeholder="Apto, Sala, etc."
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bairro" className="text-gray-300">Bairro</Label>
                  <Input
                    id="bairro"
                    value={formData.bairro}
                    onChange={(e) => handleFieldChange('bairro', e.target.value)}
                    placeholder="Bairro"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
              </div>

              {/* City and state */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="cidade" className="text-gray-300">Cidade</Label>
                  <Input
                    id="cidade"
                    value={formData.cidade}
                    onChange={(e) => handleFieldChange('cidade', e.target.value)}
                    placeholder="Cidade"
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="uf" className="text-gray-300">UF</Label>
                  <Select
                    value={formData.uf}
                    onValueChange={(value) => handleFieldChange('uf', value)}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {UF_OPTIONS.map(uf => (
                        <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button
              variant="outline"
              onClick={closeForm}
              className="bg-white/5 border-white/10 text-gray-300 hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className={cn(
                "bg-gradient-to-r from-orange-500 to-orange-600",
                "hover:from-orange-600 hover:to-orange-700",
                "text-white font-semibold"
              )}
            >
              {(createMutation.isPending || updateMutation.isPending) ? (
                <span className="flex items-center gap-2">
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  Salvando...
                </span>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  {editingClient ? 'Salvar Alterações' : 'Cadastrar Cliente'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className={cn(
          "sm:max-w-[400px]",
          "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
          "border border-white/10"
        )}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Excluir Cliente
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Tem certeza que deseja excluir <strong className="text-white">{deleteConfirm?.nome}</strong>?
              {deleteConfirm && (
                <span className="block mt-2 text-yellow-400/80 text-sm">
                  Se o cliente tiver notas fiscais, ele será arquivado ao invés de excluído.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm(null)}
              className="bg-white/5 border-white/10 text-gray-300"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30"
            >
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Client row component
function ClientRow({ client, onEdit, onDelete, onRestore, isArchived }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "px-6 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors",
        isArchived && "opacity-60"
      )}
    >
      {/* Icon */}
      <div className={cn(
        "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
        client.tipo_pessoa === 'pj' 
          ? "bg-purple-500/20 text-purple-400"
          : "bg-blue-500/20 text-blue-400"
      )}>
        {client.tipo_pessoa === 'pj' ? (
          <Building2 className="w-5 h-5" />
        ) : (
          <User className="w-5 h-5" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-white truncate">
            {client.nome}
          </span>
          {client.apelido && (
            <Badge variant="outline" className="text-xs bg-white/5 border-white/10 text-gray-400">
              {client.apelido}
            </Badge>
          )}
          {isArchived && (
            <Badge variant="secondary" className="text-xs bg-gray-500/20 text-gray-400">
              Arquivado
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {formatDocument(client.documento, client.tipo_pessoa)}
          </span>
          {client.email && (
            <span className="flex items-center gap-1 truncate">
              <Mail className="w-3 h-3" />
              {client.email}
            </span>
          )}
          {client.telefone && (
            <span className="flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {formatPhone(client.telefone)}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="text-gray-400 hover:text-white hover:bg-white/10"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="bg-slate-900 border-white/10">
          <DropdownMenuItem
            onClick={onEdit}
            className="text-gray-300 hover:text-white focus:text-white cursor-pointer"
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Editar
          </DropdownMenuItem>
          {isArchived && onRestore && (
            <DropdownMenuItem
              onClick={onRestore}
              className="text-green-400 hover:text-green-300 focus:text-green-300 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Restaurar
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator className="bg-white/10" />
          <DropdownMenuItem
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 focus:text-red-300 cursor-pointer"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </motion.div>
  );
}
