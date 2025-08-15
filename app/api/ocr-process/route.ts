import { NextRequest, NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import { getSupabase } from '../../../lib/supabaseClient';
import { enhanceImageForOCR } from '../../../lib/imagePreprocessing';
// Cache está integrado na API de geocodificação via geocodeAddressWithProviders
import { validateBrazilianAddress, correctCommonOCRErrors } from '../../../lib/brazilianAddressValidator';

// Função melhorada para extrair endereço do texto OCR
function extractAddressImproved(text: string): { address: string; confidence: number } {
  // Limpar o texto de forma mais robusta
  const cleanText = text
    .replace(/[^\w\sÀ-ÿ.,;:°º-]/g, ' ') // Remove caracteres especiais exceto acentos e pontuação básica
    .replace(/\s+/g, ' ') // Normaliza espaços
    .replace(/\n+/g, ' ') // Converte quebras de linha em espaços
    .trim();

  console.log('Texto limpo para análise:', cleanText);

  // Padrões melhorados para endereços brasileiros
  const patterns = [
    // Padrão 1: Endereço completo com tipo, nome, número, complemento e CEP
    {
      regex: /(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.|Estrada|Est\.|Rodovia|Rod\.)\s+([^,\n]+),?\s*(?:n[º°]?\.?\s*)?(\d+[A-Za-z]?)\s*(?:[-,]\s*([^,\n]+))?\s*[,-]?\s*(\d{5}-?\d{3})?/gi,
      confidence: 0.9,
      priority: 1
    },
    
    // Padrão 2: Endereço com CEP específico (mais confiável)
    {
      regex: /([^,\n]+,?\s*\d+[^,\n]*)\s*[,-]?\s*(\d{5}-?\d{3})/gi,
      confidence: 0.85,
      priority: 2
    },
    
    // Padrão 3: Nome da rua + número + bairro/cidade
    {
      regex: /(?:Rua|R\.|Av\.|Avenida|Alameda|Al\.|Travessa|Tv\.)\s+([^,\n]+),?\s*(?:n[º°]?\.?\s*)?(\d+[A-Za-z]?)\s*[,-]?\s*([^,\n]+(?:,\s*[^,\n]+)?)/gi,
      confidence: 0.75,
      priority: 3
    },
    
    // Padrão 4: Endereço simples com número
    {
      regex: /([A-Za-zÀ-ÿ\s]{3,}),?\s*(\d+[A-Za-z]?)\s*[,-]?\s*([A-Za-zÀ-ÿ\s]{3,})/gi,
      confidence: 0.6,
      priority: 4
    },
    
    // Padrão 5: Qualquer linha com CEP
    {
      regex: /([^,\n]*\d{5}-?\d{3}[^,\n]*)/gi,
      confidence: 0.7,
      priority: 5
    }
  ];

  const candidates: Array<{ address: string; confidence: number; priority: number }> = [];

  // Aplicar todos os padrões
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.regex.exec(cleanText)) !== null) {
      const extractedAddress = match[0].trim();
      
      // Validações adicionais
      if (extractedAddress.length >= 10 && extractedAddress.length <= 200) {
        candidates.push({
          address: extractedAddress,
          confidence: pattern.confidence,
          priority: pattern.priority
        });
      }
    }
  }

  // Se não encontrou padrões específicos, tentar identificar linhas que parecem endereços
  if (candidates.length === 0) {
    const lines = text.split(/[\n\r]+/).map(line => line.trim()).filter(line => line.length > 5);
    
    for (const line of lines) {
      // Verificar características de endereço
      const hasNumber = /\d+/.test(line);
      const hasLetters = /[A-Za-zÀ-ÿ]{3,}/.test(line);
      const hasCommonWords = /(?:rua|avenida|alameda|travessa|estrada|bairro|cidade)/i.test(line);
      const hasCEP = /\d{5}-?\d{3}/.test(line);
      
      let confidence = 0.3;
      if (hasNumber && hasLetters) confidence += 0.2;
      if (hasCommonWords) confidence += 0.2;
      if (hasCEP) confidence += 0.3;
      
      if (confidence >= 0.4) {
        candidates.push({
          address: line,
          confidence,
          priority: 10
        });
      }
    }
  }

  // Ordenar candidatos por prioridade e confiança
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return b.confidence - a.confidence;
  });

  console.log('Candidatos encontrados:', candidates);

  if (candidates.length > 0) {
    const best = candidates[0];
    return {
      address: normalizeExtractedAddress(best.address),
      confidence: best.confidence
    };
  }

  return { address: '', confidence: 0 };
}

// Função para normalizar endereço extraído
function normalizeExtractedAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .replace(/[,]{2,}/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\b(rua|r\.)\b/gi, 'Rua')
    .replace(/\b(avenida|av\.)\b/gi, 'Avenida')
    .replace(/\b(alameda|al\.)\b/gi, 'Alameda')
    .replace(/\b(travessa|tv\.)\b/gi, 'Travessa')
    .replace(/\b(estrada|est\.)\b/gi, 'Estrada')
    .replace(/\b(rodovia|rod\.)\b/gi, 'Rodovia')
    .replace(/\b(n[º°]?\.?\s*)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Função para extrair CEP do endereço
function extractCEP(address: string): string | null {
  const cepMatch = address.match(/\b(\d{5}-?\d{3})\b/);
  return cepMatch ? cepMatch[1].replace('-', '') : null;
}

// Função para normalizar endereço (para geocodificação)
function normalizeAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .replace(/[,]{2,}/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\b(rua|r\.)\b/gi, 'Rua')
    .replace(/\b(avenida|av\.)\b/gi, 'Avenida')
    .replace(/\b(alameda|al\.)\b/gi, 'Alameda')
    .replace(/\b(travessa|tv\.)\b/gi, 'Travessa')
    .replace(/\b(estrada|est\.)\b/gi, 'Estrada')
    .replace(/\b(rodovia|rod\.)\b/gi, 'Rodovia')
    .replace(/\b(n[º°]?\.?\s*)/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Função para validar coordenadas brasileiras
function isValidBrazilianCoordinate(lat: number, lng: number): boolean {
  return lat >= -33.7 && lat <= 5.3 && lng >= -73.9 && lng <= -28.8;
}

// Provider: ViaCEP + Nominatim
async function geocodeWithViaCEP(cep: string): Promise<{lat: number; lng: number; confidence: number; formatted_address?: string} | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return null;

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const data = await response.json();

    if (data.erro) return null;

    const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}, Brasil`;
    const nominatimResult = await geocodeWithNominatim(fullAddress);

    if (nominatimResult) {
      return {
        lat: nominatimResult.lat,
        lng: nominatimResult.lng,
        confidence: 0.9,
        formatted_address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}, ${cleanCEP}`
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ViaCEP:', error);
    return null;
  }
}

// Provider: Mapbox
async function geocodeWithMapbox(address: string): Promise<{lat: number; lng: number; confidence: number; formatted_address?: string} | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?` +
      `country=BR&types=address,poi&limit=1&language=pt&access_token=${mapboxToken}`
    );

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;

      if (isValidBrazilianCoordinate(lat, lng)) {
        return {
          lat,
          lng,
          confidence: feature.relevance || 0.8,
          formatted_address: feature.place_name
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro Mapbox:', error);
    return null;
  }
}

// Provider: Nominatim  
async function geocodeWithNominatim(address: string): Promise<{lat: number; lng: number; confidence: number; formatted_address?: string} | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${encodeURIComponent(address)}&` +
      `countrycodes=br&limit=1&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'RotaFacil/2.0 (contato@rotafacil.com)',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (isValidBrazilianCoordinate(lat, lng)) {
        let confidence = 0.5;
        if (result.osm_type === 'way') confidence = 0.7;
        if (result.class === 'building') confidence = 0.8;
        if (result.type === 'house') confidence = 0.9;

        return {
          lat,
          lng,
          confidence,
          formatted_address: result.display_name
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro Nominatim:', error);
    return null;
  }
}

// Função melhorada para geocodificar com múltiplos provedores
async function geocodeAddressImproved(address: string): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
  // Importar as funções de geocodificação diretamente para evitar loop
  return await geocodeAddressWithProviders(address);
}

// Implementação direta dos provedores para evitar chamada HTTP circular
async function geocodeAddressWithProviders(address: string): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
  const normalizedAddress = normalizeAddress(address);
  const cep = extractCEP(address);

  console.log(`Geocodificando: "${normalizedAddress}" (CEP: ${cep})`);

  // 1. Se temos CEP, tentar ViaCEP primeiro
  if (cep) {
    const viaCepResult = await geocodeWithViaCEP(cep);
    if (viaCepResult && viaCepResult.confidence >= 0.8) {
      console.log('Geocodificação via ViaCEP+Nominatim bem-sucedida');
      return {
        lat: viaCepResult.lat,
        lng: viaCepResult.lng,
        formatted_address: viaCepResult.formatted_address
      };
    }
  }

  // 2. Tentar Mapbox (se configurado)
  const mapboxResult = await geocodeWithMapbox(normalizedAddress);
  if (mapboxResult && mapboxResult.confidence >= 0.7) {
    console.log('Geocodificação via Mapbox bem-sucedida');
    return {
      lat: mapboxResult.lat,
      lng: mapboxResult.lng,
      formatted_address: mapboxResult.formatted_address
    };
  }

  // 3. Tentar Nominatim
  const nominatimResult = await geocodeWithNominatim(normalizedAddress);
  if (nominatimResult && nominatimResult.confidence >= 0.5) {
    console.log('Geocodificação via Nominatim bem-sucedida');
    return {
      lat: nominatimResult.lat,
      lng: nominatimResult.lng,
      formatted_address: nominatimResult.formatted_address
    };
  }

  // 4. Fallback para método original
  return await geocodeAddressOriginal(normalizedAddress);
}

// Função original de geocodificação (fallback)
async function geocodeAddressOriginal(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address + ', Brasil'
      )}&limit=1&countrycodes=br`,
      {
        headers: {
          'User-Agent': 'RotaFacil/1.0',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );

    const data = await response.json();
    
    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lng = parseFloat(data[0].lon);
      
      // Validar se as coordenadas estão no Brasil
      if (lat >= -33.7 && lat <= 5.3 && lng >= -73.9 && lng <= -28.8) {
        return { lat, lng };
      }
    }
  } catch (error) {
    console.error('Erro na geocodificação original:', error);
  }

  return null;
}

// Função para validar se o endereço extraído faz sentido
function validateExtractedAddress(address: string): boolean {
  if (!address || address.length < 5) return false;
  
  // Verificar se tem pelo menos um número (número da casa/prédio)
  if (!/\d+/.test(address)) return false;
  
  // Verificar se tem pelo menos 3 letras consecutivas (nome da rua)
  if (!/[A-Za-zÀ-ÿ]{3,}/.test(address)) return false;
  
  // Verificar se não é só números ou só letras
  const hasLetters = /[A-Za-zÀ-ÿ]/.test(address);
  const hasNumbers = /\d/.test(address);
  if (!hasLetters || !hasNumbers) return false;
  
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json(
        { success: false, error: 'URL da imagem não fornecida' },
        { status: 400 }
      );
    }

    console.log('Iniciando processamento OCR para:', imageUrl);

    // 1. Melhorar imagem para OCR (melhoria gratuita!)
    const imageEnhancement = await enhanceImageForOCR(imageUrl);
    console.log('Melhorias aplicadas:', imageEnhancement.improvements);
    console.log('Confiança da imagem:', (imageEnhancement.totalConfidence * 100).toFixed(1) + '%');

    // 2. Criar worker do Tesseract com configurações otimizadas
    const worker = await createWorker('por');

    try {
      // 3. Processar imagem melhorada
      const { data: { text, confidence } } = await worker.recognize(imageEnhancement.enhancedUrl);
      
      console.log('Texto extraído pelo OCR:', text);
      console.log('Confiança do OCR:', confidence);

      // 4. Corrigir erros comuns de OCR primeiro
      const correctedText = correctCommonOCRErrors(text);
      console.log('Texto corrigido:', correctedText);

      // 5. Extrair endereço do texto com método melhorado
      const extractionResult = extractAddressImproved(correctedText);
      let address = extractionResult.address;

      // 6. Validar e melhorar endereço brasileiro
      if (address) {
        const brazilianValidation = validateBrazilianAddress(address);
        console.log('Validação brasileira:', brazilianValidation);
        
        if (brazilianValidation.confidence > extractionResult.confidence) {
          // Se a validação brasileira é mais confiante, usar endereço corrigido
          address = brazilianValidation.correctedAddress;
          extractionResult.confidence = brazilianValidation.confidence;
          console.log('Endereço melhorado:', address);
        }
        
        // Se não passou na validação brasileira, tentar novamente com texto original
        if (!brazilianValidation.isValid && extractionResult.confidence < 0.5) {
          const fallbackExtraction = extractAddressImproved(text);
          if (fallbackExtraction.confidence > extractionResult.confidence) {
            address = fallbackExtraction.address;
            extractionResult.confidence = fallbackExtraction.confidence;
            console.log('Usando extração fallback:', address);
          }
        }
      }
      
      console.log('Endereço extraído:', address);
      console.log('Confiança da extração:', extractionResult.confidence);
      
      if (!address || !validateExtractedAddress(address)) {
        return NextResponse.json({
          success: false,
          error: 'Não foi possível extrair um endereço válido da imagem',
          extractedText: text,
          ocrConfidence: confidence,
          extractionConfidence: extractionResult.confidence,
          debug: {
            cleanedText: text.replace(/\s+/g, ' ').trim(),
            extractedAddress: address
          }
        });
      }

      // Geocodificar endereço
      console.log('Iniciando geocodificação para:', address);
      const coordinates = await geocodeAddressImproved(address);

      if (!coordinates) {
        return NextResponse.json({
          success: false,
          error: 'Endereço extraído mas não foi possível geocodificar',
          extractedAddress: address,
          extractedText: text,
          ocrConfidence: confidence,
          extractionConfidence: extractionResult.confidence
        });
      }

      // Salvar no banco de dados
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('stops')
        .insert({
          photo_url: imageUrl,
          address: coordinates.formatted_address || address,
          latitude: coordinates.lat,
          longitude: coordinates.lng,
          extracted_text: text,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar no banco:', error);
        // Continuar mesmo se falhar ao salvar no banco
      }

      console.log('Processamento OCR concluído com sucesso');

      return NextResponse.json({
        success: true,
        address: coordinates.formatted_address || address,
        lat: coordinates.lat,
        lng: coordinates.lng,
        extractedText: text,
        ocrConfidence: confidence,
        extractionConfidence: extractionResult.confidence,
        id: data?.id,
        debug: {
          originalExtracted: address,
          finalAddress: coordinates.formatted_address || address
        }
      });

    } finally {
      await worker.terminate();
    }

  } catch (error) {
    console.error('Erro no processamento OCR:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao processar imagem',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}