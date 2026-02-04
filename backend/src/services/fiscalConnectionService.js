/**
 * Fiscal Connection Status Service
 * Manages company-level fiscal connection states and validation
 */

import { prisma } from '../lib/prisma.js';
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
 * IMPORTANT: For Nuvem Fiscal API, the following are REQUIRED to emit invoices:
 * 1. Company registered in Nuvem Fiscal (has nuvemFiscalId)
 * 2. Digital certificate configured AND uploaded to Nuvem Fiscal
 * 
 * Status meanings:
 * - 'connected': Company + certificate configured on Nuvem Fiscal, ready to issue invoices
 * - 'not_connected': Missing requirements (company not registered, or certificate not configured)
 * - 'failed': Connection test failed
 * - 'expired': Certificate expired
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
    credentialType: company.fiscalCredential?.type,
    nuvemFiscalId: company.nuvemFiscalId,
    certificadoDigital: company.certificadoDigital
  });

  // Step 1: Check if company is registered in Nuvem Fiscal
  if (!company.nuvemFiscalId) {
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
      message: 'Empresa não registrada na Nuvem Fiscal. Acesse "Minhas Empresas", clique na empresa e registre na Nuvem Fiscal para habilitar a emissão de notas fiscais.',
      error: 'Empresa não registrada na Nuvem Fiscal',
      step: 'register_company'
    };
  }

  // Step 2: Check if digital certificate is configured
  if (!company.fiscalCredential) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Certificado digital não configurado',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Certificado digital não configurado. Para emitir notas fiscais via Nuvem Fiscal, você precisa fazer upload do certificado digital (arquivo .pfx ou .p12) na aba "Integração Fiscal" da configuração da empresa.',
      error: 'Certificado digital não configurado',
      step: 'upload_certificate'
    };
  }

  // Step 3: Verify credential type is 'certificate' (required for Nuvem Fiscal)
  if (company.fiscalCredential.type !== 'certificate') {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Certificado digital é obrigatório para Nuvem Fiscal',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Certificado digital é obrigatório para emitir notas fiscais via Nuvem Fiscal. Credenciais municipais (login/senha) não são suficientes. Faça upload do certificado digital (.pfx ou .p12) na aba "Integração Fiscal".',
      error: 'Certificado digital é obrigatório para Nuvem Fiscal',
      step: 'upload_certificate'
    };
  }

  // Step 4: Check if certificate is expired
  if (company.fiscalCredential.expiresAt) {
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
        message: 'Certificado digital expirado. Renove o certificado e faça upload novamente para continuar emitindo notas fiscais.',
        error: 'Certificado digital expirado',
        expiresAt: company.fiscalCredential.expiresAt,
        step: 'renew_certificate'
      };
    }
  }

  // Step 5: Verify company has certificadoDigital flag (indicates certificate was properly configured)
  if (!company.certificadoDigital) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Certificado digital não foi configurado corretamente',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Certificado digital não foi configurado corretamente. Faça upload do certificado digital novamente na aba "Integração Fiscal".',
      error: 'Certificado digital não foi configurado corretamente',
      step: 'upload_certificate'
    };
  }

  // Step 6: Test connection to Nuvem Fiscal
  // IMPORTANT: checkConnection() only verifies the company exists (GET /empresas/:id).
  // It does NOT verify that the certificate is configured on Nuvem Fiscal.
  // So we NEVER set status to 'connected' here - "connected" is set ONLY when our
  // certificate upload endpoint successfully uploads the cert to Nuvem Fiscal.
  try {
    const connectionResult = await checkConnection(company.nuvemFiscalId);

    if (connectionResult.status === 'conectado') {
      // Company exists on Nuvem Fiscal, but we cannot know from this API call
      // whether the certificate is actually configured there. So we set not_connected
      // with a clear message: user must upload the certificate through our app.
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: 'Certificado digital não configurado na Nuvem Fiscal. Envie o certificado na aba Integração Fiscal.',
          lastConnectionCheck: new Date()
        }
      });

      return {
        status: 'not_connected',
        message: 'Empresa está registrada na Nuvem Fiscal, mas o certificado digital ainda não foi configurado lá. Para habilitar a emissão de notas fiscais, faça upload do certificado digital (.pfx ou .p12) nesta aplicação na aba "Integração Fiscal".',
        error: 'Certificado não configurado na Nuvem Fiscal',
        step: 'upload_certificate',
        data: connectionResult.data
      };
    } else {
      // Connection test failed
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: connectionResult.message || 'Certificado digital não está configurado na Nuvem Fiscal',
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
              error: connectionResult.message || 'Certificado não configurado na Nuvem Fiscal',
              company: company.razaoSocial || company.nomeFantasia
            }
          );
        }
      }

      return {
        status: 'not_connected',
        message: connectionResult.message || 'Certificado digital não está configurado na Nuvem Fiscal. O certificado foi salvo localmente, mas precisa ser enviado para a Nuvem Fiscal. Tente fazer upload do certificado novamente.',
        error: connectionResult.details || connectionResult.message,
        step: 'upload_certificate'
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
      message: `Erro ao testar conexão com Nuvem Fiscal: ${error.message}`,
      error: error.message,
      step: 'check_connection'
    };
  }
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
