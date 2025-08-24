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

// ✅ INTERFACES TIPADAS para evitar 'any'
interface PhotonFeature {
  geometry: {
    coordinates: [number, number];
  };
  properties: {
    osm_id?: number;
    osm_value?: string;
    osm_type?: string;
    name?: string;
    street?: string;
    housenumber?: string;
    district?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countrycode?: string; // ✅ ADICIONADO: countrycode
    type?: string;
  };
  type: string;
}

interface PhotonResponse {
  features: PhotonFeature[];
}

interface NominatimItem {
  place_id?: number;
  lat: string;
  lon: string;
  display_name: string;
  importance?: string;
  type?: string;
  address?: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    suburb?: string;
    city?: string;
    town?: string;
    municipality?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
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

    const data: PhotonResponse = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: SearchResult[] = data.features
      .filter((feature: PhotonFeature) => {
        const props = feature.properties;
        return props?.countrycode === 'BR' ||
               props?.country === 'Brasil' ||
               props?.country === 'Brazil';
      })
      .map((feature: PhotonFeature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        // Calcular confiança baseada nos dados disponíveis
        let confidence = 0.6;
        let distance: number | undefined;

        // BONUS ESPECIAL: se tem o número exato que procuramos
        if (number && props?.housenumber === number) {
          confidence += 0.3; // Grande bonus para número exato
          console.log(`🎯 NÚMERO EXATO encontrado: ${props.housenumber}`);
        } else if (props?.housenumber) {
          confidence += 0.1; // Bonus menor para qualquer número
        }

        if (props?.street) confidence += 0.1;
        if (props?.city) confidence += 0.1;

        // Calcular distância se temos localização do usuário
        if (userLocation?.lat && userLocation?.lng) {
          distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
          // Bonus para proximidade
          if (distance < 5) confidence += 0.2;
          else if (distance < 20) confidence += 0.1;
        }

        // Construir display_name
        const displayParts: string[] = [];
        if (props?.street) displayParts.push(props.street);
        if (props?.housenumber) displayParts.push(props.housenumber);
        if (props?.district) displayParts.push(props.district);
        if (props?.city) displayParts.push(props.city);
        if (props?.state) displayParts.push(props.state);

        const display_name = displayParts.join(', ') || 'Endereço sem nome';

        return {
          id: props?.osm_id?.toString() || `${lat}-${lng}`,
          display_name,
          lat,
          lng,
          address: {
            house_number: props?.housenumber,
            road: props?.street,
            neighbourhood: props?.district,
            city: props?.city,
            state: props?.state,
            postcode: props?.postcode,
            country: props?.country
          },
          type: props?.osm_value || props?.type || 'place',
          importance: confidence, // Usar nossa confiança calculada
          distance,
          confidence
        };
      })
      .filter((result: SearchResult) => {
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
      // Prioridade 1: Confiança
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      
      // Prioridade 2: Proximidade (se temos localização)
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      
      // Prioridade 3: Importância
      return (b.importance || 0) - (a.importance || 0);
    });

    console.log(`✅ Photon: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Photon:', error);
    return [];
  }
}

// Busca no Photon com filtro por cidade
async function searchPhotonWithCityFilter(query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }, limit = 5): Promise<SearchResult[]> {
  try {
    if (!userLocation?.city) {
      console.log('Photon cidade: PULANDO - sem cidade do usuário');
      return [];
    }

    const { street, number } = extractAddressNumber(query);
    const cityQuery = `${query}, ${userLocation.city}`;

    const url = new URL('https://photon.komoot.io/api/');
    url.searchParams.set('q', cityQuery);
    url.searchParams.set('limit', (limit * 2).toString()); // Buscar mais para filtrar depois

    // Se temos localização do usuário, priorizar resultados próximos
    if (userLocation?.lat && userLocation?.lng) {
      url.searchParams.set('lat', userLocation.lat.toString());
      url.searchParams.set('lon', userLocation.lng.toString());
      url.searchParams.set('location_bias_scale', '0.3'); // Bias forte para localização
    }

    console.log(`🔍 Photon cidade: "${cityQuery}" (número extraído: ${number || 'nenhum'})`);

    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (https://rotafacil.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Photon cidade HTTP ${response.status}`);
    }

    const data: PhotonResponse = await response.json();

    if (!data.features || !Array.isArray(data.features)) {
      return [];
    }

    const results: SearchResult[] = data.features
      .filter((feature: PhotonFeature) => {
        const props = feature.properties;
        // Filtrar apenas resultados do Brasil e da cidade específica
        const isBrazil = props?.countrycode === 'BR' ||
                        props?.country === 'Brasil' ||
                        props?.country === 'Brazil';
        
        const isSameCity = props?.city?.toLowerCase().includes(userLocation!.city!.toLowerCase());
        
        return isBrazil && isSameCity;
      })
      .map((feature: PhotonFeature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        // Calcular confiança baseada nos dados disponíveis
        let confidence = 0.7; // Bonus base para cidade específica
        let distance: number | undefined;

        // BONUS ESPECIAL: se tem o número exato que procuramos
        if (number && props?.housenumber === number) {
          confidence += 0.3; // Grande bonus para número exato
          console.log(`🎯 PHOTON CIDADE: Número exato encontrado: ${props.housenumber}`);
        } else if (props?.housenumber) {
          confidence += 0.1; // Bonus menor para qualquer número
        }

        if (props?.street) confidence += 0.1;
        if (props?.city) confidence += 0.1;

        // Calcular distância se temos localização do usuário
        if (userLocation?.lat && userLocation?.lng) {
          distance = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
          // Bonus para proximidade
          if (distance < 5) confidence += 0.2;
          else if (distance < 20) confidence += 0.1;
        }

        // Construir display_name
        const displayParts: string[] = [];
        if (props?.street) displayParts.push(props.street);
        if (props?.housenumber) displayParts.push(props.housenumber);
        if (props?.district) displayParts.push(props.district);
        if (props?.city) displayParts.push(props.city);
        if (props?.state) displayParts.push(props.state);

        const display_name = displayParts.join(', ') || 'Endereço sem nome';

        return {
          id: props?.osm_id?.toString() || `${lat}-${lng}`,
          display_name,
          lat,
          lng,
          address: {
            house_number: props?.housenumber,
            road: props?.street,
            neighbourhood: props?.district,
            city: props?.city,
            state: props?.state,
            postcode: props?.postcode,
            country: props?.country
          },
          type: props?.osm_value || props?.type || 'place',
          importance: confidence,
          distance,
          confidence
        };
      })
      .filter((result: SearchResult) => {
        // Se procuramos um número específico, priorizar resultados relevantes
        if (number) {
          // Manter resultados com número exato OU da mesma rua
          return result.address.house_number === number ||
                 result.address.road?.toLowerCase().includes(street.toLowerCase()) ||
                 result.display_name.toLowerCase().includes(street.toLowerCase());
        }
        return true;
      })
      .slice(0, limit); // Limitar após filtrar

    console.log(`✅ Photon cidade: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Photon cidade:', error);
    return [];
  }
}

// Função para extrair número do endereço - MELHORADA
function extractAddressNumber(query: string): { street: string; number?: string } {
  const cleaned = query.trim();
  console.log(`🔍 Extraindo endereço de: "${cleaned}"`);

  // ✅ PADRÕES MELHORADOS para endereços brasileiros
  const patterns = [
    // Padrão 1: "Rua ABC, 123" ou "Rua ABC 123"
    /^(.+?)\s*,?\s*(\d{1,6})(?:\s*[^\d].*)?$/i,
    
    // Padrão 2: "123 Rua ABC" (número primeiro)
    /^(\d{1,6})\s+(.+)$/i,
    
    // Padrão 3: "Rua ABC nº 123" ou "Rua ABC n° 123"
    /^(.+?)\s+n[°º]?\s*(\d{1,6})(?:\s*[^\d].*)?$/i,
    
    // Padrão 4: "Rua ABC número 123"
    /^(.+?)\s+número\s+(\d{1,6})(?:\s*[^\d].*)?$/i,
    
    // Padrão 5: "Rua ABC - 123" (com hífen)
    /^(.+?)\s*-\s*(\d{1,6})(?:\s*[^\d].*)?$/i,
    
    // Padrão 6: "Rua ABC / 123" (com barra)
    /^(.+?)\s*\/\s*(\d{1,6})(?:\s*[^\d].*)?$/i,
    
    // Padrão 7: "Rua ABC, 123, Bairro" (com vírgulas extras)
    /^(.+?)\s*,\s*(\d{1,6})\s*,.*$/i,
    
    // Padrão 8: "Rua ABC 123 Bairro" (sem separador)
    /^(.+?)\s+(\d{1,6})\s+[^\d]+$/i
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const [, part1, part2] = match;
      
      // Determinar qual é rua e qual é número
      let street: string, number: string;
      
      if (/^\d{1,6}$/.test(part1)) {
        // Primeiro grupo é número
        number = part1;
        street = part2.trim();
      } else {
        // Primeiro grupo é rua
        street = part1.trim();
        number = part2;
      }

      // Validar se o número é razoável (não é CEP)
      const numValue = parseInt(number);
      if (numValue > 0 && numValue <= 99999) {
        console.log(`✅ Extraído: rua="${street}", número="${number}"`);
        return { street, number };
      }
    }
  }

  // Se não conseguiu extrair, retornar apenas a rua
  console.log(`⚠️ Nenhum número válido encontrado, retornando apenas rua: "${cleaned}"`);
  return { street: cleaned };
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

    const data: NominatimItem[] = await response.json();

    if (!Array.isArray(data)) {
      return [];
    }

    const results: SearchResult[] = data.map((item: NominatimItem) => {
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
    .filter((result: SearchResult) => {
      // Se procuramos um número específico, priorizar resultados com números
      if (number) {
        // Manter resultados com número exato OU resultados da mesma rua
        return result.address.house_number === number ||
               result.address.road?.toLowerCase().includes(street.toLowerCase()) ||
               result.display_name.toLowerCase().includes(street.toLowerCase());
      }
      return true;
    });

    // Ordenar por confiança e proximidade
    results.sort((a, b) => {
      // Prioridade 1: Confiança
      if (Math.abs(a.confidence - b.confidence) > 0.1) {
        return b.confidence - a.confidence;
      }
      
      // Prioridade 2: Proximidade (se temos localização)
      if (a.distance !== undefined && b.distance !== undefined) {
        return a.distance - b.distance;
      }
      
      // Prioridade 3: Importância
      return (b.importance || 0) - (a.importance || 0);
    });

    console.log(`✅ Nominatim: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Nominatim:', error);
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query, userLocation, limit = 10, searchMode, streetOnly, numberOnly } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json({ 
        success: false, 
        error: 'Query inválida' 
      }, { status: 400 });
    }

    console.log(`🔍 Busca de endereços: "${query}" (modo: ${searchMode}, rua: ${streetOnly}, número: ${numberOnly})`);

    // ✅ NOVA LÓGICA: Extrair rua e número da query
    const { street, number } = extractAddressNumber(query);
    console.log(`📍 Extraído: rua="${street}", número="${number}"`);

    // ✅ PRIORIZAR: Se temos número, buscar por rua + número primeiro
    let results: SearchResult[] = [];
    
    if (number && street) {
      console.log(`🎯 Buscando por rua + número: "${street}, ${number}"`);
      
      // 1. Tentar Photon com número específico
      const photonResults = await searchPhotonOptimized(`${street} ${number}`, userLocation, limit);
      results.push(...photonResults);
      
      // 2. Tentar Nominatim com número específico
      const nominatimResults = await searchNominatim(`${street} ${number}`, userLocation, limit);
      results.push(...nominatimResults);
      
      // 3. Se não encontrou, tentar apenas a rua
      if (results.length === 0) {
        console.log(`⚠️ Nenhum resultado para "${street}, ${number}" - tentando apenas rua`);
        const streetOnlyResults = await searchPhotonOptimized(street, userLocation, limit);
        results.push(...streetOnlyResults);
        
        const streetNominatimResults = await searchNominatim(street, userLocation, limit);
        results.push(...streetNominatimResults);
      }
    } else if (street) {
      console.log(`🔍 Buscando apenas por rua: "${street}"`);
      
      // Busca normal por rua
      const photonResults = await searchPhotonOptimized(street, userLocation, limit);
      results.push(...photonResults);
      
      const nominatimResults = await searchNominatim(street, userLocation, limit);
      results.push(...nominatimResults);
    }

    // ✅ NOVA LÓGICA: Priorizar resultados com número quando disponível
    if (number) {
      results = results.sort((a, b) => {
        const aHasExactNumber = a.address.house_number === number;
        const bHasExactNumber = b.address.house_number === number;
        
        // Prioridade 1: Número exato
        if (aHasExactNumber && !bHasExactNumber) return -1;
        if (!aHasExactNumber && bHasExactNumber) return 1;
        
        // Prioridade 2: Mesma rua com qualquer número
        const aSameStreet = a.address.road?.toLowerCase().includes(street.toLowerCase());
        const bSameStreet = b.address.road?.toLowerCase().includes(street.toLowerCase());
        
        if (aSameStreet && !bSameStreet) return -1;
        if (!aSameStreet && bSameStreet) return 1;
        
        // Prioridade 3: Importância e proximidade
        return (b.importance || 0) - (a.importance || 0);
      });
    }

    // Remover duplicatas baseado em coordenadas
    const uniqueResults = results.filter((result, index, self) => {
      const firstIndex = self.findIndex(r => 
        Math.abs(r.lat - result.lat) < 0.001 && 
        Math.abs(r.lng - result.lng) < 0.001
      );
      return firstIndex === index;
    });

    // Limitar resultados
    const limitedResults = uniqueResults.slice(0, limit);

    console.log(`✅ Encontrados ${limitedResults.length} resultados únicos`);
    
    // ✅ NOVO: Log detalhado dos resultados
    limitedResults.forEach((result, index) => {
      const hasNumber = result.address.house_number ? `✅ ${result.address.house_number}` : '❌ sem número';
      const sameStreet = result.address.road?.toLowerCase().includes(street.toLowerCase()) ? '✅ mesma rua' : '❌ rua diferente';
      console.log(`  [${index + 1}] ${result.display_name} | ${hasNumber} | ${sameStreet}`);
    });

    return NextResponse.json({
      success: true,
      results: limitedResults,
      query,
      searchMode,
      extracted: { street, number },
      totalFound: limitedResults.length
    });

  } catch (error) {
    console.error('❌ Erro na busca de endereços:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor' 
    }, { status: 500 });
  }
}
