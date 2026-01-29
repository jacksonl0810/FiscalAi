/**
 * Plan Sync Service
 * Syncs plans from config/plans.js to database and Pagar.me
 * 
 * This service ensures:
 * 1. Plans exist in database with correct planType
 * 2. Plans are created in Pagar.me (if not trial/per_invoice)
 * 3. Database plans are linked to Pagar.me plans via pagarmePlanId
 */

import { prisma } from '../lib/prisma.js';
import { PLANS, getPlanConfig } from '../config/plans.js';
import * as pagarmeSDKService from './pagarMeSDK.js';

/**
 * Sync all plans from config to database
 * Creates or updates plans in database and Pagar.me
 */
export async function syncPlans() {
  console.log('[Plan Sync] Starting plan synchronization...');
  
  const allPlans = {
    ...PLANS,
    trial: getPlanConfig('trial') // Include trial plan
  };

  const results = {
    created: [],
    updated: [],
    errors: []
  };

  for (const [planKey, planConfig] of Object.entries(allPlans)) {
    try {
      const result = await syncPlan(planConfig);
      if (result.created) {
        results.created.push(planConfig.planId);
      } else if (result.updated) {
        results.updated.push(planConfig.planId);
      }
    } catch (error) {
      console.error(`[Plan Sync] Error syncing plan ${planConfig.planId}:`, error);
      results.errors.push({
        planId: planConfig.planId,
        error: error.message
      });
    }
  }

  console.log('[Plan Sync] Synchronization complete:', results);
  return results;
}

/**
 * Sync a single plan to database and Pagar.me
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
    billingCycle
  } = planConfig;
  
  // planType is not in config, we determine it from billingCycle
  const planType = planConfig.planType; // May be undefined

  // Determine planType from billingCycle (config doesn't have planType directly)
  const determinedPlanType = billingCycle === 'trial' ? 'trial' :
                             billingCycle === 'per_invoice' ? 'custom' :
                             billingCycle === 'annual' ? 'yearly' : 'monthly';
  
  // Use planType from config if provided, otherwise determine from billingCycle
  const finalPlanType = planType || determinedPlanType;

  // Determine amount and interval based on planType and billingCycle
  let amountCents = 0;
  let annualAmountCents = null;
  let interval = 'month';
  let intervalCount = 1;
  let trialDays = 0;

  if (finalPlanType === 'trial' || planId === 'trial') {
    amountCents = 0;
    annualAmountCents = null;
    interval = 'month';
    intervalCount = 1;
    trialDays = 7;
  } else if (finalPlanType === 'custom' || billingCycle === 'per_invoice') {
    amountCents = planConfig.perInvoicePrice || 0;
    annualAmountCents = null;
    interval = 'day';
    intervalCount = 1;
    trialDays = 0;
  } else {
    // Monthly or yearly plan
    amountCents = monthlyPrice || 0;
    annualAmountCents = annualPrice || null;
    interval = 'month';
    intervalCount = 1;
    trialDays = 0;
  }

  // Check if plan exists in database
  const existingPlan = await prisma.plan.findUnique({
    where: { planId }
  });

  let pagarmePlanId = existingPlan?.pagarmePlanId || null;

  // Create plan in Pagar.me if it's a paid plan (not trial or per_invoice)
  if (planType !== 'trial' && planType !== 'per_invoice' && amountCents > 0) {
    if (!pagarmePlanId) {
      try {
        console.log(`[Plan Sync] Creating plan in Pagar.me: ${planId}`);
        const pagarmePlan = await pagarmeSDKService.createPlan({
          name: `${name} (${billingCycle === 'annual' ? 'Anual' : 'Mensal'})`,
          amount: amountCents,
          interval: interval,
          intervalCount: intervalCount,
          trialDays: trialDays
        });

        pagarmePlanId = pagarmePlan.id;
        console.log(`[Plan Sync] ✅ Plan created in Pagar.me: ${pagarmePlanId}`);
      } catch (error) {
        console.error(`[Plan Sync] Error creating plan in Pagar.me for ${planId}:`, error);
        // Continue without Pagar.me plan ID (plan will be created later)
      }
    }
  }

  // Prepare plan data for database
  const planData = {
    planId,
    name,
    description: description || null,
    pagarmePlanId,
    pagarmePlanIdAnnual: null, // Will be set when creating annual plan in Pagar.me
    amountCents,
    annualAmountCents,
    interval,
    intervalCount,
    trialDays: trialDays > 0 ? trialDays : null,
    planType: finalPlanType,
    maxCompanies: maxCompanies || null,
    maxInvoicesPerMonth: maxInvoicesPerMonth || null,
    isActive: true,
    metadata: {
      billingCycle,
      monthlyPrice,
      annualPrice,
      perInvoicePrice: planConfig.perInvoicePrice || null,
      features: planConfig.features || []
    }
  };

  // Create or update plan in database
  let created = false;
  if (existingPlan) {
    await prisma.plan.update({
      where: { planId },
      data: planData
    });
    console.log(`[Plan Sync] ✅ Updated plan in database: ${planId}`);
  } else {
    await prisma.plan.create({
      data: planData
    });
    created = true;
    console.log(`[Plan Sync] ✅ Created plan in database: ${planId}`);
  }

  return { created, updated: !created, planId, pagarmePlanId };
}

/**
 * Get plan from database by planId
 * @param {string} planId - Plan ID
 * @returns {Promise<object|null>} Plan from database
 */
export async function getPlanFromDB(planId) {
  return await prisma.plan.findUnique({
    where: { planId }
  });
}

/**
 * Ensure plan exists in database (creates if missing)
 * @param {string} planId - Plan ID
 * @returns {Promise<object>} Plan from database
 */
export async function ensurePlanExists(planId) {
  let plan = await getPlanFromDB(planId);
  
  if (!plan) {
    const planConfig = getPlanConfig(planId);
    if (!planConfig) {
      throw new Error(`Plan not found: ${planId}`);
    }
    
    await syncPlan(planConfig);
    plan = await getPlanFromDB(planId);
  }
  
  return plan;
}
