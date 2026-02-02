import apiClient from '../client';

export interface CreateCheckoutParams {
  plan_id: string;
  billing_cycle?: 'monthly' | 'semiannual' | 'annual';
  return_url: string;
  cancel_url?: string;
}

export interface SubscriptionStatus {
  status: 'trial' | 'ativo' | 'pending' | 'inadimplente' | 'cancelado';
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

export const subscriptionsService = {
  /**
   * Start subscription flow
   * For trial: activates immediately
   * For paid plans: creates PENDING subscription and returns checkout URL
   * 👉 Subscriptions become ACTIVE only after webhook confirms payment
   */
  createCheckout: async (params: CreateCheckoutParams) => {
    const response = await apiClient.post('/subscriptions/start', params);
    // Backend returns { status, message, data: { checkout_url, ... } }
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
   */
  cancel: async () => {
    const response = await apiClient.post('/subscriptions/cancel');
    return response.data.data || response.data;
  },

  /**
   * Create or update customer data in Pagar.me
   */
  createCustomer: async (data: {
    cpf_cnpj: string;
    phone?: string;
  }) => {
    const response = await apiClient.post('/subscriptions/create-customer', data);
    return response.data.data || response.data;
  },

  /**
   * Confirm checkout (for test/simulated payments only)
   * In production, webhooks handle this automatically
   */
  confirmCheckout: async (planId: string, sessionId?: string) => {
    const response = await apiClient.post('/subscriptions/confirm-checkout', {
      plan_id: planId,
      session_id: sessionId
    });
    return response.data.data || response.data;
  },

  /**
   * Tokenize card (v5-compliant)
   * Converts raw card data to token via backend
   * 
   * ✅ V5-COMPLIANT FLOW:
   * 1. Frontend sends card data to backend /tokenize-card endpoint
   * 2. Backend tokenizes with Pagar.me and returns token_xxxxx
   * 3. Frontend stores token and uses it for payment
   * 4. Backend creates card when token is attached to customer
   * 
   * ⚠️ IMPORTANT:
   * - Returns token (token_xxxxx), NOT card_id
   * - Card is created automatically when token is attached to customer
   * - Card data never persists in frontend
   */
  tokenizeCard: async (data: {
    number: string;
    holder_name: string;
    exp_month: number;
    exp_year: number;
    cvv: string;
  }) => {
    const response = await apiClient.post('/subscriptions/tokenize-card', data);
    return response.data.data || response.data;
  },

  /**
   * Process subscription payment with card_token
   * 
   * ✅ V5-COMPLIANT FLOW:
   * 1. Frontend tokenizes card via /tokenize-card → gets token_xxxxx
   * 2. Frontend sends only token to backend (PCI compliant)
   * 3. Backend creates/gets customer
   * 4. Backend attaches token to customer → creates card automatically
   * 5. Backend creates subscription via POST /subscriptions (v5)
   * 
   * ⚠️ IMPORTANT:
   * - card_token MUST be token_xxxxx format
   * - Backend NEVER receives card number, CVV, or any card data
   * - Card is created automatically when token is attached (v5 requirement)
   * - cpf_cnpj is required for Pagar.me customer creation
   * - phone is REQUIRED for Pagar.me subscription payments (at least one phone)
   * 
   * ✅ RESPONSE:
   * - is_paid: true = payment confirmed immediately (subscription active)
   * - is_paid: false = waiting for webhook confirmation
   * - pagar_me_subscription_id: Pagar.me subscription ID (sub_xxx)
   */
  processPayment: async (data: {
    plan_id: string;
    billing_cycle?: 'monthly' | 'semiannual' | 'annual';
    card_token: string; // ✅ Must be token (token_xxxxx) from tokenization
    cpf_cnpj: string; // ✅ Required for Pagar.me customer creation (CPF: 11 digits, CNPJ: 14 digits)
    phone: string; // ✅ REQUIRED for Pagar.me subscription - must have at least one customer phone
    billing_address: { // ✅ REQUIRED for credit card payments
      line_1: string;
      line_2?: string;
      city: string;
      state: string;
      zip_code: string;
    };
  }): Promise<{
    subscription_id: string;
    pagar_me_subscription_id: string;
    status: string;
    is_paid: boolean;
    plan_id: string;
    current_cycle?: {
      id: string;
      status: string;
      startAt: string;
      endAt: string;
    };
    next_billing_at?: string;
    message: string;
  }> => {
    const response = await apiClient.post('/subscriptions/process-payment', data);
    return response.data.data || response.data;
  },

  /**
   * Verify subscription status directly with Pagar.me (v5)
   * ✅ Use this to confirm payment was actually processed
   * 
   * Returns:
   * - isValid: true if subscription.status='active' AND current_cycle.status='paid'
   */
  verifySubscription: async (): Promise<{
    isValid: boolean;
    status: string;
    isPaid?: boolean;
    subscriptionId?: string;
    pagarMeSubscriptionId?: string;
    currentCycle?: {
      id: string;
      status: string;
      startAt: string;
      endAt: string;
    };
    nextBillingAt?: string;
    verifiedAt?: string;
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
  }
};

export default subscriptionsService;
