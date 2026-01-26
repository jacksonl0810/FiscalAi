/**
 * Global Error Handler Utility
 * 
 * This utility provides a simple way to handle errors throughout the application
 * ensuring that raw technical errors are NEVER shown to users.
 * 
 * Usage:
 * ```typescript
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   await handleApiError(error);
 * }
 * ```
 */

import { handleError, translateErrorForDisplay } from '@/services/errorTranslationService';
import { toast } from 'sonner';

/**
 * Handle API errors with automatic translation and toast notification
 * This is the recommended way to handle errors in the application
 */
export async function handleApiError(
  error: unknown,
  context: Record<string, any> = {}
): Promise<void> {
  await handleError(error, context, (message) => {
    const parts = message.split('\n\n');
    const title = parts[0] || 'Erro ao processar solicitação';
    const description = parts.slice(1).join('\n\n') || 'Ocorreu um erro inesperado.';
    
    toast.error(title, {
      description: description,
      duration: 8000,
      style: {
        background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.98) 0%, rgba(153, 27, 27, 0.98) 50%, rgba(127, 29, 29, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '2px solid rgba(239, 68, 68, 0.6)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(239, 68, 68, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1) inset, 0 0 40px rgba(239, 68, 68, 0.2)',
        color: '#ffffff',
        padding: '20px 24px',
        minWidth: '400px',
        maxWidth: '520px',
        fontWeight: '500',
      },
      className: 'luxury-error-toast',
    });
  });
}

/**
 * Get translated error message without showing toast
 * Useful when you want to handle the display yourself
 */
export async function getTranslatedError(
  error: unknown,
  context: Record<string, any> = {}
): Promise<string> {
  return await translateErrorForDisplay(error, context);
}
