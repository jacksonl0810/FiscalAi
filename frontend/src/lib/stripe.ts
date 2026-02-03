/**
 * Stripe.js initialization
 * Loads Stripe with the publishable key from environment
 */
import { loadStripe } from '@stripe/stripe-js';

// Initialize Stripe - this promise is used by Elements provider
export const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
