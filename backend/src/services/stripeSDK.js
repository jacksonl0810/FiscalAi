/**
 * Stripe SDK Service
 * Handles all Stripe API operations for FiscalAI
 */

import Stripe from 'stripe';

// Initialize Stripe with API key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder', {
  apiVersion: '2024-12-18.acacia',
  maxNetworkRetries: 2,
  timeout: 30000,
});

// Export stripe instance for direct access if needed
export const stripeSDK = stripe;

/**
 * Create or retrieve Stripe customer
 * @param {Object} customerData
 * @param {string} customerData.email - Customer email
 * @param {string} customerData.name - Customer name
 * @param {string} [customerData.phone] - Customer phone
 * @param {Object} [customerData.metadata] - Additional metadata
 * @param {string} [customerData.existingStripeId] - Existing Stripe customer ID
 * @returns {Promise<Stripe.Customer>}
 */
export async function createOrUpdateCustomer({ email, name, phone, metadata, existingStripeId }) {
  try {
    // If we have an existing Stripe customer ID, update it
    if (existingStripeId) {
      console.log('[Stripe] Updating existing customer:', existingStripeId);
      return await stripe.customers.update(existingStripeId, {
        name,
        phone,
        metadata
      });
    }

    // Search for existing customer by email
    const existingCustomers = await stripe.customers.list({ 
      email, 
      limit: 1 
    });
    
    if (existingCustomers.data.length > 0) {
      const customer = existingCustomers.data[0];
      console.log('[Stripe] Found existing customer by email:', customer.id);
      
      // Update customer with latest info
      return await stripe.customers.update(customer.id, {
        name,
        phone,
        metadata
      });
    }
    
    // Create new customer
    console.log('[Stripe] Creating new customer for:', email);
    return await stripe.customers.create({
      email,
      name,
      phone,
      metadata
    });
  } catch (error) {
    console.error('[Stripe] Error creating/updating customer:', error);
    throw new Error(`Failed to create/update Stripe customer: ${error.message}`);
  }
}

/**
 * Attach payment method to customer and set as default
 * @param {string} customerId - Stripe customer ID
 * @param {string} paymentMethodId - Payment method ID from frontend
 * @returns {Promise<string>} Payment method ID
 */
export async function attachPaymentMethod({ customerId, paymentMethodId }) {
  try {
    console.log('[Stripe] Attaching payment method:', paymentMethodId, 'to customer:', customerId);
    
    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });
    
    // Set as default payment method for invoices
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });
    
    console.log('[Stripe] ✅ Payment method attached and set as default');
    return paymentMethodId;
  } catch (error) {
    console.error('[Stripe] Error attaching payment method:', error);
    throw new Error(`Failed to attach payment method: ${error.message}`);
  }
}

/**
 * Create subscription
 * @param {Object} subscriptionData
 * @param {string} subscriptionData.customerId - Stripe customer ID
 * @param {string} subscriptionData.priceId - Stripe price ID
 * @param {Object} [subscriptionData.metadata] - Additional metadata
 * @param {number} [subscriptionData.trial_period_days] - Trial period in days
 * @param {string} [subscriptionData.paymentMethodId] - Payment method ID (if not already default)
 * @returns {Promise<Object>} Subscription details with client secret
 */
export async function createSubscription({
  customerId,
  priceId,
  metadata = {},
  trial_period_days = null,
  paymentMethodId = null
}) {
  try {
    console.log('[Stripe] Creating subscription for customer:', customerId, 'with price:', priceId);
    
    const subscriptionData = {
      customer: customerId,
      items: [{ price: priceId }],
      // Use default_incomplete to require payment before activating
      payment_behavior: 'default_incomplete',
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription',
      },
      // Expand to get payment intent client secret
      expand: ['latest_invoice.payment_intent'],
      metadata
    };
    
    // Add payment method if provided
    if (paymentMethodId) {
      subscriptionData.default_payment_method = paymentMethodId;
    }
    
    // Add trial period if specified
    if (trial_period_days) {
      subscriptionData.trial_period_days = trial_period_days;
    }
    
    const subscription = await stripe.subscriptions.create(subscriptionData);
    
    console.log('[Stripe] ✅ Subscription created:', subscription.id, 'Status:', subscription.status);
    
    return {
      subscriptionId: subscription.id,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
    };
  } catch (error) {
    console.error('[Stripe] Error creating subscription:', error);
    throw new Error(`Failed to create subscription: ${error.message}`);
  }
}

/**
 * Get subscription details
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Stripe.Subscription>}
 */
export async function getSubscription(subscriptionId) {
  try {
    return await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'default_payment_method']
    });
  } catch (error) {
    console.error('[Stripe] Error retrieving subscription:', error);
    throw new Error(`Failed to retrieve subscription: ${error.message}`);
  }
}

/**
 * Update subscription (e.g., change plan)
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {Object} updateData
 * @param {string} [updateData.priceId] - New price ID
 * @param {Object} [updateData.metadata] - Updated metadata
 * @returns {Promise<Stripe.Subscription>}
 */
export async function updateSubscription(subscriptionId, updateData) {
  try {
    console.log('[Stripe] Updating subscription:', subscriptionId);
    
    const updates = {};
    
    if (updateData.priceId) {
      // Get current subscription to update items
      const currentSub = await stripe.subscriptions.retrieve(subscriptionId);
      updates.items = [{
        id: currentSub.items.data[0].id,
        price: updateData.priceId,
      }];
    }
    
    if (updateData.metadata) {
      updates.metadata = updateData.metadata;
    }
    
    return await stripe.subscriptions.update(subscriptionId, updates);
  } catch (error) {
    console.error('[Stripe] Error updating subscription:', error);
    throw new Error(`Failed to update subscription: ${error.message}`);
  }
}

/**
 * Cancel subscription
 * @param {string} subscriptionId - Stripe subscription ID
 * @param {boolean} [immediately=false] - Cancel immediately or at period end
 * @returns {Promise<Stripe.Subscription>}
 */
export async function cancelSubscription(subscriptionId, immediately = false) {
  try {
    console.log('[Stripe] Canceling subscription:', subscriptionId, 'Immediately:', immediately);
    
    if (immediately) {
      // Cancel immediately
      return await stripe.subscriptions.cancel(subscriptionId);
    } else {
      // Cancel at period end
      return await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: true
      });
    }
  } catch (error) {
    console.error('[Stripe] Error canceling subscription:', error);
    throw new Error(`Failed to cancel subscription: ${error.message}`);
  }
}

/**
 * Reactivate subscription (undo cancel_at_period_end)
 * @param {string} subscriptionId - Stripe subscription ID
 * @returns {Promise<Stripe.Subscription>}
 */
export async function reactivateSubscription(subscriptionId) {
  try {
    console.log('[Stripe] Reactivating subscription:', subscriptionId);
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });
  } catch (error) {
    console.error('[Stripe] Error reactivating subscription:', error);
    throw new Error(`Failed to reactivate subscription: ${error.message}`);
  }
}

/**
 * Get invoice details
 * @param {string} invoiceId - Stripe invoice ID
 * @returns {Promise<Stripe.Invoice>}
 */
export async function getInvoice(invoiceId) {
  try {
    return await stripe.invoices.retrieve(invoiceId);
  } catch (error) {
    console.error('[Stripe] Error retrieving invoice:', error);
    throw new Error(`Failed to retrieve invoice: ${error.message}`);
  }
}

/**
 * List customer's subscriptions
 * @param {string} customerId - Stripe customer ID
 * @returns {Promise<Stripe.Subscription[]>}
 */
export async function listCustomerSubscriptions(customerId) {
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      limit: 10
    });
    return subscriptions.data;
  } catch (error) {
    console.error('[Stripe] Error listing subscriptions:', error);
    throw new Error(`Failed to list subscriptions: ${error.message}`);
  }
}

/**
 * Verify webhook signature
 * @param {string|Buffer} payload - Raw request body
 * @param {string} signature - Stripe-Signature header
 * @param {string} secret - Webhook signing secret
 * @returns {Stripe.Event} Verified event object
 */
export function constructWebhookEvent(payload, signature, secret) {
  try {
    return stripe.webhooks.constructEvent(payload, signature, secret);
  } catch (error) {
    console.error('[Stripe] Webhook signature verification failed:', error);
    throw new Error(`Webhook signature verification failed: ${error.message}`);
  }
}

// Export default for convenience
export default {
  stripe: stripeSDK,
  createOrUpdateCustomer,
  attachPaymentMethod,
  createSubscription,
  getSubscription,
  updateSubscription,
  cancelSubscription,
  reactivateSubscription,
  getInvoice,
  listCustomerSubscriptions,
  constructWebhookEvent,
};
