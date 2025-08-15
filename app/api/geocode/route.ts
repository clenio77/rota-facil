import { NextRequest, NextResponse } from 'next/server';

// Tipo para resultado de geocodificação
interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  confidence: number;
  provider: string;
  formatted_address?: string;
}

// Função para validar coordenadas brasileiras
function isValidBrazilianCoordinate(lat: number, lng: number): boolean {
  // Brasil: lat -33.7 a 5.3, lng -73.9 a -28.8
  return lat >= -33.7 && lat <= 5.3 && lng >= -73.9 && lng <= -28.8;
}

// Função para normalizar endereço
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

// Função para extrair CEP do endereço
function extractCEP(address: string): string | null {
  const cepMatch = address.match(/\b(\d{5}-?\d{3})\b/);
  return cepMatch ? cepMatch[1].replace('-', '') : null;
}

// Provider 1: ViaCEP + Nominatim (para CEPs brasileiros)
async function geocodeWithViaCEP(cep: string): Promise<GeocodeResult | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return null;

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const data = await response.json();

    if (data.erro) return null;

    // ViaCEP não retorna coordenadas, usar Nominatim para geocodificar o endereço completo
    const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}, Brasil`;
    const nominatimResult = await geocodeWithNominatim(fullAddress);

    if (nominatimResult) {
      return {
        ...nominatimResult,
        address: fullAddress,
        confidence: 0.9,
        provider: 'viacep+nominatim',
        formatted_address: `${data.logradouro}, ${data.bairro}, ${data.localidade} - ${data.uf}, ${cleanCEP}`
      };
    }

    return null;
  } catch (error) {
    console.error('Erro ViaCEP:', error);
    return null;
  }
}

// Provider 2: Mapbox Geocoding API
async function geocodeWithMapbox(address: string): Promise<GeocodeResult | null> {
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
          address: feature.place_name,
          confidence: feature.relevance || 0.8,
          provider: 'mapbox',
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

// Provider 3: Nominatim (fallback gratuito)
async function geocodeWithNominatim(address: string): Promise<GeocodeResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?` +
      `format=json&q=${encodeURIComponent(address)}&` +
      `countrycodes=br&limit=1&addressdetails=1&extratags=1&namedetails=1`,
      {
        headers: {
          'User-Agent': 'RotaFacil/1.0 (contato@rotafacil.com)',
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
        // Calcular confiança baseada no tipo de resultado
        let confidence = 0.5;
        if (result.osm_type === 'way') confidence = 0.7;
        if (result.class === 'building') confidence = 0.8;
        if (result.type === 'house') confidence = 0.9;

        return {
          lat,
          lng,
          address: result.display_name,
          confidence,
          provider: 'nominatim',
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

// Provider 4: Google Geocoding (último recurso)
async function geocodeWithGoogle(address: string): Promise<GeocodeResult | null> {
  const googleApiKey = process.env.GOOGLE_GEOCODING_API_KEY;
  if (!googleApiKey) return null;

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?` +
      `address=${encodeURIComponent(address)}&` +
      `components=country:BR&language=pt-BR&key=${googleApiKey}`
    );

    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const result = data.results[0];
      const { lat, lng } = result.geometry.location;

      if (isValidBrazilianCoordinate(lat, lng)) {
        // Google tem alta confiança
        let confidence = 0.9;
        if (result.geometry.location_type === 'ROOFTOP') confidence = 0.95;

        return {
          lat,
          lng,
          address: result.formatted_address,
          confidence,
          provider: 'google',
          formatted_address: result.formatted_address
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro Google:', error);
    return null;
  }
}

// Função principal de geocodificação com hierarquia de provedores
async function geocodeAddressImproved(originalAddress: string): Promise<GeocodeResult | null> {
  const address = normalizeAddress(originalAddress);
  const cep = extractCEP(address);

  console.log(`Geocodificando: "${address}" (CEP: ${cep})`);

  // 1. Se temos CEP, tentar ViaCEP primeiro
  if (cep) {
    const viaCepResult = await geocodeWithViaCEP(cep);
    if (viaCepResult && viaCepResult.confidence >= 0.8) {
      console.log('Geocodificação via ViaCEP+Nominatim bem-sucedida');
      return viaCepResult;
    }
  }

  // 2. Tentar Mapbox (se configurado)
  const mapboxResult = await geocodeWithMapbox(address);
  if (mapboxResult && mapboxResult.confidence >= 0.7) {
    console.log('Geocodificação via Mapbox bem-sucedida');
    return mapboxResult;
  }

  // 3. Tentar Nominatim
  const nominatimResult = await geocodeWithNominatim(address);
  if (nominatimResult && nominatimResult.confidence >= 0.5) {
    console.log('Geocodificação via Nominatim bem-sucedida');
    return nominatimResult;
  }

  // 4. Último recurso: Google (se configurado)
  const googleResult = await geocodeWithGoogle(address);
  if (googleResult) {
    console.log('Geocodificação via Google bem-sucedida');
    return googleResult;
  }

  // 5. Se nada funcionou, tentar versões simplificadas do endereço
  if (address.includes(',')) {
    const simplifiedAddress = address.split(',')[0].trim() + ', Brasil';
    const fallbackResult = await geocodeWithNominatim(simplifiedAddress);
    if (fallbackResult) {
      console.log('Geocodificação com endereço simplificado bem-sucedida');
      return {
        ...fallbackResult,
        confidence: Math.max(0.3, fallbackResult.confidence - 0.2)
      };
    }
  }

  console.log('Falha na geocodificação com todos os provedores');
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    
    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json({ 
        success: false, 
        error: 'Endereço inválido ou muito curto' 
      }, { status: 400 });
    }

    const result = await geocodeAddressImproved(address);
    
    if (!result) {
      return NextResponse.json({ 
        success: false, 
        error: 'Endereço não encontrado ou fora do Brasil',
        attempted_address: address
      }, { status: 404 });
    }

    // Log para debug
    console.log(`Geocodificação bem-sucedida: ${result.provider} (confiança: ${result.confidence})`);

    return NextResponse.json({ 
      success: true,
      lat: result.lat,
      lng: result.lng,
      address: result.formatted_address || result.address,
      confidence: result.confidence,
      provider: result.provider,
      original_address: address
    });

  } catch (error) {
    console.error('Erro no endpoint /api/geocode:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor', 
        details: error instanceof Error ? error.message : 'Erro desconhecido' 
      },
      { status: 500 }
    );
  }
}