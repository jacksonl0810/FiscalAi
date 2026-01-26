/**
 * Service Code Lookup Service
 * Maps service descriptions to CNAE/Service codes for NFS-e
 * 
 * Brazilian NFS-e requires proper service codes based on LC 116/2003
 * This service helps auto-detect the correct code from service descriptions
 */

// Common service codes based on LC 116/2003 (Lei Complementar 116)
// Format: code -> { description, keywords, defaultIssRate }
const SERVICE_CODES = {
  // 1 - Informática e assemelhados
  '0101': {
    description: 'Análise e desenvolvimento de sistemas',
    keywords: ['sistema', 'software', 'desenvolvimento', 'aplicativo', 'app', 'programação', 'programador'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0102': {
    description: 'Programação',
    keywords: ['programação', 'código', 'coding', 'programador', 'desenvolvedor'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0103': {
    description: 'Processamento de dados',
    keywords: ['dados', 'data', 'processamento', 'entrada de dados', 'digitação'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0104': {
    description: 'Elaboração de programas de computadores',
    keywords: ['programa', 'software', 'sistema', 'aplicação'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0105': {
    description: 'Licenciamento de programas de computação',
    keywords: ['licença', 'software', 'licenciamento', 'saas'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0106': {
    description: 'Assessoria e consultoria em informática',
    keywords: ['consultoria ti', 'assessoria tecnologia', 'consultoria software', 'consultoria informática'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0107': {
    description: 'Suporte técnico em informática',
    keywords: ['suporte', 'help desk', 'helpdesk', 'manutenção sistema', 'suporte técnico'],
    category: 'Informática',
    defaultIssRate: 2
  },
  '0108': {
    description: 'Planejamento, confecção, manutenção e atualização de sites',
    keywords: ['site', 'website', 'web', 'página', 'internet', 'landing page', 'ecommerce'],
    category: 'Informática',
    defaultIssRate: 2
  },

  // 7 - Engenharia e arquitetura
  '0701': {
    description: 'Engenharia, agronomia, agrimensura, arquitetura',
    keywords: ['engenharia', 'arquitetura', 'projeto', 'agronomia', 'laudo'],
    category: 'Engenharia',
    defaultIssRate: 5
  },
  '0702': {
    description: 'Execução de obras e construção civil',
    keywords: ['construção', 'obra', 'reforma', 'edificação'],
    category: 'Engenharia',
    defaultIssRate: 5
  },

  // 8 - Educação e treinamento
  '0801': {
    description: 'Ensino regular pré-escolar, fundamental, médio e superior',
    keywords: ['escola', 'ensino', 'educação', 'curso regular'],
    category: 'Educação',
    defaultIssRate: 2
  },
  '0802': {
    description: 'Instrução, treinamento, orientação pedagógica e educacional',
    keywords: ['treinamento', 'capacitação', 'curso', 'workshop', 'mentoria', 'coaching'],
    category: 'Educação',
    defaultIssRate: 2
  },
  '0803': {
    description: 'Orientação de trabalhos escolares',
    keywords: ['tutoria', 'aulas particulares', 'reforço escolar'],
    category: 'Educação',
    defaultIssRate: 2
  },

  // 10 - Intermediação e corretagem
  '1002': {
    description: 'Agenciamento, corretagem ou intermediação de câmbio',
    keywords: ['câmbio', 'corretagem', 'intermediação financeira'],
    category: 'Intermediação',
    defaultIssRate: 5
  },
  '1005': {
    description: 'Agenciamento, corretagem ou intermediação de bens móveis ou imóveis',
    keywords: ['imobiliária', 'corretor', 'corretagem imóveis', 'venda imóveis'],
    category: 'Intermediação',
    defaultIssRate: 5
  },

  // 14 - Saúde
  '1401': {
    description: 'Medicina e biomedicina',
    keywords: ['médico', 'medicina', 'clínica', 'consulta médica', 'biomedicina'],
    category: 'Saúde',
    defaultIssRate: 2
  },
  '1402': {
    description: 'Análises clínicas, patologia, eletricidade médica',
    keywords: ['laboratório', 'exame', 'análise clínica', 'patologia'],
    category: 'Saúde',
    defaultIssRate: 2
  },
  '1404': {
    description: 'Psicologia e psicanálise',
    keywords: ['psicólogo', 'psicologia', 'psicanálise', 'terapia', 'psicoterapia'],
    category: 'Saúde',
    defaultIssRate: 2
  },
  '1405': {
    description: 'Terapias de qualquer espécie',
    keywords: ['fisioterapia', 'fonoaudiologia', 'terapia ocupacional', 'nutrição'],
    category: 'Saúde',
    defaultIssRate: 2
  },
  '1406': {
    description: 'Odontologia',
    keywords: ['dentista', 'odontologia', 'odontológico', 'dental'],
    category: 'Saúde',
    defaultIssRate: 2
  },

  // 17 - Assessoria e consultoria
  '1701': {
    description: 'Assessoria ou consultoria de qualquer natureza',
    keywords: ['consultoria', 'assessoria', 'consultora', 'consultor', 'advisory'],
    category: 'Consultoria',
    defaultIssRate: 5
  },
  '1702': {
    description: 'Análise, exame, pesquisa, coleta, compilação de dados',
    keywords: ['pesquisa', 'análise de dados', 'estatística', 'levantamento'],
    category: 'Consultoria',
    defaultIssRate: 5
  },
  '1703': {
    description: 'Planejamento, coordenação, programação ou organização técnica',
    keywords: ['planejamento', 'organização', 'gestão', 'gerenciamento de projetos'],
    category: 'Consultoria',
    defaultIssRate: 5
  },
  '1704': {
    description: 'Recrutamento, seleção e colocação de mão de obra',
    keywords: ['recrutamento', 'rh', 'recursos humanos', 'seleção', 'headhunter'],
    category: 'Consultoria',
    defaultIssRate: 5
  },
  '1705': {
    description: 'Contabilidade, auditoria, consultoria contábil',
    keywords: ['contabilidade', 'contador', 'auditoria', 'fiscal', 'tributário'],
    category: 'Consultoria',
    defaultIssRate: 5
  },

  // 17 - Marketing e design
  '1706': {
    description: 'Marketing, design, identidade visual',
    keywords: ['marketing', 'design', 'branding', 'identidade visual', 'logo', 'marca'],
    category: 'Marketing',
    defaultIssRate: 5
  },
  '1707': {
    description: 'Publicidade e propaganda',
    keywords: ['publicidade', 'propaganda', 'anúncio', 'campanha', 'mídia'],
    category: 'Marketing',
    defaultIssRate: 5
  },

  // 25 - Serviços de Construção Civil
  '2501': {
    description: 'Reparação e conservação de edifícios',
    keywords: ['manutenção predial', 'conservação', 'reparos', 'pintura'],
    category: 'Construção',
    defaultIssRate: 5
  },

  // 35 - Fotografia
  '3501': {
    description: 'Serviços de fotografia',
    keywords: ['fotografia', 'foto', 'fotógrafo', 'ensaio fotográfico'],
    category: 'Fotografia',
    defaultIssRate: 5
  },

  // 36 - Audiovisual
  '3601': {
    description: 'Serviços de gravação de vídeo',
    keywords: ['vídeo', 'filmagem', 'produção audiovisual', 'edição de vídeo'],
    category: 'Audiovisual',
    defaultIssRate: 5
  },

  // Default catch-all
  '1799': {
    description: 'Outros serviços de apoio administrativo',
    keywords: ['serviço', 'prestação de serviço'],
    category: 'Outros',
    defaultIssRate: 5
  }
};

/**
 * Detect service code from service description
 * 
 * @param {string} description - Service description
 * @returns {object} Detected service code info
 */
export function detectServiceCode(description) {
  if (!description) {
    return {
      code: '1799',
      ...SERVICE_CODES['1799'],
      confidence: 'low',
      reason: 'No description provided'
    };
  }

  const normalizedDescription = description.toLowerCase().trim();
  const words = normalizedDescription.split(/\s+/);
  
  let bestMatch = null;
  let bestScore = 0;

  for (const [code, info] of Object.entries(SERVICE_CODES)) {
    let score = 0;
    let matchedKeywords = [];

    for (const keyword of info.keywords) {
      if (normalizedDescription.includes(keyword.toLowerCase())) {
        // Exact phrase match gets higher score
        score += keyword.split(' ').length * 2;
        matchedKeywords.push(keyword);
      } else {
        // Check for partial word matches
        const keywordWords = keyword.toLowerCase().split(' ');
        for (const kw of keywordWords) {
          if (words.some(w => w.includes(kw) || kw.includes(w))) {
            score += 1;
            matchedKeywords.push(kw);
          }
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = {
        code,
        ...info,
        matchedKeywords,
        score
      };
    }
  }

  // Determine confidence based on score
  let confidence = 'low';
  if (bestScore >= 6) {
    confidence = 'high';
  } else if (bestScore >= 3) {
    confidence = 'medium';
  }

  if (bestMatch && bestScore > 0) {
    return {
      ...bestMatch,
      confidence,
      reason: `Matched keywords: ${bestMatch.matchedKeywords.join(', ')}`
    };
  }

  // Return default if no match
  return {
    code: '1799',
    ...SERVICE_CODES['1799'],
    confidence: 'low',
    reason: 'No matching keywords found, using default code'
  };
}

/**
 * Get all service codes
 * @returns {object} All service codes
 */
export function getAllServiceCodes() {
  return SERVICE_CODES;
}

/**
 * Get service code info by code
 * @param {string} code - Service code
 * @returns {object|null} Service code info or null
 */
export function getServiceCodeInfo(code) {
  return SERVICE_CODES[code] || null;
}

/**
 * Suggest service codes based on description
 * @param {string} description - Service description
 * @param {number} limit - Max number of suggestions
 * @returns {Array} Array of suggested service codes with scores
 */
export function suggestServiceCodes(description, limit = 5) {
  if (!description) {
    return [];
  }

  const normalizedDescription = description.toLowerCase().trim();
  const suggestions = [];

  for (const [code, info] of Object.entries(SERVICE_CODES)) {
    let score = 0;
    
    for (const keyword of info.keywords) {
      if (normalizedDescription.includes(keyword.toLowerCase())) {
        score += keyword.split(' ').length * 2;
      }
    }

    if (score > 0) {
      suggestions.push({
        code,
        description: info.description,
        category: info.category,
        score,
        defaultIssRate: info.defaultIssRate
      });
    }
  }

  // Sort by score descending and limit results
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Get categories of service codes
 * @returns {Array} Array of unique categories
 */
export function getServiceCategories() {
  const categories = new Set();
  for (const info of Object.values(SERVICE_CODES)) {
    categories.add(info.category);
  }
  return Array.from(categories).sort();
}

/**
 * Get service codes by category
 * @param {string} category - Category name
 * @returns {Array} Array of service codes in that category
 */
export function getServiceCodesByCategory(category) {
  const codes = [];
  for (const [code, info] of Object.entries(SERVICE_CODES)) {
    if (info.category === category) {
      codes.push({
        code,
        ...info
      });
    }
  }
  return codes;
}
