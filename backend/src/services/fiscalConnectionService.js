/**
 * Fiscal Connection Status Service
 * Manages company-level fiscal connection states and validation
 * 
 * Connection flow according to Nuvem Fiscal documentation:
 * 1. Register company in Nuvem Fiscal (POST /empresas)
 * 2. Configure authentication based on municipality requirements:
 *    - Certificate only: PUT /empresas/{cnpj}/certificado
 *    - Municipal credentials only: PUT /empresas/{cnpj}/nfse with prefeitura object
 *    - Both: Both of the above
 * 3. Test connection to verify configuration
 * 4. Only set status to CONNECTED after successful test
 */

import { prisma } from '../lib/prisma.js';
import { checkConnection } from './nuvemFiscal.js';
import { getMunicipalityAuthRequirements } from './municipalityService.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Connection status values:
 * - 'connected': Ready to issue invoices
 * - 'not_connected': No credentials/certificate configured
 * - 'failed': Connection test failed
 * - 'expired': Certificate expired
 */

/**
 * Validate that the company has configured the required authentication methods
 * based on the municipality's requirements.
 * 
 * @param {object} company - Company object with credential info
 * @returns {Promise<object>} Validation result
 */
export async function validateMunicipalityAuthConfig(company) {
  try {
    if (!company.codigoMunicipio) {
      return {
        valid: false,
        message: 'Código do município não configurado',
        missing: ['codigo_municipio']
      };
    }

    // Get municipality auth requirements
    const authRequirements = await getMunicipalityAuthRequirements(company.codigoMunicipio);
    
    if (authRequirements.supported === false) {
      return {
        valid: false,
        message: authRequirements.message,
        unsupportedMunicipality: true
      };
    }

    if (!authRequirements.authRequirements) {
      return {
        valid: true,
        message: 'Não foi possível verificar requisitos do município - prosseguindo',
        warning: 'auth_requirements_unknown'
      };
    }

    const { authMode, requiresCertificate, requiresLoginSenha } = authRequirements.authRequirements;
    const missing = [];

    // Check certificate requirement
    if (requiresCertificate && !company.certificateUploadedToNuvemFiscal) {
      missing.push('certificado_digital');
    }

    // Check municipal credentials requirement
    if (requiresLoginSenha && !company.municipalCredentialsConfigured) {
      missing.push('credenciais_prefeitura');
    }

    if (missing.length > 0) {
      let message = '';
      if (authMode === 'both') {
        message = `Este município (${authRequirements.nome || company.codigoMunicipio}) requer AMBOS: certificado digital E credenciais da prefeitura.`;
      } else if (authMode === 'certificate_only') {
        message = `Este município requer certificado digital (e-CNPJ A1).`;
      } else if (authMode === 'municipal_only') {
        message = `Este município requer credenciais da prefeitura (login/senha do portal NFS-e).`;
      }

      const missingDescriptions = missing.map(m => {
        if (m === 'certificado_digital') return 'Certificado digital não configurado na Nuvem Fiscal';
        if (m === 'credenciais_prefeitura') return 'Credenciais da prefeitura não configuradas na Nuvem Fiscal';
        return m;
      });

      return {
        valid: false,
        message: `${message} Faltando: ${missingDescriptions.join(', ')}`,
        authMode,
        missing,
        municipalityName: authRequirements.nome,
        provedor: authRequirements.provedor
      };
    }

    return {
      valid: true,
      message: 'Configuração de autenticação válida para o município',
      authMode,
      municipalityName: authRequirements.nome,
      provedor: authRequirements.provedor
    };

  } catch (error) {
    console.error('[FiscalConnection] Error validating municipality auth config:', error.message);
    return {
      valid: true,
      message: 'Erro ao validar requisitos do município - prosseguindo',
      warning: error.message
    };
  }
}

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

  // Step 2: Check if any authentication method is configured (certificate OR municipal credentials)
  if (!company.fiscalCredential) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Nenhum método de autenticação configurado',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Nenhum método de autenticação configurado. Configure um certificado digital (arquivo .pfx ou .p12) ou as credenciais da prefeitura (login/senha) na aba "Integração Fiscal".',
      error: 'Nenhum método de autenticação configurado',
      step: 'configure_auth'
    };
  }

  // Step 3: Verify credential type is valid (certificate OR municipal_credentials)
  const validCredentialTypes = ['certificate', 'municipal_credentials'];
  if (!validCredentialTypes.includes(company.fiscalCredential.type)) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'not_connected',
        fiscalConnectionError: 'Tipo de credencial inválido',
        lastConnectionCheck: new Date()
      }
    });

    return {
      status: 'not_connected',
      message: 'Tipo de credencial inválido. Configure um certificado digital ou credenciais da prefeitura na aba "Integração Fiscal".',
      error: 'Tipo de credencial inválido',
      step: 'configure_auth'
    };
  }
  
  // Log the credential type being used
  console.log('[testFiscalConnection] Using credential type:', company.fiscalCredential.type);

  // Step 4: Certificate-specific checks (only for certificate type)
  if (company.fiscalCredential.type === 'certificate') {
    // Check if certificate is expired
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

    // Check if certificate was uploaded to Nuvem Fiscal
    if (!company.certificateUploadedToNuvemFiscal) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: 'Certificado digital não foi enviado para Nuvem Fiscal',
          lastConnectionCheck: new Date()
        }
      });

      return {
        status: 'not_connected',
        message: 'Certificado digital não foi enviado para Nuvem Fiscal. Faça upload do certificado digital novamente na aba "Integração Fiscal".',
        error: 'Certificado digital não foi enviado para Nuvem Fiscal',
        step: 'upload_certificate'
      };
    }
  }

  // Step 5: Municipal credentials-specific checks (only for municipal_credentials type)
  if (company.fiscalCredential.type === 'municipal_credentials') {
    // Check if municipal credentials were configured on Nuvem Fiscal
    if (!company.municipalCredentialsConfigured) {
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: 'Credenciais da prefeitura não foram configuradas na Nuvem Fiscal',
          lastConnectionCheck: new Date()
        }
      });

      return {
        status: 'not_connected',
        message: 'Credenciais da prefeitura não foram configuradas na Nuvem Fiscal. Salve as credenciais novamente na aba "Integração Fiscal".',
        error: 'Credenciais da prefeitura não foram configuradas na Nuvem Fiscal',
        step: 'configure_municipal_credentials'
      };
    }
  }

  // Step 5.5: Validate municipality-specific auth requirements
  // Some municipalities require BOTH certificate AND municipal credentials
  const fullCompanyData = await prisma.company.findUnique({
    where: { id: companyId },
    select: {
      codigoMunicipio: true,
      certificateUploadedToNuvemFiscal: true,
      municipalCredentialsConfigured: true
    }
  });

  if (fullCompanyData?.codigoMunicipio) {
    const authValidation = await validateMunicipalityAuthConfig({
      ...company,
      ...fullCompanyData
    });

    if (!authValidation.valid) {
      console.log('[testFiscalConnection] Municipality auth config invalid:', authValidation);
      
      await prisma.company.update({
        where: { id: companyId },
        data: {
          fiscalConnectionStatus: 'not_connected',
          fiscalConnectionError: authValidation.message,
          lastConnectionCheck: new Date()
        }
      });

      return {
        status: 'not_connected',
        message: authValidation.message,
        error: authValidation.message,
        step: authValidation.missing?.includes('certificado_digital') 
          ? 'upload_certificate' 
          : 'configure_municipal_credentials',
        authMode: authValidation.authMode,
        missing: authValidation.missing
      };
    }
  }

  // Step 6: Test connection to Nuvem Fiscal
  // Verify the company exists on Nuvem Fiscal
  try {
    const connectionResult = await checkConnection(company.nuvemFiscalId);

    if (connectionResult.status === 'conectado') {
      // Company exists on Nuvem Fiscal and authentication is configured
      // Check if we have valid auth configured locally
      const hasValidAuth = company.certificateUploadedToNuvemFiscal || company.municipalCredentialsConfigured;
      
      if (hasValidAuth) {
        // All good - mark as connected
        await prisma.company.update({
          where: { id: companyId },
          data: {
            fiscalConnectionStatus: 'connected',
            fiscalConnectionError: null,
            lastConnectionCheck: new Date()
          }
        });

        const authMethod = company.fiscalCredential.type === 'certificate' 
          ? 'certificado digital' 
          : 'credenciais da prefeitura';

        return {
          status: 'connected',
          message: `Empresa conectada à Nuvem Fiscal com sucesso usando ${authMethod}. Pronta para emitir notas fiscais.`,
          data: connectionResult.data
        };
      } else {
        // Company exists but no auth configured on Nuvem Fiscal
        await prisma.company.update({
          where: { id: companyId },
          data: {
            fiscalConnectionStatus: 'not_connected',
            fiscalConnectionError: 'Autenticação não configurada na Nuvem Fiscal',
            lastConnectionCheck: new Date()
          }
        });

        return {
          status: 'not_connected',
          message: 'Empresa está registrada na Nuvem Fiscal, mas a autenticação ainda não foi configurada. Configure o certificado digital ou as credenciais da prefeitura na aba "Integração Fiscal".',
          error: 'Autenticação não configurada na Nuvem Fiscal',
          step: 'configure_auth',
          data: connectionResult.data
        };
      }
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
