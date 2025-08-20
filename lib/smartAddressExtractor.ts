// RotaFácil - Extrator Inteligente de Endereços
// Sistema robusto com heurísticas avançadas e machine learning simples

// Interface para resultado de extração
export interface AddressExtractionResult {
  address: string;
  confidence: number;
  method: string;
  components: AddressComponents;
  suggestions: string[];
  debug: {
    originalText: string;
    candidates: Array<{ text: string; score: number; reason: string }>;
    processingSteps: string[];
  };
}

// Interface para componentes do endereço
export interface AddressComponents {
  streetType?: string;
  streetName?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  fullAddress?: string;
}

// Dados de treinamento para machine learning simples
const ADDRESS_PATTERNS = [
  // Padrões de alta confiança
  {
    pattern: /(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.|Estrada|Est\.|Rodovia|Rod\.)\s+([^,\n]+),?\s*(?:n[º°]?\.?\s*)?(\d+[A-Za-z]?)\s*(?:[-,]\s*([^,\n]+))?\s*[,-]?\s*(\d{5}-?\d{3})?/gi,
    confidence: 0.95,
    weight: 10,
    description: 'Endereço completo com tipo, nome, número e CEP'
  },
  {
    pattern: /([^,\n]+,?\s*\d+[^,\n]*)\s*[,-]?\s*(\d{5}-?\d{3})/gi,
    confidence: 0.90,
    weight: 9,
    description: 'Endereço com CEP específico'
  },
  {
    pattern: /(?:CEP|Cep|cep)\s*:?\s*(\d{5}-?\d{3})/gi,
    confidence: 0.85,
    weight: 8,
    description: 'CEP isolado'
  },
  
  // Padrões de média confiança
  {
    pattern: /(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.)\s+([^,\n]+),?\s*(?:n[º°]?\.?\s*)?(\d+[A-Za-z]?)\s*[,-]?\s*([^,\n]+(?:,\s*[^,\n]+)?)/gi,
    confidence: 0.80,
    weight: 7,
    description: 'Nome da rua + número + bairro/cidade'
  },
  {
    pattern: /([A-Za-zÀ-ÿ\s]{3,}),?\s*(\d+[A-Za-z]?)\s*[,-]?\s*([A-Za-zÀ-ÿ\s]{3,})/gi,
    confidence: 0.70,
    weight: 6,
    description: 'Endereço simples com número'
  },
  
  // Padrões de baixa confiança mas úteis
  {
    pattern: /([^,\n]*\d{5}-?\d{3}[^,\n]*)/gi,
    confidence: 0.60,
    weight: 5,
    description: 'Qualquer linha com CEP'
  },
  {
    pattern: /(?:Bairro|Bairro:)\s*([^,\n,]+)/gi,
    confidence: 0.50,
    weight: 4,
    description: 'Bairro identificado'
  },
  {
    pattern: /(?:Cidade|Cidade:)\s*([^,\n,]+)/gi,
    confidence: 0.50,
    weight: 4,
    description: 'Cidade identificada'
  }
];

// Palavras-chave que indicam endereços
const ADDRESS_KEYWORDS = [
  'rua', 'avenida', 'alameda', 'travessa', 'estrada', 'rodovia',
  'bairro', 'cidade', 'cep', 'endereço', 'endereco', 'local',
  'logradouro', 'número', 'numero', 'complemento', 'andar', 'apto'
];

// Palavras que NÃO são endereços
const NON_ADDRESS_KEYWORDS = [
  'telefone', 'celular', 'whatsapp', 'email', '@', 'www.', 'http',
  'cnpj', 'cpf', 'rg', 'cnh', 'produto', 'preço', 'valor',
  'quantidade', 'peso', 'medida', 'tamanho', 'cor', 'marca',
  'data', 'hora', 'prazo', 'entrega', 'retirada', 'pagamento'
];

// Função calculateSimilarity removida - não utilizada

// Função levenshteinDistance removida - não utilizada

// Função para limpar e normalizar texto
function normalizeText(text: string): string {
  return text
    .replace(/[^\w\sÀ-ÿ.,;:°º-]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, ' ')
    .trim();
}

// Função para extrair componentes do endereço
function extractAddressComponents(text: string): AddressComponents {
  const components: AddressComponents = {};
  
  // Extrair CEP
  const cepMatch = text.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) {
    components.cep = cepMatch[1].replace('-', '');
  }
  
  // Extrair estado
  const stateMatch = text.match(/\b([A-Z]{2})\b/);
  if (stateMatch) {
    components.state = stateMatch[1];
  }
  
  // Extrair número
  const numberMatch = text.match(/\b(\d{1,6})\b/);
  if (numberMatch) {
    components.number = numberMatch[1];
  }
  
  // Identificar tipo de logradouro
  const streetTypes = ['rua', 'avenida', 'alameda', 'travessa', 'estrada', 'rodovia'];
  for (const type of streetTypes) {
    if (text.toLowerCase().includes(type)) {
      components.streetType = type;
      break;
    }
  }
  
  // Extrair cidade (usar lista de cidades conhecidas)
  const cities = ['são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza'];
  for (const city of cities) {
    if (text.toLowerCase().includes(city)) {
      components.city = city;
      break;
    }
  }
  
  return components;
}

// Função para calcular score de endereço usando machine learning simples
function calculateAddressScore(text: string, pattern: { weight: number; description: string }): number {
  let score = pattern.weight;
  const normalizedText = text.toLowerCase();
  
  // Boost para características específicas
  if (/\d{5}-?\d{3}/.test(text)) score += 3; // CEP
  if (/\b[A-Z]{2}\b/.test(text)) score += 2; // Estado
  if (/\d+/.test(text)) score += 2; // Número
  if (/\b(rua|avenida|alameda|travessa|estrada|rodovia)\b/i.test(text)) score += 2; // Tipo de logradouro
  
  // Penalidades para características não desejadas
  if (text.length < 10) score -= 2; // Muito curto
  if (text.length > 200) score -= 3; // Muito longo
  
  // Verificar palavras-chave de endereço
  const addressKeywordCount = ADDRESS_KEYWORDS.filter(keyword => 
    normalizedText.includes(keyword)
  ).length;
  score += addressKeywordCount;
  
  // Penalizar palavras que não são endereços
  const nonAddressKeywordCount = NON_ADDRESS_KEYWORDS.filter(keyword => 
    normalizedText.includes(keyword)
  ).length;
  score -= nonAddressKeywordCount * 2;
  
  // Boost para padrões específicos
  if (pattern.description.includes('completo')) score += 2;
  if (pattern.description.includes('CEP')) score += 1;
  
  return Math.max(0, score);
}

// Função principal de extração inteligente
export async function extractAddressIntelligently(originalText: string): Promise<AddressExtractionResult> {
  const startTime = Date.now();
  const processingSteps: string[] = [];
  const candidates: Array<{ text: string; score: number; reason: string }> = [];
  
  processingSteps.push('Iniciando extração inteligente de endereço');
  
  // 1. Normalizar texto
  const normalizedText = normalizeText(originalText);
  processingSteps.push('Texto normalizado');
  
  // 2. Aplicar padrões conhecidos
  for (const pattern of ADDRESS_PATTERNS) {
    let match;
    while ((match = pattern.pattern.exec(normalizedText)) !== null) {
      const extractedText = match[0].trim();
      
      if (extractedText.length >= 10 && extractedText.length <= 200) {
        const score = calculateAddressScore(extractedText, pattern);
        
        candidates.push({
          text: extractedText,
          score,
          reason: pattern.description
        });
        
        processingSteps.push(`Padrão "${pattern.description}" aplicado - score: ${score}`);
      }
    }
  }
  
  // 3. Análise de linhas individuais (fallback)
  if (candidates.length === 0) {
    processingSteps.push('Nenhum padrão encontrado, analisando linhas individuais');
    
    const lines = originalText.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 5);
    
    for (const line of lines) {
      let lineScore = 0;
      const normalizedLine = line.toLowerCase();
      
      // Verificar características de endereço
      if (/\d+/.test(line)) lineScore += 2;
      if (/[A-Za-zÀ-ÿ]{3,}/.test(line)) lineScore += 1;
      if (/\b(rua|avenida|alameda|travessa|estrada|rodovia)\b/i.test(line)) lineScore += 3;
      if (/\d{5}-?\d{3}/.test(line)) lineScore += 4;
      if (/\b[A-Z]{2}\b/.test(line)) lineScore += 2;
      
      // Penalizar características não desejadas
      if (NON_ADDRESS_KEYWORDS.some(keyword => normalizedLine.includes(keyword))) {
        lineScore -= 3;
      }
      
      if (lineScore >= 3) {
        candidates.push({
          text: line,
          score: lineScore,
          reason: 'Análise de linha individual'
        });
        
        processingSteps.push(`Linha analisada: "${line}" - score: ${lineScore}`);
      }
    }
  }
  
  // 4. Ordenar candidatos por score
  candidates.sort((a, b) => b.score - a.score);
  processingSteps.push(`Candidatos ordenados por score (${candidates.length} encontrados)`);
  
  // 5. Selecionar melhor candidato
  const bestCandidate = candidates[0];
  let finalAddress = '';
  let confidence = 0;
  let method = 'fallback';
  
  if (bestCandidate && bestCandidate.score >= 5) {
    finalAddress = bestCandidate.text;
    confidence = Math.min(0.95, bestCandidate.score / 15); // Normalizar score para 0-1
    method = bestCandidate.reason;
    processingSteps.push(`Melhor candidato selecionado: "${finalAddress}" (score: ${bestCandidate.score})`);
  } else {
    processingSteps.push('Nenhum candidato com score suficiente encontrado');
  }
  
  // 6. Extrair componentes
  const components = extractAddressComponents(finalAddress);
  components.fullAddress = finalAddress;
  
  // 7. Gerar sugestões
  const suggestions: string[] = [];
  if (!components.cep) suggestions.push('Adicione o CEP para melhor precisão');
  if (!components.state) suggestions.push('Inclua o estado (sigla de 2 letras)');
  if (!components.city) suggestions.push('Especifique a cidade');
  if (!components.number) suggestions.push('Inclua o número do endereço');
  
  if (suggestions.length === 0) {
    suggestions.push('Endereço extraído com sucesso');
  }
  
  const processingTime = Date.now() - startTime;
  processingSteps.push(`Processamento concluído em ${processingTime}ms`);
  
  return {
    address: finalAddress,
    confidence,
    method,
    components,
    suggestions,
    debug: {
      originalText,
      candidates,
      processingSteps
    }
  };
}

// Função para validar endereço extraído
export function validateExtractedAddress(address: string): {
  isValid: boolean;
  confidence: number;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  let confidence = 0.5;
  
  if (!address || address.length < 5) {
    issues.push('Endereço muito curto');
    return { isValid: false, confidence: 0, issues, suggestions };
  }
  
  // Verificações básicas
  if (!/\d+/.test(address)) {
    issues.push('Falta número do endereço');
    confidence -= 0.3;
  } else {
    confidence += 0.2;
  }
  
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(address)) {
    issues.push('Falta nome da rua');
    confidence -= 0.3;
  } else {
    confidence += 0.2;
  }
  
  // Verificar CEP
  if (/\d{5}-?\d{3}/.test(address)) {
    confidence += 0.2;
    suggestions.push('CEP encontrado - boa precisão');
  } else {
    suggestions.push('Adicione o CEP para melhor precisão');
  }
  
  // Verificar estado
  if (/\b[A-Z]{2}\b/.test(address)) {
    confidence += 0.1;
  } else {
    suggestions.push('Inclua o estado (sigla de 2 letras)');
  }
  
  // Verificar se não contém palavras proibidas
  const nonAddressKeywords = NON_ADDRESS_KEYWORDS.filter(keyword => 
    address.toLowerCase().includes(keyword)
  );
  
  if (nonAddressKeywords.length > 0) {
    issues.push(`Contém palavras não relacionadas a endereço: ${nonAddressKeywords.join(', ')}`);
    confidence -= 0.2;
  }
  
  const isValid = confidence >= 0.4 && issues.length === 0;
  
  return {
    isValid,
    confidence: Math.max(0, Math.min(1, confidence)),
    issues,
    suggestions
  };
}

// Função para combinar múltiplas tentativas de extração
export function combineAddressExtractions(extractions: Array<{ address: string; confidence: number; method: string }>): {
  bestAddress: string;
  combinedConfidence: number;
  method: string;
} {
  if (extractions.length === 0) {
    return { bestAddress: '', combinedConfidence: 0, method: 'none' };
  }
  
  if (extractions.length === 1) {
    return {
      bestAddress: extractions[0].address,
      combinedConfidence: extractions[0].confidence,
      method: extractions[0].method
    };
  }
  
  // Ordenar por confiança
  const sorted = extractions.sort((a, b) => b.confidence - a.confidence);
  const best = sorted[0];
  
  // Calcular confiança combinada
  let combinedConfidence = best.confidence;
  
  // Se temos múltiplos resultados similares, aumentar confiança
  const similarResults = sorted.filter(extraction => 
    extraction.confidence >= best.confidence * 0.8
  );
  
  if (similarResults.length > 1) {
    combinedConfidence = Math.min(0.95, combinedConfidence + 0.1);
  }
  
  return {
    bestAddress: best.address,
    combinedConfidence,
    method: `${best.method} + ${similarResults.length} confirmações`
  };
}
