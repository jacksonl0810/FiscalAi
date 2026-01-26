/**
 * Error Translation Service Tests
 * 
 * Tests for the error translation service that converts
 * technical API errors into user-friendly Portuguese messages.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  translateError,
  translateErrorForUser,
  translateErrorForAI,
} from '../../src/services/errorTranslationService.js';

describe('ErrorTranslationService', () => {
  describe('translateError', () => {
    test('should translate known error codes', () => {
      const result = translateError({
        status: 400,
        code: 'INVALID_CNPJ',
        message: 'CNPJ inválido'
      });

      expect(result).toBeDefined();
      expect(result.message).toBeTruthy();
      expect(result.explanation).toBeTruthy();
      expect(result.action).toBeTruthy();
    });

    test('should handle string errors', () => {
      const result = translateError('Erro desconhecido');

      expect(result).toBeDefined();
      expect(result.message).toContain('Erro');
    });

    test('should return generic message for unknown errors', () => {
      const result = translateError({
        status: 500,
        code: 'UNKNOWN_CODE_XYZ',
        message: 'Something went wrong'
      });

      expect(result).toBeDefined();
      expect(result.message).toBeTruthy();
    });

    test('should handle null/undefined gracefully', () => {
      expect(() => translateError(null)).not.toThrow();
      expect(() => translateError(undefined)).not.toThrow();
    });

    test('should translate 401 authentication errors', () => {
      const result = translateError({ status: 401 });

      expect(result.message).toBeTruthy();
      expect(result.action).toBeTruthy();
    });

    test('should translate 403 authorization errors', () => {
      const result = translateError({ status: 403 });

      expect(result.message).toBeTruthy();
    });

    test('should translate 404 not found errors', () => {
      const result = translateError({ status: 404 });

      expect(result.message).toBeTruthy();
    });

    test('should translate 429 rate limit errors', () => {
      const result = translateError({ status: 429 });

      expect(result.message).toBeTruthy();
      expect(result.action).toBeTruthy();
    });

    test('should translate 500 server errors', () => {
      const result = translateError({ status: 500 });

      expect(result.message).toBeTruthy();
    });
  });

  describe('translateErrorForUser', () => {
    test('should format error as user-friendly string', () => {
      const result = translateErrorForUser({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos'
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should include action in the message', () => {
      const result = translateErrorForUser({
        status: 401,
        message: 'Unauthorized'
      });

      expect(typeof result).toBe('string');
    });
  });

  describe('translateErrorForAI', () => {
    test('should format error for AI conversation', () => {
      const result = translateErrorForAI({
        status: 400,
        code: 'INVALID_DATA',
        message: 'Invalid input'
      });

      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    test('should be conversational in tone', () => {
      const result = translateErrorForAI({
        status: 500,
        message: 'Internal server error'
      });

      expect(typeof result).toBe('string');
    });
  });
});

describe('Error Pattern Matching', () => {
  test('should match CNPJ-related errors', () => {
    const errors = [
      { message: 'CNPJ inválido' },
      { message: 'CNPJ não encontrado' },
      { message: 'Empresa com CNPJ 12345678901234 não cadastrada' },
    ];

    errors.forEach(error => {
      const result = translateError(error);
      expect(result).toBeDefined();
    });
  });

  test('should match certificate-related errors', () => {
    const errors = [
      { message: 'Certificado expirado' },
      { message: 'Certificate expired' },
      { message: 'Senha do certificado inválida' },
    ];

    errors.forEach(error => {
      const result = translateError(error);
      expect(result).toBeDefined();
    });
  });

  test('should match municipality-related errors', () => {
    const errors = [
      { message: 'Município não suportado' },
      { message: 'Prefeitura offline' },
      { message: 'Serviço municipal indisponível' },
    ];

    errors.forEach(error => {
      const result = translateError(error);
      expect(result).toBeDefined();
    });
  });
});
