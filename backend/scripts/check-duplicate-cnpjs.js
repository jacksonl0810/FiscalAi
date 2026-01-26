/**
 * Check for duplicate CNPJs in the database
 * Run this before migration to ensure no duplicates exist
 * 
 * Usage: node backend/scripts/check-duplicate-cnpjs.js
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkDuplicateCNPJs() {
  console.log('🔍 Checking for duplicate CNPJs...\n');

  try {
    // Get all companies with their CNPJs
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        cnpj: true,
        razaoSocial: true,
        userId: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`📊 Total companies in database: ${companies.length}\n`);

    // Group by CNPJ (normalized - remove formatting)
    const cnpjMap = new Map();
    
    companies.forEach(company => {
      const normalizedCnpj = company.cnpj.replace(/\D/g, ''); // Remove non-digits
      
      if (!cnpjMap.has(normalizedCnpj)) {
        cnpjMap.set(normalizedCnpj, []);
      }
      
      cnpjMap.get(normalizedCnpj).push({
        id: company.id,
        cnpj: company.cnpj,
        razaoSocial: company.razaoSocial,
        userId: company.userId,
        createdAt: company.createdAt
      });
    });

    // Find duplicates
    const duplicates = [];
    cnpjMap.forEach((companies, normalizedCnpj) => {
      if (companies.length > 1) {
        duplicates.push({
          cnpj: normalizedCnpj,
          count: companies.length,
          companies: companies
        });
      }
    });

    if (duplicates.length === 0) {
      console.log('✅ No duplicate CNPJs found! Safe to run migration.\n');
      console.log('📝 All CNPJs are unique. You can proceed with:');
      console.log('   npx prisma migrate dev --name add_new_business_rules\n');
      return { hasDuplicates: false, duplicates: [] };
    }

    console.log(`❌ Found ${duplicates.length} duplicate CNPJ(s):\n`);
    
    duplicates.forEach((duplicate, index) => {
      console.log(`${index + 1}. CNPJ: ${duplicate.cnpj} (appears ${duplicate.count} times)`);
      console.log('   Companies:');
      duplicate.companies.forEach((company, idx) => {
        console.log(`      ${idx + 1}. ID: ${company.id}`);
        console.log(`         Razão Social: ${company.razaoSocial}`);
        console.log(`         User ID: ${company.userId}`);
        console.log(`         Created: ${company.createdAt.toISOString()}`);
        console.log(`         Original CNPJ format: ${company.cnpj}`);
      });
      console.log('');
    });

    console.log('\n⚠️  ACTION REQUIRED:');
    console.log('   Before running the migration, you need to resolve these duplicates.');
    console.log('   Options:');
    console.log('   1. Delete duplicate companies (keep the oldest one)');
    console.log('   2. Update duplicate CNPJs if they are incorrect');
    console.log('   3. Merge companies if they represent the same entity\n');

    return { hasDuplicates: true, duplicates };
  } catch (error) {
    console.error('❌ Error checking for duplicates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the check
checkDuplicateCNPJs()
  .then(result => {
    if (result.hasDuplicates) {
      process.exit(1); // Exit with error code if duplicates found
    } else {
      process.exit(0); // Exit successfully if no duplicates
    }
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
