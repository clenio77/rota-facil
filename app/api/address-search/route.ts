import { NextRequest, NextResponse } from 'next/server';

interface SearchResult {
  id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  type: string;
  importance: number;
  distance?: number;
}

// Função para calcular distância entre dois pontos
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Busca no Nominatim (OpenStreetMap)
async function searchNominatim(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 8): Promise<SearchResult[]> {
  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', query);
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('extratags', '1');
    url.searchParams.set('namedetails', '1');
    
    // Se temos localização do usuário, priorizar resultados próximos
    if (userLocation?.lat && userLocation?.lng) {
      url.searchParams.set('viewbox', 
        `${userLocation.lng - 0.5},${userLocation.lat + 0.5},${userLocation.lng + 0.5},${userLocation.lat - 0.5}`
      );
      url.searchParams.set('bounded', '1');
    }

    console.log(`🔍 Nominatim Search: ${url.toString()}`);
    
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (https://rotafacil.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!Array.isArray(data)) {
      return [];
    }

    const results: SearchResult[] = data.map((item: any) => {
      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);
      
      let distance: number | undefined;
      if (userLocation?.lat && userLocation?.lng) {
        distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
      }

      return {
        id: item.place_id?.toString() || `${lat}-${lng}`,
        display_name: item.display_name,
        lat,
        lng,
        address: {
          house_number: item.address?.house_number,
          road: item.address?.road,
          neighbourhood: item.address?.neighbourhood || item.address?.suburb,
          city: item.address?.city || item.address?.town || item.address?.municipality,
          state: item.address?.state,
          postcode: item.address?.postcode,
          country: item.address?.country
        },
        type: item.type || 'unknown',
        importance: parseFloat(item.importance || '0'),
        distance
      };
    });

    // Ordenar por relevância e proximidade
    results.sort((a, b) => {
      // Se temos localização do usuário, priorizar por distância
      if (userLocation?.lat && userLocation?.lng && a.distance !== undefined && b.distance !== undefined) {
        // Primeiro por distância, depois por importância
        const distanceDiff = a.distance - b.distance;
        if (Math.abs(distanceDiff) > 5) { // Diferença significativa de distância (>5km)
          return distanceDiff;
        }
      }
      
      // Ordenar por importância (maior primeiro)
      return b.importance - a.importance;
    });

    console.log(`✅ Nominatim: ${results.length} resultados encontrados`);
    return results;

  } catch (error) {
    console.error('Erro no Nominatim:', error);
    return [];
  }
}

// Busca no Photon (alternativa rápida)
async function searchPhoton(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 8): Promise<SearchResult[]> {
  try {
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('osm_tag', 'place');
    
    // Filtrar apenas Brasil
    if (userLocation?.lat && userLocation?.lng) {
      url.searchParams.set('lat', userLocation.lat.toString());
      url.searchParams.set('lon', userLocation.lng.toString());
    }

    console.log(`🔍 Photon Search: ${url.toString()}`);
    
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Photon HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: SearchResult[] = data.features
      .filter((feature: any) => {
        // Filtrar apenas resultados do Brasil
        return feature.properties?.country === 'Brazil' || 
               feature.properties?.country === 'Brasil';
      })
      .map((feature: any) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;
        
        let distance: number | undefined;
        if (userLocation?.lat && userLocation?.lng) {
          distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        }

        return {
          id: props.osm_id?.toString() || `${lat}-${lng}`,
          display_name: props.name || 'Endereço sem nome',
          lat,
          lng,
          address: {
            house_number: props.housenumber,
            road: props.street,
            neighbourhood: props.district,
            city: props.city,
            state: props.state,
            postcode: props.postcode,
            country: props.country
          },
          type: props.osm_value || props.type || 'unknown',
          importance: 0.5, // Photon não retorna importance
          distance
        };
      });

    console.log(`✅ Photon: ${results.length} resultados encontrados`);
    return results;

  } catch (error) {
    console.error('Erro no Photon:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, userLocation, limit = 8 } = await request.json();

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Query deve ter pelo menos 3 caracteres'
      }, { status: 400 });
    }

    console.log(`🔍 Address Search: "${query}" (limit: ${limit})`);
    
    // Buscar em paralelo no Nominatim e Photon
    const [nominatimResults, photonResults] = await Promise.all([
      searchNominatim(query, userLocation, Math.ceil(limit * 0.7)),
      searchPhoton(query, userLocation, Math.ceil(limit * 0.3))
    ]);

    // Combinar e deduplificar resultados
    const allResults = [...nominatimResults, ...photonResults];
    const uniqueResults = new Map<string, SearchResult>();

    allResults.forEach(result => {
      const key = `${result.lat.toFixed(4)}-${result.lng.toFixed(4)}`;
      if (!uniqueResults.has(key) || 
          (uniqueResults.get(key)!.importance < result.importance)) {
        uniqueResults.set(key, result);
      }
    });

    const finalResults = Array.from(uniqueResults.values())
      .slice(0, limit)
      .sort((a, b) => {
        // Ordenação final por distância e importância
        if (userLocation?.lat && userLocation?.lng && a.distance !== undefined && b.distance !== undefined) {
          const distanceDiff = a.distance - b.distance;
          if (Math.abs(distanceDiff) > 2) {
            return distanceDiff;
          }
        }
        return b.importance - a.importance;
      });

    console.log(`✅ Address Search: ${finalResults.length} resultados finais`);

    return NextResponse.json({
      success: true,
      results: finalResults,
      query,
      total: finalResults.length
    });

  } catch (error) {
    console.error('Erro na busca de endereços:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
