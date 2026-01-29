/**
 * Pagar.me Core API v5 Integration Service
 * 
 * ✅ CLEAN V5-ONLY IMPLEMENTATION
 * 
 * CORRECT SUBSCRIPTION FLOW (v5):
 * 1. tokenizeCard() → returns card_id (card_xxxxx)
 * 2. getOrCreateCustomer() → returns customer_id (cus_xxxxx)
 * 3. attachCardToCustomer() → attaches card_id to customer (REQUIRED)
 * 4. createSubscription() → creates subscription with card_id
 * 
 * ⚠️ IMPORTANT:
 * - Pagar.me v5 /tokens returns card_id (card_xxxxx) directly
 * - Subscriptions API requires card.id field (card must be attached first)
 * - All functions use HTTP API (no legacy SDK)
 * 
 * Documentation: https://docs.pagar.me/reference
 */

import crypto from 'crypto';
import axios from 'axios';
import https from 'https';

const API_BASE = 'https://api.pagar.me/core/v5';

// Timeout configuration
const PAGARME_TIMEOUT = 30000; // 30 seconds

// Create HTTPS agent with keep-alive for better connection handling
const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: PAGARME_TIMEOUT
});

const PAGARME_API_KEY = process.env.PAGARME_API_KEY; // Secret key (sk_test_... or sk_live_...)
const PAGARME_PUBLIC_KEY = process.env.PAGARME_PUBLIC_KEY || process.env.VITE_PAGARME_PUBLIC_KEY; // Public key (pk_test_... or pk_live_...)
const PAGARME_WEBHOOK_SECRET = process.env.PAGARME_WEBHOOK_SECRET || PAGARME_API_KEY;

/**
 * Check if Pagar.me is configured
 * @returns {boolean}
 */
export function isConfigured() {
  return !!PAGARME_API_KEY && PAGARME_API_KEY.trim().length > 0;
}

/**
 * Get authentication headers for API requests
 */
function getAuthHeaders() {
  if (!isConfigured()) {
    throw new Error('Pagar.me API key not configured');
  }
  const authHeader = Buffer.from(`${PAGARME_API_KEY}:`).toString('base64');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${authHeader}`,
    'Accept': 'application/json'
  };
}

/**
 * Validate ID format
 */
function assertId(id, prefix, name) {
  if (!id || !id.startsWith(prefix)) {
    throw new Error(`Invalid ${name}. Expected ${prefix}*, got: ${id || 'undefined'}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Card Tokenization (v5)                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Tokenize card using Pagar.me v5 API (uses public key)
 * ⚠️ IMPORTANT: In v5, this ONLY creates a token. NO card creation here.
 * Cards are created implicitly when attaching token to customer.
 * 
 * @param {object} cardData - Card data
 * @param {string} cardData.number - Card number
 * @param {string} cardData.holder_name - Cardholder name
 * @param {string} cardData.exp_month - Expiration month (01-12)
 * @param {string} cardData.exp_year - Expiration year (4 digits)
 * @param {string} cardData.cvv - CVV code
 * @returns {Promise<object>} Token result with token_xxxxx
 */
export async function tokenizeCard(cardData) {
  if (!PAGARME_PUBLIC_KEY) {
    throw new Error('Pagar.me public key (PAGARME_PUBLIC_KEY) is required for card tokenization');
  }

  if (!PAGARME_PUBLIC_KEY.startsWith('pk_')) {
    throw new Error('Invalid Pagar.me public key format. Must start with "pk_test_" or "pk_live_"');
  }

  try {
    const apiUrl = `${API_BASE}/tokens?appId=${encodeURIComponent(PAGARME_PUBLIC_KEY)}`;

    const requestBody = {
      type: 'card',
      card: {
        number: cardData.number.replace(/\s/g, ''),
        holder_name: cardData.holder_name.toUpperCase(),
        exp_month: cardData.exp_month.toString().padStart(2, '0'),
        exp_year: cardData.exp_year.toString(),
        cvv: cardData.cvv
      }
    };

    console.log('[Card Tokenization] Tokenizing card with Pagar.me v5 API');

    const response = await axios.post(apiUrl, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const tokenId = response.data.id;

    if (!tokenId) {
      throw new Error('Token not received from Pagar.me');
    }

    // ✅ Pagar.me /tokens returns token_xxxxx
    // This token will be converted to card_xxxxx when attached to customer
    if (!tokenId.startsWith('token_')) {
      throw new Error(`Invalid token format. Expected token_xxxxx, got: ${tokenId.substring(0, 20)}...`);
    }

    console.log('[Card Tokenization] ✅ Successfully tokenized card:', {
      token: tokenId.substring(0, 20) + '...',
      note: 'Token will be converted to card when attached to customer'
    });

    return {
      token: tokenId, // ✅ Returns token_xxxxx (card created later during attachment)
      card: response.data.card // Card preview data (last 4 digits, brand, etc.)
    };
  } catch (error) {
    console.error('[Pagar.me] Error tokenizing card:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    const errorData = error.response?.data || {};
    throw new Error(`Falha ao tokenizar cartão: ${errorData.message || error.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Customer Management                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Create a customer in Pagar.me
 * @param {object} customerData - Customer data
 * @param {string} customerData.name - Customer name
 * @param {string} customerData.email - Customer email
 * @param {string} customerData.cpfCnpj - CPF or CNPJ (numbers only)
 * @param {string} customerData.phone - Phone number (optional)
 * @param {string} customerData.externalId - External ID (user ID from our system)
 * @returns {Promise<object>} Created customer with customerId
 */
export async function createCustomer(customerData) {
  try {
    const apiUrl = `${API_BASE}/customers`;
    
    // Validate CPF/CNPJ is provided
    if (!customerData.cpfCnpj || customerData.cpfCnpj.trim() === '') {
      throw new Error('CPF_CNPJ_REQUIRED');
    }
    
    const document = customerData.cpfCnpj.replace(/\D/g, '');
    
    // Validate document length (CPF = 11 digits, CNPJ = 14 digits)
    if (document.length !== 11 && document.length !== 14) {
      throw new Error('INVALID_CPF_CNPJ');
    }

    const requestBody = {
      name: customerData.name,
      email: customerData.email,
      external_id: customerData.externalId,
      type: document.length === 11 ? 'individual' : 'company',
      document: document
    };

    if (customerData.phone) {
      const cleanPhone = customerData.phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        requestBody.phones = {
          mobile_phone: {
        country_code: '55',
            area_code: cleanPhone.substring(0, 2),
            number: cleanPhone.substring(2)
          }
        };
    }
    }

    console.log('[Pagar.me] Creating customer:', {
      email: customerData.email,
      documentLength: document.length,
      type: requestBody.type
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const customerId = response.data.id;
    assertId(customerId, 'cus_', 'customer_id');

    console.log('[Pagar.me] ✅ Customer created:', {
      customerId,
      email: customerData.email
    });

    return {
      customerId,
      externalId: customerData.externalId
    };
  } catch (error) {
    console.error('[Pagar.me] Error creating customer:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Handle specific error codes
    if (error.message === 'CPF_CNPJ_REQUIRED') {
      throw new Error('CPF ou CNPJ é obrigatório para processar o pagamento. Por favor, adicione seu CPF/CNPJ nas configurações da conta.');
    }
    if (error.message === 'INVALID_CPF_CNPJ') {
      throw new Error('CPF ou CNPJ inválido. CPF deve ter 11 dígitos e CNPJ deve ter 14 dígitos.');
    }
    
    const errorData = error.response?.data || {};
    throw new Error(`Falha ao criar cliente no Pagar.me: ${errorData.message || error.message}`);
  }
}

/**
 * Get or create customer in Pagar.me
 * @param {object} customerData - Customer data
 * @param {string} customerData.name - Customer name
 * @param {string} customerData.email - Customer email
 * @param {string} customerData.cpfCnpj - CPF or CNPJ (numbers only)
 * @param {string} customerData.phone - Phone number (optional)
 * @param {string} customerData.externalId - External ID (user ID from our system)
 * @param {string} customerData.pagarMeCustomerId - Existing Pagar.me customer ID (optional)
 * @returns {Promise<object>} Customer with Pagar.me customer ID
 */
export async function getOrCreateCustomer(customerData) {
  // If customer already has Pagar.me ID, return it
  if (customerData.pagarMeCustomerId) {
    assertId(customerData.pagarMeCustomerId, 'cus_', 'customer_id');
    return {
      customerId: customerData.pagarMeCustomerId,
      externalId: customerData.externalId
    };
  }

  // Otherwise, create new customer
  return await createCustomer(customerData);
}

/* -------------------------------------------------------------------------- */
/* Card Management                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Attach token to customer (v5-compliant)
 * ⚠️ CRITICAL: In Pagar.me v5, cards are created IMPLICITLY when attaching a token.
 * There is NO separate /cards endpoint. This endpoint creates the card automatically.
 * 
 * @param {string} customerId - Pagar.me customer ID
 * @param {string} token - Pagar.me token (token_xxxxx) - REQUIRED
 * @returns {Promise<object>} Attached card details with card_id (card_xxxxx)
 */
export async function attachCardToCustomer(customerId, token) {
  assertId(customerId, 'cus_', 'customer_id');

  // ✅ CRITICAL: Accept token (token_xxxxx) - card is created during attachment
  if (!token || !token.startsWith('token_')) {
    throw new Error(`Invalid token format. Expected token_xxxxx, got: ${token}. In v5, you attach tokens to customers, and cards are created automatically.`);
  }

  try {
    const apiUrl = `${API_BASE}/customers/${customerId}/cards`;

    // ✅ Pagar.me v5: Attach token to customer → creates card automatically
    // POST /customers/{id}/cards with { token: "token_xxxxx" } returns { id: "card_xxxxx" }
    const requestBody = {
      token: token
    };

    console.log('[Pagar.me] Attaching token to customer (creates card automatically):', {
      customerId,
      token: token.substring(0, 20) + '...',
      requestBody: JSON.stringify(requestBody)
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const cardId = response.data.id;
    
    // ✅ CRITICAL: Verify card was created (must be card_xxxxx)
    if (!cardId || !cardId.startsWith('card_')) {
      throw new Error(`Card creation failed: Invalid card_id returned. Expected card_xxxxx, got: ${cardId}`);
    }

    console.log('[Pagar.me] ✅ Token attached to customer, card created successfully:', {
      customerId,
      token: token.substring(0, 20) + '...',
      cardId: cardId,
      card_last4: response.data.last_four_digits || 'N/A',
      card_brand: response.data.brand || 'N/A'
    });

    return {
      card_id: cardId, // ✅ Returns card_xxxxx (created during attachment)
      card: response.data
    };
  } catch (error) {
    // Handle network/TLS errors specifically
    const errorMsg = error.message || '';
    const errorCode = error.code || '';
    
    if (errorCode === 'ECONNRESET' || 
        errorCode === 'ETIMEDOUT' || 
        errorCode === 'ENOTFOUND' ||
        errorCode === 'ECONNREFUSED' ||
        errorCode === 'ECONNABORTED' ||
        errorMsg.includes('socket disconnected') ||
        errorMsg.includes('TLS connection') ||
        errorMsg.includes('secure TLS connection') ||
        errorMsg.includes('network socket') ||
        errorMsg.includes('network')) {
      console.error('[Pagar.me] Network/TLS error attaching card:', {
        code: errorCode,
        message: errorMsg,
        stack: error.stack
      });
      throw new Error(`Erro de conexão com Pagar.me: ${errorMsg}. Verifique sua conexão com a internet e tente novamente. Se o problema persistir, pode ser um problema temporário do servidor Pagar.me.`);
    }

    const errorData = error.response?.data || {};
    const errorMessage = errorData.message || error.message;
    const errorDetails = errorData.errors || errorData.details || null;

    console.error('[Pagar.me] Error attaching card to customer:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      requestBody: JSON.stringify(requestBody), // Log what we sent
      fullError: JSON.stringify(error.response?.data, null, 2)
    });

    // Handle "Token not found" error specifically
    if (errorMessage?.includes('Token not found') || errorMessage?.includes('token not found') || errorMessage?.includes('Token não encontrado')) {
      throw new Error(`Token expirado ou inválido. Por favor, tente novamente. Os tokens do Pagar.me expiram rapidamente e devem ser usados imediatamente após a criação.`);
    }
    
    // Handle invalid card_id errors
    if (errorMessage?.includes('card_id') || errorMessage?.includes('card not found')) {
      throw new Error(`Cartão inválido ou não encontrado. Certifique-se de que o card_id está no formato correto (card_xxxxx).`);
    }

    // Provide detailed error message
    let detailedMessage = errorMessage;
    if (errorDetails) {
      if (Array.isArray(errorDetails)) {
        detailedMessage += ` | ${errorDetails.map(e => e.message || e).join(', ')}`;
      } else if (typeof errorDetails === 'object') {
        detailedMessage += ` | ${JSON.stringify(errorDetails)}`;
      } else {
        detailedMessage += ` | ${errorDetails}`;
      }
    }

    // Check for common card validation errors
    if (errorMessage.includes('exp_month') || (errorDetails && JSON.stringify(errorDetails).includes('exp_month'))) {
      throw new Error(`Dados do cartão inválidos: Mês de validade deve estar entre 01 e 12. Verifique os dados do cartão e tente novamente.`);
    }
    if (errorMessage.includes('exp_year') || (errorDetails && JSON.stringify(errorDetails).includes('exp_year'))) {
      throw new Error(`Dados do cartão inválidos: Ano de validade inválido ou expirado. Verifique os dados do cartão e tente novamente.`);
    }
    if (errorMessage.includes('cvv') || (errorDetails && JSON.stringify(errorDetails).includes('cvv'))) {
      throw new Error(`Dados do cartão inválidos: CVV inválido. Verifique os dados do cartão e tente novamente.`);
    }
    if (errorMessage.includes('number') || (errorDetails && JSON.stringify(errorDetails).includes('number'))) {
      throw new Error(`Dados do cartão inválidos: Número do cartão inválido. Verifique os dados do cartão e tente novamente.`);
    }

    throw new Error(`Falha ao anexar cartão ao cliente: ${detailedMessage}`);
  }
}

/**
 * Get customer cards from Pagar.me
 * @param {string} customerId - Pagar.me customer ID
 * @returns {Promise<Array>} Array of customer cards
 */
export async function getCustomerCards(customerId) {
  assertId(customerId, 'cus_', 'customer_id');

  try {
    const apiUrl = `${API_BASE}/customers/${customerId}/cards`;
    
    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    return response.data.data || [];
  } catch (error) {
    console.error('[Pagar.me] Error getting customer cards:', {
      customerId,
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    const errorData = error.response?.data || {};
    throw new Error(`Falha ao buscar cartões do cliente: ${errorData.message || error.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Subscription Management (v5)                                               */
/* -------------------------------------------------------------------------- */

/**
 * Create subscription using Pagar.me Orders API (v5)
 * 
 * ⚠️ CRITICAL: In Pagar.me v5, subscriptions are created via Orders API, NOT Subscriptions API
 * Card information MUST be inside payments[].credit_card structure
 * 
 * @param {object} subscriptionData - Subscription data
 * @param {string} subscriptionData.customerId - Pagar.me customer ID (required)
 * @param {string} subscriptionData.cardId - Pagar.me card ID (required, must be attached first)
 * @param {string} subscriptionData.cardToken - Pagar.me card token (alternative to cardId)
 * @param {object} subscriptionData.plan - Plan configuration
 * @param {string} subscriptionData.plan.name - Plan name
 * @param {number} subscriptionData.plan.amount - Amount in cents
 * @param {string} subscriptionData.plan.interval - 'month' or 'year' (default: 'month')
 * @param {number} subscriptionData.plan.intervalCount - Interval count (default: 1)
 * @param {object} subscriptionData.metadata - Additional metadata
 * @returns {Promise<object>} Created subscription order
 */
export async function createSubscription(subscriptionData) {
  assertId(subscriptionData.customerId, 'cus_', 'customer_id');

  // ✅ CRITICAL: Must have either card_id or card_token
  if (!subscriptionData.cardId && !subscriptionData.cardToken) {
    throw new Error('Either card_id or card_token is required');
  }

  // ✅ Validate card_id format if provided
  if (subscriptionData.cardId && !subscriptionData.cardId.startsWith('card_')) {
    throw new Error(`Invalid card_id format. Expected card_xxxxx, got: ${subscriptionData.cardId}`);
  }

  // ✅ Validate card_token format if provided
  if (subscriptionData.cardToken && !subscriptionData.cardToken.startsWith('token_')) {
    throw new Error(`Invalid card_token format. Expected token_xxxxx, got: ${subscriptionData.cardToken}`);
  }

  try {
    // ✅ CRITICAL: Use Orders API, NOT Subscriptions API
    const apiUrl = `${API_BASE}/orders`;

    // ✅ Build payment object - card info MUST be inside payments[].credit_card
    const creditCard = subscriptionData.cardId
      ? { card_id: subscriptionData.cardId }
      : { card_token: subscriptionData.cardToken };

    // ✅ CRITICAL: Verify no raw card data
    if (creditCard.number || creditCard.exp_month || creditCard.cvv || creditCard.holder_name) {
      throw new Error('❌ SECURITY: Raw card data detected. Only card_id or card_token allowed.');
    }

    // ✅ CRITICAL: Validate amount is a positive integer (in cents)
    const amount = subscriptionData.plan.amount;
    if (!amount || typeof amount !== 'number' || amount < 1 || !Number.isInteger(amount)) {
      throw new Error(`Invalid amount. Must be a positive integer >= 1 (in cents). Got: ${amount}`);
    }

    // ✅ Build request body using Orders API structure
    // ⚠️ CRITICAL: items[].amount must be an integer >= 1 (in cents)
    // ⚠️ CRITICAL: items[].code is REQUIRED by Pagar.me (HTTP 412 if missing)
    // ⚠️ CRITICAL: closed: true means charge immediately, false means create order but don't charge
    // For subscription first payment, we want to charge immediately, so closed: true
    
    // Generate unique code for the plan (e.g., "pro_monthly", "business_yearly")
    const planCode = subscriptionData.plan.code || 
                     `${(subscriptionData.metadata?.plan_id || subscriptionData.plan.name || 'plan').toLowerCase().replace(/\s+/g, '_')}_${subscriptionData.plan.interval || 'monthly'}`;
    
    const requestBody = {
      customer_id: subscriptionData.customerId,
      items: [
        {
          code: planCode, // ✅ REQUIRED: Unique identifier for the product/plan
          amount: amount, // ✅ REQUIRED: integer in cents (e.g., 9700 for R$97.00)
          description: `${subscriptionData.plan.name} (${subscriptionData.plan.interval || 'month'})`,
          quantity: 1
        }
      ],
      // ✅ CRITICAL: Card info MUST be inside payments[].credit_card
      payments: [
        {
          payment_method: 'credit_card',
          credit_card: {
            ...creditCard,
            // ✅ CRITICAL: Add installments for credit card (1 = single payment, required for immediate charge)
            installments: 1
            // Note: capture is not a valid field in Pagar.me v5 - payment is captured automatically when closed: true
          }
        }
      ],
      closed: true, // ✅ CRITICAL: true = charge immediately, false = create order but don't charge
      metadata: subscriptionData.metadata || {}
    };

    console.log('[Pagar.me] Creating subscription order with Orders API (v5):', {
      customerId: subscriptionData.customerId,
      cardId: subscriptionData.cardId,
      cardToken: subscriptionData.cardToken ? subscriptionData.cardToken.substring(0, 20) + '...' : null,
      planName: subscriptionData.plan.name,
      amount: subscriptionData.plan.amount,
      payments: JSON.stringify(requestBody.payments, null, 2), // Log payment structure
      requestBody: JSON.stringify(requestBody, null, 2) // Log full request for debugging
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const order = response.data;

    if (!order.id) {
      throw new Error('Order ID not received from Pagar.me');
    }

    console.log('[Pagar.me] ✅ Subscription order created successfully:', {
      orderId: order.id,
      status: order.status,
      customerId: subscriptionData.customerId,
      charges: order.charges?.length || 0,
      chargeStatus: order.charges?.[0]?.status || 'unknown',
      amount: order.amount,
      closed: order.closed
    });

    // ✅ Extract charge info to verify payment was processed
    const charge = order.charges?.[0];
    
    if (!charge) {
      console.warn('[Pagar.me] ⚠️ No charge found in order response:', {
        orderId: order.id,
        orderStatus: order.status
      });
    } else {
      console.log('[Pagar.me] Charge details:', {
        chargeId: charge.id,
        chargeStatus: charge.status,
        amount: charge.amount,
        paidAt: charge.paid_at
      });
    }

    // ✅ Verify payment was actually processed
    if (order.status !== 'paid' && order.status !== 'closed' && charge?.status !== 'paid') {
      console.warn('[Pagar.me] ⚠️ Order created but payment not confirmed:', {
        orderId: order.id,
        orderStatus: order.status,
        chargeStatus: charge?.status,
        note: 'Payment may be pending or failed. Check charge status.'
      });
    }

    // ✅ Extract subscription info from order response
    // Orders API returns order with charges, we need to extract subscription ID if available
    const subscriptionId = charge?.subscription_id || order.id; // Use order ID as fallback

    return {
      subscriptionId: subscriptionId,
      orderId: order.id,
      status: order.status === 'paid' || order.status === 'closed' || charge?.status === 'paid' ? 'active' : order.status,
      chargeId: charge?.id,
      chargeStatus: charge?.status,
      currentPeriodStart: charge?.paid_at ? new Date(charge.paid_at * 1000) : new Date(),
      currentPeriodEnd: charge?.paid_at 
        ? new Date((charge.paid_at * 1000) + (subscriptionData.plan.interval === 'year' ? 365 : 30) * 86400000)
        : null
    };
  } catch (error) {
    const errorData = error.response?.data || {};
    const errorMessage = errorData.message || error.message;
    const errorDetails = errorData.errors || errorData.details || null;
    const statusCode = error.response?.status;
    
    // ✅ Check for gateway response errors (e.g., HTTP 412 - missing required fields)
    const gatewayResponse = errorData.gateway_response || {};
    const gatewayCode = gatewayResponse.code;
    const gatewayErrors = gatewayResponse.errors || [];

    console.error('[Pagar.me] Error creating subscription:', {
      message: error.message,
      status: statusCode,
      statusText: error.response?.statusText,
      data: error.response?.data,
      gatewayCode: gatewayCode,
      gatewayErrors: gatewayErrors,
      requestBody: error.config?.data ? JSON.parse(error.config.data) : null,
      fullError: JSON.stringify(error.response?.data, null, 2)
    });

    // ✅ CRITICAL: Detect HTTP 412 (Precondition Failed) - missing required fields like 'code'
    if (statusCode === 412 || gatewayCode === '412') {
      const missingField = gatewayErrors.find(e => e.message?.includes('Code')) || 
                          gatewayErrors.find(e => e.message?.includes('code')) ||
                          gatewayErrors[0];
      const errorMsg = missingField?.message || 'Missing required field in order items';
      throw new Error(`Erro de integração: ${errorMsg}. Por favor, tente novamente mais tarde.`);
    }

    // Provide detailed error message
    let detailedMessage = errorMessage;
    if (errorDetails) {
      detailedMessage += ` | Details: ${JSON.stringify(errorDetails)}`;
    }
    if (gatewayErrors.length > 0) {
      detailedMessage += ` | Gateway: ${gatewayErrors.map(e => e.message).join(', ')}`;
    }

    if (statusCode === 400) {
      throw new Error(`Dados inválidos (400): ${detailedMessage}`);
    } else if (statusCode === 401) {
      throw new Error(`Erro de autenticação (401): ${detailedMessage}`);
    }

    throw new Error(`Falha ao criar assinatura: ${detailedMessage}`);
  }
}

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Pagar.me subscription ID
 * @returns {Promise<object>} Cancellation result
 */
export async function cancelSubscription(subscriptionId) {
  assertId(subscriptionId, 'sub_', 'subscription_id');

  try {
    const apiUrl = `${API_BASE}/subscriptions/${subscriptionId}`;

    // Pagar.me v5 uses DELETE for cancellation
    const response = await axios.delete(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    console.log('[Pagar.me] ✅ Subscription canceled:', {
      subscriptionId,
      status: response.data?.status
    });

    return {
      subscriptionId: response.data?.id || subscriptionId,
      status: response.data?.status || 'canceled',
      canceledAt: new Date()
    };
  } catch (error) {
    console.error('[Pagar.me] Error canceling subscription:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    const errorData = error.response?.data || {};
    throw new Error(`Falha ao cancelar assinatura no Pagar.me: ${errorData.message || error.message}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Orders API (for one-time payments, not subscriptions)                     */
/* -------------------------------------------------------------------------- */

/**
 * Get order status from Pagar.me API
 * @param {string} orderId - Pagar.me order ID (e.g., or_xxxxx)
 * @returns {Promise<object>} Order data with status
 */
export async function getOrderStatus(orderId) {
  if (!orderId || !orderId.startsWith('or_')) {
    throw new Error(`Invalid order ID format. Expected or_xxxxx, got: ${orderId}`);
  }

  try {
    const apiUrl = `${API_BASE}/orders/${orderId}`;

    console.log('[Pagar.me] Fetching order status:', { orderId });

    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const order = response.data;

    console.log('[Pagar.me] ✅ Order status retrieved:', {
      orderId: order.id,
      status: order.status,
      amount: order.amount,
      charges: order.charges?.length || 0
    });

    return {
      id: order.id,
      status: order.status,
      amount: order.amount,
      charges: order.charges || [],
      customer_id: order.customer_id,
      metadata: order.metadata || {}
    };
  } catch (error) {
    console.error('[Pagar.me] Error fetching order status:', {
      orderId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });

    if (error.response?.status === 404) {
      throw new Error(`Order not found: ${orderId}`);
    }

    const errorData = error.response?.data || {};
    throw new Error(`Failed to fetch order status: ${errorData.message || error.message}`);
  }
}

/**
 * Create order for one-time payment (e.g., pay-per-use invoices)
 * ⚠️ NOTE: This is for one-time payments only, NOT for subscriptions
 * Use createSubscription() for recurring payments
 * 
 * @param {object} orderData - Order data
 * @param {object} orderData.customer - Customer data
 * @param {object} orderData.payment - Payment data
 * @param {number} orderData.amount - Amount in cents
 * @param {string} orderData.planName - Description
 * @param {object} orderData.metadata - Additional metadata
 * @returns {Promise<object>} Created order
 */
export async function createOrder(orderData) {
  try {
    const apiUrl = `${API_BASE}/orders`;

    const requestBody = {
      customer: {
        name: orderData.customer.name,
        email: orderData.customer.email,
        document: orderData.customer.document?.replace(/\D/g, ''),
        type: orderData.customer.type || (orderData.customer.document?.replace(/\D/g, '').length === 11 ? 'individual' : 'company')
      },
      items: [
        {
          code: orderData.code || `invoice_${Date.now()}`, // ✅ REQUIRED: Unique identifier for the product/item
          amount: orderData.amount,
          description: orderData.planName || 'One-time payment',
          quantity: 1
        }
      ],
      payments: [
        {
          payment_method: orderData.payment?.method || 'credit_card',
          credit_card: {
            installments: 1,
            statement_descriptor: 'FISCALAI'
          }
        }
      ]
    };

    // Add card token if provided
    if (orderData.payment?.card_token) {
      requestBody.payments[0].credit_card.card_token = orderData.payment.card_token;
    } else if (orderData.payment?.card_id) {
      requestBody.payments[0].credit_card.card_id = orderData.payment.card_id;
    }

    if (orderData.metadata) {
      requestBody.metadata = orderData.metadata;
    }

    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    return {
      orderId: response.data.id,
      status: response.data.status,
      charges: response.data.charges
    };
  } catch (error) {
    const errorData = error.response?.data || {};
    const statusCode = error.response?.status;
    const gatewayResponse = errorData.gateway_response || {};
    const gatewayCode = gatewayResponse.code;
    const gatewayErrors = gatewayResponse.errors || [];

    console.error('[Pagar.me] Error creating order:', {
      message: error.message,
      response: error.response?.data,
      status: statusCode,
      gatewayCode: gatewayCode,
      gatewayErrors: gatewayErrors
    });

    // ✅ CRITICAL: Detect HTTP 412 (Precondition Failed) - missing required fields like 'code'
    if (statusCode === 412 || gatewayCode === '412') {
      const missingField = gatewayErrors.find(e => e.message?.includes('Code')) || 
                          gatewayErrors.find(e => e.message?.includes('code')) ||
                          gatewayErrors[0];
      const errorMsg = missingField?.message || 'Missing required field in order items';
      throw new Error(`Erro de integração: ${errorMsg}. Por favor, tente novamente mais tarde.`);
    }

    const errorMessage = errorData.message || error.message;
    if (gatewayErrors.length > 0) {
      const gatewayMsg = gatewayErrors.map(e => e.message).join(', ');
      throw new Error(`Falha ao criar pedido no Pagar.me: ${errorMessage} | ${gatewayMsg}`);
    }
    
    throw new Error(`Falha ao criar pedido no Pagar.me: ${errorMessage}`);
  }
}

/* -------------------------------------------------------------------------- */
/* Webhook Validation                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Validate webhook using custom secret header
 * 
 * IMPORTANT: Pagar.me does NOT provide HMAC signing like Stripe!
 * Instead, we use a custom header approach:
 * - Set PAGARME_WEBHOOK_SECRET in .env (any secure string you create)
 * - Configure Pagar.me webhook to send this secret in X-Pagarme-Webhook-Secret header
 * - Or append it to the webhook URL as ?token=YOUR_SECRET
 * 
 * @param {object} headers - Request headers object
 * @param {string} queryToken - Optional token from query string
 * @returns {boolean} True if webhook is authenticated
 */
export function validateWebhookSecret(headers, queryToken = null) {
  if (!PAGARME_WEBHOOK_SECRET) {
    console.warn('[Pagar.me] Webhook secret not configured (PAGARME_WEBHOOK_SECRET), skipping validation');
    console.warn('[Pagar.me] ⚠️ SECURITY WARNING: Configure PAGARME_WEBHOOK_SECRET in production!');
    return true;
  }

  // Method 1: Check custom header (recommended)
  const headerSecret = headers['x-pagarme-webhook-secret'] || 
                       headers['x-webhook-secret'] ||
                       headers['authorization']?.replace('Bearer ', '');

  if (headerSecret && headerSecret === PAGARME_WEBHOOK_SECRET) {
    console.log('[Pagar.me] ✅ Webhook validated via header');
    return true;
  }

  // Method 2: Check query token (fallback)
  if (queryToken && queryToken === PAGARME_WEBHOOK_SECRET) {
    console.log('[Pagar.me] ✅ Webhook validated via query token');
    return true;
  }

  // Method 3: Check Basic Auth (alternative)
  const authHeader = headers['authorization'];
  if (authHeader && authHeader.startsWith('Basic ')) {
    try {
      const base64Credentials = authHeader.replace('Basic ', '');
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');
      
      if (password === PAGARME_WEBHOOK_SECRET || username === PAGARME_WEBHOOK_SECRET) {
        console.log('[Pagar.me] ✅ Webhook validated via Basic Auth');
        return true;
      }
    } catch (e) {
      // Ignore parse errors
    }
  }

  console.error('[Pagar.me] ❌ Webhook validation failed - no valid secret found');
  console.error('[Pagar.me] Expected header: X-Pagarme-Webhook-Secret or query param: ?token=...');
  return false;
}

/**
 * Get the webhook secret for configuring in Pagar.me dashboard
 * @returns {string|null} The webhook secret or null if not configured
 */
export function getWebhookSecret() {
  return PAGARME_WEBHOOK_SECRET || null;
}

// Legacy alias for backwards compatibility
export const validateWebhookSignature = validateWebhookSecret;
