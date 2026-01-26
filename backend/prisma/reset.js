import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');
const migrationsDir = join(__dirname, 'migrations');

const prisma = new PrismaClient();

async function resetDatabase() {
  console.log('🔄 Resetting database...');
  console.log('⚠️  This will DELETE ALL DATA!');
  
  try {
    // Check if migrations exist
    const hasMigrations = existsSync(migrationsDir) && 
      require('fs').readdirSync(migrationsDir).length > 0;
    
    if (hasMigrations) {
      // Use migrate reset if migrations exist
      console.log('📦 Dropping all tables and recreating schema (using migrations)...');
      execSync('npx prisma migrate reset --force --skip-seed', {
        cwd: backendDir,
        stdio: 'inherit'
      });
    } else {
      // Use db push if no migrations exist
      console.log('📦 No migrations found. Using db push to create schema...');
      console.log('📦 Dropping all tables...');
      
      // First, try to drop the schema (this will fail if tables don't exist, which is OK)
      try {
        await prisma.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE;');
        await prisma.$executeRawUnsafe('CREATE SCHEMA public;');
        await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO postgres;');
        await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO public;');
        console.log('✅ Schema dropped');
      } catch (error) {
        // Ignore if schema doesn't exist
        console.log('ℹ️  Schema already clean or doesn\'t exist');
      }
      
      // Push schema to create tables
      console.log('📦 Creating tables from schema...');
      execSync('npx prisma db push --force-reset --skip-generate', {
        cwd: backendDir,
        stdio: 'inherit'
      });
      
      // Generate Prisma Client
      console.log('📦 Generating Prisma Client...');
      execSync('npx prisma generate', {
        cwd: backendDir,
        stdio: 'inherit'
      });
    }
    
    console.log('\n✅ Database reset complete!');
    console.log('🌱 Run "npm run db:seed" to populate with demo data');
  } catch (error) {
    console.error('❌ Error resetting database:', error.message);
    if (error.stdout) console.log('Output:', error.stdout);
    if (error.stderr) console.error('Error:', error.stderr);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resetDatabase();
