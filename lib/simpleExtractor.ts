// RotaFácil - Extrator SIMPLES e EFICAZ
// Foco: funcionar bem, não ser complexo

import { createWorker } from 'tesseract.js';

export interface SimpleExtractionResult {
  addresses: string[];
  confidence: number;
  method: string;
  rawText: string;
}

// OCR SIMPLES - apenas Tesseract básico
export async function extractTextFromImage(imageUrl: string): Promise<string> {
  try {
    console.log('🔍 Iniciando OCR simples...');
    
    const worker = await createWorker('por');
    
    // Configuração MÍNIMA - só o essencial
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÇÉÍÓÚàáâãçéíóú.,-()/\\s',
    });
    
    const { data } = await worker.recognize(imageUrl);
    await worker.terminate();
    
    console.log('✅ OCR concluído');
    return data.text || '';
    
  } catch (error) {
    console.error('❌ Erro no OCR:', error);
    return '';
  }
}

// EXTRAÇÃO SIMPLES - apenas padrões que funcionam
export function extractAddressesFromText(text: string): SimpleExtractionResult {
  console.log('🔍 Extraindo endereços do texto...');
  
  const addresses: string[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 5);
  
  for (const line of lines) {
    // Padrão 1: Linha com CEP (mais confiável)
    const cepMatch = line.match(/\d{5}-?\d{3}/);
    if (cepMatch) {
      addresses.push(line);
      continue;
    }
    
    // Padrão 2: Linha com número (rua + número)
    const numberMatch = line.match(/\b\d{1,5}\b/);
    if (numberMatch && line.length > 10) {
      // Verificar se parece com endereço (tem palavras como rua, av, etc. OU tem vírgulas)
      const looksLikeAddress = /\b(rua|av|avenida|alameda|travessa|estrada|rod|rodovia|r\.|av\.)\b/i.test(line) || 
                              line.includes(',') ||
                              line.split(' ').length >= 3;
      
      if (looksLikeAddress) {
        addresses.push(line);
      }
    }
  }
  
  // Remover duplicatas e limpar
  const uniqueAddresses = [...new Set(addresses)]
    .map(addr => addr.replace(/\s+/g, ' ').trim())
    .filter(addr => addr.length > 8);
  
  console.log(`✅ Encontrados ${uniqueAddresses.length} endereços`);
  
  return {
    addresses: uniqueAddresses,
    confidence: uniqueAddresses.length > 0 ? 0.8 : 0.1,
    method: 'simple-pattern',
    rawText: text
  };
}

// PROCESSAMENTO DE PDF SIMPLES
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('🔍 Processando PDF...');
    
    // Usar PDF.js para extrair texto (mais simples que utilitários externos)
    const arrayBuffer = await file.arrayBuffer();
    
    // Importar PDF.js dinamicamente
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configurar worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
    
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    
    // Extrair texto de todas as páginas
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');
      fullText += pageText + '\n';
    }
    
    console.log('✅ PDF processado');
    return fullText;
    
  } catch (error) {
    console.error('❌ Erro ao processar PDF:', error);
    throw new Error('Erro ao processar PDF. Tente converter para imagem.');
  }
}

// GEOCODIFICAÇÃO SIMPLES - usar a API existente
export async function geocodeAddress(address: string, userLocation?: any): Promise<any> {
  try {
    console.log(`🌍 Geocodificando: ${address}`);
    
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: address,
        userLocation: userLocation,
        forceLocalSearch: true
      })
    });
    
    const result = await response.json();
    
    if (result.success) {
      console.log(`✅ Geocodificado: ${result.provider}`);
      return {
        lat: result.lat,
        lng: result.lng,
        display_name: result.address,
        confidence: result.confidence,
        provider: result.provider
      };
    } else {
      console.log(`❌ Falha na geocodificação: ${result.error}`);
      return null;
    }
    
  } catch (error) {
    console.error('❌ Erro na geocodificação:', error);
    return null;
  }
}

// FUNÇÃO PRINCIPAL - processar imagem ou PDF
export async function processFileSimple(
  file: File, 
  userLocation?: any
): Promise<{
  addresses: Array<{
    original: string;
    geocoded?: any;
    error?: string;
  }>;
  summary: {
    total: number;
    geocoded: number;
    failed: number;
  };
}> {
  try {
    let text = '';
    
    // Extrair texto baseado no tipo de arquivo
    if (file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      text = await extractTextFromImage(imageUrl);
      URL.revokeObjectURL(imageUrl);
    } else if (file.type === 'application/pdf') {
      text = await extractTextFromPDF(file);
    } else {
      throw new Error('Tipo de arquivo não suportado. Use imagem (JPG, PNG) ou PDF.');
    }
    
    // Extrair endereços
    const extraction = extractAddressesFromText(text);
    
    if (extraction.addresses.length === 0) {
      throw new Error('Nenhum endereço encontrado no arquivo.');
    }
    
    // Geocodificar cada endereço
    const results = [];
    let geocoded = 0;
    let failed = 0;
    
    for (const address of extraction.addresses) {
      const geocodedResult = await geocodeAddress(address, userLocation);
      
      if (geocodedResult) {
        results.push({
          original: address,
          geocoded: geocodedResult
        });
        geocoded++;
      } else {
        results.push({
          original: address,
          error: 'Não foi possível geocodificar'
        });
        failed++;
      }
      
      // Pequena pausa para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return {
      addresses: results,
      summary: {
        total: extraction.addresses.length,
        geocoded,
        failed
      }
    };
    
  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    throw error;
  }
}
