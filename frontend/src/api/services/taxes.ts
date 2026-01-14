import apiClient from '../client';
import type { DAS } from '@/types';

export const taxesService = {
  /**
   * Get all DAS payments for the current user's companies
   */
  async list(params?: {
    companyId?: string;
    status?: string;
    year?: number;
    sort?: string;
  }): Promise<DAS[]> {
    const response = await apiClient.get<DAS[]>('/taxes/das', { params });
    return response.data;
  },

  /**
   * Get a single DAS payment
   */
  async get(id: string): Promise<DAS> {
    const response = await apiClient.get<DAS>(`/taxes/das/${id}`);
    return response.data;
  },

  /**
   * Mark DAS as paid
   */
  async markAsPaid(id: string, paymentDate?: string): Promise<DAS> {
    const response = await apiClient.post<DAS>(`/taxes/das/${id}/pay`, {
      data_pagamento: paymentDate || new Date().toISOString().split('T')[0],
    });
    return response.data;
  },

  /**
   * Generate DAS for a specific month
   */
  async generate(companyId: string, referencia: string): Promise<DAS> {
    const response = await apiClient.post<DAS>('/taxes/das/generate', {
      company_id: companyId,
      referencia,
    });
    return response.data;
  },

  /**
   * Download DAS PDF
   */
  async downloadPdf(id: string): Promise<Blob> {
    const response = await apiClient.get(`/taxes/das/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Get tax summary for a company
   */
  async getSummary(companyId: string, year?: number): Promise<{
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
  }> {
    const response = await apiClient.get<{
      totalPaid: number;
      totalPending: number;
      paidCount: number;
      pendingCount: number;
    }>(`/taxes/summary/${companyId}`, {
      params: { year },
    });
    return response.data;
  },
};

export default taxesService;
