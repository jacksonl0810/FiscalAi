/**
 * Pagar.me API Integration Service
 * 
 * Documentation: https://docs.pagar.me/v3/docs
 * 
 * This service handles:
 * - Customer creation
 * - Subscription management
 * - Payment processing
 * - Webhook signature validation
 */

import pagarme from 'pagarme';
import crypto from 'crypto';

const PAGARME_API_KEY = process.env.PAGARME_API_KEY;
const PAGARME_ENCRYPTION_KEY = process.env.PAGARME_ENCRYPTION_KEY;
const PAGARME_WEBHOOK_SECRET = process.env.PAGARME_WEBHOOK_SECRET;
const PAGARME_ENVIRONMENT = process.env.PAGARME_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'

let pagarmeClient = null;

/**
 * Initialize Pagar.me client
 * @returns {Promise<object>} Pagar.me client
 */
async function getClient() {
  if (pagarmeClient) {
    return pagarmeClient;
  }

  if (!PAGARME_API_KEY) {
    throw new Error('Pagar.me API key not configured. Please set PAGARME_API_KEY environment variable.');
  }

  try {
    pagarmeClient = await pagarme.client.connect({ api_key: PAGARME_API_KEY });
    return pagarmeClient;
  } catch (error) {
    console.error('Error connecting to Pagar.me:', error);
    throw new Error(`Failed to connect to Pagar.me: ${error.message}`);
  }
}

/**
 * Create a customer in Pagar.me
 * @param {object} customerData - Customer data
 * @param {string} customerData.name - Customer name
 * @param {string} customerData.email - Customer email
 * @param {string} customerData.cpfCnpj - CPF or CNPJ (numbers only)
 * @param {string} customerData.phone - Phone number
 * @param {string} customerData.externalId - External ID (user ID from our system)
 * @returns {Promise<object>} Created customer
 */
async function createCustomer(customerData) {
  try {
    const client = await getClient();

    const customer = await client.customers.create({
      external_id: customerData.externalId,
      name: customerData.name,
      email: customerData.email,
      type: customerData.cpfCnpj.length === 11 ? 'individual' : 'corporation',
      country: 'br',
      documents: [
        {
          type: customerData.cpfCnpj.length === 11 ? 'cpf' : 'cnpj',
          number: customerData.cpfCnpj.replace(/\D/g, '') // Remove formatting
        }
      ],
      phone_numbers: [customerData.phone || ''],
      birthday: customerData.birthday || null
    });

    return {
      customerId: customer.id,
      externalId: customer.external_id
    };
  } catch (error) {
    console.error('Error creating customer in Pagar.me:', error);
    throw new Error(`Falha ao criar cliente no Pagar.me: ${error.message}`);
  }
}

/**
 * Create a subscription plan in Pagar.me
 * @param {object} planData - Plan data
 * @param {number} planData.amount - Amount in cents (e.g., 9900 for R$ 99.00)
 * @param {string} planData.name - Plan name
 * @param {number} planData.days - Billing cycle in days (default: 30 for monthly)
 * @returns {Promise<object>} Created plan
 */
async function createPlan(planData) {
  try {
    const client = await getClient();

    const plan = await client.plans.create({
      name: planData.name,
      amount: planData.amount,
      days: planData.days || 30,
      payment_methods: ['credit_card', 'boleto', 'pix'],
      currency: 'BRL'
    });

    return {
      planId: plan.id,
      name: plan.name,
      amount: plan.amount
    };
  } catch (error) {
    console.error('Error creating plan in Pagar.me:', error);
    throw new Error(`Falha ao criar plano no Pagar.me: ${error.message}`);
  }
}

/**
 * Create a subscription
 * @param {object} subscriptionData - Subscription data
 * @param {string} subscriptionData.customerId - Pagar.me customer ID
 * @param {string} subscriptionData.planId - Pagar.me plan ID
 * @param {object} subscriptionData.paymentMethod - Payment method data
 * @param {string} subscriptionData.paymentMethod.type - 'credit_card', 'boleto', or 'pix'
 * @param {object} subscriptionData.paymentMethod.card - Card data (if credit_card)
 * @returns {Promise<object>} Created subscription
 */
async function createSubscription(subscriptionData) {
  try {
    const client = await getClient();

    const subscriptionParams = {
      plan_id: subscriptionData.planId,
      customer_id: subscriptionData.customerId,
      payment_method: subscriptionData.paymentMethod.type
    };

    // Add card data if credit card
    if (subscriptionData.paymentMethod.type === 'credit_card' && subscriptionData.paymentMethod.card) {
      subscriptionParams.card_id = subscriptionData.paymentMethod.card.id;
      // Or card data directly
      if (!subscriptionParams.card_id) {
        subscriptionParams.card = {
          number: subscriptionData.paymentMethod.card.number,
          holder_name: subscriptionData.paymentMethod.card.holderName,
          exp_month: subscriptionData.paymentMethod.card.expMonth,
          exp_year: subscriptionData.paymentMethod.card.expYear,
          cvv: subscriptionData.paymentMethod.card.cvv
        };
      }
    }

    const subscription = await client.subscriptions.create(subscriptionParams);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodStart: subscription.current_period_start ? new Date(subscription.current_period_start * 1000) : null,
      currentPeriodEnd: subscription.current_period_end ? new Date(subscription.current_period_end * 1000) : null
    };
  } catch (error) {
    console.error('Error creating subscription in Pagar.me:', error);
    throw new Error(`Falha ao criar assinatura no Pagar.me: ${error.message}`);
  }
}

/**
 * Get subscription details
 * @param {string} subscriptionId - Pagar.me subscription ID
 * @returns {Promise<object>} Subscription details
 */
async function getSubscription(subscriptionId) {
  try {
    const client = await getClient();
    const subscription = await client.subscriptions.find({ id: subscriptionId });
    return subscription;
  } catch (error) {
    console.error('Error getting subscription from Pagar.me:', error);
    throw new Error(`Falha ao consultar assinatura no Pagar.me: ${error.message}`);
  }
}

/**
 * Cancel a subscription
 * @param {string} subscriptionId - Pagar.me subscription ID
 * @returns {Promise<object>} Cancellation result
 */
async function cancelSubscription(subscriptionId) {
  try {
    const client = await getClient();
    const subscription = await client.subscriptions.cancel({ id: subscriptionId });
    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : new Date()
    };
  } catch (error) {
    console.error('Error canceling subscription in Pagar.me:', error);
    throw new Error(`Falha ao cancelar assinatura no Pagar.me: ${error.message}`);
  }
}

/**
 * Validate webhook signature
 * Pagar.me uses HMAC SHA256 for webhook signature validation
 * @param {string} signature - Webhook signature from header (format: sha256=<hash> or just hash)
 * @param {string} payload - Raw request body
 * @returns {boolean} True if signature is valid
 */
function validateWebhookSignature(signature, payload) {
  if (!PAGARME_WEBHOOK_SECRET) {
    console.warn('Pagar.me webhook secret not configured. Skipping signature validation.');
    // In production, this should return false, but for development we allow it
    return process.env.NODE_ENV !== 'production';
  }

  if (!signature) {
    console.error('No webhook signature provided');
    return false;
  }

  // Pagar.me sends signature in format: sha256=<hash> or just the hash
  const providedHash = signature.replace(/^sha256=/, '').trim();
  
  // Calculate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', PAGARME_WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks
  if (providedHash.length !== expectedSignature.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(providedHash, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

/**
 * Get transaction details
 * @param {string} transactionId - Pagar.me transaction ID
 * @returns {Promise<object>} Transaction details
 */
async function getTransaction(transactionId) {
  try {
    const client = await getClient();
    const transaction = await client.transactions.find({ id: transactionId });
    return transaction;
  } catch (error) {
    console.error('Error getting transaction from Pagar.me:', error);
    throw new Error(`Falha ao consultar transação no Pagar.me: ${error.message}`);
  }
}

export {
  createCustomer,
  createPlan,
  createSubscription,
  getSubscription,
  cancelSubscription,
  validateWebhookSignature,
  getTransaction,
  getClient
};
