import apiClient from '../client';

export interface CreateCheckoutParams {
  plan_id: string;
  return_url: string;
  cancel_url: string;
}

export interface SubscriptionStatus {
  status: 'trial' | 'ativo' | 'inadimplente' | 'cancelado';
  plan_id: string;
  current_period_end: string;
  days_remaining: number;
}

export const subscriptionsService = {
  /**
   * Create a checkout session for subscription
   */
  createCheckout: async (params: CreateCheckoutParams) => {
    const response = await apiClient.post('/subscriptions/create-checkout', params);
    return response.data;
  },

  /**
   * Get current subscription status
   */
  getStatus: async (): Promise<SubscriptionStatus> => {
    const response = await apiClient.get('/subscriptions/status');
    return response.data.data;
  },

  /**
   * Get subscription details
   */
  getDetails: async () => {
    const response = await apiClient.get('/subscriptions/details');
    return response.data.data;
  },

  /**
   * Cancel subscription
   */
  cancel: async () => {
    const response = await apiClient.post('/subscriptions/cancel');
    return response.data;
  },

  /**
   * Create customer in Pagar.me
   */
  createCustomer: async (data: { cpf_cnpj: string; phone?: string }) => {
    const response = await apiClient.post('/subscriptions/create-customer', data);
    return response.data;
  },

  /**
   * Subscribe to a plan
   */
  subscribe: async (planId: string, paymentMethod: object) => {
    const response = await apiClient.post('/subscriptions/subscribe', {
      plan_id: planId,
      payment_method: paymentMethod
    });
    return response.data;
  }
};

export default subscriptionsService;
