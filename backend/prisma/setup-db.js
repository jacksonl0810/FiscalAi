import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const backendDir = join(__dirname, '..');

dotenv.config({ path: join(backendDir, '.env') });

const prisma = new PrismaClient();

function maskConnectionString(url) {
  if (!url) return 'Not set';
  try {
    const urlObj = new URL(url);
    const masked = `${urlObj.protocol}//${urlObj.username}:****@${urlObj.hostname}:${urlObj.port}${urlObj.pathname}`;
    return masked;
  } catch {
    return 'Invalid format';
  }
}

async function testConnection() {
  console.log('🔍 Testing database connection...');
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL is not set in .env file');
    console.error('💡 Please set DATABASE_URL in your .env file');
    console.error('   Example: DATABASE_URL="postgresql://user:password@localhost:5432/fiscalai"');
    return false;
  }
  
  const maskedUrl = maskConnectionString(dbUrl);
  console.log(`📡 Connecting to: ${maskedUrl}`);
  
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as test`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      )
    ]);
    console.log('✅ Database connection successful!');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed!');
    console.error(`\n📋 Error Details:`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    console.error(`   Message: ${error.message}`);
    
    if (error.code === 'P1001' || error.message.includes("Can't reach database server")) {
      console.error(`\n🔧 Troubleshooting Steps:`);
      console.error(`   1. Verify the database server is running and accessible`);
      console.error(`   2. Check if the host/IP address is correct: ${maskedUrl}`);
      console.error(`   3. Verify network connectivity (firewall, VPN, etc.)`);
      console.error(`   4. Check if PostgreSQL is listening on the specified port`);
      console.error(`   5. Verify database credentials (username/password)`);
      console.error(`   6. Ensure the database exists: ${new URL(dbUrl).pathname.slice(1)}`);
      console.error(`\n💡 For local development, you can use:`);
      console.error(`   DATABASE_URL="postgresql://postgres:password@localhost:5432/fiscalai"`);
    } else if (error.code === 'P1000' || error.message.includes('authentication')) {
      console.error(`\n🔧 Authentication Error:`);
      console.error(`   1. Verify username and password are correct`);
      console.error(`   2. Check if the user has access to the database`);
    } else if (error.message.includes('timeout')) {
      console.error(`\n🔧 Connection Timeout:`);
      console.error(`   1. The database server may be slow or overloaded`);
      console.error(`   2. Check network latency`);
      console.error(`   3. Verify firewall rules allow the connection`);
    }
    
    return false;
  }
}

async function setupDatabase() {
  console.log('🔄 Setting up database...\n');
  
  const canConnect = await testConnection();
  if (!canConnect) {
    console.error('\n❌ Cannot proceed without database connection');
    process.exit(1);
  }
  
  try {
    console.log('\n📦 Creating/updating database schema...');
    execSync('npx prisma db push --accept-data-loss', {
      cwd: backendDir,
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('\n📦 Generating Prisma Client...');
    execSync('npx prisma generate', {
      cwd: backendDir,
      stdio: 'inherit',
      env: { ...process.env }
    });
    
    console.log('\n✅ Database setup complete!');
    console.log('🌱 Run "npm run db:seed" to populate with demo data');
  } catch (error) {
    console.error('\n❌ Error setting up database schema');
    console.error(`   ${error.message}`);
    
    if (error.message.includes('P1001') || error.message.includes("Can't reach")) {
      console.error('\n💡 The database connection was lost during setup.');
      console.error('   Please check your network connection and try again.');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

setupDatabase();
