/**
 * Company Repository
 * Data access layer for companies
 */

import { BaseRepository } from './BaseRepository.js';

export class CompanyRepository extends BaseRepository {
  constructor() {
    super('company');
  }

  /**
   * Find by user ID
   */
  async findByUserId(userId, options = {}) {
    return this.findMany({
      where: { userId },
      ...options,
    });
  }

  /**
   * Find by CNPJ
   */
  async findByCNPJ(cnpj) {
    return this.findFirst({ cnpj });
  }

  /**
   * Find by user ID and ID (for ownership check)
   */
  async findByUserIdAndId(userId, id) {
    return this.findFirst({
      userId,
      id,
    });
  }

  /**
   * Update fiscal connection status
   */
  async updateFiscalStatus(id, status, error = null) {
    return this.update(id, {
      fiscalConnectionStatus: status,
      fiscalConnectionError: error,
      lastConnectionCheck: new Date(),
    });
  }

  /**
   * Update Nuvem Fiscal ID
   */
  async updateNuvemFiscalId(id, nuvemFiscalId) {
    return this.update(id, { nuvemFiscalId });
  }

  /**
   * Check if user owns company
   */
  async userOwnsCompany(userId, companyId) {
    const company = await this.findByUserIdAndId(userId, companyId);
    return !!company;
  }
}
