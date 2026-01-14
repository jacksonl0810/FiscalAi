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
  async registerInFiscalCloud(companyId: string): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      `/companies/${companyId}/register-fiscal`
    );
    return response.data;
  },

  /**
   * Get fiscal integration status for a company
   */
  async getFiscalStatus(companyId: string): Promise<FiscalIntegrationStatus | null> {
    try {
      const response = await apiClient.get<FiscalIntegrationStatus>(
        `/companies/${companyId}/fiscal-status`
      );
      return response.data;
    } catch (error) {
      return null;
    }
  },

  /**
   * Check/verify fiscal connection
   */
  async checkFiscalConnection(companyId: string): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
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

  /**
   * Upload digital certificate
   */
  async uploadCertificate(companyId: string, file: File, password: string): Promise<void> {
    const formData = new FormData();
    formData.append('certificate', file);
    formData.append('password', password);

    await apiClient.post(`/companies/${companyId}/certificate`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  },
};

export default companiesService;
