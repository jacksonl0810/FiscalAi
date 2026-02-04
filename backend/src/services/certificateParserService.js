/**
 * Certificate Parser Service
 * 
 * Parses Brazilian digital certificates (ICP-Brasil) to extract CNPJ/CPF
 * and validate ownership for company linking.
 * 
 * Brazilian digital certificates (e-CNPJ, e-CPF) follow ICP-Brasil standards:
 * - OID 2.16.76.1.3.3 = CNPJ of the legal entity (in otherName SAN)
 * - OID 2.16.76.1.3.1 = CPF of the certificate holder
 * - CNPJ may also appear in the Subject's OU or CN fields
 * 
 * Reference: DOC-ICP-04.01 (ITI - Instituto Nacional de Tecnologia da Informação)
 */

import forge from 'node-forge';

// ICP-Brasil OIDs for extracting CNPJ/CPF
const OID_CNPJ = '2.16.76.1.3.3'; // CNPJ da Pessoa Jurídica
const OID_CPF = '2.16.76.1.3.1';  // CPF do titular

/**
 * Parse a PFX/P12 certificate and extract information
 * 
 * @param {string} certificateBase64 - Base64 encoded PFX certificate
 * @param {string} password - Certificate password
 * @returns {Promise<object>} Parsed certificate information
 */
export async function parseCertificate(certificateBase64, password) {
  try {
    // Decode base64 to binary
    const pfxDer = forge.util.decode64(certificateBase64);
    
    // Parse the PKCS#12 container
    const p12Asn1 = forge.asn1.fromDer(pfxDer);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Get the certificate from the bag
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const certBag = certBags[forge.pki.oids.certBag];
    
    if (!certBag || certBag.length === 0) {
      throw new Error('Certificado não encontrado no arquivo PFX');
    }
    
    const cert = certBag[0].cert;
    
    if (!cert) {
      throw new Error('Certificado inválido ou corrompido');
    }
    
    // Extract certificate information
    const subject = cert.subject;
    const issuer = cert.issuer;
    const validity = {
      notBefore: cert.validity.notBefore,
      notAfter: cert.validity.notAfter
    };
    
    // Check if certificate is expired
    const now = new Date();
    const isExpired = now > validity.notAfter;
    const isNotYetValid = now < validity.notBefore;
    
    // Extract CNPJ from certificate
    const cnpj = extractCNPJFromCertificate(cert);
    const cpf = extractCPFFromCertificate(cert);
    
    // Extract subject fields
    const subjectFields = {};
    subject.attributes.forEach(attr => {
      const name = attr.shortName || attr.name || attr.type;
      subjectFields[name] = attr.value;
    });
    
    // Extract issuer fields
    const issuerFields = {};
    issuer.attributes.forEach(attr => {
      const name = attr.shortName || attr.name || attr.type;
      issuerFields[name] = attr.value;
    });
    
    return {
      valid: !isExpired && !isNotYetValid,
      expired: isExpired,
      notYetValid: isNotYetValid,
      cnpj: cnpj,
      cpf: cpf,
      subject: subjectFields,
      issuer: issuerFields,
      validity: {
        notBefore: validity.notBefore.toISOString(),
        notAfter: validity.notAfter.toISOString()
      },
      serialNumber: cert.serialNumber,
      // Common name (usually company or person name)
      commonName: subjectFields.CN || subjectFields.commonName || null,
      // Organization
      organization: subjectFields.O || subjectFields.organizationName || null,
      // Organizational unit (may contain CNPJ)
      organizationalUnit: subjectFields.OU || subjectFields.organizationalUnitName || null
    };
  } catch (error) {
    console.error('[CertificateParser] Error parsing certificate:', error);
    
    // Handle specific error types
    if (error.message && error.message.includes('PKCS#12 MAC could not be verified')) {
      throw new Error('Senha do certificado incorreta. Verifique a senha e tente novamente.');
    }
    
    if (error.message && error.message.includes('Invalid PEM formatted message')) {
      throw new Error('Formato de certificado inválido. O arquivo deve ser um certificado PFX/P12.');
    }
    
    throw new Error(`Erro ao processar certificado: ${error.message}`);
  }
}

/**
 * Extract CNPJ from certificate using ICP-Brasil standards
 * 
 * The CNPJ can be found in:
 * 1. Subject Alternative Name (SAN) with OID 2.16.76.1.3.3
 * 2. Organizational Unit (OU) field
 * 3. Common Name (CN) field
 * 
 * @param {object} cert - Parsed certificate object
 * @returns {string|null} Extracted CNPJ (digits only) or null
 */
function extractCNPJFromCertificate(cert) {
  try {
    // Method 1: Try to get CNPJ from Subject Alternative Name extension
    const sanExtension = cert.getExtension('subjectAltName');
    if (sanExtension && sanExtension.altNames) {
      for (const altName of sanExtension.altNames) {
        // Check for otherName with CNPJ OID
        if (altName.type === 0 && altName.value) {
          // Parse ASN.1 structure for CNPJ OID
          const cnpj = extractCNPJFromOtherName(altName.value);
          if (cnpj) return cnpj;
        }
      }
    }
    
    // Method 2: Try to extract from Organizational Unit (OU)
    const ou = cert.subject.getField('OU');
    if (ou && ou.value) {
      const cnpjMatch = extractCNPJFromString(ou.value);
      if (cnpjMatch) return cnpjMatch;
    }
    
    // Method 3: Try to extract from Common Name (CN)
    const cn = cert.subject.getField('CN');
    if (cn && cn.value) {
      const cnpjMatch = extractCNPJFromString(cn.value);
      if (cnpjMatch) return cnpjMatch;
    }
    
    // Method 4: Check all subject attributes
    for (const attr of cert.subject.attributes) {
      if (attr.value && typeof attr.value === 'string') {
        const cnpjMatch = extractCNPJFromString(attr.value);
        if (cnpjMatch) return cnpjMatch;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CertificateParser] Error extracting CNPJ:', error);
    return null;
  }
}

/**
 * Extract CPF from certificate using ICP-Brasil standards
 * 
 * @param {object} cert - Parsed certificate object
 * @returns {string|null} Extracted CPF (digits only) or null
 */
function extractCPFFromCertificate(cert) {
  try {
    // Try to get CPF from Subject Alternative Name extension
    const sanExtension = cert.getExtension('subjectAltName');
    if (sanExtension && sanExtension.altNames) {
      for (const altName of sanExtension.altNames) {
        if (altName.type === 0 && altName.value) {
          const cpf = extractCPFFromOtherName(altName.value);
          if (cpf) return cpf;
        }
      }
    }
    
    // Try to extract from subject fields
    for (const attr of cert.subject.attributes) {
      if (attr.value && typeof attr.value === 'string') {
        const cpfMatch = extractCPFFromString(attr.value);
        if (cpfMatch) return cpfMatch;
      }
    }
    
    return null;
  } catch (error) {
    console.error('[CertificateParser] Error extracting CPF:', error);
    return null;
  }
}

/**
 * Extract CNPJ from ASN.1 otherName structure
 * 
 * @param {object} otherName - ASN.1 otherName value
 * @returns {string|null} CNPJ or null
 */
function extractCNPJFromOtherName(otherName) {
  try {
    // The otherName contains an OID and a value
    // For CNPJ, OID is 2.16.76.1.3.3
    if (typeof otherName === 'string') {
      // Try to parse as ASN.1
      const asn1 = forge.asn1.fromDer(otherName);
      
      // Look for CNPJ OID
      if (asn1.value && Array.isArray(asn1.value)) {
        for (const item of asn1.value) {
          if (item.type === forge.asn1.Type.OID) {
            const oid = forge.asn1.derToOid(item.value);
            if (oid === OID_CNPJ) {
              // Find the value (usually next sibling or child)
              const valueItem = asn1.value.find(v => 
                v.type === forge.asn1.Type.PRINTABLESTRING ||
                v.type === forge.asn1.Type.UTF8 ||
                v.type === forge.asn1.Type.IA5STRING
              );
              if (valueItem) {
                return cleanCNPJ(valueItem.value);
              }
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract CPF from ASN.1 otherName structure
 * 
 * @param {object} otherName - ASN.1 otherName value
 * @returns {string|null} CPF or null
 */
function extractCPFFromOtherName(otherName) {
  try {
    if (typeof otherName === 'string') {
      const asn1 = forge.asn1.fromDer(otherName);
      
      if (asn1.value && Array.isArray(asn1.value)) {
        for (const item of asn1.value) {
          if (item.type === forge.asn1.Type.OID) {
            const oid = forge.asn1.derToOid(item.value);
            if (oid === OID_CPF) {
              const valueItem = asn1.value.find(v => 
                v.type === forge.asn1.Type.PRINTABLESTRING ||
                v.type === forge.asn1.Type.UTF8 ||
                v.type === forge.asn1.Type.IA5STRING
              );
              if (valueItem) {
                return cleanCPF(valueItem.value);
              }
            }
          }
        }
      }
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract CNPJ from a string using regex
 * Matches patterns like:
 * - 12345678000199
 * - 12.345.678/0001-99
 * - CNPJ:12345678000199
 * 
 * @param {string} str - String to search
 * @returns {string|null} CNPJ (digits only) or null
 */
function extractCNPJFromString(str) {
  if (!str) return null;
  
  // Pattern for formatted or unformatted CNPJ
  const patterns = [
    /CNPJ[:\s]*(\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-]?\d{2})/i,
    /(\d{2}\.?\d{3}\.?\d{3}[\/]?\d{4}[-]?\d{2})/,
    /(\d{14})/
  ];
  
  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      const cnpj = cleanCNPJ(match[1]);
      if (cnpj && cnpj.length === 14) {
        return cnpj;
      }
    }
  }
  
  return null;
}

/**
 * Extract CPF from a string using regex
 * 
 * @param {string} str - String to search
 * @returns {string|null} CPF (digits only) or null
 */
function extractCPFFromString(str) {
  if (!str) return null;
  
  const patterns = [
    /CPF[:\s]*(\d{3}\.?\d{3}\.?\d{3}[-]?\d{2})/i,
    /(\d{3}\.?\d{3}\.?\d{3}[-]?\d{2})/,
    /(\d{11})/
  ];
  
  for (const pattern of patterns) {
    const match = str.match(pattern);
    if (match) {
      const cpf = cleanCPF(match[1]);
      if (cpf && cpf.length === 11) {
        return cpf;
      }
    }
  }
  
  return null;
}

/**
 * Remove formatting from CNPJ
 * 
 * @param {string} cnpj - CNPJ string
 * @returns {string} CNPJ with only digits
 */
function cleanCNPJ(cnpj) {
  return (cnpj || '').replace(/\D/g, '');
}

/**
 * Remove formatting from CPF
 * 
 * @param {string} cpf - CPF string
 * @returns {string} CPF with only digits
 */
function cleanCPF(cpf) {
  return (cpf || '').replace(/\D/g, '');
}

/**
 * Verify that a certificate's CNPJ matches a company's CNPJ
 * 
 * @param {string} certificateBase64 - Base64 encoded PFX certificate
 * @param {string} password - Certificate password
 * @param {string} companyCNPJ - Company CNPJ to verify against
 * @returns {Promise<object>} Verification result
 */
export async function verifyCertificateOwnership(certificateBase64, password, companyCNPJ) {
  try {
    // Parse the certificate
    const certInfo = await parseCertificate(certificateBase64, password);
    
    // Clean the company CNPJ for comparison
    const cleanCompanyCNPJ = cleanCNPJ(companyCNPJ);
    
    // Check if certificate is valid
    if (!certInfo.valid) {
      if (certInfo.expired) {
        return {
          verified: false,
          error: 'CERTIFICATE_EXPIRED',
          message: `Certificado expirado em ${new Date(certInfo.validity.notAfter).toLocaleDateString('pt-BR')}. Utilize um certificado válido.`
        };
      }
      if (certInfo.notYetValid) {
        return {
          verified: false,
          error: 'CERTIFICATE_NOT_YET_VALID',
          message: `Certificado ainda não é válido. Válido a partir de ${new Date(certInfo.validity.notBefore).toLocaleDateString('pt-BR')}.`
        };
      }
    }
    
    // Check if certificate has a CNPJ
    if (!certInfo.cnpj) {
      return {
        verified: false,
        error: 'NO_CNPJ_IN_CERTIFICATE',
        message: 'Não foi possível extrair o CNPJ do certificado. Verifique se está usando um certificado e-CNPJ válido.',
        certInfo
      };
    }
    
    // Compare CNPJs
    if (certInfo.cnpj !== cleanCompanyCNPJ) {
      return {
        verified: false,
        error: 'CNPJ_MISMATCH',
        message: `O CNPJ do certificado (${formatCNPJ(certInfo.cnpj)}) não corresponde ao CNPJ da empresa (${formatCNPJ(cleanCompanyCNPJ)}). Utilize o certificado digital correto para esta empresa.`,
        certificateCNPJ: certInfo.cnpj,
        companyCNPJ: cleanCompanyCNPJ,
        certInfo
      };
    }
    
    // Success - CNPJs match
    return {
      verified: true,
      message: 'Certificado verificado com sucesso. O CNPJ do certificado corresponde ao da empresa.',
      certificateCNPJ: certInfo.cnpj,
      companyCNPJ: cleanCompanyCNPJ,
      certInfo,
      expiresAt: certInfo.validity.notAfter
    };
  } catch (error) {
    console.error('[CertificateParser] Verification error:', error);
    return {
      verified: false,
      error: 'VERIFICATION_ERROR',
      message: error.message || 'Erro ao verificar certificado.'
    };
  }
}

/**
 * Format CNPJ for display
 * 
 * @param {string} cnpj - CNPJ digits only
 * @returns {string} Formatted CNPJ (XX.XXX.XXX/XXXX-XX)
 */
function formatCNPJ(cnpj) {
  if (!cnpj || cnpj.length !== 14) return cnpj;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export default {
  parseCertificate,
  verifyCertificateOwnership
};
