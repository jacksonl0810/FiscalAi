/**
 * Customer Management Service
 * Manages Stripe customers and syncs with database
 */

import prisma from '../lib/prisma.js';
import * as stripeSDK from './stripeSDK.js';

/**
 * Create customer in Stripe
 * @param {object} customerData - Customer data
 * @returns {Promise<object>} Created customer from Stripe
 */
async function createCustomerInStripe(customerData) {
  console.log('[Customer Service] Creating customer in Stripe:', {
    userId: customerData.userId,
    email: customerData.email
  });

  try {
    const customer = await stripeSDK.createOrUpdateCustomer({
      email: customerData.email,
      name: customerData.name,
      phone: customerData.phone,
      metadata: {
        userId: customerData.userId,
        cpfCnpj: customerData.document
      }
    });

    console.log('[Customer Service] ✅ Customer created in Stripe:', {
      userId: customerData.userId,
      stripeCustomerId: customer.id
    });

    return customer;
  } catch (error) {
    console.error('[Customer Service] ❌ Error creating customer in Stripe:', {
      userId: customerData.userId,
      error: error.message
    });
    throw error;
  }
}

/**
 * Get or create customer for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Customer object
 */
export async function getOrCreateCustomer(userId) {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error(`User not found: ${userId}`);
  }

  // If user already has Stripe customer ID, return it
  if (user.stripeCustomerId) {
    console.log('[Customer Service] User already has Stripe customer:', user.stripeCustomerId);
    return {
      id: user.stripeCustomerId,
      email: user.email,
      name: user.name
    };
  }

  // Create customer in Stripe
  const stripeCustomer = await createCustomerInStripe({
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    document: user.cpfCnpj
  });

  // Update user with Stripe customer ID
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: stripeCustomer.id }
  });

  console.log('[Customer Service] ✅ Customer created and linked:', {
    userId: user.id,
    stripeCustomerId: stripeCustomer.id
  });

  return stripeCustomer;
}

/**
 * Get customer by user ID
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User with customer info
 */
export async function getCustomerByUserId(userId) {
  return await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      stripeCustomerId: true
    }
  });
}

/**
 * Get customer by Stripe customer ID
 * @param {string} stripeCustomerId - Stripe customer ID
 * @returns {Promise<object|null>} User from database
 */
export async function getCustomerByStripeId(stripeCustomerId) {
  return await prisma.user.findFirst({
    where: { stripeCustomerId }
  });
}

export default {
  getOrCreateCustomer,
  getCustomerByUserId,
  getCustomerByStripeId
};
