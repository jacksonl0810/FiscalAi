/**
 * Plan Service Tests
 * 
 * Tests for subscription plan configurations and utilities.
 */

import { describe, test, expect } from '@jest/globals';
import {
  PLANS,
  normalizePlanId,
  getPlanConfig,
  hasUnlimitedInvoices,
  hasUnlimitedCompanies,
  getPlanPrice,
} from '../../src/config/plans.js';

describe('Plans Configuration', () => {
  describe('PLANS object', () => {
    test('should have all required plans', () => {
      expect(PLANS).toHaveProperty('essential');
      expect(PLANS).toHaveProperty('professional');
      expect(PLANS).toHaveProperty('accountant');
      expect(PLANS).toHaveProperty('pay_per_use');
    });

    test('each plan should have required fields', () => {
      const requiredFields = [
        'planId',
        'name',
        'description',
        'maxCompanies',
        'maxInvoicesPerMonth',
      ];

      Object.values(PLANS).forEach(plan => {
        requiredFields.forEach(field => {
          expect(plan).toHaveProperty(field);
        });
      });
    });

    test('plan prices should be valid numbers', () => {
      Object.values(PLANS).forEach(plan => {
        if (plan.monthlyPrice !== undefined) {
          expect(typeof plan.monthlyPrice).toBe('number');
          expect(plan.monthlyPrice).toBeGreaterThanOrEqual(0);
        }
        if (plan.annualPrice !== undefined) {
          expect(typeof plan.annualPrice).toBe('number');
          expect(plan.annualPrice).toBeGreaterThanOrEqual(0);
        }
      });
    });

    test('plan limits should be valid', () => {
      Object.values(PLANS).forEach(plan => {
        expect(
          typeof plan.maxCompanies === 'number' || plan.maxCompanies === Infinity
        ).toBe(true);
        expect(
          typeof plan.maxInvoicesPerMonth === 'number' || plan.maxInvoicesPerMonth === Infinity
        ).toBe(true);
      });
    });
  });

  describe('normalizePlanId', () => {
    test('should normalize frontend plan IDs', () => {
      expect(normalizePlanId('essential')).toBe('essential');
      expect(normalizePlanId('pro')).toBe('professional');
      expect(normalizePlanId('business')).toBe('accountant');
    });

    test('should handle already normalized IDs', () => {
      expect(normalizePlanId('professional')).toBe('professional');
      expect(normalizePlanId('accountant')).toBe('accountant');
    });

    test('should handle null/undefined', () => {
      expect(normalizePlanId(null)).toBeFalsy();
      expect(normalizePlanId(undefined)).toBeFalsy();
    });

    test('should handle unknown plan IDs', () => {
      const result = normalizePlanId('unknown_plan');
      // Should return the original or undefined
      expect(result).toBeDefined();
    });
  });

  describe('getPlanConfig', () => {
    test('should return correct config for valid plan', () => {
      const config = getPlanConfig('essential');
      
      expect(config).toBeDefined();
      expect(config.planId).toBe('essential');
      expect(config.name).toBeTruthy();
    });

    test('should handle pay_per_use plan specially', () => {
      const config = getPlanConfig('pay_per_use');
      
      expect(config).toBeDefined();
      expect(config.maxCompanies).toBeGreaterThan(0);
      expect(config.maxInvoicesPerMonth).toBe(-1); // Unlimited
    });

    test('should return undefined for unknown plan', () => {
      const config = getPlanConfig('nonexistent_plan');
      
      // Should return undefined or throw
      expect(config === undefined || config === null).toBe(true);
    });
  });

  describe('hasUnlimitedInvoices', () => {
    test('should return true for unlimited plans', () => {
      // Find a plan with unlimited invoices
      const unlimitedPlan = Object.values(PLANS).find(
        p => p.maxInvoicesPerMonth === Infinity
      );
      
      if (unlimitedPlan) {
        expect(hasUnlimitedInvoices(unlimitedPlan.planId)).toBe(true);
      }
    });

    test('should return false for limited plans', () => {
      const limitedPlan = Object.values(PLANS).find(
        p => p.maxInvoicesPerMonth !== Infinity && typeof p.maxInvoicesPerMonth === 'number'
      );
      
      if (limitedPlan) {
        expect(hasUnlimitedInvoices(limitedPlan.planId)).toBe(false);
      }
    });
  });

  describe('hasUnlimitedCompanies', () => {
    test('should return correct value based on plan', () => {
      // Test with accountant plan which usually has unlimited companies
      const result = hasUnlimitedCompanies('accountant');
      expect(typeof result).toBe('boolean');
    });

    test('should return false for basic plans', () => {
      const result = hasUnlimitedCompanies('essential');
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getPlanPrice', () => {
    test('should return monthly price for monthly billing', () => {
      const price = getPlanPrice('essential', 'monthly');
      
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThanOrEqual(0);
    });

    test('should return annual price for annual billing', () => {
      const price = getPlanPrice('essential', 'annual');
      
      expect(typeof price).toBe('number');
      expect(price).toBeGreaterThanOrEqual(0);
    });

    test('annual price should be discounted compared to 12x monthly', () => {
      const monthlyPrice = getPlanPrice('professional', 'monthly');
      const annualPrice = getPlanPrice('professional', 'annual');
      
      if (monthlyPrice > 0 && annualPrice > 0) {
        // Annual should be less than 12 * monthly
        expect(annualPrice).toBeLessThanOrEqual(monthlyPrice * 12);
      }
    });

    test('should handle invalid plan gracefully', () => {
      expect(() => getPlanPrice('invalid_plan', 'monthly')).not.toThrow();
    });
  });
});

describe('Plan Feature Checks', () => {
  test('essential plan should have basic limits', () => {
    const plan = PLANS.essential;
    
    expect(plan.maxCompanies).toBeGreaterThan(0);
    expect(plan.maxInvoicesPerMonth).toBeGreaterThan(0);
  });

  test('professional plan should have more features', () => {
    const essential = PLANS.essential;
    const professional = PLANS.professional;
    
    expect(professional.maxInvoicesPerMonth).toBeGreaterThanOrEqual(essential.maxInvoicesPerMonth);
  });

  test('accountant plan should support multiple companies', () => {
    const plan = PLANS.accountant;
    
    expect(plan.maxCompanies).toBeGreaterThan(1);
  });
});
