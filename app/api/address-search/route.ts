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

    // ✅ CORRIGIDO: Adicionar timeout para evitar travamento
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos

    try {
      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'RotaFacil/1.0 (https://rotafacil.com)'
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Photon HTTP ${response.status}`);
      }

      // ✅ CORRIGIDO: Verificar se a resposta é JSON válido
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        console.warn('⚠️ Photon retornou resposta não-JSON:', contentType);
        return [];
      }

      let data: PhotonResponse;
      try {
        data = await response.json();
      } catch (jsonError) {
        console.error('❌ Erro ao parsear JSON do Photon:', jsonError);
        console.error('❌ Resposta recebida:', await response.text());
        return [];
      }

      if (!data.features || !Array.isArray(data.features)) {
        console.warn('⚠️ Photon retornou estrutura inválida:', data);
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

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.warn('⚠️ Timeout na chamada do Photon');
        return [];
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('❌ Erro no Photon:', error);
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

    // ✅ CORRIGIDO: Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('⚠️ Photon cidade retornou resposta não-JSON:', contentType);
      return [];
    }

    let data: PhotonResponse;
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Erro ao parsear JSON do Photon cidade:', jsonError);
      console.error('❌ Resposta recebida:', await response.text());
      return [];
    }

    if (!data.features || !Array.isArray(data.features)) {
      console.warn('⚠️ Photon cidade retornou estrutura inválida:', data);
      return [];
    }

    const results: SearchResult[] = data.features
      .filter((feature: PhotonFeature) => {
        const props = feature.properties;
        // ✅ CORRIGIDO: Filtro mais rigoroso por cidade e estado
        const isBrazil = props?.countrycode === 'BR' ||
                        props?.country === 'Brasil' ||
                        props?.country === 'Brazil';
        
        // ✅ NOVO: Filtro rigoroso por cidade - deve conter exatamente a cidade do usuário
        const isSameCity = props?.city && 
                          (props.city.toLowerCase() === userLocation!.city!.toLowerCase() ||
                           props.city.toLowerCase().includes(userLocation!.city!.toLowerCase()) ||
                           userLocation!.city!.toLowerCase().includes(props.city.toLowerCase()));
        
        // ✅ NOVO: Filtro por estado também
        const isSameState = props?.state && userLocation!.state &&
                          (props.state.toLowerCase() === userLocation!.state.toLowerCase() ||
                           props.state.toLowerCase().includes(userLocation!.state.toLowerCase()));
        
        // ✅ NOVO: Log detalhado do filtro
        if (props?.city && props?.state) {
          console.log(`🔍 Filtro cidade: "${props.city}" vs "${userLocation!.city}" = ${isSameCity}`);
          console.log(`🔍 Filtro estado: "${props.state}" vs "${userLocation!.state}" = ${isSameState}`);
        }
        
        return isBrazil && isSameCity && isSameState;
      })
      .map((feature: PhotonFeature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const props = feature.properties;

        // Calcular confiança baseada nos dados disponíveis
        let confidence = 0.8; // ✅ AUMENTADO: Bonus base para cidade específica
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
          // ✅ NOVO: Bonus maior para proximidade na mesma cidade
          if (distance < 2) confidence += 0.3; // Muito próximo
          else if (distance < 5) confidence += 0.2; // Próximo
          else if (distance < 10) confidence += 0.1; // Moderadamente próximo
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
        // ✅ NOVO: Filtro adicional para garantir que está na cidade correta
        if (userLocation?.city && result.address.city) {
          const cityMatch = result.address.city.toLowerCase().includes(userLocation.city.toLowerCase()) ||
                           userLocation.city.toLowerCase().includes(result.address.city.toLowerCase());
          
          if (!cityMatch) {
            console.log(`❌ Filtro adicional: "${result.address.city}" não corresponde a "${userLocation.city}"`);
            return false;
          }
        }
        
        // Se procuramos um número específico, priorizar resultados com números
        if (number) {
          // Manter resultados com número exato OU resultados da mesma rua
          return result.address.house_number === number ||
                 result.address.road?.toLowerCase().includes(street.toLowerCase()) ||
                 result.display_name.toLowerCase().includes(street.toLowerCase());
        }
        return true;
      });

    // ✅ NOVO: Ordenar por confiança, proximidade e relevância
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

    console.log(`✅ Photon cidade: ${results.length} resultados encontrados (${results.filter(r => r.address.house_number === number).length} com número exato)`);
    return results;

  } catch (error) {
    console.error('Erro no Photon cidade:', error);
    return [];
  }
}

// 🎯 FUNÇÃO: Validar e filtrar localizações reais do endereço
async function validateAndFilterRealLocations(results: SearchResult[], query: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<SearchResult[]> {
  if (results.length <= 1) return results;

  const { street, number } = extractAddressNumber(query);
  console.log(`🔍 Validando localizações para: "${street}" número "${number}"`);

  // 🎯 ESTRATÉGIA 1: Se tem número, buscar CEP específico
  if (number && userLocation?.city) {
    try {
      const cepValidatedResults = await validateByCEP(results, street, number, userLocation.city);
      if (cepValidatedResults.length > 0) {
        console.log(`✅ Validação por CEP: ${cepValidatedResults.length} resultados válidos`);
        return cepValidatedResults;
      }
    } catch (error) {
      console.log('⚠️ Validação por CEP falhou:', error);
    }
  }

  // 🎯 ESTRATÉGIA 2: Filtrar por bairro mais provável
  const neighborhoodFiltered = filterByMostLikelyNeighborhood(results, street, number, userLocation);
  if (neighborhoodFiltered.length > 0 && neighborhoodFiltered.length < results.length) {
    console.log(`✅ Filtro por bairro: ${neighborhoodFiltered.length} resultados (era ${results.length})`);
    return neighborhoodFiltered;
  }

  // 🎯 ESTRATÉGIA 3: Filtrar por proximidade ao centro da cidade
  const proximityFiltered = filterByProximityToCenter(results, userLocation);
  if (proximityFiltered.length > 0 && proximityFiltered.length < results.length) {
    console.log(`✅ Filtro por proximidade: ${proximityFiltered.length} resultados (era ${results.length})`);
    return proximityFiltered;
  }

  // 🎯 Fallback: retornar apenas os 3 melhores por confiança
  const topResults = results
    .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
    .slice(0, 3);
  
  console.log(`⚠️ Usando fallback: ${topResults.length} melhores resultados por confiança`);
  return topResults;
}

// 🏛️ FUNÇÃO: Validar endereço por CEP (ViaCEP)
async function validateByCEP(results: SearchResult[], street: string, number: string, city: string): Promise<SearchResult[]> {
  try {
    // Buscar CEP do endereço no ViaCEP
    const viaCepUrl = `https://viacep.com.br/ws/${city.replace(/\s+/g, '%20')}/${street.replace(/\s+/g, '%20')}/json/`;
    console.log(`🔍 Buscando CEP: ${viaCepUrl}`);
    
    const response = await fetch(viaCepUrl, { 
      signal: AbortSignal.timeout(5000) // 5s timeout
    });
    
    if (!response.ok) throw new Error('ViaCEP falhou');
    
    const cepData = await response.json();
    
    if (Array.isArray(cepData) && cepData.length > 0) {
      const validCEP = cepData[0].cep;
      const validNeighborhood = cepData[0].bairro;
      
      console.log(`✅ CEP encontrado: ${validCEP} - Bairro: ${validNeighborhood}`);
      
      // Filtrar resultados que coincidem com CEP ou bairro
      const validResults = results.filter(result => {
        const resultNeighborhood = result.address.neighbourhood?.toLowerCase();
        const validNeighborhoodLower = validNeighborhood?.toLowerCase();
        
        const neighborhoodMatch = resultNeighborhood && validNeighborhoodLower &&
          (resultNeighborhood.includes(validNeighborhoodLower) || 
           validNeighborhoodLower.includes(resultNeighborhood));
        
        if (neighborhoodMatch) {
          result.confidence += 0.4; // Grande bonus para bairro correto
          console.log(`🎯 Bairro correto: ${result.display_name}`);
        }
        
        return neighborhoodMatch;
      });
      
      return validResults;
    }
  } catch (error) {
    console.log('⚠️ Erro na validação por CEP:', error);
  }
  
  return [];
}

// 🗺️ BASE DE CONHECIMENTO: Endereços específicos de Uberlândia
const UBERLANDIA_ADDRESS_KNOWLEDGE: { [key: string]: { neighborhood: string; cep?: string; description: string } } = {
  'afonso pena': {
    neighborhood: 'centro',
    cep: '38400',
    description: 'Avenida principal do centro de Uberlândia'
  },
  'joão pinheiro': {
    neighborhood: 'centro',
    cep: '38400', 
    description: 'Avenida central histórica'
  },
  'cesário alvim': {
    neighborhood: 'tibery',
    cep: '38400',
    description: 'Avenida do bairro Tibery'
  },
  'floriano peixoto': {
    neighborhood: 'centro',
    cep: '38400',
    description: 'Rua do centro comercial'
  },
  'santos dumont': {
    neighborhood: 'centro',
    cep: '38400',
    description: 'Praça central'
  }
};

// 🏘️ FUNÇÃO: Filtrar por bairro mais provável
function filterByMostLikelyNeighborhood(results: SearchResult[], street: string, number?: string, userLocation?: { lat: number; lng: number; city?: string }): SearchResult[] {
  // 🎯 PRIMEIRO: Verificar conhecimento específico de Uberlândia
  const streetKey = street.toLowerCase().replace(/rua|avenida|alameda/g, '').trim();
  const knownAddress = Object.entries(UBERLANDIA_ADDRESS_KNOWLEDGE).find(([key]) => 
    streetKey.includes(key) || key.includes(streetKey)
  );
  
  if (knownAddress) {
    const [, info] = knownAddress;
    console.log(`🧠 Conhecimento local: "${street}" deve estar em "${info.neighborhood}"`);
    
    // Filtrar resultados que coincidem com o bairro conhecido
    const knownResults = results.filter(result => {
      const neighborhood = result.address.neighbourhood?.toLowerCase() || '';
      const city = result.address.city?.toLowerCase() || '';
      
      const isCorrectNeighborhood = neighborhood.includes(info.neighborhood) || 
                                   city.includes(info.neighborhood) ||
                                   result.display_name.toLowerCase().includes(info.neighborhood);
      
      if (isCorrectNeighborhood) {
        result.confidence += 0.5; // Grande bonus para conhecimento local
        console.log(`🎯 Bairro correto por conhecimento: ${result.display_name}`);
      }
      
      return isCorrectNeighborhood;
    });
    
    if (knownResults.length > 0) {
      console.log(`✅ Conhecimento local aplicado: ${knownResults.length} resultados corretos`);
      return knownResults;
    }
  }
  // Agrupar por bairro
  const byNeighborhood: { [key: string]: SearchResult[] } = {};
  
  results.forEach(result => {
    const neighborhood = result.address.neighbourhood || result.address.city || 'unknown';
    const key = neighborhood.toLowerCase();
    
    if (!byNeighborhood[key]) byNeighborhood[key] = [];
    byNeighborhood[key].push(result);
  });
  
  // Encontrar bairro com maior confiança média
  let bestNeighborhood = '';
  let bestConfidence = 0;
  
  Object.entries(byNeighborhood).forEach(([neighborhood, neighborhoodResults]) => {
    const avgConfidence = neighborhoodResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / neighborhoodResults.length;
    const hasExactNumber = number ? neighborhoodResults.some(r => r.address.house_number === number) : false;
    
    // Bonus para bairro com número exato
    const finalConfidence = avgConfidence + (hasExactNumber ? 0.3 : 0);
    
    console.log(`🏘️ Bairro "${neighborhood}": ${neighborhoodResults.length} resultados, confiança ${finalConfidence.toFixed(3)}`);
    
    if (finalConfidence > bestConfidence) {
      bestConfidence = finalConfidence;
      bestNeighborhood = neighborhood;
    }
  });
  
  if (bestNeighborhood && byNeighborhood[bestNeighborhood]) {
    console.log(`🏆 Melhor bairro: "${bestNeighborhood}" com confiança ${bestConfidence.toFixed(3)}`);
    return byNeighborhood[bestNeighborhood];
  }
  
  return results;
}

// 📏 FUNÇÃO: Filtrar por proximidade ao centro da cidade
function filterByProximityToCenter(results: SearchResult[], userLocation?: { lat: number; lng: number }): SearchResult[] {
  if (!userLocation) return results;
  
  // Calcular distância de cada resultado ao centro (posição do usuário)
  const withDistance = results.map(result => ({
    ...result,
    distanceToCenter: haversineKm(userLocation.lat, userLocation.lng, result.lat, result.lng)
  }));
  
  // Ordenar por proximidade
  withDistance.sort((a, b) => a.distanceToCenter - b.distanceToCenter);
  
  // Retornar apenas os mais próximos (dentro de 5km do centro)
  const nearCenter = withDistance.filter(result => result.distanceToCenter <= 5);
  
  console.log(`📏 Proximidade: ${nearCenter.length} resultados dentro de 5km do centro`);
  
  return nearCenter;
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

    // ✅ CORRIGIDO: Verificar se a resposta é JSON válido
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      console.warn('⚠️ Nominatim retornou resposta não-JSON:', contentType);
      return [];
    }

    let data: NominatimItem[];
    try {
      data = await response.json();
    } catch (jsonError) {
      console.error('❌ Erro ao parsear JSON do Nominatim:', jsonError);
      console.error('❌ Resposta recebida:', await response.text());
      return [];
    }

    if (!Array.isArray(data)) {
      console.warn('⚠️ Nominatim retornou estrutura inválida:', data);
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
    // ✅ CORRIGIDO: Validação mais robusta do request
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error('❌ Erro ao parsear JSON do request:', parseError);
      return NextResponse.json({ 
        success: false, 
        error: 'Request JSON inválido' 
      }, { status: 400 });
    }

    const { query, userLocation, limit = 10, searchMode, streetOnly, numberOnly } = requestBody;

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
    
    try {
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
    } catch (searchError) {
      console.error('❌ Erro durante a busca:', searchError);
      // ✅ NOVO: Fallback básico quando as APIs externas falham
      console.log('🔄 Tentando fallback básico...');
      
      try {
        // Criar resultado básico baseado na query
        const fallbackResult: SearchResult = {
          id: `fallback-${Date.now()}`,
          display_name: query,
          lat: userLocation?.lat || -18.9186, // Coordenadas padrão de Uberlândia
          lng: userLocation?.lng || -48.2772,
          address: {
            road: street,
            house_number: number,
            city: userLocation?.city || 'Uberlândia',
            state: userLocation?.state || 'MG',
            country: 'Brasil'
          },
          type: 'place',
          importance: 0.5,
          confidence: 0.5,
          distance: 0
        };
        
        results.push(fallbackResult);
        console.log('✅ Fallback básico criado:', fallbackResult.display_name);
      } catch (fallbackError) {
        console.error('❌ Erro no fallback:', fallbackError);
      }
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

    // ✅ NOVA LÓGICA: FILTRAR APENAS RESULTADOS DA CIDADE DO USUÁRIO
    if (userLocation?.city) {
      const userCity = userLocation.city.toLowerCase();
      const userState = userLocation.state?.toLowerCase();
      
      console.log(`🏙️ Filtrando por cidade: "${userCity}" e estado: "${userState}"`);
      
      const cityFilteredResults = results.filter(result => {
        const resultCity = result.address.city?.toLowerCase();
        const resultState = result.address.state?.toLowerCase();
        
        // ✅ VALIDAÇÃO: Deve estar na mesma cidade OU no mesmo estado se cidade não especificada
        const sameCity = resultCity && resultCity.includes(userCity);
        const sameState = resultState && userState && resultState.includes(userState);
        
        // ✅ BONUS: Se tem número exato, ser mais flexível com cidade
        const hasExactNumber = number && result.address.house_number === number;
        
        if (sameCity) {
          console.log(`✅ ${result.display_name} - MESMA CIDADE: ${resultCity}`);
          return true;
        }
        
        if (sameState && hasExactNumber) {
          console.log(`⚠️ ${result.display_name} - MESMO ESTADO + NÚMERO EXATO: ${resultState}`);
          return true;
        }
        
        if (hasExactNumber && !resultCity) {
          console.log(`⚠️ ${result.display_name} - NÚMERO EXATO sem cidade especificada`);
          return true;
        }
        
        // ✅ MELHORIA: Ser mais flexível com cidades similares
        if (resultCity && (resultCity.includes('uberlandia') || resultCity.includes('uberlândia'))) {
          console.log(`✅ ${result.display_name} - CIDADE SIMILAR: ${resultCity}`);
          return true;
        }
        
        console.log(`❌ ${result.display_name} - CIDADE DIFERENTE: ${resultCity} vs ${userCity}`);
        return false;
      });
      
      console.log(`🏙️ Filtro por cidade: ${results.length} → ${cityFilteredResults.length} resultados`);
      results = cityFilteredResults;
    }

    // 🔧 FLEXIBILIZAR VALIDAÇÃO DE NÚMEROS - PERMITIR RESULTADOS SEM NÚMERO QUANDO NECESSÁRIO
    if (number) {
      const validatedResults = results.filter(result => {
        const resultNumber = result.address.house_number;
        
        // ✅ PRIORIDADE 1: Se tem o número exato, sempre manter
        if (resultNumber === number) {
          console.log(`🎯 ${result.display_name} - NÚMERO EXATO: ${resultNumber}`);
          result.confidence += 0.3; // Grande bonus
          return true;
        }
        
        // ✅ PRIORIDADE 2: Se tem qualquer número válido na mesma rua
        if (resultNumber && /^\d+$/.test(resultNumber) && resultNumber.length <= 5) {
          const street = result.address.road?.toLowerCase() || '';
          const searchStreet = extractAddressNumber(query).street.toLowerCase();
          
          if (street.includes(searchStreet) || searchStreet.includes(street)) {
            console.log(`✅ ${result.display_name} - MESMA RUA COM NÚMERO: ${resultNumber}`);
            result.confidence += 0.1;
            return true;
          }
        }
        
        // ✅ PRIORIDADE 3: Se é da mesma rua mesmo sem número (FALLBACK)
        const street = result.address.road?.toLowerCase() || '';
        const searchStreet = extractAddressNumber(query).street.toLowerCase();
        
        if (street.includes(searchStreet) || searchStreet.includes(street)) {
          console.log(`⚠️ ${result.display_name} - MESMA RUA SEM NÚMERO (fallback permitido)`);
          result.confidence += 0.05; // Bonus menor
          return true;
        }
        
        console.log(`❌ ${result.display_name} - NÃO RELACIONADO`);
        return false;
      });
      
      console.log(`🔢 Validação FLEXÍVEL: ${results.length} → ${validatedResults.length} resultados válidos`);
      results = validatedResults;
      
      // ✅ Se não encontrou nada, ser ainda mais flexível
      if (validatedResults.length === 0) {
        console.log('🆘 NENHUM RESULTADO - sendo mais flexível...');
        
        const fallbackResults = results.filter(result => {
          const street = result.address.road?.toLowerCase() || result.display_name.toLowerCase();
          const searchStreet = extractAddressNumber(query).street.toLowerCase();
          
          // Aceitar qualquer resultado da mesma rua
          return street.includes(searchStreet) || searchStreet.includes(street);
        });
        
        console.log(`🆘 Fallback: ${fallbackResults.length} resultados encontrados`);
        results = fallbackResults;
      }
    }
    
    // ✅ NOVA LÓGICA: PRIORIZAR RESULTADOS DA CIDADE DO USUÁRIO
    if (userLocation?.city) {
      const userCity = userLocation.city.toLowerCase();
      
      results.forEach(result => {
        const resultCity = result.address.city?.toLowerCase();
        
        // ✅ BONUS para mesma cidade
        if (resultCity && resultCity.includes(userCity)) {
          result.confidence += 0.3;
          console.log(`🏙️ BONUS CIDADE: ${result.display_name} +0.3 confiança`);
        }
        
        // ✅ BONUS para cidades similares
        if (resultCity && (resultCity.includes('uberlandia') || resultCity.includes('uberlândia'))) {
          result.confidence += 0.2;
          console.log(`🏙️ BONUS CIDADE SIMILAR: ${result.display_name} +0.2 confiança`);
        }
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

    // 🎯 VALIDAÇÃO INTELIGENTE DE LOCALIZAÇÃO - FILTRAR DUPLICATAS POR ENDEREÇO REAL
    const validatedResults = await validateAndFilterRealLocations(uniqueResults, query, userLocation);

    // Limitar resultados após validação
    const limitedResults = validatedResults.slice(0, limit);

    console.log(`✅ Encontrados ${limitedResults.length} resultados únicos (${uniqueResults.length} antes da validação)`);
    
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
    
    // ✅ CORRIGIDO: Log mais detalhado do erro
    if (error instanceof Error) {
      console.error('❌ Detalhes do erro:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
    }
    
    return NextResponse.json({ 
      success: false, 
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
