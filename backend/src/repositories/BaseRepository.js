/**
 * Base Repository
 * Provides common repository functionality
 */

import { prisma } from '../lib/prisma.js';
import { PAGINATION } from '../constants/index.js';

export class BaseRepository {
  constructor(model) {
    this.model = model;
    this.prisma = prisma;
  }

  /**
   * Find by ID
   */
  async findById(id, include = null) {
    const options = { where: { id } };
    if (include) options.include = include;
    return this.prisma[this.model].findUnique(options);
  }

  /**
   * Find many with pagination
   */
  async findMany(options = {}) {
    const {
      where = {},
      include = null,
      orderBy = { createdAt: 'desc' },
      page = PAGINATION.DEFAULT_PAGE,
      limit = PAGINATION.DEFAULT_LIMIT,
    } = options;

    const skip = (page - 1) * limit;
    const take = Math.min(limit, PAGINATION.MAX_LIMIT);

    const queryOptions = {
      where,
      orderBy,
      skip,
      take,
    };

    if (include) queryOptions.include = include;

    const [data, total] = await Promise.all([
      this.prisma[this.model].findMany(queryOptions),
      this.prisma[this.model].count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit: take,
        total,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /**
   * Create
   */
  async create(data, include = null) {
    const options = { data };
    if (include) options.include = include;
    return this.prisma[this.model].create(options);
  }

  /**
   * Update
   */
  async update(id, data, include = null) {
    const options = { where: { id }, data };
    if (include) options.include = include;
    return this.prisma[this.model].update(options);
  }

  /**
   * Delete
   */
  async delete(id) {
    return this.prisma[this.model].delete({ where: { id } });
  }

  /**
   * Count
   */
  async count(where = {}) {
    return this.prisma[this.model].count({ where });
  }

  /**
   * Find first
   */
  async findFirst(where = {}, include = null) {
    const options = { where };
    if (include) options.include = include;
    return this.prisma[this.model].findFirst(options);
  }

  /**
   * Find unique
   */
  async findUnique(where = {}, include = null) {
    const options = { where };
    if (include) options.include = include;
    return this.prisma[this.model].findUnique(options);
  }

  /**
   * Update many
   */
  async updateMany(where = {}, data) {
    return this.prisma[this.model].updateMany({ where, data });
  }

  /**
   * Delete many
   */
  async deleteMany(where = {}) {
    return this.prisma[this.model].deleteMany({ where });
  }
}
