// Parser específico para listas ECT dos Correios Brasileiros
// Otimizado para extrair endereços do formato padrão ECT

export interface ECTAddress {
  id: string;
  originalText: string;
  address: string;
  cep?: string;
  confidence: number;
  itemNumber?: string;
  objectCode?: string;
}

// Regex patterns otimizados para formato ECT
const ECT_PATTERNS = {
  // Padrão principal: "Endereço:" seguido do endereço completo
  mainAddress: /Endereço:\s*([^\n\r]+(?:\n\r?[^\n\r]*(?:CEP|Hora):)?)/gi,
  
  // CEP brasileiro (formato: 12345-678 ou 12345678)
  cep: /CEP:?\s*(\d{5}-?\d{3})/gi,
  
  // Número do item (001, 002, etc.)
  itemNumber: /(?:Item|^)\s*(\d{3})\s/gm,
  
  // Código do objeto (letras + números + BR)
  objectCode: /([A-Z]{2}\s*\d{3}\s*\d{3}\s*\d{3}\s*BR)/gi,
  
  // Endereços brasileiros típicos
  streetAddress: /((?:Rua|Av|Avenida|Travessa|Alameda|Praça|Estrada|Rod|Rodovia)[^,\n]+(?:,\s*\d+)?)/gi,
  
  // Bairro e cidade (após hífen ou vírgula)
  neighborhood: /[-,]\s*([^,\n]+(?:,\s*[^,\n]+)?)/gi
};

// Função para limpar e normalizar texto extraído
function cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ') // Múltiplos espaços para um
    .replace(/[^\w\s\-,\.]/g, ' ') // Remove caracteres especiais exceto básicos
    .trim();
}

// Função para calcular confiança baseada em padrões ECT
function calculateConfidence(text: string, hasItemNumber: boolean, hasCEP: boolean): number {
  let confidence = 0.3; // Base
  
  // Boost para padrões ECT
  if (text.toLowerCase().includes('endereço:')) confidence += 0.3;
  if (hasItemNumber) confidence += 0.2;
  if (hasCEP) confidence += 0.3;
  
  // Boost para palavras-chave de endereço
  const addressKeywords = ['rua', 'avenida', 'av', 'travessa', 'alameda', 'praça'];
  const hasAddressKeyword = addressKeywords.some(keyword => 
    text.toLowerCase().includes(keyword)
  );
  if (hasAddressKeyword) confidence += 0.2;
  
  // Penalidade para textos muito curtos ou muito longos
  if (text.length < 10) confidence -= 0.2;
  if (text.length > 200) confidence -= 0.1;
  
  return Math.min(Math.max(confidence, 0), 1);
}

// Função principal para extrair endereços de texto OCR de lista ECT
export function parseECTAddresses(ocrText: string): ECTAddress[] {
  console.log('Iniciando parsing de lista ECT...');
  
  const addresses: ECTAddress[] = [];
  const lines = ocrText.split(/\n|\r\n/);
  
  let currentItem: Partial<ECTAddress> = {};
  let itemCounter = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Detectar início de novo item (número do item)
    const itemMatch = line.match(/(?:Item|^)\s*(\d{3})\s/);
    if (itemMatch) {
      // Salvar item anterior se existir
      if (currentItem.address) {
        addresses.push({
          id: `ect-${itemCounter}`,
          originalText: currentItem.originalText || '',
          address: currentItem.address,
          cep: currentItem.cep,
          confidence: calculateConfidence(
            currentItem.address, 
            !!currentItem.itemNumber, 
            !!currentItem.cep
          ),
          itemNumber: currentItem.itemNumber,
          objectCode: currentItem.objectCode
        });
      }
      
      // Iniciar novo item
      itemCounter++;
      currentItem = {
        itemNumber: itemMatch[1],
        originalText: line
      };
      continue;
    }
    
    // Detectar código do objeto
    const objectMatch = line.match(ECT_PATTERNS.objectCode);
    if (objectMatch && currentItem) {
      currentItem.objectCode = objectMatch[0];
      currentItem.originalText += '\n' + line;
      continue;
    }
    
    // Detectar endereço
    if (line.toLowerCase().includes('endereço:')) {
      const addressMatch = line.match(/endereço:\s*(.+)/i);
      if (addressMatch && currentItem) {
        currentItem.address = cleanText(addressMatch[1]);
        currentItem.originalText += '\n' + line;
        
        // Verificar se há continuação do endereço na próxima linha
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1].trim();
          if (nextLine && !nextLine.toLowerCase().includes('cep:') && 
              !nextLine.toLowerCase().includes('hora:') &&
              !nextLine.match(/^item\s*\d{3}/i)) {
            currentItem.address += ' ' + cleanText(nextLine);
            currentItem.originalText += '\n' + nextLine;
            i++; // Pular próxima linha
          }
        }
      }
      continue;
    }
    
    // Detectar CEP
    const cepMatch = line.match(/CEP:?\s*(\d{5}-?\d{3})/i);
    if (cepMatch && currentItem) {
      currentItem.cep = cepMatch[1];
      currentItem.originalText += '\n' + line;
      continue;
    }
    
    // Adicionar linha ao texto original se faz parte do item atual
    if (currentItem && (line.includes('Destinatário:') || line.includes('Doc.Identidade:') || 
        line.includes('Nome legível') || line.includes('Hora:'))) {
      currentItem.originalText += '\n' + line;
    }
  }
  
  // Salvar último item
  if (currentItem.address) {
    addresses.push({
      id: `ect-${itemCounter}`,
      originalText: currentItem.originalText || '',
      address: currentItem.address,
      cep: currentItem.cep,
      confidence: calculateConfidence(
        currentItem.address, 
        !!currentItem.itemNumber, 
        !!currentItem.cep
      ),
      itemNumber: currentItem.itemNumber,
      objectCode: currentItem.objectCode
    });
  }
  
  console.log(`Parsing ECT concluído: ${addresses.length} endereços encontrados`);
  
  return addresses;
}

// Função para validar se o texto parece ser uma lista ECT
export function isECTList(ocrText: string): boolean {
  const ectIndicators = [
    /ECT\s+LISTA\s+DE\s+OBJETOS\s+ENTREGUES/i,
    /Lista\s*:\s*OEC\s*\d+/i,
    /Unidade\s*:\s*\d+\s*-\s*CDD/i,
    /Carteiro\s*:\s*\d+/i,
    /Endereço:\s*[^\n]+/i
  ];
  
  return ectIndicators.some(pattern => pattern.test(ocrText));
}

// Função para extrair metadados da lista ECT
export function extractECTMetadata(ocrText: string) {
  const metadata: Record<string, string> = {};
  
  // Lista OEC
  const listMatch = ocrText.match(/Lista\s*:\s*(OEC\s*\d+)/i);
  if (listMatch) metadata.lista = listMatch[1];
  
  // Unidade
  const unitMatch = ocrText.match(/Unidade\s*:\s*(\d+\s*-\s*[^,\n]+)/i);
  if (unitMatch) metadata.unidade = unitMatch[1];
  
  // Distrito
  const districtMatch = ocrText.match(/Distrito\s*:\s*(\d+)/i);
  if (districtMatch) metadata.distrito = districtMatch[1];
  
  // Carteiro
  const postmanMatch = ocrText.match(/Carteiro\s*:\s*(\d+)/i);
  if (postmanMatch) metadata.carteiro = postmanMatch[1];
  
  // Data
  const dateMatch = ocrText.match(/(\d{2}\/\d{2}\/\d{4})/);
  if (dateMatch) metadata.data = dateMatch[1];
  
  return metadata;
}
