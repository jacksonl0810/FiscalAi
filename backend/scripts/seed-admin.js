/**
 * Seed Admin User
 * Creates or updates the admin user with the specified credentials
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedAdmin() {
  console.log('🌱 Seeding admin user...\n');

  try {
    const adminEmail = 'admin@gmail.com';
    const adminPassword = 'admin123!@#';
    const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: {
        passwordHash: adminPasswordHash,
        isAdmin: true,
        name: 'Administrador'
      },
      create: {
        email: adminEmail,
        passwordHash: adminPasswordHash,
        name: 'Administrador',
        isAdmin: true
      }
    });

    console.log('✅ Admin user created/updated successfully!');
    console.log('\n📋 Admin credentials:');
    console.log(`   Email: ${admin.email}`);
    console.log(`   Password: ${adminPassword}`);
    console.log(`   isAdmin: ${admin.isAdmin}`);
    console.log(`   ID: ${admin.id}`);
    console.log('\n🎉 Done!');
  } catch (error) {
    console.error('❌ Error seeding admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seedAdmin()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
