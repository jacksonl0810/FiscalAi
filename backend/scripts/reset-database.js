/**
 * Database Reset Script
 * 
 * This script will:
 * 1. Drop all existing tables
 * 2. Create fresh tables based on current Prisma schema
 * 3. Run seed data if available
 * 
 * ⚠️ WARNING: This will DELETE ALL DATA in the database!
 * Only run this in development or when you want to completely reset the database.
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Starting database reset...\n');

  try {
    // Step 1: Drop all existing tables
    console.log('📋 Step 1: Dropping all existing tables...');
    
    // Get all table names from the database
    const tables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    if (tables.length > 0) {
      console.log(`   Found ${tables.length} tables to drop:`);
      tables.forEach(table => {
        console.log(`   - ${table.tablename}`);
      });

      // Drop all tables
      for (const table of tables) {
        try {
          await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${table.tablename}" CASCADE;`);
          console.log(`   ✅ Dropped table: ${table.tablename}`);
        } catch (error) {
          console.error(`   ❌ Error dropping table ${table.tablename}:`, error.message);
        }
      }
    } else {
      console.log('   No tables found to drop.');
    }

    console.log('\n📋 Step 2: Creating fresh database schema...');
    
    // Step 2: Push schema to database
    try {
      execSync('npx prisma db push --force-reset --accept-data-loss', {
        cwd: join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('   ✅ Schema pushed successfully');
    } catch (error) {
      console.error('   ❌ Error pushing schema:', error.message);
      throw error;
    }

    console.log('\n📋 Step 3: Generating Prisma Client...');
    try {
      execSync('npx prisma generate', {
        cwd: join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('   ✅ Prisma Client generated successfully');
    } catch (error) {
      console.error('   ❌ Error generating Prisma Client:', error.message);
      throw error;
    }

    console.log('\n📋 Step 4: Running seed script (if available)...');
    try {
      const seedPath = join(__dirname, '..', 'prisma', 'seed.js');
      const seedExists = readFileSync(seedPath, 'utf8').length > 0;
      
      if (seedExists) {
        execSync('node prisma/seed.js', {
          cwd: join(__dirname, '..'),
          stdio: 'inherit'
        });
        console.log('   ✅ Seed data loaded successfully');
      } else {
        console.log('   ⚠️  No seed file found, skipping...');
      }
    } catch (error) {
      console.warn('   ⚠️  Seed script failed or not found:', error.message);
      console.log('   Continuing without seed data...');
    }

    console.log('\n✅ Database reset completed successfully!');
    console.log('\n📊 Current database tables:');
    
    const newTables = await prisma.$queryRaw`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT LIKE '_prisma%'
      ORDER BY tablename;
    `;

    newTables.forEach(table => {
      console.log(`   - ${table.tablename}`);
    });

  } catch (error) {
    console.error('\n❌ Error during database reset:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the reset
resetDatabase()
  .then(() => {
    console.log('\n✨ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
