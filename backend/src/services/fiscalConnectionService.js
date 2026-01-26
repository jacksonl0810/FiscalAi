/**
 * Fiscal Connection Status Service
 * Manages company-level fiscal connection states and validation
 */

import { prisma } from '../index.js';
import { checkConnection } from './nuvemFiscal.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Connection status values:
 * - 'connected': Ready to issue invoices
 * - 'not_connected': No credentials/certificate configured
 * - 'failed': Connection test failed
 * - 'expired': Certificate expired
 */

/**
 * Test and update fiscal connection status for a company
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Connection status result
 */
export async function testFiscalConnection(companyId) {
  console.log('[testFiscalConnection] Starting for company:', companyId);
  
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      fiscalCredential: true,
      user: {
        select: {
          id: true
        }
      }
    }
  });

  if (!company) {
    console.log('[testFiscalConnection] Company not found');
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  console.log('[testFiscalConnection] Company found:', { 
    id: company.id, 
    hasCredential: !!company.fiscalCredential,
    nuvemFiscalId: company.nuvemFiscalId 
  });

  if (!company.fiscalCredential) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Credenciais fiscais não configuradas',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Credenciais fiscais não configuradas. Configure certificado digital ou credenciais municipais.',
      error: 'Credenciais fiscais não configuradas'
    };
  }

  // Check if certificate is expired
  if (company.fiscalCredential.type === 'certificate' && company.fiscalCredential.expiresAt) {
    if (new Date(company.fiscalCredential.expiresAt) < new Date()) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'expired',
          fiscalConnectionError: 'Certificado digital expirado',
          lastConnectionCheck: new Date()
        }
      });

      return {
        status: 'expired',
        message: 'Certificado digital expirado. Renove o certificado para continuar emitindo notas fiscais.',
        error: 'Certificado digital expirado',
        expiresAt: company.fiscalCredential.expiresAt
      };
    }
  }

  // If company is registered in Nuvem Fiscal, test connection
  if (company.nuvemFiscalId) {
    try {
      const connectionResult = await checkConnection(company.nuvemFiscalId);

      if (connectionResult.status === 'conectado') {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            fiscalConnectionStatus: 'connected',
            fiscalConnectionError: null,
            lastConnectionCheck: new Date()
          }
        });

        return {
          status: 'connected',
          message: connectionResult.message || 'Conexão fiscal estabelecida com sucesso',
          data: connectionResult.data
        };
      } else {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            fiscalConnectionStatus: 'failed',
            fiscalConnectionError: connectionResult.message || 'Falha na conexão',
            lastConnectionCheck: new Date()
          }
        });

        // Create AI notification for credential issue (only if not already notified recently)
        if (company.user?.id) {
          const recentNotifications = await prisma.notification.findMany({
            where: {
              userId: company.user.id,
              titulo: { contains: 'Credenciais Fiscais' },
              createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
            }
          });

          if (recentNotifications.length === 0) {
            const { createAINotification } = await import('./aiNotificationService.js');
            await createAINotification(
              company.user.id,
              'credential_issue',
              {
                error: connectionResult.message || 'Falha na conexão',
                company: company.razaoSocial || company.nomeFantasia
              }
            );
          }
        }

        return {
          status: 'failed',
          message: connectionResult.message || 'Falha ao conectar com a prefeitura',
          error: connectionResult.details || connectionResult.message
        };
      }
    } catch (error) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'failed',
          fiscalConnectionError: error.message,
          lastConnectionCheck: new Date()
        }
      });

      // Create AI notification for credential issue (only if not already notified recently)
      if (company.user?.id) {
        const recentNotifications = await prisma.notification.findMany({
          where: {
            userId: company.user.id,
            titulo: { contains: 'Credenciais Fiscais' },
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
          }
        });

        if (recentNotifications.length === 0) {
          const { createAINotification } = await import('./aiNotificationService.js');
          await createAINotification(
            company.user.id,
            'credential_issue',
            {
              error: error.message,
              company: company.razaoSocial || company.nomeFantasia
            }
          );
        }
      }

      return {
        status: 'failed',
        message: `Erro ao testar conexão: ${error.message}`,
        error: error.message
      };
    }
  }

  // Company has credentials but not registered in Nuvem Fiscal
  await prisma.company.update({
    where: { id: companyId },
    data: {
      fiscalConnectionStatus: 'not_connected',
      fiscalConnectionError: 'Empresa não registrada na Nuvem Fiscal',
      lastConnectionCheck: new Date()
    }
  });

  return {
    status: 'not_connected',
    message: 'Empresa não registrada na Nuvem Fiscal. Registre a empresa primeiro.',
    error: 'Empresa não registrada na Nuvem Fiscal'
  };
}

/**
 * Validate fiscal connection before invoice issuance
 * 
 * @param {object} company - Company object
 * @throws {AppError} If connection is not valid
 */
export async function validateFiscalConnection(company) {
  // Get fresh company data with credential
  const companyWithCredential = await prisma.company.findUnique({
    where: { id: company.id },
    include: {
      fiscalCredential: true
    }
  });

  if (!companyWithCredential) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  const status = companyWithCredential.fiscalConnectionStatus;

  // Check connection status
  if (status === 'not_connected') {
    throw new AppError(
      'Credenciais fiscais não configuradas. Configure certificado digital ou credenciais municipais antes de emitir notas fiscais.',
      400,
      'FISCAL_NOT_CONNECTED'
    );
  }

  if (status === 'expired') {
    throw new AppError(
      'Certificado digital expirado. Renove o certificado para continuar emitindo notas fiscais.',
      400,
      'CERTIFICATE_EXPIRED',
      {
        expiresAt: companyWithCredential.fiscalCredential?.expiresAt
      }
    );
  }

  if (status === 'failed') {
    const error = companyWithCredential.fiscalConnectionError || 'Falha na conexão fiscal';
    
    // Create AI-generated notification for credential issue
    const { createAINotification } = await import('./aiNotificationService.js');
    await createAINotification(
      companyWithCredential.userId,
      'credential_issue',
      {
        error: error,
        company: companyWithCredential.razaoSocial || companyWithCredential.nomeFantasia
      }
    );
    
    throw new AppError(
      `Conexão fiscal falhou: ${error}. Verifique as credenciais e tente novamente.`,
      400,
      'FISCAL_CONNECTION_FAILED',
      { error }
    );
  }

  // If status is 'connected', allow issuance
  // If status is null/undefined, test connection first
  if (status !== 'connected') {
    // Test connection
    const testResult = await testFiscalConnection(company.id);
    
    if (testResult.status !== 'connected') {
      throw new AppError(
        testResult.message || 'Conexão fiscal não estabelecida',
        400,
        'FISCAL_CONNECTION_INVALID',
        { status: testResult.status, error: testResult.error }
      );
    }
  }

  return true;
}

/**
 * Get fiscal connection status for a company
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Connection status
 */
export async function getFiscalConnectionStatus(companyId) {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      fiscalCredential: true
    },
    select: {
      id: true,
      fiscalConnectionStatus: true,
      fiscalConnectionError: true,
      lastConnectionCheck: true,
      nuvemFiscalId: true,
      fiscalCredential: {
        select: {
          type: true,
          expiresAt: true,
          lastUsedAt: true
        }
      }
    }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  return {
    status: company.fiscalConnectionStatus || 'not_connected',
    error: company.fiscalConnectionError,
    lastCheck: company.lastConnectionCheck,
    hasCredential: !!company.fiscalCredential,
    credentialType: company.fiscalCredential?.type,
    certificateExpiresAt: company.fiscalCredential?.expiresAt,
    isRegistered: !!company.nuvemFiscalId
  };
}
