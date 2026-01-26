/**
 * Fiscal Credential Service
 * Manages digital certificates and municipal credentials securely
 */

import { prisma } from '../index.js';
import { encryptCredential, decryptCredential, hashPassword, verifyPassword } from './credentialEncryption.js';
import { AppError } from '../middleware/errorHandler.js';

/**
 * Store fiscal credential (certificate or municipal credentials)
 * 
 * @param {string} companyId - Company ID
 * @param {string} type - 'certificate' or 'municipal_credentials'
 * @param {object} data - Credential data
 * @param {object} options - Additional options (expiresAt, metadata)
 * @returns {Promise<object>} Created credential record
 */
export async function storeFiscalCredential(companyId, type, data, options = {}) {
  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  // Validate type
  if (!['certificate', 'municipal_credentials'].includes(type)) {
    throw new AppError('Invalid credential type', 400, 'INVALID_TYPE');
  }

  let encryptedData;
  let metadata = options.metadata || {};

  if (type === 'certificate') {
    // Certificate: encrypt the certificate file (base64 or buffer)
    if (!data.certificate) {
      throw new AppError('Certificate data is required', 400, 'MISSING_CERTIFICATE');
    }

    // If certificate is a buffer, convert to base64
    const certificateBase64 = Buffer.isBuffer(data.certificate) 
      ? data.certificate.toString('base64')
      : data.certificate;

    // Encrypt certificate
    encryptedData = encryptCredential(certificateBase64);

    // Store metadata
    metadata = {
      ...metadata,
      filename: data.filename || 'certificate.pfx',
      uploadedAt: new Date().toISOString(),
      hasPassword: !!data.password
    };

    // If password provided, hash it (don't encrypt - we need to verify it later)
    if (data.password) {
      metadata.passwordHash = hashPassword(data.password);
    }
  } else if (type === 'municipal_credentials') {
    // Municipal credentials: encrypt username and password separately
    if (!data.username || !data.password) {
      throw new AppError('Username and password are required', 400, 'MISSING_CREDENTIALS');
    }

    // Encrypt username and password
    const credentials = {
      username: encryptCredential(data.username),
      password: encryptCredential(data.password)
    };

    encryptedData = encryptCredential(JSON.stringify(credentials));

    metadata = {
      ...metadata,
      usernameHint: data.username.substring(0, 2) + '***', // Partial hint for display
      storedAt: new Date().toISOString()
    };
  }

  // Check if credential already exists
  const existing = await prisma.fiscalCredential.findUnique({
    where: { companyId }
  });

  let credential;
  if (existing) {
    // Update existing
    credential = await prisma.fiscalCredential.update({
      where: { id: existing.id },
      data: {
        type,
        encryptedData,
        metadata,
        expiresAt: options.expiresAt || null,
        updatedAt: new Date()
      }
    });
  } else {
    // Create new
    credential = await prisma.fiscalCredential.create({
      data: {
        companyId,
        type,
        encryptedData,
        metadata,
        expiresAt: options.expiresAt || null
      }
    });
  }

  // Update company connection status
  await prisma.company.update({
    where: { id: companyId },
    data: {
      fiscalConnectionStatus: 'connected',
      lastConnectionCheck: new Date()
    }
  });

  // Audit log (create notification or log entry)
  console.log(`[FiscalCredential] Stored ${type} for company ${companyId}`);

  return {
    id: credential.id,
    type: credential.type,
    expiresAt: credential.expiresAt,
    createdAt: credential.createdAt,
    // Never return encrypted data
    metadata: {
      ...metadata,
      passwordHash: undefined // Remove password hash from response
    }
  };
}

/**
 * Retrieve and decrypt fiscal credential
 * 
 * @param {string} companyId - Company ID
 * @param {string} type - 'certificate' or 'municipal_credentials'
 * @returns {Promise<object>} Decrypted credential data
 */
export async function retrieveFiscalCredential(companyId, type) {
  // Verify company exists
  const company = await prisma.company.findUnique({
    where: { id: companyId }
  });

  if (!company) {
    throw new AppError('Company not found', 404, 'COMPANY_NOT_FOUND');
  }

  // Get credential
  const credential = await prisma.fiscalCredential.findUnique({
    where: { companyId }
  });

  if (!credential) {
    throw new AppError('Fiscal credential not found', 404, 'CREDENTIAL_NOT_FOUND');
  }

  if (credential.type !== type) {
    throw new AppError(`Credential type mismatch. Expected ${type}, found ${credential.type}`, 400, 'TYPE_MISMATCH');
  }

  // Check expiration
  if (credential.expiresAt && new Date(credential.expiresAt) < new Date()) {
    throw new AppError('Credential has expired', 400, 'CREDENTIAL_EXPIRED');
  }

  // Update last used timestamp
  await prisma.fiscalCredential.update({
    where: { id: credential.id },
    data: { lastUsedAt: new Date() }
  });

  // Decrypt data
  let decryptedData;
  try {
    if (type === 'certificate') {
      // Certificate: return base64 string
      decryptedData = {
        certificate: decryptCredential(credential.encryptedData),
        filename: credential.metadata?.filename || 'certificate.pfx'
      };
    } else if (type === 'municipal_credentials') {
      // Municipal credentials: return username and password
      const credentialsJson = decryptCredential(credential.encryptedData);
      const credentials = JSON.parse(credentialsJson);
      
      decryptedData = {
        username: decryptCredential(credentials.username),
        password: decryptCredential(credentials.password)
      };
    }
  } catch (error) {
    console.error('[FiscalCredential] Decryption error:', error);
    throw new AppError('Falha ao descriptografar credencial', 500, 'DECRYPTION_ERROR');
  }

  // Audit log
  console.log(`[FiscalCredential] Retrieved ${type} for company ${companyId}`);

  return decryptedData;
}

/**
 * Verify certificate password
 * 
 * @param {string} companyId - Company ID
 * @param {string} password - Password to verify
 * @returns {Promise<boolean>} True if password is correct
 */
export async function verifyCertificatePassword(companyId, password) {
  const credential = await prisma.fiscalCredential.findUnique({
    where: { companyId }
  });

  if (!credential || credential.type !== 'certificate') {
    return false;
  }

  const passwordHash = credential.metadata?.passwordHash;
  if (!passwordHash) {
    return false; // No password stored
  }

  return verifyPassword(password, passwordHash);
}

/**
 * Check credential status
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Credential status
 */
export async function getCredentialStatus(companyId) {
  const credential = await prisma.fiscalCredential.findUnique({
    where: { companyId }
  });

  if (!credential) {
    return {
      exists: false,
      type: null,
      expired: false,
      expiresAt: null,
      lastUsedAt: null
    };
  }

  const now = new Date();
  const expired = credential.expiresAt ? new Date(credential.expiresAt) < now : false;

  return {
    exists: true,
    type: credential.type,
    expired,
    expiresAt: credential.expiresAt,
    lastUsedAt: credential.lastUsedAt,
    daysUntilExpiration: credential.expiresAt 
      ? Math.ceil((new Date(credential.expiresAt) - now) / (1000 * 60 * 60 * 24))
      : null
  };
}

/**
 * Revoke fiscal credential
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<void>}
 */
export async function revokeFiscalCredential(companyId) {
  const credential = await prisma.fiscalCredential.findUnique({
    where: { companyId }
  });

  if (!credential) {
    throw new AppError('Fiscal credential not found', 404, 'CREDENTIAL_NOT_FOUND');
  }

  // Delete credential
  await prisma.fiscalCredential.delete({
    where: { id: credential.id }
  });

  // Update company connection status
  await prisma.company.update({
    where: { id: companyId },
    data: {
      fiscalConnectionStatus: 'not_connected',
      fiscalConnectionError: 'Credencial revogada'
    }
  });

  // Audit log
  console.log(`[FiscalCredential] Revoked credential for company ${companyId}`);
}
