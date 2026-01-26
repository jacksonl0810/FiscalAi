/**
 * Frontend Error Translation Service
 * Translates technical API errors into user-friendly Portuguese messages
 * 
 * This service ensures that:
 * - Raw technical errors are NEVER shown to users
 * - All errors include: What happened, Why it happened, What to do next
 */

import apiClient from '@/api/client';
import type { AxiosError } from 'axios';

export interface TranslatedError {
  message: string;
  explanation: string;
  action: string;
  category: string;
  fullMessage: string; // Combined message for display
}

/**
 * Translate an error using the backend translation service
 */
export async function translateError(
  error: unknown,
  context: Record<string, any> = {}
): Promise<TranslatedError> {
  try {
    // Extract error information
    let errorData: any = {
      message: '',
      code: '',
      status: null,
    };

    if (error instanceof Error) {
      errorData.message = error.message;
      errorData.code = (error as any).code || '';
      errorData.status = (error as any).status || null;
    } else if (error && typeof error === 'object') {
      errorData = {
        message: (error as any).message || String(error),
        code: (error as any).code || '',
        status: (error as any).status || null,
      };
    } else {
      errorData.message = String(error);
    }

    // If it's an Axios error, extract more details
    if ((error as AxiosError)?.response) {
      const axiosError = error as AxiosError;
      errorData.status = axiosError.response?.status || null;
      errorData.code = (axiosError.response?.data as any)?.code || '';
      errorData.message = 
        (axiosError.response?.data as any)?.message || 
        axiosError.message || 
        'Erro desconhecido';
    }

    // Call backend translation service
    const { assistantService } = await import('@/api/services');
    const translation = await assistantService.translateError(errorData, context);

    return {
      message: translation.message,
      explanation: translation.explanation,
      action: translation.action,
      category: translation.category,
      fullMessage: `${translation.message}\n\n${translation.explanation}\n\n${translation.action}`,
    };
  } catch (translationError) {
    // If translation fails, return a safe generic error
    console.error('Error translation failed:', translationError);
    
    return {
      message: 'Erro ao processar solicitação',
      explanation: 'Ocorreu um erro inesperado ao processar sua solicitação.',
      action: 'Tente novamente em alguns instantes. Se o problema persistir, entre em contato com o suporte.',
      category: 'unknown',
      fullMessage: 'Erro ao processar solicitação\n\nOcorreu um erro inesperado ao processar sua solicitação.\n\nTente novamente em alguns instantes. Se o problema persistir, entre em contato com o suporte.',
    };
  }
}

/**
 * Translate error and return formatted message for toast/notification
 */
export async function translateErrorForDisplay(
  error: unknown,
  context: Record<string, any> = {}
): Promise<string> {
  const translation = await translateError(error, context);
  return translation.fullMessage;
}

/**
 * Handle error and show translated message to user
 * This is the main function to use in catch blocks
 */
export async function handleError(
  error: unknown,
  context: Record<string, any> = {},
  onDisplay?: (message: string) => void
): Promise<TranslatedError> {
  // Log original error for debugging (never shown to user)
  console.error('[Error Handler] Original error:', error);

  // Translate error
  const translation = await translateError(error, context);

  // Display to user if callback provided
  if (onDisplay) {
    onDisplay(translation.fullMessage);
  }

  return translation;
}

/**
 * Create an error handler that automatically shows toast notifications
 */
export function createErrorHandler(context: Record<string, any> = {}) {
  return async (error: unknown) => {
    const { toast } = await import('sonner');
    
    const translation = await translateError(error, context);
    
    toast.error(translation.message, {
      description: `${translation.explanation}\n\n${translation.action}`,
      duration: 8000,
      style: {
        background: 'linear-gradient(135deg, rgba(127, 29, 29, 0.95) 0%, rgba(153, 27, 27, 0.95) 50%, rgba(127, 29, 29, 0.95) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '2px solid rgba(239, 68, 68, 0.5)',
        borderRadius: '16px',
        boxShadow: '0 20px 60px rgba(239, 68, 68, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1) inset',
        color: '#ffffff',
        padding: '20px',
        minWidth: '380px',
        maxWidth: '500px',
        whiteSpace: 'pre-line',
        fontWeight: '500',
      },
      className: 'error-toast-luxury',
    });

    return translation;
  };
}
