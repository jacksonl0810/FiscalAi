/**
 * Formatting Utilities
 * Common formatting functions for the frontend
 */

import { DATE_FORMATS } from '../constants/index.js';
import { format as formatDate, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Format CNPJ (XX.XXX.XXX/XXXX-XX)
 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj) return '';
  const clean = cnpj.replace(/\D/g, '');
  if (clean.length !== 14) return cnpj;
  return clean.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Format CPF (XXX.XXX.XXX-XX)
 */
export function formatCPF(cpf: string | null | undefined): string {
  if (!cpf) return '';
  const clean = cpf.replace(/\D/g, '');
  if (clean.length !== 11) return cpf;
  return clean.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Format phone number (XX) XXXXX-XXXX
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const clean = phone.replace(/\D/g, '');
  if (clean.length === 10) {
    return clean.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  } else if (clean.length === 11) {
    return clean.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

/**
 * Format currency (R$ X.XXX,XX)
 */
export function formatCurrency(
  value: number | string | null | undefined,
  options: Intl.NumberFormatOptions = {}
): string {
  if (value === null || value === undefined) return 'R$ 0,00';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return 'R$ 0,00';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    ...options,
  }).format(numValue);
}

/**
 * Format date to Brazilian format
 */
export function formatDateBR(
  date: string | Date | null | undefined,
  format: string = DATE_FORMATS.BR
): string {
  if (!date) return '';
  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    return formatDate(dateObj, format, { locale: ptBR });
  } catch {
    return '';
  }
}

/**
 * Format date and time to Brazilian format
 */
export function formatDateTimeBR(date: string | Date | null | undefined): string {
  return formatDateBR(date, DATE_FORMATS.BR_DATETIME);
}

/**
 * Clean document (remove formatting)
 */
export function cleanDocument(doc: string | null | undefined): string {
  if (!doc) return '';
  return doc.replace(/\D/g, '');
}

/**
 * Validate CNPJ format
 */
export function isValidCNPJ(cnpj: string | null | undefined): boolean {
  if (!cnpj) return false;
  const clean = cleanDocument(cnpj);
  return clean.length === 14;
}

/**
 * Validate CPF format
 */
export function isValidCPF(cpf: string | null | undefined): boolean {
  if (!cpf) return false;
  const clean = cleanDocument(cpf);
  return clean.length === 11;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Truncate text
 */
export function truncate(text: string | null | undefined, length: number = 50): string {
  if (!text) return '';
  if (text.length <= length) return text;
  return text.substring(0, length) + '...';
}

/**
 * Capitalize first letter
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Format status badge
 */
export function formatStatus(status: string | null | undefined): string {
  if (!status) return '';
  return status
    .split('_')
    .map(word => capitalize(word))
    .join(' ');
}

export default {
  formatCNPJ,
  formatCPF,
  formatPhone,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  cleanDocument,
  isValidCNPJ,
  isValidCPF,
  formatFileSize,
  truncate,
  capitalize,
  formatStatus,
};
