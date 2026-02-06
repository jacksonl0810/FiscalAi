/**
 * Client Repository
 * Data access layer for clients
 */

import { BaseRepository } from './BaseRepository.js';

export class ClientRepository extends BaseRepository {
  constructor() {
    super('client');
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
   * Find by company ID
   */
  async findByCompanyId(companyId, options = {}) {
    return this.findMany({
      where: { companyId },
      ...options,
    });
  }

  /**
   * Find by CPF
   */
  async findByCPF(cpf, userId) {
    return this.findFirst({
      cpf,
      userId,
    });
  }

  /**
   * Find by CNPJ
   */
  async findByCNPJ(cnpj, userId) {
    return this.findFirst({
      cnpj,
      userId,
    });
  }

  /**
   * Find by document (CPF or CNPJ)
   */
  async findByDocument(document, userId) {
    const cleanDoc = document.replace(/\D/g, '');
    
    if (cleanDoc.length === 11) {
      return this.findByCPF(cleanDoc, userId);
    } else if (cleanDoc.length === 14) {
      return this.findByCNPJ(cleanDoc, userId);
    }
    
    return null;
  }
}
