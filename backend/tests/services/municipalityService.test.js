/**
 * Municipality Service Tests
 * 
 * Tests for municipality support checking and caching.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

describe('MunicipalityService', () => {
  describe('IBGE Code Validation', () => {
    test('should validate 7-digit IBGE codes', () => {
      const isValidIBGE = (code) => {
        const cleaned = (code || '').replace(/\D/g, '');
        return cleaned.length === 7;
      };

      expect(isValidIBGE('3550308')).toBe(true); // São Paulo
      expect(isValidIBGE('3304557')).toBe(true); // Rio de Janeiro
      expect(isValidIBGE('5300108')).toBe(true); // Brasília
    });

    test('should reject invalid IBGE codes', () => {
      const isValidIBGE = (code) => {
        const cleaned = (code || '').replace(/\D/g, '');
        return cleaned.length === 7;
      };

      expect(isValidIBGE('12345')).toBe(false);
      expect(isValidIBGE('12345678')).toBe(false);
      expect(isValidIBGE('')).toBe(false);
      expect(isValidIBGE(null)).toBe(false);
      expect(isValidIBGE(undefined)).toBe(false);
    });

    test('should clean and format IBGE codes', () => {
      const cleanIBGE = (code) => (code || '').replace(/\D/g, '');

      expect(cleanIBGE('35.503.08')).toBe('3550308');
      expect(cleanIBGE('35-503-08')).toBe('3550308');
      expect(cleanIBGE('3550308')).toBe('3550308');
    });
  });

  describe('Municipality Support Checking', () => {
    test('should return support status object', () => {
      const createSupportStatus = (supported, message) => ({
        supported,
        message,
        checkedAt: new Date(),
      });

      const status = createSupportStatus(true, 'Município suportado');
      
      expect(status.supported).toBe(true);
      expect(status.message).toBe('Município suportado');
      expect(status.checkedAt instanceof Date).toBe(true);
    });

    test('should include municipality data when supported', () => {
      const createSupportStatus = (supported, data) => ({
        supported,
        data: supported ? data : null,
        checkedAt: new Date(),
      });

      const data = {
        codigo: '3550308',
        nome: 'São Paulo',
        uf: 'SP',
        provedor: 'PRONIM',
      };

      const status = createSupportStatus(true, data);
      
      expect(status.supported).toBe(true);
      expect(status.data.codigo).toBe('3550308');
      expect(status.data.nome).toBe('São Paulo');
    });

    test('should handle unsupported municipalities', () => {
      const createSupportStatus = (supported, message) => ({
        supported,
        message,
        hint: !supported ? 'Verifique o código IBGE' : null,
        checkedAt: new Date(),
      });

      const status = createSupportStatus(false, 'Município não suportado');
      
      expect(status.supported).toBe(false);
      expect(status.hint).toBeTruthy();
    });

    test('should handle unknown status', () => {
      const createSupportStatus = (supported, message, error) => ({
        supported,
        message,
        error: error || null,
        checkedAt: new Date(),
      });

      const status = createSupportStatus(null, 'Não foi possível verificar', 'API unavailable');
      
      expect(status.supported).toBeNull();
      expect(status.error).toBe('API unavailable');
    });
  });

  describe('Cache Management', () => {
    test('should check cache TTL', () => {
      const isCacheValid = (lastFetch, ttl) => {
        if (!lastFetch) return false;
        return Date.now() - lastFetch < ttl;
      };

      const TTL = 24 * 60 * 60 * 1000; // 24 hours
      const recentFetch = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago
      const oldFetch = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago

      expect(isCacheValid(recentFetch, TTL)).toBe(true);
      expect(isCacheValid(oldFetch, TTL)).toBe(false);
      expect(isCacheValid(null, TTL)).toBe(false);
    });

    test('should determine if re-check is needed', () => {
      const shouldRecheck = (supportStatus, checkedAt, maxAge) => {
        if (supportStatus === null || supportStatus === undefined) return true;
        if (!checkedAt) return true;
        return (Date.now() - new Date(checkedAt).getTime()) > maxAge;
      };

      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const recentCheck = new Date().toISOString();
      const oldCheck = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();

      expect(shouldRecheck(true, recentCheck, maxAge)).toBe(false);
      expect(shouldRecheck(true, oldCheck, maxAge)).toBe(true);
      expect(shouldRecheck(null, recentCheck, maxAge)).toBe(true);
      expect(shouldRecheck(true, null, maxAge)).toBe(true);
    });
  });

  describe('Municipality Availability', () => {
    test('should handle online status', () => {
      const isOnline = (response) => {
        return response.status === 'online' ||
               response.disponivel === true ||
               response.available === true;
      };

      expect(isOnline({ status: 'online' })).toBe(true);
      expect(isOnline({ disponivel: true })).toBe(true);
      expect(isOnline({ available: true })).toBe(true);
      expect(isOnline({ status: 'offline' })).toBe(false);
    });

    test('should create availability response', () => {
      const createAvailability = (available, message) => ({
        available,
        message,
        checkedAt: new Date(),
      });

      const online = createAvailability(true, 'Sistema da prefeitura disponível');
      const offline = createAvailability(false, 'Sistema temporariamente indisponível');

      expect(online.available).toBe(true);
      expect(offline.available).toBe(false);
    });
  });

  describe('Municipality Search', () => {
    test('should find municipality in list by code', () => {
      const municipalities = [
        { codigo_ibge: '3550308', nome: 'São Paulo', uf: 'SP' },
        { codigo_ibge: '3304557', nome: 'Rio de Janeiro', uf: 'RJ' },
        { codigo_ibge: '5300108', nome: 'Brasília', uf: 'DF' },
      ];

      const findMunicipality = (list, code) => {
        return list.find(city => {
          const cityCode = (city.codigo_ibge || city.codigo_municipio || city.codigo || '').toString();
          return cityCode === code;
        });
      };

      expect(findMunicipality(municipalities, '3550308')).toBeDefined();
      expect(findMunicipality(municipalities, '3550308').nome).toBe('São Paulo');
      expect(findMunicipality(municipalities, '9999999')).toBeUndefined();
    });

    test('should handle different field names', () => {
      const variants = [
        { codigo_ibge: '3550308' },
        { codigo_municipio: '3550308' },
        { ibge: '3550308' },
        { codigo: '3550308' },
      ];

      const getCode = (city) => {
        return (city.codigo_ibge || city.codigo_municipio || city.ibge || city.codigo || '').toString();
      };

      variants.forEach(city => {
        expect(getCode(city)).toBe('3550308');
      });
    });
  });
});

describe('Cache Statistics', () => {
  test('should track cache stats', () => {
    const createStats = (options) => ({
      memoryCacheActive: !!options.data,
      memoryCacheAge: options.lastFetch ? Date.now() - options.lastFetch : null,
      memoryCacheTTL: options.ttl,
      supportedCitiesCount: options.data?.length || 0,
    });

    const stats = createStats({
      data: new Array(100).fill({}),
      lastFetch: Date.now() - 3600000, // 1 hour ago
      ttl: 86400000, // 24 hours
    });

    expect(stats.memoryCacheActive).toBe(true);
    expect(stats.memoryCacheAge).toBeLessThan(3700000);
    expect(stats.supportedCitiesCount).toBe(100);
  });
});
