/**
 * Credential Encryption Service
 * Handles encryption/decryption of sensitive fiscal credentials
 * 
 * Security Requirements:
 * - Never store raw credentials
 * - Encrypt at rest
 * - Use secure key management
 * - Audit all access
 */

import crypto from 'crypto';

// Encryption key from environment (should be stored in KMS/Secret Manager in production)
const ENCRYPTION_KEY = process.env.CREDENTIAL_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypt sensitive data
 * @param {string} text - Plain text to encrypt
 * @returns {string} Encrypted data (base64 encoded: iv:authTag:encryptedData)
 */
export function encryptCredential(text) {
  if (!text) {
    throw new Error('Cannot encrypt empty data');
  }

  try {
    // Generate random IV for each encryption
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32); // Ensure 32 bytes for AES-256

    // Create cipher
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    // Encrypt
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag for integrity verification
    const authTag = cipher.getAuthTag();

    // Return: iv:authTag:encryptedData (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  } catch (error) {
    console.error('[CredentialEncryption] Encryption error:', error);
    throw new Error(`Falha ao criptografar credencial: ${error.message}`);
  }
}

/**
 * Decrypt sensitive data
 * @param {string} encryptedData - Encrypted data (format: iv:authTag:encryptedData)
 * @returns {string} Decrypted plain text
 */
export function decryptCredential(encryptedData) {
  if (!encryptedData) {
    throw new Error('Cannot decrypt empty data');
  }

  try {
    // Parse encrypted data format: iv:authTag:encryptedData
    const parts = encryptedData.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }

    const [ivBase64, authTagBase64, encrypted] = parts;
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const key = Buffer.from(ENCRYPTION_KEY, 'hex').slice(0, 32); // Ensure 32 bytes for AES-256

    // Create decipher
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('[CredentialEncryption] Decryption error:', error);
    throw new Error(`Falha ao descriptografar credencial: ${error.message}`);
  }
}

/**
 * Hash password (for municipal credentials)
 * Uses bcrypt-like approach but simpler for now
 * In production, use proper bcrypt or Argon2
 * @param {string} password - Plain password
 * @returns {string} Hashed password
 */
export function hashPassword(password) {
  if (!password) {
    throw new Error('Cannot hash empty password');
  }

  // Use crypto.createHash for now (in production, use bcrypt)
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  
  // Return: salt:hash
  return `${salt}:${hash}`;
}

/**
 * Verify password against hash
 * @param {string} password - Plain password
 * @param {string} hash - Stored hash (format: salt:hash)
 * @returns {boolean} True if password matches
 */
export function verifyPassword(password, hash) {
  if (!password || !hash) {
    return false;
  }

  try {
    const [salt, storedHash] = hash.split(':');
    if (!salt || !storedHash) {
      return false;
    }

    const computedHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return computedHash === storedHash;
  } catch (error) {
    console.error('[CredentialEncryption] Password verification error:', error);
    return false;
  }
}

/**
 * Validate encryption key is set
 * @throws {Error} If encryption key is not properly configured
 */
export function validateEncryptionKey() {
  if (!ENCRYPTION_KEY || ENCRYPTION_KEY.length < 32) {
    throw new Error(
      'CREDENTIAL_ENCRYPTION_KEY not properly configured. ' +
      'Set a 32+ character hex string in environment variables. ' +
      'In production, use a secure key management service (KMS).'
    );
  }
}

// Validate on module load
try {
  validateEncryptionKey();
} catch (error) {
  console.warn('[CredentialEncryption] Warning:', error.message);
  console.warn('[CredentialEncryption] Using temporary key. This is NOT secure for production!');
}
