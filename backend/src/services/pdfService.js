/**
 * PDF Generation Service
 * Generates PDF invoices locally when Nuvem Fiscal URL is unavailable
 */

import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

/**
 * Format currency in Brazilian Real
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value || 0);
}

/**
 * Format date in Brazilian format
 */
function formatDate(date) {
  if (!date) return '---';
  return new Date(date).toLocaleDateString('pt-BR');
}

/**
 * Format CNPJ
 */
function formatCNPJ(cnpj) {
  if (!cnpj) return '---';
  const cleaned = cnpj.replace(/\D/g, '');
  return cleaned.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    '$1.$2.$3/$4-$5'
  );
}

/**
 * Format CPF
 */
function formatCPF(cpf) {
  if (!cpf) return '---';
  const cleaned = cpf.replace(/\D/g, '');
  return cleaned.replace(
    /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
    '$1.$2.$3-$4'
  );
}

/**
 * Format document (CPF or CNPJ)
 */
function formatDocument(doc) {
  if (!doc) return '---';
  const cleaned = doc.replace(/\D/g, '');
  if (cleaned.length === 11) return formatCPF(cleaned);
  if (cleaned.length === 14) return formatCNPJ(cleaned);
  return doc;
}

/**
 * Generate PDF for an invoice
 * 
 * @param {object} invoice - Invoice data
 * @param {object} company - Company data
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateInvoicePDF(invoice, company) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 50,
        info: {
          Title: `NFS-e ${invoice.numero || 'Rascunho'}`,
          Author: 'MAY - Assistente Fiscal IA',
          Subject: `Nota Fiscal de Serviço - ${invoice.clienteNome}`,
          Creator: 'MAY Fiscal Platform'
        }
      });

      const chunks = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Colors
      const primaryColor = '#f97316';
      const darkColor = '#1a1a2e';
      const grayColor = '#6b7280';

      // Header with gradient-like effect
      doc.rect(0, 0, 612, 120)
         .fill(darkColor);

      // Logo/Title
      doc.fillColor('#ffffff')
         .fontSize(28)
         .font('Helvetica-Bold')
         .text('MAY', 50, 40);

      doc.fillColor(primaryColor)
         .fontSize(10)
         .font('Helvetica')
         .text('Assistente Fiscal IA', 50, 70);

      // NFS-e Badge
      doc.roundedRect(450, 35, 110, 50, 5)
         .fill(primaryColor);

      doc.fillColor('#ffffff')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('NFS-e', 455, 45, { width: 100, align: 'center' });

      doc.fontSize(18)
         .text(invoice.numero || 'RASCUNHO', 455, 62, { width: 100, align: 'center' });

      // Status bar
      const statusColors = {
        'autorizada': '#22c55e',
        'rejeitada': '#ef4444',
        'cancelada': '#6b7280',
        'processando': '#f59e0b',
        'rascunho': '#3b82f6'
      };
      const statusColor = statusColors[invoice.status] || '#3b82f6';

      doc.rect(0, 120, 612, 25)
         .fill(statusColor);

      doc.fillColor('#ffffff')
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(`STATUS: ${(invoice.status || 'RASCUNHO').toUpperCase()}`, 50, 127);

      if (invoice.codigoVerificacao) {
        doc.text(`CÓDIGO DE VERIFICAÇÃO: ${invoice.codigoVerificacao}`, 300, 127, { align: 'right', width: 262 });
      }

      // Reset position
      let y = 170;

      // Prestador Section
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('PRESTADOR DE SERVIÇOS', 50, y);

      y += 20;

      doc.roundedRect(50, y, 512, 80, 5)
         .stroke(grayColor);

      y += 10;

      doc.fillColor(darkColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(company?.razaoSocial || company?.nomeFantasia || 'Empresa', 60, y);

      y += 15;

      doc.fillColor(grayColor)
         .font('Helvetica')
         .fontSize(9);

      doc.text(`CNPJ: ${formatCNPJ(company?.cnpj)}`, 60, y);
      doc.text(`Inscrição Municipal: ${company?.inscricaoMunicipal || '---'}`, 300, y);

      y += 12;

      doc.text(`Endereço: ${company?.logradouro || ''} ${company?.numero || ''}, ${company?.bairro || ''}`, 60, y);

      y += 12;

      doc.text(`${company?.cidade || ''} - ${company?.uf || ''}  |  CEP: ${company?.cep || '---'}`, 60, y);

      y += 40;

      // Tomador Section
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('TOMADOR DE SERVIÇOS', 50, y);

      y += 20;

      doc.roundedRect(50, y, 512, 60, 5)
         .stroke(grayColor);

      y += 10;

      doc.fillColor(darkColor)
         .fontSize(10)
         .font('Helvetica-Bold')
         .text(invoice.clienteNome || 'Cliente', 60, y);

      y += 15;

      doc.fillColor(grayColor)
         .font('Helvetica')
         .fontSize(9)
         .text(`CPF/CNPJ: ${formatDocument(invoice.clienteDocumento)}`, 60, y);

      y += 50;

      // Service Section
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('DESCRIÇÃO DOS SERVIÇOS', 50, y);

      y += 20;

      doc.roundedRect(50, y, 512, 80, 5)
         .stroke(grayColor);

      y += 10;

      doc.fillColor(darkColor)
         .fontSize(9)
         .font('Helvetica')
         .text(invoice.descricaoServico || 'Serviço prestado', 60, y, { width: 492 });

      if (invoice.codigoServico) {
        y += 30;
        doc.fillColor(grayColor)
           .text(`Código do Serviço: ${invoice.codigoServico}`, 60, y);
      }

      y += 60;

      // Values Section
      doc.fillColor(darkColor)
         .fontSize(12)
         .font('Helvetica-Bold')
         .text('VALORES', 50, y);

      y += 20;

      // Values table
      doc.roundedRect(50, y, 512, 100, 5)
         .fill('#f9fafb');

      y += 15;

      const col1 = 60;
      const col2 = 280;
      const col3 = 400;

      doc.fillColor(grayColor)
         .fontSize(8)
         .font('Helvetica')
         .text('DATA DE EMISSÃO', col1, y)
         .text('DATA DE PRESTAÇÃO', col2, y)
         .text('VALOR TOTAL', col3, y);

      y += 12;

      doc.fillColor(darkColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(formatDate(invoice.dataEmissao), col1, y)
         .text(formatDate(invoice.dataPrestacao || invoice.dataEmissao), col2, y);

      doc.fillColor(primaryColor)
         .fontSize(16)
         .text(formatCurrency(invoice.valor), col3, y - 3);

      y += 25;

      doc.fillColor(grayColor)
         .fontSize(8)
         .font('Helvetica')
         .text('ALÍQUOTA ISS', col1, y)
         .text('VALOR ISS', col2, y)
         .text('ISS RETIDO', col3, y);

      y += 12;

      doc.fillColor(darkColor)
         .fontSize(11)
         .font('Helvetica-Bold')
         .text(`${invoice.aliquotaIss || 5}%`, col1, y)
         .text(formatCurrency(invoice.valorIss), col2, y)
         .text(invoice.issRetido ? 'SIM' : 'NÃO', col3, y);

      y += 45;

      // Footer
      doc.moveTo(50, y)
         .lineTo(562, y)
         .stroke('#e5e7eb');

      y += 15;

      doc.fillColor(grayColor)
         .fontSize(8)
         .font('Helvetica')
         .text('Este documento foi gerado pelo sistema MAY - Assistente Fiscal IA', 50, y, { align: 'center', width: 512 });

      y += 12;

      doc.text(`Emitido em: ${formatDate(new Date())} às ${new Date().toLocaleTimeString('pt-BR')}`, 50, y, { align: 'center', width: 512 });

      if (invoice.municipio) {
        y += 12;
        doc.text(`Município: ${invoice.municipio}`, 50, y, { align: 'center', width: 512 });
      }

      // End document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate PDF and return as stream
 * 
 * @param {object} invoice - Invoice data
 * @param {object} company - Company data
 * @returns {Promise<Readable>} PDF stream
 */
export async function generateInvoicePDFStream(invoice, company) {
  const buffer = await generateInvoicePDF(invoice, company);
  return Readable.from(buffer);
}

export default {
  generateInvoicePDF,
  generateInvoicePDFStream
};
