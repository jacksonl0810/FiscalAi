/**
 * Seed Plans from config file to database
 * This script syncs plan definitions from config/plans.js to the database Plan model
 */

import { PrismaClient } from '@prisma/client';
import { PLANS, getPlanConfig } from '../src/config/plans.js';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('🌱 Seeding plans from config to database...\n');

  try {
    // Get all plans from config
    const configPlans = Object.values(PLANS);
    
    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const configPlan of configPlans) {
      const planId = configPlan.planId;
      
      // Determine plan type
      let planType = 'monthly';
      if (configPlan.billingCycle === 'annual' || configPlan.billingCycle === 'yearly') {
        planType = 'yearly';
      } else if (configPlan.billingCycle === 'custom') {
        planType = 'custom';
      } else if (planId === 'pay_per_use') {
        planType = 'pay_per_use';
      }

      // Determine interval
      let interval = 'month';
      let intervalCount = 1;
      if (planType === 'yearly' || configPlan.billingCycle === 'annual') {
        interval = 'year';
        intervalCount = 1;
      }

      // Prepare plan data
      const planData = {
        planId: planId,
        name: configPlan.name,
        description: configPlan.description || null,
        amountCents: configPlan.monthlyPrice || 0,
        annualAmountCents: configPlan.annualPrice || null,
        interval: interval,
        intervalCount: intervalCount,
        trialDays: 0, // No trial
        planType: planType,
        maxCompanies: configPlan.maxCompanies || null,
        maxInvoicesPerMonth: configPlan.maxInvoicesPerMonth || null,
        isActive: true,
        metadata: {
          features: configPlan.features || [],
          perInvoicePrice: configPlan.perInvoicePrice || null,
          billingCycle: configPlan.billingCycle
        }
      };

      // Check if plan exists
      const existingPlan = await prisma.plan.findUnique({
        where: { planId: planId }
      });

      if (existingPlan) {
        // Update existing plan
        await prisma.plan.update({
          where: { planId: planId },
          data: planData
        });
        console.log(`✅ Updated plan: ${planId} (${configPlan.name})`);
        updated++;
      } else {
        // Create new plan
        await prisma.plan.create({
          data: planData
        });
        console.log(`✨ Created plan: ${planId} (${configPlan.name})`);
        created++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`\n✅ Plans seeded successfully!`);

  } catch (error) {
    console.error('❌ Error seeding plans:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlans()
    .then(() => {
      console.log('\n🎉 Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Failed:', error);
      process.exit(1);
    });
}

export { seedPlans };
