/**
 * Customer Management Service
 * Manages Pagar.me customers and syncs with database
 */

import prisma from '../lib/prisma.js';
import axios from 'axios';
import https from 'https';

const API_BASE = 'https://api.pagar.me/core/v5';
const PAGARME_TIMEOUT = 30000;

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 1000,
  maxSockets: 50,
  maxFreeSockets: 10,
  timeout: PAGARME_TIMEOUT
});

/**
 * Get authentication headers
 */
function getAuthHeaders() {
  const PAGARME_API_KEY = process.env.PAGARME_API_KEY;
  if (!PAGARME_API_KEY) {
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
 * Create customer in Pagar.me
 * @param {object} customerData - Customer data
 * @returns {Promise<object>} Created customer from Pagar.me
 */
async function createCustomerInPagarMe(customerData) {
  const apiUrl = `${API_BASE}/customers`;

  const requestBody = {
    name: customerData.name,
    email: customerData.email,
    document: customerData.document,
    type: customerData.document?.length === 11 ? 'individual' : 'company',
    metadata: {
      user_id: customerData.userId
    }
  };

  console.log('[Customer Service] Creating customer in Pagar.me:', {
    userId: customerData.userId,
    email: customerData.email
  });

  try {
    const response = await axios.post(apiUrl, requestBody, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    console.log('[Customer Service] ✅ Customer created in Pagar.me:', {
      userId: customerData.userId,
      pagarmeCustomerId: response.data.id
    });

    return response.data;
  } catch (error) {
    console.error('[Customer Service] ❌ Error creating customer in Pagar.me:', {
      userId: customerData.userId,
      error: error.response?.data || error.message
    });
    throw error;
  }
}

/**
 * Get customer from Pagar.me by ID
 * @param {string} pagarmeCustomerId - Pagar.me customer ID
 * @returns {Promise<object|null>} Customer from Pagar.me or null
 */
async function getCustomerFromPagarMe(pagarmeCustomerId) {
  const apiUrl = `${API_BASE}/customers/${pagarmeCustomerId}`;

  try {
    const response = await axios.get(apiUrl, {
      headers: getAuthHeaders(),
      timeout: PAGARME_TIMEOUT,
      httpsAgent: httpsAgent
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Get or create customer for user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Customer from database
 */
export async function getOrCreateCustomer(userId) {
  // Check if customer exists in database
  let customer = await prisma.customer.findUnique({
    where: { userId },
    include: { user: true }
  });

  if (customer) {
    return customer;
  }

  // Get user data
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // Create customer in Pagar.me
  const pagarmeCustomer = await createCustomerInPagarMe({
    userId: user.id,
    name: user.name,
    email: user.email,
    document: user.cpfCnpj
  });

  // Create customer in database
  customer = await prisma.customer.create({
    data: {
      userId: user.id,
      pagarmeCustomerId: pagarmeCustomer.id,
      document: user.cpfCnpj,
      metadata: {
        created_from: 'subscription'
      }
    },
    include: { user: true }
  });

  console.log('[Customer Service] ✅ Customer created:', {
    userId: customer.userId,
    pagarmeCustomerId: customer.pagarmeCustomerId
  });

  return customer;
}

/**
 * Get customer by user ID
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} Customer from database
 */
export async function getCustomerByUserId(userId) {
  return await prisma.customer.findUnique({
    where: { userId },
    include: { user: true }
  });
}

/**
 * Get customer by Pagar.me customer ID
 * @param {string} pagarmeCustomerId - Pagar.me customer ID
 * @returns {Promise<object|null>} Customer from database
 */
export async function getCustomerByPagarMeId(pagarmeCustomerId) {
  return await prisma.customer.findUnique({
    where: { pagarmeCustomerId },
    include: { user: true }
  });
}

export default {
  getOrCreateCustomer,
  getCustomerByUserId,
  getCustomerByPagarMeId
};
