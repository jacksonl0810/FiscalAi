import apiClient from '../client';
import type { Company, CreateCompanyData, UpdateCompanyData, FiscalIntegrationStatus } from '@/types';

export const companiesService = {
  /**
   * Get all companies for the current user
   */
  async list(): Promise<Company[]> {
    const response = await apiClient.get<Company[]>('/companies');
    return response.data;
  },

  /**
   * Get a single company by ID
   */
  async get(id: string): Promise<Company> {
    const response = await apiClient.get<Company>(`/companies/${id}`);
    return response.data;
  },

  /**
   * Create a new company
   */
  async create(data: CreateCompanyData): Promise<Company> {
    const response = await apiClient.post<Company>('/companies', data);
    return response.data;
  },

  /**
   * Update a company
   */
  async update(id: string, data: UpdateCompanyData): Promise<Company> {
    const response = await apiClient.put<Company>(`/companies/${id}`, data);
    return response.data;
  },

  /**
   * Delete a company
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/companies/${id}`);
  },

  /**
   * Register company in fiscal cloud (Nuvem Fiscal)
   */
  async registerInFiscalCloud(companyId: string): Promise<{ 
    status?: string; 
    message?: string; 
    nuvemFiscalId?: string; 
    alreadyExists?: boolean;
    requiresCertificateVerification?: boolean;
    nextStep?: string;
  }> {
    const response = await apiClient.post<{ 
      status: string; 
      message: string; 
      data?: { 
        status?: string;
        nuvemFiscalId?: string; 
        alreadyExists?: boolean;
        requiresCertificateVerification?: boolean;
        nextStep?: string;
        message?: string;
      } 
    }>(
      `/companies/${companyId}/register-fiscal`
    );
    // Extract nested data from the wrapped response
    const result = response.data;
    return {
      status: result.data?.status || result.status,
      message: result.data?.message || result.message,
      nuvemFiscalId: result.data?.nuvemFiscalId,
      alreadyExists: result.data?.alreadyExists,
      requiresCertificateVerification: result.data?.requiresCertificateVerification,
      nextStep: result.data?.nextStep,
    };
  },

  async getFiscalStatus(companyId: string): Promise<FiscalIntegrationStatus | null> {
    try {
      const response = await apiClient.get<{ status: string; message: string; data: FiscalIntegrationStatus }>(
        `/companies/${companyId}/fiscal-status`
      );
      return response.data.data || response.data;
    } catch (error) {
      return null;
    }
  },

  async checkFiscalConnection(companyId: string): Promise<{ status: string; message: string; data?: unknown }> {
    const response = await apiClient.post<{ status: string; message: string; data: unknown }>(
      `/companies/${companyId}/check-fiscal-connection`
    );
    return response.data;
  },

  /**
   * Get MEI limit status
   */
  async getMEILimitStatus(companyId: string): Promise<{
    isMEI: boolean;
    yearlyRevenue?: number;
    limit?: number;
    percentage?: number;
    remaining?: number;
    alertLevel?: string;
    status?: string;
  } | null> {
    const response = await apiClient.get<{
      status: string;
      data: {
        isMEI: boolean;
        yearlyRevenue?: number;
        limit?: number;
        percentage?: number;
        remaining?: number;
        alertLevel?: string;
        status?: string;
      }
    }>(`/companies/${companyId}/mei-limit-status`);
    return response.data.data;
  },

  async uploadCertificate(companyId: string, file: File, password: string): Promise<{
    credential_id?: string;
    expires_at?: string;
    nuvem_fiscal?: {
      status: string;
      message: string;
    };
  }> {
    const formData = new FormData();
    formData.append('certificate', file);
    formData.append('password', password);

    const response = await apiClient.post(`/companies/${companyId}/certificate`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data;
  },

  async saveMunicipalCredentials(companyId: string, username: string, password: string, token?: string): Promise<{
    credential_id?: string;
    nuvem_fiscal?: {
      status: string;
      message: string;
    };
    warning?: {
      type: string;
      message: string;
      affectedCompanies?: Array<{
        id: string;
        name: string;
        cnpj: string;
      }>;
    };
  }> {
    const response = await apiClient.post(`/companies/${companyId}/municipal-credentials`, {
      username,
      password,
      ...(token ? { token } : {})
    });
    return response.data.data;
  },

  async getMunicipalCredentialsStatus(companyId: string): Promise<{
    exists: boolean;
    type?: string;
    usernameHint?: string;
    hasToken?: boolean;
    storedAt?: string;
  }> {
    const response = await apiClient.get(`/companies/${companyId}/municipal-credentials/status`);
    return response.data.data;
  },

  /**
   * Test NFS-e emission capability for a company
   * Detects configuration issues or provider bugs before trying to emit real invoices
   */
  async testNfseEmission(companyId: string): Promise<{
    canEmit: boolean;
    status: string;
    code?: string;
    message: string;
    action?: string;
    supportUrl?: string;
    technicalDetails?: unknown;
    municipality?: {
      codigo: string;
      cidade: string;
      uf: string;
    };
  }> {
    const response = await apiClient.post<{
      status: string;
      message: string;
      data: {
        canEmit: boolean;
        status: string;
        code?: string;
        message: string;
        action?: string;
        supportUrl?: string;
        technicalDetails?: unknown;
        municipality?: {
          codigo: string;
          cidade: string;
          uf: string;
        };
      };
    }>(`/companies/${companyId}/test-nfse-emission`);
    return response.data.data;
  },
};

export default companiesService;
