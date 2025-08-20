import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '../../../lib/supabaseClient';
import { enhanceImageForOCR } from '../../../lib/imagePreprocessing';
import { executeOCRWithFallback } from '../../../lib/ocrFallbackSystem';
import { extractAddressIntelligently, validateExtractedAddress } from '../../../lib/smartAddressExtractor';
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
async function geocodeWithMapbox(address: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<{lat: number; lng: number; confidence: number; formatted_address?: string} | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) return null;

  try {
    // Construir query com contexto de localização se disponível
    let query = address;
    if (userLocation?.city) {
      query = `${address}, ${userLocation.city}`;
      if (userLocation.state) {
        query += `, ${userLocation.state}`;
      }
    }
    
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
      `country=BR&types=address,poi&limit=5&language=pt&access_token=${mapboxToken}`
    );

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // Filtrar e ordenar resultados por relevância e proximidade
      const features = data.features
        .filter((feature: any) => {
          const [lng, lat] = feature.center;
          return isValidBrazilianCoordinate(lat, lng);
        })
        .map((feature: any) => {
          const [lng, lat] = feature.center;
          let confidence = feature.relevance || 0.8;
          
          // Aplicar boost para resultados da mesma cidade
          if (userLocation?.city) {
            const featureContext = feature.context || [];
            const featureCity = featureContext.find((ctx: any) => 
              ctx.id.startsWith('place') || ctx.id.startsWith('locality')
            );
            
            if (featureCity && featureCity.text.toLowerCase() === userLocation.city.toLowerCase()) {
              confidence = Math.min(1.0, confidence + 0.3); // Boost de 30% para mesma cidade
              console.log(`Mapbox OCR: boost aplicado para ${featureCity.text}`);
            }
          }
          
          return {
            feature,
            lat,
            lng,
            confidence,
            formatted_address: feature.place_name
          };
        })
        .sort((a, b) => b.confidence - a.confidence);

      if (features.length > 0) {
        const best = features[0];
        return {
          lat: best.lat,
          lng: best.lng,
          confidence: best.confidence,
          formatted_address: best.formatted_address
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
async function geocodeAddressImproved(address: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
  // Importar as funções de geocodificação diretamente para evitar loop
  return await geocodeAddressWithProviders(address, userLocation);
}

// Implementação direta dos provedores para evitar chamada HTTP circular
async function geocodeAddressWithProviders(address: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<{ lat: number; lng: number; formatted_address?: string } | null> {
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
    const { imageUrl, userLocation } = await request.json();

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

          // 2. Executar OCR com sistema de fallback robusto
      console.log('Executando OCR com sistema de fallback...');
      const ocrResult = await executeOCRWithFallback(imageEnhancement.enhancedUrl, 0.3);
      
      console.log('Resultado do OCR:', {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        provider: ocrResult.provider,
        processingTime: ocrResult.processingTime,
        improvements: ocrResult.improvements
      });

      // 3. Corrigir erros comuns de OCR
      const correctedText = correctCommonOCRErrors(ocrResult.text);
      console.log('Texto corrigido:', correctedText);

      // 4. Extrair endereço usando sistema inteligente
      console.log('Extraindo endereço com sistema inteligente...');
      const extractionResult = await extractAddressIntelligently(correctedText);
      let address = extractionResult.address;

              // 5. Validar e melhorar endereço brasileiro
        if (address) {
          const brazilianValidation = validateBrazilianAddress(address);
          console.log('Validação brasileira:', brazilianValidation);
          
          if (brazilianValidation.confidence > extractionResult.confidence) {
            // Se a validação brasileira é mais confiante, usar endereço corrigido
            address = brazilianValidation.correctedAddress;
            extractionResult.confidence = brazilianValidation.confidence;
            console.log('Endereço melhorado:', address);
          }
          
          // Validação adicional com sistema inteligente
          const smartValidation = validateExtractedAddress(address);
          console.log('Validação inteligente:', smartValidation);
          
          if (smartValidation.confidence > extractionResult.confidence) {
            extractionResult.confidence = smartValidation.confidence;
            console.log('Confiança atualizada pela validação inteligente');
          }
        }
      
      console.log('Endereço extraído:', address);
      console.log('Confiança da extração:', extractionResult.confidence);
      
      if (!address || !validateExtractedAddress(address).isValid) {
        return NextResponse.json({
          success: false,
          error: 'Não foi possível extrair um endereço válido da imagem',
          extractedText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractionResult.confidence,
          extractionMethod: extractionResult.method,
          suggestions: extractionResult.suggestions,
          debug: {
            originalText: ocrResult.text,
            cleanedText: correctedText,
            extractedAddress: address,
            processingSteps: extractionResult.debug.processingSteps,
            candidates: extractionResult.debug.candidates
          }
        });
      }

      // Geocodificar endereço com contexto de localização
      console.log('Iniciando geocodificação para:', address);
      const coordinates = await geocodeAddressImproved(address, userLocation);

      if (!coordinates) {
        return NextResponse.json({
          success: false,
          error: 'Endereço extraído mas não foi possível geocodificar',
          extractedAddress: address,
          extractedText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractionResult.confidence,
          extractionMethod: extractionResult.method,
          suggestions: extractionResult.suggestions
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
        extractedText: ocrResult.text,
        ocrConfidence: ocrResult.confidence,
        extractionConfidence: extractionResult.confidence,
        extractionMethod: extractionResult.method,
        suggestions: extractionResult.suggestions,
        id: data?.id,
        debug: {
          originalExtracted: address,
          finalAddress: coordinates.formatted_address || address,
          processingSteps: extractionResult.debug.processingSteps,
          candidates: extractionResult.debug.candidates
        }
      });

    // Worker é gerenciado pelo sistema de fallback

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