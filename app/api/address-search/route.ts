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
  confidence: number;
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

// Busca otimizada no Photon com suporte a números
async function searchPhotonOptimized(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 10): Promise<SearchResult[]> {
  try {
    const { street, number } = extractAddressNumber(query);

    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', query); // Usar query original primeiro
    url.searchParams.set('limit', limit.toString());
    // Removido 'lang=pt' pois Photon não suporta português

    // Se temos localização do usuário, priorizar resultados próximos
    if (userLocation?.lat && userLocation?.lng) {
      url.searchParams.set('lat', userLocation.lat.toString());
      url.searchParams.set('lon', userLocation.lng.toString());
      url.searchParams.set('location_bias_scale', '0.5'); // Bias moderado para localização
    }

    console.log(`🔍 Photon com número: "${query}" (número extraído: ${number || 'nenhum'})`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (https://rotafacil.com)'
      }
    });

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
        const props = feature.properties;
        return props?.country === 'Brazil' ||
               props?.country === 'Brasil' ||
               props?.countrycode === 'BR';
      })
      .map((feature: any) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        let distance: number | undefined;
        if (userLocation?.lat && userLocation?.lng) {
          distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        }

        // Calcular confiança baseada em completude dos dados
        let confidence = 0.5;

        // BONUS ESPECIAL: se tem o número exato que procuramos
        if (number && props.housenumber === number) {
          confidence += 0.3; // Grande bonus para número exato
          console.log(`🎯 PHOTON: Número exato encontrado: ${props.housenumber}`);
        } else if (props.housenumber) {
          confidence += 0.1; // Bonus menor para qualquer número
        }

        if (props.street) confidence += 0.2;
        if (props.city) confidence += 0.1;
        if (distance !== undefined && distance < 10) confidence += 0.1; // Bonus proximidade
        if (distance !== undefined && distance < 2) confidence += 0.1; // Bonus proximidade alta

        // Criar display_name formatado com prioridade para número
        const displayParts = [];
        if (props.street) {
          if (props.housenumber) {
            displayParts.push(`${props.street}, ${props.housenumber}`);
          } else {
            displayParts.push(props.street);
          }
        } else if (props.name) {
          displayParts.push(props.name);
        }

        if (props.district) displayParts.push(props.district);
        if (props.city) displayParts.push(props.city);
        if (props.state) displayParts.push(props.state);

        const display_name = displayParts.join(', ') || 'Endereço sem nome';

        return {
          id: props.osm_id?.toString() || `${lat}-${lng}`,
          display_name,
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
          type: props.osm_value || props.type || 'place',
          importance: confidence, // Usar nossa confiança calculada
          distance,
          confidence
        };
      })
      .filter(result => {
        // Se procuramos um número específico, priorizar resultados relevantes
        if (number) {
          // Manter resultados com número exato OU da mesma rua
          return result.address.house_number === number ||
                 result.address.road?.toLowerCase().includes(street.toLowerCase()) ||
                 result.display_name.toLowerCase().includes(street.toLowerCase());
        }
        return true;
      });

    // Ordenar por confiança, proximidade e relevância
    results.sort((a, b) => {
      // Priorizar resultados com número exato
      if (number) {
        const aHasExactNumber = a.address.house_number === number;
        const bHasExactNumber = b.address.house_number === number;

        if (aHasExactNumber && !bHasExactNumber) return -1;
        if (bHasExactNumber && !aHasExactNumber) return 1;
      }

      // Se temos localização do usuário, considerar distância
      if (userLocation?.lat && userLocation?.lng && a.distance !== undefined && b.distance !== undefined) {
        // Priorizar resultados muito próximos (< 5km)
        if (a.distance < 5 && b.distance >= 5) return -1;
        if (b.distance < 5 && a.distance >= 5) return 1;

        // Para resultados próximos, ordenar por confiança
        if (a.distance < 20 && b.distance < 20) {
          return b.confidence - a.confidence;
        }

        // Para resultados distantes, ordenar por distância
        return a.distance - b.distance;
      }

      // Sem localização, ordenar apenas por confiança
      return b.confidence - a.confidence;
    });

    console.log(`✅ Photon: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Photon:', error);
    return [];
  }
}

// Busca adicional com filtro de cidade específica
async function searchPhotonWithCityFilter(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 5): Promise<SearchResult[]> {
  if (!userLocation?.city) return [];

  try {
    // Buscar especificamente na cidade do usuário
    const cityQuery = `${query} ${userLocation.city}`;
    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', cityQuery);
    url.searchParams.set('limit', limit.toString());
    url.searchParams.set('lang', 'pt');

    if (userLocation.lat && userLocation.lng) {
      url.searchParams.set('lat', userLocation.lat.toString());
      url.searchParams.set('lon', userLocation.lng.toString());
    }

    console.log(`🎯 Photon City Filter: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (https://rotafacil.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Photon City Filter HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: SearchResult[] = data.features
      .filter((feature: any) => {
        const props = feature.properties;
        // Filtrar apenas Brasil E cidade específica
        const isBrazil = props?.country === 'Brazil' || props?.country === 'Brasil' || props?.countrycode === 'BR';
        const isCorrectCity = props?.city?.toLowerCase().includes(userLocation.city!.toLowerCase());
        return isBrazil && isCorrectCity;
      })
      .map((feature: any) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        let distance: number | undefined;
        if (userLocation.lat && userLocation.lng) {
          distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        }

        // Confiança alta para resultados filtrados por cidade
        let confidence = 0.8;
        if (props.housenumber) confidence += 0.1;
        if (props.street) confidence += 0.1;
        if (distance !== undefined && distance < 5) confidence += 0.1;

        const displayParts = [];
        if (props.street) {
          if (props.housenumber) {
            displayParts.push(`${props.street}, ${props.housenumber}`);
          } else {
            displayParts.push(props.street);
          }
        } else if (props.name) {
          displayParts.push(props.name);
        }

        if (props.district) displayParts.push(props.district);
        if (props.city) displayParts.push(props.city);

        const display_name = displayParts.join(', ') || 'Endereço sem nome';

        return {
          id: props.osm_id?.toString() || `${lat}-${lng}`,
          display_name,
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
          type: props.osm_value || props.type || 'place',
          importance: confidence,
          distance,
          confidence
        };
      });

    console.log(`✅ Photon City Filter: ${results.length} resultados encontrados`);
    return results;

  } catch (error) {
    console.error('Erro no Photon City Filter:', error);
    return [];
  }
}

// Função para extrair número do endereço
function extractAddressNumber(query: string): { street: string; number?: string } {
  // Regex para capturar número no final ou no meio
  const patterns = [
    /^(.+?)\s+(\d+)$/,           // "Rua ABC 123"
    /^(.+?),\s*(\d+)$/,          // "Rua ABC, 123"
    /^(\d+)\s+(.+)$/,            // "123 Rua ABC"
    /^(.+?)\s+n[°º]?\s*(\d+)$/i, // "Rua ABC nº 123"
  ];

  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) {
      const [, part1, part2] = match;
      // Se o primeiro grupo é número, inverter
      if (/^\d+$/.test(part1)) {
        return { street: part2.trim(), number: part1 };
      } else {
        return { street: part1.trim(), number: part2 };
      }
    }
  }

  return { street: query.trim() };
}

// Busca no Nominatim com suporte a números
async function searchNominatim(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 5): Promise<SearchResult[]> {
  try {
    const { street, number } = extractAddressNumber(query);

    // Primeira tentativa: busca com número exato
    let searchQuery = query;
    if (number) {
      searchQuery = `${street} ${number}`;
    }

    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('format', 'json');
    url.searchParams.set('q', searchQuery);
    url.searchParams.set('countrycodes', 'br');
    url.searchParams.set('limit', (limit * 2).toString()); // Buscar mais para filtrar depois
    url.searchParams.set('addressdetails', '1');

    // Se temos localização do usuário, priorizar resultados próximos
    if (userLocation?.lat && userLocation?.lng) {
      url.searchParams.set('viewbox',
        `${userLocation.lng - 0.1},${userLocation.lat + 0.1},${userLocation.lng + 0.1},${userLocation.lat - 0.1}`
      );
      url.searchParams.set('bounded', '1');
    }

    console.log(`🔍 Nominatim com número: "${searchQuery}" (número extraído: ${number || 'nenhum'})`);

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

      // Calcular confiança baseada nos dados disponíveis
      let confidence = 0.6;

      // BONUS ESPECIAL: se tem o número exato que procuramos
      if (number && item.address?.house_number === number) {
        confidence += 0.3; // Grande bonus para número exato
        console.log(`🎯 NÚMERO EXATO encontrado: ${item.address.house_number}`);
      } else if (item.address?.house_number) {
        confidence += 0.1; // Bonus menor para qualquer número
      }

      if (item.address?.road) confidence += 0.1;
      if (item.importance) confidence += parseFloat(item.importance) * 0.1;

      // Melhorar display_name para mostrar número quando disponível
      let display_name = item.display_name;
      if (item.address?.house_number && item.address?.road) {
        const parts = display_name.split(', ');
        parts[0] = `${item.address.road}, ${item.address.house_number}`;
        display_name = parts.join(', ');
      }

      return {
        id: item.place_id?.toString() || `${lat}-${lng}`,
        display_name,
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
        type: item.type || 'place',
        importance: parseFloat(item.importance || '0'),
        distance,
        confidence
      };
    })
    .filter(result => {
      // Se procuramos um número específico, priorizar resultados com números
      if (number) {
        // Manter resultados com número exato OU resultados da mesma rua
        return result.address.house_number === number ||
               result.address.road?.toLowerCase().includes(street.toLowerCase()) ||
               result.display_name.toLowerCase().includes(street.toLowerCase());
      }
      return true;
    })
    .slice(0, limit); // Limitar após filtrar

    console.log(`✅ Nominatim: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Nominatim:', error);
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

    console.log(`🔍 Address Search (Híbrida): "${query}" (limit: ${limit})`);

    // ESTRATÉGIA HÍBRIDA: Photon + Nominatim + Filtro por cidade
    const [photonResults, nominatimResults, cityResults] = await Promise.all([
      searchPhotonOptimized(query, userLocation, Math.ceil(limit * 0.4)),
      searchNominatim(query, userLocation, Math.ceil(limit * 0.4)),
      searchPhotonWithCityFilter(query, userLocation, Math.ceil(limit * 0.2))
    ]);

    // Combinar todos os resultados
    const allResults = [...cityResults, ...photonResults, ...nominatimResults];

    if (allResults.length === 0) {
      console.log(`❌ Nenhum resultado encontrado para: "${query}"`);
      return NextResponse.json({
        success: false,
        results: [],
        query,
        total: 0,
        message: 'Nenhum endereço encontrado. Tente ser mais específico.'
      });
    }

    // Deduplificar resultados
    const uniqueResults = new Map<string, SearchResult>();

    allResults.forEach(result => {
      const key = `${result.lat.toFixed(4)}-${result.lng.toFixed(4)}`;
      if (!uniqueResults.has(key) ||
          (uniqueResults.get(key)!.confidence < result.confidence)) {
        uniqueResults.set(key, result);
      }
    });

    const finalResults = Array.from(uniqueResults.values())
      .slice(0, limit)
      .sort((a, b) => {
        // Ordenação otimizada por confiança e proximidade
        if (userLocation?.lat && userLocation?.lng && a.distance !== undefined && b.distance !== undefined) {
          // Priorizar resultados muito próximos
          if (a.distance < 5 && b.distance >= 5) return -1;
          if (b.distance < 5 && a.distance >= 5) return 1;

          // Para resultados próximos, ordenar por confiança
          if (a.distance < 20 && b.distance < 20) {
            return b.confidence - a.confidence;
          }

          // Para resultados distantes, ordenar por distância
          return a.distance - b.distance;
        }

        // Sem localização, ordenar por confiança
        return b.confidence - a.confidence;
      });

    console.log(`✅ Address Search (Híbrida): ${finalResults.length} resultados finais`);

    return NextResponse.json({
      success: true,
      results: finalResults,
      query,
      total: finalResults.length,
      provider: 'hybrid-photon-nominatim'
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
