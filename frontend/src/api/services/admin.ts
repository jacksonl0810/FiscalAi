import apiClient from '../client';

export interface AdminStats {
  overview: {
    totalUsers: number;
    newUsersThisMonth: number;
    userGrowth: number;
    totalCompanies: number;
    totalSubscriptions: number;
    activeSubscriptions: number;
    totalInvoices: number;
    invoicesThisMonth: number;
    totalRevenue: number;
    revenueThisMonth: number;
  };
  recentUsers: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    isAdmin: boolean;
  }>;
  recentInvoices: Array<{
    id: string;
    numero: string;
    clienteNome: string;
    valor: number;
    status: string;
    dataEmissao: string;
  }>;
  subscriptionBreakdown: Record<string, number>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    status: string;
    planId: string;
    currentPeriodEnd: string;
  };
  _count: {
    companies: number;
    notifications: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminService = {
  // Dashboard Stats
  getStats: async (): Promise<AdminStats> => {
    const response = await apiClient.get('/admin/stats');
    return response.data.data;
  },

  getChartData: async () => {
    const response = await apiClient.get('/admin/stats/chart');
    return response.data.data;
  },

  // Users
  getUsers: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data.data;
  },

  getUser: async (id: string) => {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data.data;
  },

  updateUser: async (id: string, data: { name?: string; email?: string; isAdmin?: boolean }) => {
    const response = await apiClient.put(`/admin/users/${id}`, data);
    return response.data.data;
  },

  deleteUser: async (id: string) => {
    const response = await apiClient.delete(`/admin/users/${id}`);
    return response.data;
  },

  resetUserPassword: async (id: string, newPassword: string) => {
    const response = await apiClient.post(`/admin/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  // Subscriptions
  getSubscriptions: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await apiClient.get('/admin/subscriptions', { params });
    return response.data.data;
  },

  updateSubscription: async (id: string, status: string) => {
    const response = await apiClient.put(`/admin/subscriptions/${id}`, { status });
    return response.data.data;
  },

  // Companies
  getCompanies: async (params?: { page?: number; limit?: number; search?: string }) => {
    const response = await apiClient.get('/admin/companies', { params });
    return response.data.data;
  },

  // Invoices
  getInvoices: async (params?: { page?: number; limit?: number; status?: string }) => {
    const response = await apiClient.get('/admin/invoices', { params });
    return response.data.data;
  },

  // Settings
  getSettings: async () => {
    const response = await apiClient.get('/admin/settings');
    return response.data.data;
  }
};

export default adminService;
