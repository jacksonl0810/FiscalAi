import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');

const prisma = new PrismaClient();

async function setupDatabase() {
  console.log('🔄 Setting up database...');
  
  try {
    // Step 1: Push schema to create tables (without force-reset)
    console.log('📦 Creating/updating database schema...');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: backendDir,
      stdio: 'inherit'
    });
    
    // Step 2: Generate Prisma Client
    console.log('📦 Generating Prisma Client...');
    execSync('npx prisma generate', {
      cwd: backendDir,
      stdio: 'inherit'
    });
    
    console.log('\n✅ Database setup complete!');
    console.log('🌱 Run "npm run db:seed" to populate with demo data');
  } catch (error) {
    console.error('❌ Error setting up database:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
