import { prisma } from '../index.js';

const CONNECTION_CHECK_TIMEOUT = 5000;

export async function checkDatabaseConnection() {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), CONNECTION_CHECK_TIMEOUT)
      )
    ]);
    return true;
  } catch (error) {
    return false;
  }
}

export function isDatabaseConnectionError(error) {
  if (!error) return false;
  
  const errorMessage = (error.message || '').toLowerCase();
  const errorCode = error.code || '';
  
  const connectionErrors = [
    'can\'t reach database server',
    'connection refused',
    'econnrefused',
    'etimedout',
    'enotfound',
    'p1001',
    'p1017',
    'timeout',
    'connection error',
    'database server'
  ];
  
  return connectionErrors.some(err => 
    errorMessage.includes(err) || 
    errorCode.toLowerCase().includes(err)
  );
}
