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
import fs from 'fs';
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

    // ✅ CRITICAL: Parse phone properly (handles country code stripping and phone type)
    if (customerData.phone) {
      const parsedPhone = parsePhoneForPagarme(customerData.phone);
      if (parsedPhone) {
        // ✅ Use correct phone type (mobile_phone or home_phone)
        const phoneType = parsedPhone.phoneType || 'mobile_phone';
        const phoneData = {
          country_code: parsedPhone.country_code,
          area_code: parsedPhone.area_code,
          number: parsedPhone.number
        };
        
        requestBody.phones = {
          [phoneType]: phoneData
        };
        console.log('[Pagar.me] Creating customer with phone:', { phoneType, phoneData });
      } else {
        console.warn('[Pagar.me] Could not parse phone for customer creation:', customerData.phone);
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
    const statusCode = error.response?.status;
    
    if (statusCode === 409 || errorData.message?.includes('already exists') || errorData.message?.includes('duplicado')) {
      console.log('[Pagar.me] Customer already exists, attempting to find:', customerData.email);
      const document = customerData.cpfCnpj?.replace(/\D/g, '') || '';
      const existingCustomer = await searchCustomer(customerData.email, document);
      if (existingCustomer) {
        return {
          customerId: existingCustomer.customerId,
          externalId: customerData.externalId
        };
      }
    }
    
    throw new Error(`Falha ao criar cliente no Pagar.me: ${errorData.message || error.message}`);
  }
}

/**
 * Search for an existing customer in Pagar.me by email or document
 */
async function searchCustomer(email, document) {
  try {
    const apiUrl = `${API_BASE}/customers`;
    
    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      params: { email },
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });
    
    if (response.data?.data?.length > 0) {
      const matchingCustomer = response.data.data.find(c => 
        c.document === document || c.email === email
      );
      if (matchingCustomer) {
        return { 
          customerId: matchingCustomer.id,
          hasPhone: !!(matchingCustomer.phones?.mobile_phone || matchingCustomer.phones?.home_phone),
          customer: matchingCustomer
        };
      }
    }
    return null;
  } catch (error) {
    console.log('[Pagar.me] Customer search failed, will create new:', error.message);
    return null;
  }
}

/**
 * Parse Brazilian phone number for Pagar.me API
 * ✅ CRITICAL: Handles country code stripping and proper formatting
 * 
 * Brazilian phones: DDD (2 digits) + number (8-9 digits) = 10-11 digits
 * With country code: 55 + DDD (2) + number (8-9) = 12-13 digits
 * 
 * @param {string} phone - Raw phone number
 * @returns {object|null} Parsed phone for Pagar.me { country_code, area_code, number }
 */
function parsePhoneForPagarme(phone) {
  if (!phone) return null;
  
  let cleanPhone = phone.replace(/\D/g, '');
  const originalLength = cleanPhone.length;
  
  console.log('[Pagar.me] Parsing phone:', cleanPhone, 'length:', originalLength);
  
  // ✅ Phone should come WITH country code 55 from frontend
  // Expected format: 55 + DDD (2) + number (8-9) = 12-13 digits
  // But also accept without country code (10-11 digits) for backward compatibility
  
  let countryCode = '55';
  let areaCode;
  let number;
  
  if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
    // Phone WITH country code: 55 + DDD + number
    countryCode = '55';
    areaCode = cleanPhone.substring(2, 4);
    number = cleanPhone.substring(4);
    console.log('[Pagar.me] Phone has country code 55. DDD:', areaCode, 'Number:', number);
  } else if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
    // Phone WITHOUT country code (backward compatibility): DDD + number
    countryCode = '55';
    areaCode = cleanPhone.substring(0, 2);
    number = cleanPhone.substring(2);
    console.log('[Pagar.me] Phone without country code. Adding 55. DDD:', areaCode, 'Number:', number);
  } else {
    // Invalid length - try to parse anyway
    console.warn('[Pagar.me] ⚠️ Unexpected phone length:', originalLength, 'Original:', phone);
    // Try to extract what we can
    if (cleanPhone.length >= 8) {
      areaCode = cleanPhone.substring(0, 2);
      number = cleanPhone.substring(2);
    } else {
      console.error('[Pagar.me] ❌ Phone too short to parse:', cleanPhone);
      return null;
    }
  }
  
  // ✅ NO STRICT VALIDATION - Frontend handles all validation
  // Just determine phone type based on number length (best guess)
  // Brazilian phones: 9 digits = usually mobile, 8 digits = usually landline
  const isMobile = number.length === 9;
  const phoneType = isMobile ? 'mobile_phone' : 'home_phone';
  
  console.log('[Pagar.me] ✅ Parsed phone:', {
    original: phone,
    originalLength,
    countryCode,
    areaCode,
    number,
    numberLength: number.length,
    phoneType,
    isMobile
  });
  
  return {
    country_code: countryCode,
    area_code: areaCode,
    number: number,
    phoneType: phoneType // ✅ Include phone type for correct API field
  };
}

/**
 * Get customer data from Pagar.me
 * @param {string} customerId - Pagar.me customer ID
 * @returns {Promise<object>} Customer data
 */
export async function getCustomer(customerId) {
  assertId(customerId, 'cus_', 'customer_id');

  try {
    const apiUrl = `${API_BASE}/customers/${customerId}`;
    
    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const customer = response.data;
    const hasPhone = !!(
      customer.phones?.mobile_phone?.number || 
      customer.phones?.home_phone?.number
    );

    console.log('[Pagar.me] Customer data retrieved:', {
      customerId,
      hasPhone,
      phones: customer.phones
    });

    return {
      ...customer,
      hasPhone
    };
  } catch (error) {
    console.error('[Pagar.me] Error getting customer:', {
      customerId,
      message: error.message,
      status: error.response?.status
    });
    throw error;
  }
}

/**
 * Update an existing customer in Pagar.me (to add/update phone, name, document)
 * ✅ CRITICAL: This function VERIFIES the phone was added after update
 * ✅ CRITICAL: Pagar.me PUT requires 'name' field
 * ✅ CRITICAL: Pagar.me requires 'document' (CPF/CNPJ) for payment processing
 * 
 * @param {string} customerId - Pagar.me customer ID
 * @param {object} updateData - Data to update
 * @param {string} updateData.phone - Phone number (required for subscriptions)
 * @param {string} updateData.name - Customer name (required by Pagar.me PUT)
 * @param {string} updateData.document - CPF/CNPJ (required for payment processing)
 * @returns {Promise<object>} Updated customer with verification
 */
export async function updateCustomer(customerId, updateData) {
  assertId(customerId, 'cus_', 'customer_id');

  // Parse phone FIRST to fail early if invalid
  const parsedPhone = updateData.phone ? parsePhoneForPagarme(updateData.phone) : null;
  
  if (updateData.phone && !parsedPhone) {
    const errorMsg = `Não foi possível processar o telefone: ${updateData.phone}. Use formato DDD + número (ex: 47999998888)`;
    console.error('[Pagar.me] ❌ Phone parsing failed:', updateData.phone);
    throw new Error(errorMsg);
  }

  try {
    const apiUrl = `${API_BASE}/customers/${customerId}`;
    
    const requestBody = {};
    
    // ✅ CRITICAL: Pagar.me PUT requires 'name' field
    if (updateData.name) {
      requestBody.name = updateData.name;
    }
    
    // ✅ CRITICAL: Add document (CPF/CNPJ) - required for payment processing
    if (updateData.document) {
      const cleanDocument = updateData.document.replace(/\D/g, '');
      if (cleanDocument) {
        requestBody.document = cleanDocument;
        requestBody.document_type = cleanDocument.length === 11 ? 'CPF' : 'CNPJ';
        requestBody.type = cleanDocument.length === 11 ? 'individual' : 'company';
        console.log('[Pagar.me] Including document in update:', {
          document: cleanDocument,
          document_type: requestBody.document_type,
          type: requestBody.type
        });
      }
    }
    
    if (parsedPhone) {
      // ✅ Use correct phone type based on number length
      // mobile_phone for 9-digit numbers, home_phone for 8-digit numbers
      const phoneType = parsedPhone.phoneType || 'mobile_phone';
      const phoneData = {
        country_code: parsedPhone.country_code,
        area_code: parsedPhone.area_code,
        number: parsedPhone.number
      };
      
      requestBody.phones = {
        [phoneType]: phoneData
      };
      
      console.log('[Pagar.me] Updating customer phone:', {
        customerId,
        phoneType,
        phoneData,
        originalInput: updateData.phone
      });
    }
    
    // Only update if there's data to update
    if (Object.keys(requestBody).length === 0) {
      console.log('[Pagar.me] No data to update for customer:', customerId);
      return { customerId, updated: false, hasPhone: false };
    }

    console.log('[Pagar.me] PUT /customers/' + customerId, JSON.stringify(requestBody, null, 2));

    // ✅ Use PUT for customer updates (Pagar.me v5 Core API)
    const response = await axios.put(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    // ✅ CRITICAL: Verify phone was actually added in response (check both types)
    const phones = response.data.phones || {};
    const hasPhone = !!(phones.mobile_phone?.number || phones.home_phone?.number);

    console.log('[Pagar.me] Customer update response:', {
      customerId,
      hasPhone,
      responsePhones: phones,
      updatedAt: response.data.updated_at,
      sentPhoneType: parsedPhone?.phoneType
    });

    if (parsedPhone && !hasPhone) {
      console.error('[Pagar.me] ❌ CRITICAL: Phone was sent but NOT saved!', {
        sentPhone: parsedPhone,
        sentPhoneType: parsedPhone.phoneType,
        responsePhones: phones
      });
      // Don't throw - let verification step handle it
    }

    return {
      customerId,
      updated: true,
      hasPhone,
      phones: response.data.phones
    };
  } catch (error) {
    const errorData = error.response?.data || {};
    
    // ✅ Log FULL error details from Pagar.me
    console.error('[Pagar.me] ❌ Error updating customer:', {
      customerId,
      message: error.message,
      status: error.response?.status,
      requestedPhone: parsedPhone,
      // Full error response from Pagar.me
      pagarmeResponse: JSON.stringify(errorData, null, 2),
      pagarmeErrors: errorData.errors,
      pagarmeMessage: errorData.message
    });
    
    // Extract detailed error message
    let detailedError = errorData.message || error.message;
    if (errorData.errors && Array.isArray(errorData.errors)) {
      detailedError = errorData.errors.map(e => e.message || e).join('; ');
    }
    
    throw new Error(`Falha ao atualizar telefone do cliente: ${detailedError}`);
  }
}

/**
 * Get or create customer in Pagar.me
 * ✅ CRITICAL: Phone is REQUIRED for subscription payments
 * If customer exists but has no phone, we update them with phone data
 * 
 * @param {object} customerData - Customer data
 * @param {string} customerData.name - Customer name
 * @param {string} customerData.email - Customer email
 * @param {string} customerData.cpfCnpj - CPF or CNPJ (numbers only)
 * @param {string} customerData.phone - Phone number (REQUIRED for subscriptions)
 * @param {string} customerData.externalId - External ID (user ID from our system)
 * @param {string} customerData.pagarMeCustomerId - Existing Pagar.me customer ID (optional)
 * @returns {Promise<object>} Customer with Pagar.me customer ID
 */
export async function getOrCreateCustomer(customerData) {
  console.log('[Pagar.me] getOrCreateCustomer called with:', {
    hasExistingId: !!customerData.pagarMeCustomerId,
    email: customerData.email,
    phone: customerData.phone,
    phoneLength: customerData.phone?.replace(/\D/g, '').length
  });

  // ✅ CRITICAL: Phone is REQUIRED for subscriptions
  if (!customerData.phone) {
    throw new Error('Telefone é obrigatório para processar pagamentos de assinatura.');
  }

  // ✅ Parse phone (validation handled by frontend)
  const parsedPhoneCheck = parsePhoneForPagarme(customerData.phone);
  if (!parsedPhoneCheck) {
    throw new Error(`Não foi possível processar o telefone: ${customerData.phone}. Telefone muito curto.`);
  }
  
  console.log('[Pagar.me] Phone parsed successfully:', parsedPhoneCheck);

  // ✅ CRITICAL: If we have an existing customer ID, update with phone and VERIFY
  if (customerData.pagarMeCustomerId) {
    assertId(customerData.pagarMeCustomerId, 'cus_', 'customer_id');
    
    console.log('[Pagar.me] Updating existing customer with phone:', customerData.pagarMeCustomerId);
    
    // Step 1: Update customer with phone, name AND document (all required by Pagar.me)
    const updateResult = await updateCustomer(customerData.pagarMeCustomerId, { 
      phone: customerData.phone,
      name: customerData.name, // ✅ Required by Pagar.me PUT
      document: customerData.cpfCnpj // ✅ Required for payment processing
    });
    console.log('[Pagar.me] Customer update result:', updateResult);
    
    // Step 2: VERIFY phone was actually added by fetching customer
    console.log('[Pagar.me] Verifying phone was saved...');
    const verifiedCustomer = await getCustomer(customerData.pagarMeCustomerId);
    
    if (!verifiedCustomer.hasPhone) {
      console.error('[Pagar.me] ❌ CRITICAL: Phone update succeeded but phone NOT in customer profile!', {
        customerId: customerData.pagarMeCustomerId,
        sentPhone: customerData.phone,
        customerPhones: verifiedCustomer.phones
      });
      throw new Error('Falha ao salvar telefone no perfil do cliente. O telefone é obrigatório para pagamentos.');
    }
    
    console.log('[Pagar.me] ✅ Phone verified in customer profile:', verifiedCustomer.phones);
    
    return {
      customerId: customerData.pagarMeCustomerId,
      externalId: customerData.externalId,
      hasPhone: true
    };
  }

  const document = customerData.cpfCnpj?.replace(/\D/g, '') || '';
  
  const existingCustomer = await searchCustomer(customerData.email, document);
  if (existingCustomer) {
    console.log('[Pagar.me] Found existing customer:', existingCustomer.customerId, 'hasPhone:', existingCustomer.hasPhone);
    
    // Step 1: Update customer with phone, name AND document (all required by Pagar.me)
    console.log('[Pagar.me] Updating existing customer with phone...');
    const updateResult = await updateCustomer(existingCustomer.customerId, { 
      phone: customerData.phone,
      name: customerData.name, // ✅ Required by Pagar.me PUT
      document: customerData.cpfCnpj // ✅ Required for payment processing
    });
    console.log('[Pagar.me] Customer update result:', updateResult);
    
    // Step 2: VERIFY phone was actually added
    console.log('[Pagar.me] Verifying phone was saved...');
    const verifiedCustomer = await getCustomer(existingCustomer.customerId);
    
    if (!verifiedCustomer.hasPhone) {
      console.error('[Pagar.me] ❌ CRITICAL: Phone NOT saved to existing customer!', {
        customerId: existingCustomer.customerId,
        sentPhone: customerData.phone,
        customerPhones: verifiedCustomer.phones
      });
      throw new Error('Falha ao salvar telefone no perfil do cliente. O telefone é obrigatório para pagamentos.');
    }
    
    console.log('[Pagar.me] ✅ Phone verified in existing customer profile:', verifiedCustomer.phones);
    
    return {
      customerId: existingCustomer.customerId,
      externalId: customerData.externalId,
      hasPhone: true
    };
  }

  // Create new customer (with phone included)
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
 * Create subscription using Pagar.me Subscriptions API (v5)
 * 
 * ✅ CORRECT v5 IMPLEMENTATION: Uses POST /subscriptions endpoint
 * ❌ NOT /orders - Orders are for one-time payments only, metadata is ignored for billing
 * 
 * v5 Subscription Model:
 * - No plan objects (old v1/v3 model is gone)
 * - Pricing defined directly in items[].pricing_scheme.price
 * - Recurrence via interval/interval_count at top level
 * - card_id at top level (NOT in payments array)
 * - payment_method at top level
 * 
 * @param {object} subscriptionData - Subscription data
 * @param {string} subscriptionData.customerId - Pagar.me customer ID (required)
 * @param {string} subscriptionData.cardToken - Pagar.me card token (token_xxx) with billing
 * @param {string} subscriptionData.cardId - Pagar.me card ID (card_xxx) for existing card
 * @param {object} subscriptionData.plan - Plan configuration
 * @param {string} subscriptionData.plan.name - Plan name
 * @param {number} subscriptionData.plan.amount - Amount in cents
 * @param {string} subscriptionData.plan.interval - 'month' or 'year' (default: 'month')
 * @param {number} subscriptionData.plan.intervalCount - Interval count (default: 1)
 * @param {object} subscriptionData.billing - Billing info for card (name, email, document, address)
 * @param {object} subscriptionData.billingAddress - Billing address (for card validation)
 * @param {object} subscriptionData.metadata - Additional metadata
 * @returns {Promise<object>} Created subscription with current_cycle status
 */
export async function createSubscription(subscriptionData) {
  assertId(subscriptionData.customerId, 'cus_', 'customer_id');

  // ✅ Must have either cardToken or cardId
  if (!subscriptionData.cardToken && !subscriptionData.cardId) {
    throw new Error('Either cardToken or cardId is required for subscription');
  }

  // ✅ Validate format
  if (subscriptionData.cardId && !subscriptionData.cardId.startsWith('card_')) {
    throw new Error(`Invalid card_id format. Expected card_xxxxx, got: ${subscriptionData.cardId}`);
  }
  if (subscriptionData.cardToken && !subscriptionData.cardToken.startsWith('token_')) {
    throw new Error(`Invalid cardToken format. Expected token_xxxxx, got: ${subscriptionData.cardToken}`);
  }

  // ✅ CRITICAL: Validate amount is a positive integer (in cents)
  const amount = subscriptionData.plan.amount;
  if (!amount || typeof amount !== 'number' || amount < 1 || !Number.isInteger(amount)) {
    throw new Error(`Invalid amount. Must be a positive integer >= 1 (in cents). Got: ${amount}`);
  }

  // ✅ Validate billing address if provided (for card validation)
  let billingAddress = null;
  if (subscriptionData.billingAddress) {
    const { line_1, city, state, zip_code, country = 'BR', line_2 } = subscriptionData.billingAddress;
    
    if (line_1 && city && state && zip_code) {
      // Validate state format (2 characters, must be valid Brazilian UF)
      const validStates = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
      const normalizedState = state.toUpperCase().slice(0, 2);
      
      if (!validStates.includes(normalizedState)) {
        console.warn(`[Pagar.me] ⚠️ Invalid state code: ${state}. Using SP as fallback.`);
      }
      
      billingAddress = {
        line_1: line_1,
        line_2: line_2 || '',
        city: city,
        state: validStates.includes(normalizedState) ? normalizedState : 'SP',
        zip_code: zip_code.replace(/\D/g, ''),
        country: country
      };
    }
  }

  try {
    // ✅ CORRECT: Use Subscriptions API for recurring billing
    const apiUrl = `${API_BASE}/subscriptions`;

    // ✅ Map interval to Pagar.me format
    // Pagar.me v5 accepts: day, week, month, year
    let interval = 'month';
    let intervalCount = subscriptionData.plan.intervalCount || 1;
    
    if (subscriptionData.plan.interval === 'year' || subscriptionData.plan.interval === 'annual') {
      interval = 'year';
      intervalCount = 1;
    } else if (subscriptionData.plan.interval === 'semiannual') {
      interval = 'month';
      intervalCount = 6;
    } else if (subscriptionData.plan.interval === 'month' || subscriptionData.plan.interval === 'monthly') {
      interval = 'month';
      intervalCount = 1;
    }

    // ✅ Build v5 subscription request body
    // Key differences from /orders:
    // - card with card_token + billing for new cards (recommended)
    // - OR card_id at TOP LEVEL for existing cards
    // - payment_method at TOP LEVEL
    // - items use pricing_scheme.price
    // - interval/interval_count at TOP LEVEL
    // - NO payments[] array
    // - NO closed field
    
    // ✅ Build billing object for card (REQUIRED for gateway to process charge)
    // Runtime evidence: card.billing.value sent as string ("197000") still fails.
    // Try sending as NUMBER to match the amount field type.
    const billing = subscriptionData.billing || {};
    const billingValue = billing.value ?? amount;
    const cardBillingInfo = {
      value: Number(billingValue),  // Try as number (matching amount field type)
      name: billing.name || 'Customer',
      email: billing.email || '',
      document: billing.document || '',
      document_type: billing.document_type || 'cpf',
      address: billing.address || billingAddress || {
        line_1: 'Not provided',
        city: 'Not provided', 
        state: 'SP',
        zip_code: '00000000',
        country: 'BR'
      }
    };
    
    // ✅ Build card object based on whether we have token or card_id
    let cardObject;
    if (subscriptionData.cardToken) {
      // ✅ Use token with billing - Pagar.me will create card and charge with billing info
      cardObject = {
        token: subscriptionData.cardToken,
        billing: cardBillingInfo
      };
    } else {
      // ✅ Use existing card_id - billing comes from customer/card
      cardObject = null; // Will use card_id at top level
    }
    
    const requestBody = {
      customer_id: subscriptionData.customerId,
      
      // ✅ Payment method at top level
      payment_method: 'credit_card',
      
      // ✅ Card: either use card object with token+billing, or card_id for existing card
      ...(cardObject ? { card: cardObject } : { card_id: subscriptionData.cardId }),
      
      // ✅ Items with pricing_scheme
      items: [
        {
          description: `${subscriptionData.plan.name} (${interval === 'year' ? 'anual' : interval === 'month' && intervalCount === 6 ? 'semestral' : 'mensal'})`,
          quantity: 1,
          pricing_scheme: {
            scheme_type: 'unit',  // ✅ REQUIRED: pricing type
            price: amount         // Amount in cents (e.g., 9700 for R$97.00)
          }
        }
      ],
      
      // ✅ Recurrence at top level
      interval: interval,
      interval_count: intervalCount,
      
      // ⚠️ WORKAROUND: Using postpaid billing to avoid first-charge billing.value error
      // prepaid = charge at START (first charge fails with "billing.value required")
      // postpaid = charge at END of cycle (may work around the Pagar.me API bug)
      billing_type: 'postpaid',
      
      // ✅ CRITICAL: Subscription-level billing object (REQUIRED for prepaid subscriptions)
      // Runtime evidence: sending value as string OR number both fail. Try NUMBER to match amount field type.
      billing: {
        value: amount,  // Try as number (matching items[].pricing_scheme.price and minimum_price)
        minimum_price: amount
      },
      
      // ✅ minimum_price (centavos) - subscription minimum value (also at top level for compatibility)
      minimum_price: amount,
      
      // ✅ Installments (required for credit_card)
      installments: 1,
      
      // ✅ Metadata for internal tracking
      metadata: subscriptionData.metadata || {}
    };

    console.log('[Pagar.me] Creating subscription with Subscriptions API (v5):', {
      endpoint: apiUrl,
      customerId: subscriptionData.customerId,
      cardId: subscriptionData.cardId,
      planName: subscriptionData.plan.name,
      amount: amount,
      interval: interval,
      intervalCount: intervalCount,
      requestBody: JSON.stringify(requestBody, null, 2)
    });

    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const subscription = response.data;

    if (!subscription.id) {
      throw new Error('Subscription ID not received from Pagar.me');
    }

    // ✅ Log subscription details
    console.log('[Pagar.me] ✅ Subscription created successfully:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      customerId: subscription.customer?.id || subscriptionData.customerId,
      interval: subscription.interval,
      intervalCount: subscription.interval_count,
      currentCycle: subscription.current_cycle ? {
        id: subscription.current_cycle.id,
        status: subscription.current_cycle.status,
        startAt: subscription.current_cycle.start_at,
        endAt: subscription.current_cycle.end_at,
        billingAt: subscription.current_cycle.billing_at
      } : null
    });

    // ✅ CRITICAL: Verify payment was confirmed
    // In v5 subscriptions, success means:
    // - subscription.status === 'active'
    // - current_cycle.status === 'paid'
    const currentCycle = subscription.current_cycle;
    const isPaid = subscription.status === 'active' && currentCycle?.status === 'paid';
    
    if (!isPaid) {
      console.warn('[Pagar.me] ⚠️ Subscription created but payment not confirmed:', {
        subscriptionId: subscription.id,
        subscriptionStatus: subscription.status,
        cycleStatus: currentCycle?.status,
        note: 'Check current_cycle.status for payment confirmation. Listen to invoice.paid webhook.'
      });
    } else {
      console.log('[Pagar.me] ✅ Payment confirmed:', {
        subscriptionId: subscription.id,
        cycleStatus: currentCycle.status,
        nextBilling: currentCycle.end_at
      });
    }

    // ✅ Return subscription data with proper status
    return {
      subscriptionId: subscription.id,
      status: subscription.status, // 'active', 'pending', 'canceled', etc.
      isPaid: isPaid,
      currentCycle: currentCycle ? {
        id: currentCycle.id,
        status: currentCycle.status,
        startAt: currentCycle.start_at ? new Date(currentCycle.start_at) : new Date(),
        endAt: currentCycle.end_at ? new Date(currentCycle.end_at) : null,
        billingAt: currentCycle.billing_at ? new Date(currentCycle.billing_at) : null
      } : null,
      interval: subscription.interval,
      intervalCount: subscription.interval_count,
      nextBillingAt: currentCycle?.end_at ? new Date(currentCycle.end_at) : null,
      createdAt: subscription.created_at ? new Date(subscription.created_at) : new Date()
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
/* Subscription Verification (v5)                                            */
/* -------------------------------------------------------------------------- */

/**
 * Get subscription details from Pagar.me API (v5)
 * ✅ Use this to verify subscription status
 * 
 * Success states:
 * - subscription.status === 'active'
 * - current_cycle.status === 'paid'
 * 
 * @param {string} subscriptionId - Pagar.me subscription ID (sub_xxx)
 * @returns {Promise<object>} Subscription data with current_cycle
 */
export async function getSubscription(subscriptionId) {
  assertId(subscriptionId, 'sub_', 'subscription_id');

  try {
    const apiUrl = `${API_BASE}/subscriptions/${subscriptionId}`;

    console.log('[Pagar.me] Fetching subscription details:', { subscriptionId });

    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const subscription = response.data;

    // ✅ Determine if subscription is truly active and paid
    const isPaid = subscription.status === 'active' && 
                   subscription.current_cycle?.status === 'paid';

    console.log('[Pagar.me] ✅ Subscription details retrieved:', {
      subscriptionId: subscription.id,
      status: subscription.status,
      cycleStatus: subscription.current_cycle?.status,
      isPaid,
      interval: subscription.interval,
      intervalCount: subscription.interval_count,
      nextBillingAt: subscription.current_cycle?.end_at
    });

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      isPaid,
      currentCycle: subscription.current_cycle ? {
        id: subscription.current_cycle.id,
        status: subscription.current_cycle.status,
        startAt: subscription.current_cycle.start_at,
        endAt: subscription.current_cycle.end_at,
        billingAt: subscription.current_cycle.billing_at
      } : null,
      interval: subscription.interval,
      intervalCount: subscription.interval_count,
      paymentMethod: subscription.payment_method,
      customerId: subscription.customer?.id,
      createdAt: subscription.created_at,
      updatedAt: subscription.updated_at
    };
  } catch (error) {
    console.error('[Pagar.me] Error fetching subscription:', {
      subscriptionId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 404) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }
    
    throw new Error(`Erro ao buscar assinatura: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Get subscription invoices from Pagar.me API (v5)
 * ✅ Invoices are the SOURCE OF TRUTH for payment status
 * 
 * Check invoice.status === 'paid' to confirm payment
 * 
 * @param {string} subscriptionId - Pagar.me subscription ID (sub_xxx)
 * @returns {Promise<object[]>} List of invoices with payment status
 */
export async function getSubscriptionInvoices(subscriptionId) {
  assertId(subscriptionId, 'sub_', 'subscription_id');

  try {
    const apiUrl = `${API_BASE}/subscriptions/${subscriptionId}/invoices`;

    console.log('[Pagar.me] Fetching subscription invoices:', { subscriptionId });

    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    const invoices = response.data?.data || response.data || [];

    console.log('[Pagar.me] ✅ Subscription invoices retrieved:', {
      subscriptionId,
      invoiceCount: invoices.length,
      latestInvoice: invoices[0] ? {
        id: invoices[0].id,
        status: invoices[0].status,
        amount: invoices[0].amount,
        dueAt: invoices[0].due_at
      } : null
    });

    return invoices.map(invoice => ({
      id: invoice.id,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
      dueAt: invoice.due_at,
      paidAt: invoice.paid_at,
      charge: invoice.charge ? {
        id: invoice.charge.id,
        status: invoice.charge.status,
        paidAt: invoice.charge.paid_at
      } : null,
      period: invoice.period ? {
        startAt: invoice.period.start_at,
        endAt: invoice.period.end_at
      } : null
    }));
  } catch (error) {
    console.error('[Pagar.me] Error fetching subscription invoices:', {
      subscriptionId,
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    if (error.response?.status === 404) {
      throw new Error(`Assinatura não encontrada: ${subscriptionId}`);
    }
    
    throw new Error(`Erro ao buscar faturas: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Verify subscription payment status (v5)
 * ✅ Complete verification: checks subscription + latest invoice
 * 
 * Returns true ONLY if:
 * - subscription.status === 'active'
 * - current_cycle.status === 'paid'
 * 
 * @param {string} subscriptionId - Pagar.me subscription ID (sub_xxx)
 * @returns {Promise<object>} Verification result with detailed status
 */
export async function verifySubscriptionPayment(subscriptionId) {
  assertId(subscriptionId, 'sub_', 'subscription_id');

  try {
    // Get subscription details
    const subscription = await getSubscription(subscriptionId);
    
    // Get latest invoices
    let latestInvoice = null;
    try {
      const invoices = await getSubscriptionInvoices(subscriptionId);
      latestInvoice = invoices[0] || null;
    } catch (invoiceError) {
      console.warn('[Pagar.me] Could not fetch invoices:', invoiceError.message);
    }

    // Determine overall status
    const isActive = subscription.status === 'active';
    const isPaid = subscription.isPaid;
    const invoicePaid = latestInvoice?.status === 'paid';

    const verificationResult = {
      subscriptionId: subscription.subscriptionId,
      isValid: isActive && isPaid,
      status: subscription.status,
      isPaid,
      currentCycle: subscription.currentCycle,
      latestInvoice: latestInvoice ? {
        id: latestInvoice.id,
        status: latestInvoice.status,
        paidAt: latestInvoice.paidAt
      } : null,
      nextBillingAt: subscription.currentCycle?.endAt,
      verifiedAt: new Date().toISOString()
    };

    console.log('[Pagar.me] ✅ Subscription verification complete:', {
      subscriptionId,
      isValid: verificationResult.isValid,
      subscriptionStatus: subscription.status,
      cycleStatus: subscription.currentCycle?.status,
      invoiceStatus: latestInvoice?.status
    });

    return verificationResult;
  } catch (error) {
    console.error('[Pagar.me] Error verifying subscription:', {
      subscriptionId,
      message: error.message
    });
    
    return {
      subscriptionId,
      isValid: false,
      status: 'error',
      error: error.message,
      verifiedAt: new Date().toISOString()
    };
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

  // Safe debug: help user fix mismatch (never log actual secret)
  console.error('[Pagar.me] ❌ Webhook validation failed - no valid secret found');
  console.error('[Pagar.me] Expected header: X-Pagarme-Webhook-Secret or query param: ?token=...');
  console.error('[Pagar.me] Debug: query token present=', !!queryToken, 'query token length=', queryToken ? String(queryToken).length : 0, 'expected secret length=', PAGARME_WEBHOOK_SECRET ? PAGARME_WEBHOOK_SECRET.length : 0);
  console.error('[Pagar.me] Fix: Ensure PAGARME_WEBHOOK_SECRET in .env exactly matches the ?token= value in your Pagar.me webhook URL (no extra spaces or newlines).');
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
