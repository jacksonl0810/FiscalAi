/**
 * Database Check Script
 * 
 * This script checks the current database state and compares it with the Prisma schema
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking database state...\n');

  try {
    // Get all tables from database
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    console.log(`📊 Found ${tables.length} tables in database:\n`);
    tables.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.tablename}`);
    });

    // Expected tables from schema
    const expectedTables = [
      'users',
      'refresh_tokens',
      'companies',
      'invoices',
      'notifications',
      'user_settings',
      'das',
      'fiscal_integration_status',
      'subscriptions',
      'payments',
      'conversation_messages',
      'invoice_usage',
      'plan_configurations',
      'fiscal_credentials',
      'invoice_status_history',
      'accountant_reviews',
      'invoice_retry_queue',
      'municipality_cache'
    ];

    console.log(`\n📋 Expected tables from schema: ${expectedTables.length}\n`);
    expectedTables.forEach((table, index) => {
      const exists = tables.some(t => t.tablename === table);
      const status = exists ? '✅' : '❌';
      console.log(`   ${index + 1}. ${status} ${table}`);
    });

    // Check for extra tables
    const tableNames = tables.map(t => t.tablename);
    const extraTables = tableNames.filter(t => !expectedTables.includes(t));

    if (extraTables.length > 0) {
      console.log(`\n⚠️  Found ${extraTables.length} extra tables not in schema:`);
      extraTables.forEach(table => {
        console.log(`   - ${table}`);
      });
    } else {
      console.log(`\n✅ No extra tables found. Database matches schema.`);
    }

    // Check for missing tables
    const missingTables = expectedTables.filter(t => !tableNames.includes(t));

    if (missingTables.length > 0) {
      console.log(`\n⚠️  Missing ${missingTables.length} tables from schema:`);
      missingTables.forEach(table => {
        console.log(`   - ${table}`);
      });
    } else {
      console.log(`\n✅ All expected tables exist.`);
    }

    console.log('\n✨ Database check completed!');

  } catch (error) {
    console.error('❌ Error checking database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
