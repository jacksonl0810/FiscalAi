import apiClient from '../client';

// Client types
export interface Client {
  id: string;
  user_id: string;
  nome: string;
  documento: string;
  tipo_pessoa: 'pf' | 'pj';
  email?: string | null;
  telefone?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  codigo_municipio?: string | null;
  apelido?: string | null;
  notas?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateClientData {
  nome: string;
  documento: string;
  tipo_pessoa?: 'pf' | 'pj';
  email?: string;
  telefone?: string;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  codigo_municipio?: string;
  apelido?: string;
  notas?: string;
}

export interface UpdateClientData extends Partial<CreateClientData> {
  ativo?: boolean;
}

export interface ClientListParams {
  search?: string;
  ativo?: boolean;
  limit?: number;
}

export interface ClientSearchParams {
  q: string;
  limit?: number;
}

interface ApiResponse<T> {
  status: string;
  data: T;
}

export const clientsService = {
  /**
   * Get all clients for the current user
   */
  async list(params?: ClientListParams): Promise<Client[]> {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set('search', params.search);
    if (params?.ativo !== undefined) queryParams.set('ativo', String(params.ativo));
    if (params?.limit) queryParams.set('limit', String(params.limit));
    
    const queryString = queryParams.toString();
    const url = queryString ? `/clients?${queryString}` : '/clients';
    
    const response = await apiClient.get<ApiResponse<{ clients: Client[] }>>(url);
    return response.data.data.clients;
  },

  /**
   * Search clients for quick lookup (used by AI assistant)
   */
  async search(params: ClientSearchParams): Promise<Client[]> {
    const queryParams = new URLSearchParams();
    queryParams.set('q', params.q);
    if (params.limit) queryParams.set('limit', String(params.limit));
    
    const response = await apiClient.get<ApiResponse<{ clients: Client[] }>>(
      `/clients/search?${queryParams.toString()}`
    );
    return response.data.data.clients;
  },

  /**
   * Get a single client by ID
   */
  async get(id: string): Promise<Client> {
    const response = await apiClient.get<ApiResponse<{ client: Client }>>(`/clients/${id}`);
    return response.data.data.client;
  },

  /**
   * Create a new client
   */
  async create(data: CreateClientData): Promise<Client> {
    const response = await apiClient.post<ApiResponse<{ client: Client }>>('/clients', data);
    return response.data.data.client;
  },

  /**
   * Update a client
   */
  async update(id: string, data: UpdateClientData): Promise<Client> {
    const response = await apiClient.put<ApiResponse<{ client: Client }>>(`/clients/${id}`, data);
    return response.data.data.client;
  },

  /**
   * Delete a client (archives if has invoices)
   */
  async delete(id: string): Promise<{ message: string; archived?: boolean; deleted?: boolean }> {
    const response = await apiClient.delete<ApiResponse<{ message: string; archived?: boolean; deleted?: boolean }>>(
      `/clients/${id}`
    );
    return response.data.data;
  },

  /**
   * Restore an archived client
   */
  async restore(id: string): Promise<Client> {
    const response = await apiClient.post<ApiResponse<{ client: Client }>>(`/clients/${id}/restore`);
    return response.data.data.client;
  },
};

export default clientsService;
