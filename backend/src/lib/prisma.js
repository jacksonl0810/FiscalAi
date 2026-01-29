// Prisma Client instance
// This file is the single source of truth for Prisma to avoid circular dependencies
import { PrismaClient } from '@prisma/client';

// Create and export Prisma client instance
export const prisma = new PrismaClient();

// Also export as default for files that use default import
export default prisma;
