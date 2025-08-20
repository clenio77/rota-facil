import { NextRequest, NextResponse } from 'next/server';
import { executeOCRWithFallback } from '../../../lib/ocrFallbackSystem';
import { extractAddressIntelligently, validateExtractedAddress } from '../../../lib/smartAddressExtractor';
import { validateBrazilianAddress, correctCommonOCRErrors } from '../../../lib/brazilianAddressValidator';
import { getSupabase } from '../../../lib/supabaseClient';
import { enhanceImageForOCR } from '../../../lib/imagePreprocessing';

// Interfaces para dados do Mapbox
interface MapboxFeature {
  center: [number, number];
  relevance: number;
  place_name: string;
  context?: Array<{
    id: string;
    text: string;
  }>;
}

interface MapboxFeatureResult {
  feature: MapboxFeature;
  lat: number;
  lng: number;
  confidence: number;
  formatted_address: string;
}

// Função normalizeExtractedAddress removida - não utilizada

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
        .filter((feature: MapboxFeature) => {
          const [lng, lat] = feature.center;
          return isValidBrazilianCoordinate(lat, lng);
        })
        .map((feature: MapboxFeature): MapboxFeatureResult => {
          const [lng, lat] = feature.center;
          let confidence = feature.relevance || 0.8;
          
          // Aplicar boost para resultados da mesma cidade
          if (userLocation?.city) {
            const featureContext = feature.context || [];
            const featureCity = featureContext.find((ctx) => 
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
        .sort((a: MapboxFeatureResult, b: MapboxFeatureResult) => b.confidence - a.confidence);

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
async function geocodeWithNominatim(address: string, userLocation?: { city?: string; state?: string }): Promise<{lat: number; lng: number; confidence: number; formatted_address?: string} | null> {
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

        // Aplicar filtro de cidade se disponível
        if (userLocation?.city) {
          const resultAddress = result.display_name.toLowerCase();
          const userCity = userLocation.city.toLowerCase();
          
          if (resultAddress.includes(userCity)) {
            confidence = Math.min(1.0, confidence + 0.2); // Boost para mesma cidade
            console.log(`Nominatim OCR: boost aplicado para cidade ${userCity}`);
          } else {
            // Penalizar resultados de outras cidades
            confidence = Math.max(0.1, confidence - 0.3);
            console.log(`Nominatim OCR: penalização para cidade diferente`);
          }
        }

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
  // Usar userLocation para melhorar geocodificação
  console.log(`Geocodificando endereço: ${address} com localização:`, userLocation);
  
  // 1. Se temos CEP, tentar ViaCEP primeiro
  if (extractCEP(address)) {
    const viaCepResult = await geocodeWithViaCEP(extractCEP(address)!);
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
  const mapboxResult = await geocodeWithMapbox(normalizeAddress(address), userLocation);
  if (mapboxResult && mapboxResult.confidence >= 0.7) {
    console.log('Geocodificação via Mapbox bem-sucedida');
    return {
      lat: mapboxResult.lat,
      lng: mapboxResult.lng,
      formatted_address: mapboxResult.formatted_address
    };
  }

  // 3. Tentar Nominatim
  const nominatimResult = await geocodeWithNominatim(normalizeAddress(address), userLocation);
  if (nominatimResult && nominatimResult.confidence >= 0.5) {
    console.log('Geocodificação via Nominatim bem-sucedida');
    return {
      lat: nominatimResult.lat,
      lng: nominatimResult.lng,
      formatted_address: nominatimResult.formatted_address
    };
  }

  // 4. Fallback para método original
  return await geocodeAddressOriginal(normalizeAddress(address));
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
    console.log('Imagem processada com confiança:', (imageEnhancement.confidence * 100).toFixed(1) + '%');

    // 2. Executar OCR com sistema de fallback robusto
    const ocrResult = await executeOCRWithFallback(imageEnhancement.enhancedImageUrl, 0.3);
      
      console.log('Resultado do OCR:', {
        text: ocrResult.text,
        confidence: ocrResult.confidence,
        provider: ocrResult.provider
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

      // Validar endereço extraído
      const validation = validateExtractedAddress(address);
      if (validation.isValid) {
        console.log('Endereço validado com sucesso');
        
        // Geocodificar endereço
        const coordinates = await geocodeAddressImproved(address, userLocation);
        
        if (coordinates) {
          console.log('Geocodificação bem-sucedida:', coordinates);
          
          // Salvar no banco de dados
          const supabase = getSupabase();
          const { data, error } = await supabase
            .from('stops')
            .insert({
              photo_url: imageUrl,
              address: coordinates.formatted_address || address,
              latitude: coordinates.lat,
              longitude: coordinates.lng,
              extracted_text: ocrResult.text,
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
        } else {
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
      } else {
        return NextResponse.json({
          success: false,
          error: 'Endereço extraído mas não foi possível validar',
          extractedAddress: address,
          extractedText: ocrResult.text,
          ocrConfidence: ocrResult.confidence,
          extractionConfidence: extractionResult.confidence,
          extractionMethod: extractionResult.method,
          suggestions: extractionResult.suggestions
        });
      }

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