// RotaFácil - Validador de Endereços Brasileiros
// Melhorias gratuitas para aumentar precisão na identificação de endereços

// Estados brasileiros
export const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

// Principais cidades brasileiras (top 100)
export const MAJOR_BRAZILIAN_CITIES = [
  'são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza',
  'belo horizonte', 'manaus', 'curitiba', 'recife', 'goiânia',
  'belém', 'porto alegre', 'guarulhos', 'campinas', 'são luís',
  'são gonçalo', 'maceió', 'duque de caxias', 'natal', 'teresina',
  'campo grande', 'nova iguaçu', 'são bernardo do campo', 'joão pessoa',
  'santo andré', 'osasco', 'jaboatão dos guararapes', 'contagem',
  'são josé dos campos', 'uberlândia', 'sorocaba', 'aracaju',
  'feira de santana', 'cuiabá', 'joinville', 'juiz de fora',
  'londrina', 'aparecida de goiânia', 'ananindeua', 'porto velho',
  'serra', 'niterói', 'caxias do sul', 'macapá', 'mogi das cruzes',
  'campos dos goytacazes', 'florianópolis', 'vila velha', 'são joão de meriti',
  'santos', 'ribeirão preto', 'carapicuíba', 'olinda', 'diadema',
  'jundiaí', 'piracicaba', 'cariacica', 'bauru', 'são vicente',
  'pelotas', 'canoas', 'franca', 'maringá', 'anápolis',
  'itaquaquecetuba', 'são josé do rio preto', 'santos', 'mauá',
  'são caetano do sul', 'várzea grande', 'petrolina', 'praia grande',
  'ipatinga', 'santarém', 'suzano', 'volta redonda', 'taboão da serra',
  'caruaru', 'uberaba', 'imperatriz', 'presidente prudente'
];

// Tipos de logradouros brasileiros
export const BRAZILIAN_STREET_TYPES = [
  'rua', 'r.', 'r', 'avenida', 'av.', 'av', 'alameda', 'al.', 'al',
  'travessa', 'tv.', 'tv', 'estrada', 'est.', 'est', 'rodovia', 'rod.', 'rod',
  'praça', 'pça', 'largo', 'vila', 'jardim', 'parque', 'conjunto',
  'quadra', 'setor', 'loteamento', 'distrito', 'fazenda', 'sítio',
  'chácara', 'lote', 'gleba', 'área', 'zona', 'região'
];

// Bairros comuns em grandes cidades
export const COMMON_NEIGHBORHOODS = [
  'centro', 'vila nova', 'jardim', 'parque', 'conjunto', 'cidade nova',
  'bela vista', 'boa vista', 'santa maria', 'são josé', 'são joão',
  'nossa senhora', 'santo antônio', 'santa cruz', 'vila maria',
  'campo grande', 'jardim américa', 'vila madalena', 'copacabana',
  'ipanema', 'leblon', 'tijuca', 'botafogo', 'flamengo', 'laranjeiras'
];

// Função para validar CEP brasileiro
export function isValidBrazilianCEP(cep: string): boolean {
  const cleanCEP = cep.replace(/\D/g, '');
  return cleanCEP.length === 8 && /^\d{8}$/.test(cleanCEP);
}

// Função para validar se estado existe
export function isValidBrazilianState(state: string): boolean {
  return BRAZILIAN_STATES.includes(state.toUpperCase());
}

// Função para validar se cidade é conhecida
export function isKnownBrazilianCity(city: string): boolean {
  const normalizedCity = city.toLowerCase().trim();
  return MAJOR_BRAZILIAN_CITIES.includes(normalizedCity);
}

// Função para identificar tipo de logradouro
export function identifyStreetType(text: string): string | null {
  const normalizedText = text.toLowerCase().trim();
  
  for (const streetType of BRAZILIAN_STREET_TYPES) {
    if (normalizedText.includes(streetType)) {
      return streetType;
    }
  }
  
  return null;
}

// Função para extrair componentes do endereço
export interface AddressComponents {
  streetType?: string;
  streetName?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  cep?: string;
  confidence: number;
}

export function parseAddressComponents(address: string): AddressComponents {
  let confidence = 0.1;
  const components: AddressComponents = { confidence };
  
  // Normalizar endereço
  const normalized = address.toLowerCase().trim();
  
  // 1. Extrair CEP
  const cepMatch = address.match(/\b(\d{5}-?\d{3})\b/);
  if (cepMatch) {
    components.cep = cepMatch[1].replace('-', '');
    confidence += 0.3;
    
    if (isValidBrazilianCEP(components.cep)) {
      confidence += 0.2;
    }
  }
  
  // 2. Extrair estado
  const stateMatch = address.match(/\b([A-Z]{2})\b/);
  if (stateMatch && isValidBrazilianState(stateMatch[1])) {
    components.state = stateMatch[1];
    confidence += 0.2;
  }
  
  // 3. Identificar tipo de logradouro
  const streetType = identifyStreetType(normalized);
  if (streetType) {
    components.streetType = streetType;
    confidence += 0.1;
  }
  
  // 4. Extrair número
  const numberMatch = address.match(/\b(\d{1,6})\b/);
  if (numberMatch) {
    components.number = numberMatch[1];
    confidence += 0.1;
  }
  
  // 5. Verificar se há cidade conhecida
  for (const city of MAJOR_BRAZILIAN_CITIES) {
    if (normalized.includes(city)) {
      components.city = city;
      confidence += 0.3;
      break;
    }
  }
  
  // 6. Verificar bairro comum
  for (const neighborhood of COMMON_NEIGHBORHOODS) {
    if (normalized.includes(neighborhood)) {
      components.neighborhood = neighborhood;
      confidence += 0.1;
      break;
    }
  }
  
  components.confidence = Math.min(confidence, 1.0);
  return components;
}

// Função para validar se texto parece ser endereço brasileiro
export function isLikelyBrazilianAddress(text: string): {
  isLikely: boolean;
  confidence: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let confidence = 0;
  
  if (!text || text.length < 5) {
    return { isLikely: false, confidence: 0, reasons: ['Texto muito curto'] };
  }
  
  const components = parseAddressComponents(text);
  
  // Verificações básicas
  if (components.cep) {
    reasons.push('CEP encontrado');
    confidence += 0.3;
    
    if (isValidBrazilianCEP(components.cep)) {
      reasons.push('CEP válido');
      confidence += 0.2;
    }
  }
  
  if (components.state) {
    reasons.push('Estado brasileiro encontrado');
    confidence += 0.2;
  }
  
  if (components.streetType) {
    reasons.push('Tipo de logradouro brasileiro');
    confidence += 0.1;
  }
  
  if (components.number) {
    reasons.push('Número de endereço encontrado');
    confidence += 0.1;
  }
  
  if (components.city) {
    reasons.push('Cidade brasileira conhecida');
    confidence += 0.3;
  }
  
  // Verificar padrões que NÃO são endereços
  const blacklist = [
    'telefone', 'celular', 'whatsapp', 'email', '@', 'www.', 'http',
    'cnpj', 'cpf', 'rg', 'cnh', 'produto', 'preço', 'valor',
    'quantidade', 'peso', 'medida', 'tamanho', 'cor', 'marca'
  ];
  
  const normalized = text.toLowerCase();
  for (const blacklisted of blacklist) {
    if (normalized.includes(blacklisted)) {
      reasons.push(`Contém "${blacklisted}" - não é endereço`);
      confidence = Math.max(0, confidence - 0.3);
    }
  }
  
  // Confiança mínima para ser considerado endereço
  const isLikely = confidence >= 0.4;
  
  return {
    isLikely,
    confidence: Math.min(confidence, 1.0),
    reasons
  };
}

// Função para corrigir erros comuns do OCR em endereços
export function correctCommonOCRErrors(text: string): string {
  return text
    // Correções de caracteres similares
    .replace(/[0O]/g, match => {
      // Se está no meio de números, provavelmente é 0
      const before = text[text.indexOf(match) - 1];
      const after = text[text.indexOf(match) + 1];
      if (/\d/.test(before) || /\d/.test(after)) {
        return '0';
      }
      return 'O';
    })
    .replace(/[1I|l]/g, match => {
      const context = text.substring(Math.max(0, text.indexOf(match) - 2), text.indexOf(match) + 3);
      if (/\d/.test(context)) {
        return '1';
      }
      return match;
    })
    // Correções específicas de endereços
    .replace(/\bPua\b/gi, 'Rua')
    .replace(/\bPv\.\b/gi, 'Av.')
    .replace(/\bAvenida\b/gi, 'Avenida')
    .replace(/\bPlameda\b/gi, 'Alameda')
    .replace(/\bTravessa\b/gi, 'Travessa')
    // Correções de CEP
    .replace(/(\d{2})[.,](\d{3})[.,](\d{3})/g, '$1$2-$3')
    .replace(/(\d{5})(\d{3})/g, '$1-$2')
    // Normalizar espaços
    .replace(/\s+/g, ' ')
    .trim();
}

// Função para sugerir melhorias no endereço
export function suggestAddressImprovements(address: string): {
  correctedAddress: string;
  suggestions: string[];
  confidence: number;
} {
  const suggestions: string[] = [];
  let correctedAddress = correctCommonOCRErrors(address);
  
  const validation = isLikelyBrazilianAddress(correctedAddress);
  const components = parseAddressComponents(correctedAddress);
  
  // Sugestões baseadas no que está faltando
  if (!components.cep) {
    suggestions.push('Adicione o CEP para melhor precisão');
  }
  
  if (!components.state) {
    suggestions.push('Inclua o estado (sigla de 2 letras)');
  }
  
  if (!components.city) {
    suggestions.push('Especifique a cidade');
  }
  
  if (!components.number) {
    suggestions.push('Inclua o número do endereço');
  }
  
  // Normalizar formato
  if (components.streetType && components.cep) {
    const parts = [];
    
    if (components.streetType && components.streetName) {
      parts.push(`${components.streetType} ${components.streetName}`);
    }
    
    if (components.number) {
      parts.push(components.number);
    }
    
    if (components.neighborhood) {
      parts.push(components.neighborhood);
    }
    
    if (components.city) {
      parts.push(components.city);
    }
    
    if (components.state) {
      parts.push(components.state);
    }
    
    if (components.cep) {
      parts.push(components.cep);
    }
    
    if (parts.length > 2) {
      correctedAddress = parts.join(', ');
      suggestions.push('Endereço formatado automaticamente');
    }
  }
  
  return {
    correctedAddress,
    suggestions,
    confidence: validation.confidence
  };
}

// Função principal para validação completa
export function validateBrazilianAddress(address: string): {
  isValid: boolean;
  confidence: number;
  components: AddressComponents;
  suggestions: string[];
  correctedAddress: string;
  reasons: string[];
} {
  const validation = isLikelyBrazilianAddress(address);
  const components = parseAddressComponents(address);
  const improvements = suggestAddressImprovements(address);
  
  return {
    isValid: validation.isLikely,
    confidence: validation.confidence,
    components,
    suggestions: improvements.suggestions,
    correctedAddress: improvements.correctedAddress,
    reasons: validation.reasons
  };
}