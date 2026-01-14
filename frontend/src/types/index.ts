// User & Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
}

// Company Types
export interface Company {
  id: string;
  user_id: string;
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cidade: string;
  uf: string;
  cnae_principal?: string;
  regime_tributario: 'MEI' | 'Simples Nacional' | 'Lucro Presumido' | 'Lucro Real';
  certificado_digital: boolean;
  email: string;
  telefone: string;
  inscricao_municipal: string;
  nuvem_fiscal_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCompanyData {
  cnpj: string;
  razao_social: string;
  nome_fantasia?: string;
  cidade: string;
  uf: string;
  cnae_principal?: string;
  regime_tributario: string;
  certificado_digital?: boolean;
  email: string;
  telefone: string;
  inscricao_municipal: string;
}

export interface UpdateCompanyData extends Partial<CreateCompanyData> {}

// Invoice Types
export type InvoiceStatus = 
  | 'rascunho' 
  | 'pendente_confirmacao' 
  | 'enviada' 
  | 'autorizada' 
  | 'rejeitada' 
  | 'cancelada';

export interface Invoice {
  id: string;
  company_id: string;
  numero?: string;
  cliente_nome: string;
  cliente_documento: string;
  descricao_servico: string;
  valor: number;
  aliquota_iss: number;
  valor_iss: number;
  iss_retido?: boolean;
  status: InvoiceStatus;
  municipio?: string;
  codigo_verificacao?: string;
  data_emissao?: string;
  data_prestacao?: string;
  codigo_servico?: string;
  pdf_url?: string;
  xml_url?: string;
  nuvem_fiscal_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInvoiceData {
  company_id: string;
  cliente_nome: string;
  cliente_documento: string;
  descricao_servico: string;
  valor: number;
  aliquota_iss?: number;
  municipio?: string;
  data_prestacao?: string;
  codigo_servico?: string;
}

export interface UpdateInvoiceData extends Partial<CreateInvoiceData> {
  status?: InvoiceStatus;
}

// Notification Types
export type NotificationType = 'sucesso' | 'erro' | 'alerta' | 'info';

export interface Notification {
  id: string;
  user_id: string;
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
  lida: boolean;
  invoice_id?: string;
  created_at: string;
}

export interface CreateNotificationData {
  titulo: string;
  mensagem: string;
  tipo: NotificationType;
  invoice_id?: string;
}

// User Settings Types
export interface UserSettings {
  id: string;
  user_id: string;
  theme: 'dark' | 'light';
  font_size: 'small' | 'medium' | 'large';
  active_company_id?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateUserSettingsData {
  theme?: 'dark' | 'light';
  font_size?: 'small' | 'medium' | 'large';
  active_company_id?: string;
}

// DAS (Tax Payment) Types
export type DASStatus = 'pendente' | 'pago';

export interface DAS {
  id: string;
  company_id: string;
  referencia: string; // e.g., "01/2025"
  data_vencimento: string;
  valor_total: number;
  valor_inss?: number;
  valor_icms?: number;
  valor_iss?: number;
  status: DASStatus;
  codigo_barras?: string;
  pdf_url?: string;
  data_pagamento?: string;
  created_at: string;
  updated_at: string;
}

// Fiscal Integration Status Types
export type FiscalConnectionStatus = 'conectado' | 'falha' | 'verificando';

export interface FiscalIntegrationStatus {
  id: string;
  company_id: string;
  status: FiscalConnectionStatus;
  mensagem?: string;
  ultima_verificacao?: string;
  created_at: string;
  updated_at: string;
}

// AI Assistant Types
export interface AIMessage {
  id: number;
  isAI: boolean;
  content: string;
  time: string;
}

export interface AIAction {
  type: string | null;
  data?: {
    cliente_nome?: string;
    cliente_documento?: string;
    descricao_servico?: string;
    valor?: number;
    aliquota_iss?: number;
    municipio?: string;
  };
}

export interface AIResponse {
  success: boolean;
  action?: AIAction;
  explanation: string;
  requiresConfirmation?: boolean;
  error?: string;
  message?: string;
}

// API Response Types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
