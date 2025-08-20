import { NextRequest, NextResponse } from 'next/server';

interface ReverseGeocodeResult {
  city: string;
  state: string;
  country: string;
  fullAddress: string;
  confidence: number;
  provider: string;
}

// Função para validar coordenadas brasileiras
function isValidBrazilianCoordinate(lat: number, lng: number): boolean {
  return lat >= -33.7 && lat <= 5.3 && lng >= -73.9 && lng <= -28.8;
}

// Provider 1: Mapbox Reverse Geocoding (mais preciso)
async function reverseGeocodeWithMapbox(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) return null;

  try {
    const response = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?` +
      `types=place,locality&country=BR&language=pt&access_token=${mapboxToken}`
    );

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const context = feature.context || [];
      
      // Extrair cidade e estado do contexto
      let city = feature.text;
      let state = '';
      
      for (const ctx of context) {
        if (ctx.id.startsWith('region')) {
          state = ctx.text;
        }
      }

      return {
        city: city.toLowerCase(),
        state: state.toLowerCase(),
        country: 'Brasil',
        fullAddress: feature.place_name,
        confidence: 0.9,
        provider: 'mapbox'
      };
    }

    return null;
  } catch (error) {
    console.error('Erro Mapbox reverse geocoding:', error);
    return null;
  }
}

// Provider 2: Nominatim Reverse Geocoding (fallback gratuito)
async function reverseGeocodeWithNominatim(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?` +
      `format=json&lat=${lat}&lon=${lng}&` +
      `addressdetails=1&accept-language=pt-BR`,
      {
        headers: {
          'User-Agent': 'RotaFacil/1.0 (contato@rotafacil.com)',
        },
      }
    );

    const data = await response.json();

    if (data.address) {
      const address = data.address;
      const city = address.city || address.town || address.village || address.municipality || '';
      const state = address.state || '';

      if (city && state) {
        return {
          city: city.toLowerCase(),
          state: state.toLowerCase(),
          country: 'Brasil',
          fullAddress: data.display_name,
          confidence: 0.7,
          provider: 'nominatim'
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Erro Nominatim reverse geocoding:', error);
    return null;
  }
}

// Função principal de reverse geocoding
async function reverseGeocodeLocation(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  if (!isValidBrazilianCoordinate(lat, lng)) {
    return null;
  }

  // Tentar Mapbox primeiro (mais preciso)
  const mapboxResult = await reverseGeocodeWithMapbox(lat, lng);
  if (mapboxResult) {
    return mapboxResult;
  }

  // Fallback para Nominatim
  const nominatimResult = await reverseGeocodeWithNominatim(lat, lng);
  if (nominatimResult) {
    return nominatimResult;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { lat, lng } = await request.json();
    
    if (!lat || !lng || typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ 
        success: false, 
        error: 'Coordenadas inválidas' 
      }, { status: 400 });
    }

    const result = await reverseGeocodeLocation(lat, lng);
    
    if (!result) {
      return NextResponse.json({ 
        success: false, 
        error: 'Não foi possível identificar a localização',
        coordinates: { lat, lng }
      }, { status: 404 });
    }

    console.log(`Reverse geocoding bem-sucedido: ${result.city} - ${result.state} (${result.provider})`);

    return NextResponse.json({ 
      success: true,
      city: result.city,
      state: result.state,
      country: result.country,
      fullAddress: result.fullAddress,
      confidence: result.confidence,
      provider: result.provider
    });

  } catch (error) {
    console.error('Erro no endpoint /api/reverse-geocode:', error);
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
