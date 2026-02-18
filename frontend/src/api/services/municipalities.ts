import apiClient from '../client';

export interface AuthRequirements {
  raw: string[];
  requiresCertificate: boolean;
  requiresLoginSenha: boolean;
  authMode: 'certificate_only' | 'municipal_only' | 'both' | 'unknown' | 'none';
  authModeDescription: string;
}

export interface MunicipalityAuthResponse {
  codigo_ibge: string;
  supported: boolean | null;
  nome: string;
  uf: string;
  provedor: string | null;
  auth_requirements: AuthRequirements | null;
  message: string;
  checked_at: string;
  hint?: string;
}

export interface MunicipalityCheckResponse {
  supported: boolean | null;
  message: string;
  checked_at: string;
  codigo_municipio: string;
  data?: {
    codigo: string;
    nome: string;
    uf: string;
    provedor?: string;
  };
}

export const municipalitiesService = {
  /**
   * Get authentication requirements for a municipality
   * Returns what auth methods are required: certificate_only, municipal_only, or both
   */
  getAuthRequirements: async (codigoIbge: string): Promise<MunicipalityAuthResponse> => {
    const cleanCodigo = codigoIbge.replace(/\D/g, '');
    const { data } = await apiClient.get(`/municipalities/${cleanCodigo}/auth-requirements`);
    return data.data;
  },

  /**
   * Check if a municipality is supported for NFS-e
   */
  checkSupport: async (codigoMunicipio: string): Promise<MunicipalityCheckResponse> => {
    const cleanCodigo = codigoMunicipio.replace(/\D/g, '');
    const { data } = await apiClient.get(`/municipalities/check`, {
      params: { codigo_municipio: cleanCodigo }
    });
    return data.data;
  },

  /**
   * Check and update municipality support for a company
   */
  checkCompanySupport: async (companyId: string): Promise<MunicipalityCheckResponse> => {
    const { data } = await apiClient.get(`/municipalities/check`, {
      params: { company_id: companyId }
    });
    return data.data;
  },

  /**
   * Get municipality support status for a company
   */
  getCompanyStatus: async (companyId: string) => {
    const { data } = await apiClient.get(`/municipalities/company/${companyId}/status`);
    return data.data;
  }
};
