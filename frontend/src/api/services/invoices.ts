import apiClient from '../client';
import type { Invoice, CreateInvoiceData, UpdateInvoiceData, PaginatedResponse } from '@/types';

export const invoicesService = {
  /**
   * Get all invoices (with optional pagination and filters)
   */
  async list(params?: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    sort?: string;
  }): Promise<Invoice[]> {
    const response = await apiClient.get<Invoice[]>('/invoices', { params });
    return response.data;
  },

  /**
   * Get paginated invoices
   */
  async listPaginated(params?: {
    page?: number;
    limit?: number;
    status?: string;
    companyId?: string;
    sort?: string;
  }): Promise<PaginatedResponse<Invoice>> {
    const response = await apiClient.get<PaginatedResponse<Invoice>>('/invoices/paginated', { params });
    return response.data;
  },

  /**
   * Get a single invoice by ID
   */
  async get(id: string): Promise<Invoice> {
    const response = await apiClient.get<Invoice>(`/invoices/${id}`);
    return response.data;
  },

  /**
   * Create a new invoice (draft)
   */
  async create(data: CreateInvoiceData): Promise<Invoice> {
    const response = await apiClient.post<Invoice>('/invoices', data);
    return response.data;
  },

  /**
   * Update an invoice
   */
  async update(id: string, data: UpdateInvoiceData): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`/invoices/${id}`, data);
    return response.data;
  },

  /**
   * Delete an invoice (only drafts)
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/invoices/${id}`);
  },

  /**
   * Issue an invoice (send to fiscal authority)
   */
  async issue(data: {
    companyId: string;
    cliente_nome: string;
    cliente_documento: string;
    descricao_servico: string;
    valor: number;
    aliquota_iss?: number;
    municipio?: string;
    data_prestacao?: string;
    codigo_servico?: string;
  }): Promise<{ status: string; message: string; invoice?: Invoice }> {
    const response = await apiClient.post<{ status: string; message: string; invoice?: Invoice }>(
      '/invoices/issue',
      data
    );
    return response.data;
  },

  /**
   * Check invoice status (query fiscal authority)
   */
  async checkStatus(invoiceId: string): Promise<{ status: string; message: string; invoiceStatus?: string }> {
    const response = await apiClient.post<{ status: string; message: string; invoiceStatus?: string }>(
      `/invoices/${invoiceId}/check-status`
    );
    return response.data;
  },

  /**
   * Cancel an invoice
   */
  async cancel(id: string, reason: string): Promise<{ status: string; message: string }> {
    const response = await apiClient.post<{ status: string; message: string }>(
      `/invoices/${id}/cancel`,
      { reason }
    );
    return response.data;
  },

  /**
   * Download invoice PDF
   */
  async downloadPdf(id: string): Promise<Blob> {
    const response = await apiClient.get(`/invoices/${id}/pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  /**
   * Download invoice XML
   */
  async downloadXml(id: string): Promise<Blob> {
    const response = await apiClient.get(`/invoices/${id}/xml`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default invoicesService;
