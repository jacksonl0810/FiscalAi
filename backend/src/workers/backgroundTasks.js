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

/**
 * Start all background tasks
 */
export async function startAllBackgroundTasks() {
  console.log('[BackgroundTasks] Starting all background tasks...');

  try {
    // Start invoice status polling (runs every 5 minutes)
    await startBackgroundPolling();
    console.log('[BackgroundTasks] Invoice status polling started');

    // Start certificate monitoring (runs daily at 9 AM)
    await startCertificateMonitoring();
    console.log('[BackgroundTasks] Certificate monitoring started');

    // Start municipality retry queue processor (runs every 10 minutes)
    await startRetryQueueProcessor();
    console.log('[BackgroundTasks] Municipality retry queue started');

    console.log('[BackgroundTasks] All background tasks started successfully');
  } catch (error) {
    console.error('[BackgroundTasks] Error starting background tasks:', error);
    throw error;
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
