/**
 * Plan Sync Service
 * Syncs plans from config/plans.js to database
 * 
 * NOTE: Stripe uses pre-created Prices in the dashboard.
 * Plans are synced to the local database only for reference.
 * Price IDs are stored in config/plans.js (stripePrices field).
 */

import { prisma } from '../lib/prisma.js';
import { PLANS, getPlanConfig, getStripePriceId } from '../config/plans.js';

/**
 * Sync all plans from config to database
 * Creates or updates plans in database
 */
export async function syncPlans() {
  console.log('[Plan Sync] Starting plan synchronization...');
  
  const allPlans = {
    ...PLANS
  };
  
  const results = {
    created: 0,
    updated: 0,
    errors: []
  };

  for (const [planId, planConfig] of Object.entries(allPlans)) {
    try {
      const result = await syncPlan(planConfig);
      if (result.created) results.created++;
      else results.updated++;
    } catch (error) {
      console.error(`[Plan Sync] Error syncing plan ${planId}:`, error.message);
      results.errors.push({ planId, error: error.message });
    }
  }

  console.log('[Plan Sync] Synchronization complete:', results);
  return results;
}

/**
 * Sync a single plan to database
 * @param {object} planConfig - Plan configuration from config/plans.js
 * @returns {Promise<object>} Sync result
 */
export async function syncPlan(planConfig) {
  const {
    planId,
    name,
    description,
    monthlyPrice,
    annualPrice,
    maxCompanies,
    maxInvoicesPerMonth,
    features,
    billingCycle,
    stripePrices
  } = planConfig;

  // Determine plan type based on config
  let planType = 'subscription';
  if (billingCycle === 'custom') planType = 'custom';
  else if (planId === 'pay_per_use') planType = 'pay_per_use';

  // Get interval info
  const interval = billingCycle === 'annual' ? 'year' : 'month';
  const intervalCount = 1;

  // Amounts (already in cents)
  const amountCents = monthlyPrice || 0;
  const annualAmountCents = annualPrice || 0;

  // No trial days (trial plan removed)
  const trialDays = 0;

  // Stripe price IDs
  const stripePriceIdMonthly = stripePrices?.monthly || null;
  const stripePriceIdAnnual = stripePrices?.annual || null;

  // Check if plan exists in database
  const existingPlan = await prisma.plan.findUnique({
    where: { planId }
  });

  // Prepare plan data for database
  const planData = {
    planId,
    name,
    description: description || null,
    stripePriceId: stripePriceIdMonthly,
    stripePriceIdAnnual: stripePriceIdAnnual,
    amountCents,
    annualAmountCents,
    interval,
    intervalCount,
    trialDays: trialDays > 0 ? trialDays : null,
    maxCompanies: maxCompanies || null,
    maxInvoicesPerMonth: maxInvoicesPerMonth || null,
    features: features || [],
    planType,
    isActive: true
  };

  let created = false;

  if (existingPlan) {
    // Update existing plan
    await prisma.plan.update({
      where: { planId },
      data: planData
    });
    console.log(`[Plan Sync] ✅ Updated plan in database: ${planId}`);
  } else {
    // Create new plan
    await prisma.plan.create({
      data: planData
    });
    created = true;
    console.log(`[Plan Sync] ✅ Created plan in database: ${planId}`);
  }

  return { 
    created, 
    updated: !created, 
    planId, 
    stripePriceIdMonthly,
    stripePriceIdAnnual
  };
}

/**
 * Get plan from database by planId
 * @param {string} planId - Plan ID
 * @returns {Promise<object|null>} Plan from database
 */
export async function getPlanFromDatabase(planId) {
  return await prisma.plan.findUnique({
    where: { planId }
  });
}

/**
 * Get all active plans from database
 * @returns {Promise<Array>} Array of active plans
 */
export async function getActivePlans() {
  return await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { amountCents: 'asc' }
  });
}

export default {
  syncPlans,
  syncPlan,
  getPlanFromDatabase,
  getActivePlans
};
