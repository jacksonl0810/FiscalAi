import apiClient from '../client';

export interface CreateCheckoutParams {
  plan_id: string;
  billing_cycle?: 'monthly' | 'semiannual' | 'annual';
  return_url: string;
  cancel_url?: string;
}

export interface SubscriptionStatus {
  status: 'trial' | 'ACTIVE' | 'PENDING' | 'PAST_DUE' | 'CANCELED' | 'TRIAL' | string;
  plan_id?: string;
  current_period_end?: string;
  days_remaining?: number;
  has_used_trial?: boolean;
  trial_eligible?: boolean;
}

export interface TrialEligibility {
  eligible: boolean;
  hasUsedTrial: boolean;
  trialStartedAt?: string;
  trialEndedAt?: string;
  message: string;
}

export interface ProcessPaymentParams {
  plan_id: string;
  billing_cycle?: 'monthly' | 'semiannual' | 'annual';
  payment_method_id: string; // Stripe PaymentMethod ID (pm_xxx)
  cpf_cnpj?: string;
  phone?: string;
  billing_address?: {
    line_1: string;
    line_2?: string;
    city: string;
    state: string;
    zip_code: string;
  };
}

export interface ProcessPaymentResponse {
  subscription_id: string;
  stripe_subscription_id: string;
  status: string;
  is_paid: boolean;
  plan_id: string;
  client_secret?: string; // For 3D Secure confirmation
  current_period_end?: string;
  message: string;
}

export const subscriptionsService = {
  /**
   * Start subscription flow
   * For trial: activates immediately
   * For paid plans: redirects to checkout page
   */
  createCheckout: async (params: CreateCheckoutParams) => {
    const response = await apiClient.post('/subscriptions/start', params);
    return response.data.data || response.data;
  },

  /**
   * Get current subscription status
   */
  getStatus: async (): Promise<SubscriptionStatus> => {
    const response = await apiClient.get('/subscriptions/status');
    return response.data.data || response.data;
  },

  /**
   * Check if user is eligible for free trial
   * Users can only use trial ONCE
   */
  checkTrialEligibility: async (): Promise<TrialEligibility> => {
    const response = await apiClient.get('/subscriptions/trial-eligibility');
    return response.data.data || response.data;
  },

  /**
   * Get current subscription with payment history
   */
  getCurrent: async () => {
    const response = await apiClient.get('/subscriptions/current');
    return response.data.data || response.data;
  },

  /**
   * Cancel active subscription
   * Subscription will remain active until end of billing period
   */
  cancel: async () => {
    const response = await apiClient.post('/subscriptions/cancel');
    return response.data.data || response.data;
  },

  /**
   * Reactivate a canceled subscription
   * Only works if subscription was canceled but still within billing period
   */
  reactivate: async () => {
    const response = await apiClient.post('/subscriptions/reactivate');
    return response.data.data || response.data;
  },

  /**
   * Process subscription payment with Stripe
   * 
   * ✅ STRIPE FLOW:
   * 1. Frontend creates PaymentMethod via Stripe.js → gets pm_xxxxx
   * 2. Frontend sends payment_method_id to backend
   * 3. Backend creates/gets Stripe customer
   * 4. Backend attaches payment method to customer
   * 5. Backend creates subscription
   * 
   * ⚠️ IMPORTANT:
   * - payment_method_id MUST be pm_xxxxx format from Stripe.js
   * - If client_secret is returned, confirm payment with stripe.confirmCardPayment()
   * 
   * ✅ RESPONSE:
   * - is_paid: true = payment confirmed immediately (subscription active)
   * - is_paid: false = needs confirmation or waiting for webhook
   * - client_secret: use for 3D Secure confirmation if present
   */
  processPayment: async (data: ProcessPaymentParams): Promise<ProcessPaymentResponse> => {
    const response = await apiClient.post('/subscriptions/process-payment', data);
    return response.data.data || response.data;
  },

  /**
   * Create a SetupIntent for adding a payment method
   * Returns clientSecret for Stripe.js confirmSetup
   */
  createSetupIntent: async () => {
    const response = await apiClient.post('/subscriptions/create-setup-intent');
    return response.data.data || response.data;
  },

  /**
   * Update default payment method
   * @param paymentMethodId - Stripe PaymentMethod ID (pm_xxx)
   */
  updatePaymentMethod: async (paymentMethodId: string) => {
    const response = await apiClient.post('/subscriptions/update-payment-method', {
      payment_method_id: paymentMethodId
    });
    return response.data.data || response.data;
  },

  /**
   * Get Stripe Customer Portal URL
   * Redirects user to Stripe's hosted portal for managing subscription
   */
  getPortalUrl: async (): Promise<{ url: string }> => {
    const response = await apiClient.get('/subscriptions/portal');
    return response.data.data || response.data;
  },

  /**
   * Verify subscription status directly with Stripe
   * ✅ Use this to confirm payment was actually processed
   */
  verifySubscription: async (): Promise<{
    isValid: boolean;
    status: string;
    stripeStatus?: string;
    subscriptionId?: string;
    stripeSubscriptionId?: string;
    currentPeriodEnd?: string;
  }> => {
    const response = await apiClient.get('/subscriptions/verify');
    return response.data.data || response.data;
  },

  /**
   * Get current user's plan limits
   */
  getLimits: async () => {
    const response = await apiClient.get('/subscriptions/limits');
    return response.data.data || response.data;
  },

  // ============================================
  // DEPRECATED - Kept for backward compatibility
  // ============================================

  /**
   * @deprecated Use Stripe.js createPaymentMethod instead
   * This endpoint no longer exists in the backend
   */
  tokenizeCard: async (_data: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  }) => {
    console.warn('[subscriptionsService] tokenizeCard is deprecated. Use Stripe.js createPaymentMethod instead.');
    throw new Error('Card tokenization should be done via Stripe.js on the frontend');
  },

  /**
   * @deprecated Use createCheckout instead
   */
  createCustomer: async (_data: {
    cpf_cnpj: string;
    phone?: string;
  }) => {
    console.warn('[subscriptionsService] createCustomer is deprecated. Customers are created automatically during checkout.');
    throw new Error('Customer creation is now automatic during checkout');
  },

  /**
   * @deprecated Not needed with Stripe - webhooks handle confirmation
   */
  confirmCheckout: async (_planId: string, _sessionId?: string) => {
    console.warn('[subscriptionsService] confirmCheckout is deprecated. Stripe webhooks handle confirmation automatically.');
    throw new Error('Checkout confirmation is now handled by Stripe webhooks');
  }
};

export default subscriptionsService;
