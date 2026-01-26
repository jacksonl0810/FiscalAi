/**
 * Certificate Lifecycle Management Service
 * Tracks certificate expiration and sends notifications
 */

import { prisma } from '../index.js';
import { getCredentialStatus } from './fiscalCredentialService.js';

// Notification thresholds (days before expiration)
const EXPIRATION_WARNINGS = [30, 15, 7, 3, 1]; // Warn at 30, 15, 7, 3, and 1 days before expiration

/**
 * Check certificate expiration and send notifications
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Expiration status
 */
export async function checkCertificateExpiration(companyId) {
  const status = await getCredentialStatus(companyId);

  if (!status.exists || status.type !== 'certificate' || !status.expiresAt) {
    return {
      hasCertificate: status.exists,
      isExpired: false,
      needsNotification: false
    };
  }

  const now = new Date();
  const expiresAt = new Date(status.expiresAt);
  const daysUntilExpiration = Math.ceil((expiresAt - now) / (1000 * 60 * 60 * 24));

  const isExpired = daysUntilExpiration <= 0;
  const needsNotification = EXPIRATION_WARNINGS.includes(daysUntilExpiration);

  // Update company connection status if expired
  if (isExpired) {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        fiscalConnectionStatus: 'expired',
        fiscalConnectionError: 'Certificado digital expirado',
        lastConnectionCheck: new Date()
      }
    });
  }

  return {
    hasCertificate: true,
    isExpired,
    expiresAt: status.expiresAt,
    daysUntilExpiration,
    needsNotification,
    notificationSent: false
  };
}

/**
 * Send expiration notification if needed
 * 
 * @param {string} companyId - Company ID
 * @returns {Promise<object>} Notification result
 */
export async function sendExpirationNotificationIfNeeded(companyId) {
  const expirationStatus = await checkCertificateExpiration(companyId);

  if (!expirationStatus.needsNotification && !expirationStatus.isExpired) {
    return {
      sent: false,
      reason: 'No notification needed'
    };
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      user: true,
      fiscalCredential: true
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // Check if we already sent a notification for this expiration date
  const recentNotifications = await prisma.notification.findMany({
    where: {
      userId: company.userId,
      titulo: {
        contains: 'Certificado Digital'
      },
      createdAt: {
        gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
      }
    }
  });

  // If notification already sent today, skip
  if (recentNotifications.length > 0) {
    return {
      sent: false,
      reason: 'Notification already sent recently'
    };
  }

  // Create AI-generated notification
  const { createAINotification } = await import('./aiNotificationService.js');
  await createAINotification(
    company.userId,
    expirationStatus.isExpired ? 'certificate_expired' : 'certificate_expiring',
    {
      days: expirationStatus.daysUntilExpiration
    }
  );

  return {
    sent: true,
    message: message,
    daysUntilExpiration: expirationStatus.daysUntilExpiration
  };
}

/**
 * Check all certificates and send notifications
 * 
 * @returns {Promise<object>} Summary of checks
 */
export async function checkAllCertificates() {
  console.log('[CertificateLifecycle] Checking all certificates...');

  // Find all companies with certificates
  const companiesWithCertificates = await prisma.company.findMany({
    where: {
      fiscalCredential: {
        type: 'certificate',
        expiresAt: {
          not: null
        }
      }
    },
    select: {
      id: true
    }
  });

  console.log(`[CertificateLifecycle] Found ${companiesWithCertificates.length} companies with certificates`);

  const results = {
    total: companiesWithCertificates.length,
    expired: 0,
    expiringSoon: 0,
    notificationsSent: 0,
    errors: 0
  };

  for (const company of companiesWithCertificates) {
    try {
      const expirationStatus = await checkCertificateExpiration(company.id);
      
      if (expirationStatus.isExpired) {
        results.expired++;
      } else if (expirationStatus.needsNotification) {
        results.expiringSoon++;
      }

      // Send notification if needed
      const notificationResult = await sendExpirationNotificationIfNeeded(company.id);
      if (notificationResult.sent) {
        results.notificationsSent++;
      }
    } catch (error) {
      console.error(`[CertificateLifecycle] Error checking company ${company.id}:`, error);
      results.errors++;
    }
  }

  console.log('[CertificateLifecycle] Certificate check complete:', results);
  return results;
}

/**
 * Block invoice issuance if certificate is expired
 * 
 * @param {string} companyId - Company ID
 * @throws {Error} If certificate is expired
 */
export async function validateCertificateNotExpired(companyId) {
  const expirationStatus = await checkCertificateExpiration(companyId);

  if (expirationStatus.isExpired) {
    throw new Error(
      'Certificado digital expirado. Renove o certificado para continuar emitindo notas fiscais.'
    );
  }

  return true;
}

/**
 * Start background certificate monitoring (call from scheduler)
 */
export async function startCertificateMonitoring() {
  console.log('[CertificateLifecycle] Starting certificate monitoring...');
  
  // Check immediately
  await checkAllCertificates();

  // Set up daily check (run once per day)
  const dailyCheck = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(9, 0, 0, 0); // 9 AM

    const msUntilTomorrow = tomorrow.getTime() - now.getTime();

    setTimeout(async () => {
      try {
        await checkAllCertificates();
      } catch (error) {
        console.error('[CertificateLifecycle] Daily check error:', error);
      }
      
      // Schedule next day
      setInterval(async () => {
        try {
          await checkAllCertificates();
        } catch (error) {
          console.error('[CertificateLifecycle] Daily check error:', error);
        }
      }, 24 * 60 * 60 * 1000); // 24 hours
    }, msUntilTomorrow);
  };

  dailyCheck();
}
