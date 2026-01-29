/**
 * Background Tasks Worker
 * Handles scheduled background tasks:
 * - Invoice status polling
 * - Certificate expiration checks
 * - Municipality offline retry queue
 * 
 * Usage:
 * - Run as a separate process: node backend/src/workers/backgroundTasks.js
 * - Or integrate into main server process (default)
 */

import { pollAllPendingInvoices, startBackgroundPolling } from '../services/invoiceStatusMonitoring.js';
import { checkAllCertificates, startCertificateMonitoring } from '../services/certificateLifecycleService.js';
import { processRetryQueue, startRetryQueueProcessor } from '../services/municipalityRetryService.js';
import { startRecurringBillingMonitoring } from '../services/recurringBillingService.js';
import { isDatabaseConnectionError } from '../utils/databaseConnection.js';

/**
 * Start all background tasks
 */
export async function startAllBackgroundTasks() {
  console.log('[BackgroundTasks] Starting all background tasks...');

  const errors = [];

  try {
    await startBackgroundPolling();
    console.log('[BackgroundTasks] Invoice status polling started');
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[BackgroundTasks] Database unavailable, invoice polling will retry when database is available');
    } else {
      console.error('[BackgroundTasks] Error starting invoice polling:', error.message);
      errors.push(error);
    }
  }

  try {
    await startCertificateMonitoring();
    console.log('[BackgroundTasks] Certificate monitoring started');
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[BackgroundTasks] Database unavailable, certificate monitoring will retry when database is available');
    } else {
      console.error('[BackgroundTasks] Error starting certificate monitoring:', error.message);
      errors.push(error);
    }
  }

  try {
    await startRetryQueueProcessor();
    console.log('[BackgroundTasks] Municipality retry queue started');
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[BackgroundTasks] Database unavailable, retry queue will retry when database is available');
    } else {
      console.error('[BackgroundTasks] Error starting retry queue:', error.message);
      errors.push(error);
    }
  }

  try {
    await startRecurringBillingMonitoring();
    console.log('[BackgroundTasks] Recurring billing monitoring started');
  } catch (error) {
    if (isDatabaseConnectionError(error)) {
      console.warn('[BackgroundTasks] Database unavailable, recurring billing will retry when database is available');
    } else {
      console.error('[BackgroundTasks] Error starting recurring billing monitoring:', error.message);
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    console.warn('[BackgroundTasks] Some background tasks failed to start, but server will continue running');
  } else {
    console.log('[BackgroundTasks] All background tasks started successfully');
  }
}

/**
 * Run one-time tasks (for manual execution or cron)
 */
export async function runScheduledTasks() {
  console.log('[BackgroundTasks] Running scheduled tasks...');

  const results = {
    invoicePolling: null,
    certificateCheck: null,
    retryQueue: null,
    errors: []
  };

  try {
    // Poll pending invoices
    results.invoicePolling = await pollAllPendingInvoices();
  } catch (error) {
    console.error('[BackgroundTasks] Invoice polling error:', error);
    results.errors.push({ task: 'invoicePolling', error: error.message });
  }

  try {
    // Check all certificates
    results.certificateCheck = await checkAllCertificates();
  } catch (error) {
    console.error('[BackgroundTasks] Certificate check error:', error);
    results.errors.push({ task: 'certificateCheck', error: error.message });
  }

  try {
    // Process municipality retry queue
    results.retryQueue = await processRetryQueue();
  } catch (error) {
    console.error('[BackgroundTasks] Retry queue error:', error);
    results.errors.push({ task: 'retryQueue', error: error.message });
  }

  console.log('[BackgroundTasks] Scheduled tasks completed:', results);
  return results;
}

// If run directly, start background tasks
if (import.meta.url === `file://${process.argv[1]}`) {
  startAllBackgroundTasks().catch(error => {
    console.error('[BackgroundTasks] Fatal error:', error);
    process.exit(1);
  });
}
