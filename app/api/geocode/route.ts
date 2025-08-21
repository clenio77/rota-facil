import { NextRequest, NextResponse } from 'next/server';
import { searchGeocodingCache, saveToGeocodingCache } from '../../../lib/geocodingCache';

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
async function geocodeWithViaCEP(cep: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return null;

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const data = await response.json();

    if (data.erro) return null;

    // FILTRO RIGOROSO: Se temos localização do usuário, verificar se o CEP é da mesma cidade
    if (userLocation?.city) {
      const cepCity = normalizeStr(data.localidade);
      const userCity = normalizeStr(userLocation.city);

      if (cepCity !== userCity) {
        console.log(`ViaCEP: REJEITADO - CEP de ${data.localidade} mas usuário está em ${userLocation.city}`);
        return null;
      }
    }

    // ViaCEP não retorna coordenadas, usar Nominatim para geocodificar o endereço completo
    const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}, Brasil`;
    const nominatimResult = await geocodeWithNominatim(fullAddress, userLocation);

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

// Utilitário: remover acentos para comparação robusta
function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Extração simples de rua e número do texto
function extractStreetAndNumberLoose(text: string): { street: string; number?: string } | null {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  // Padrões comuns: "Rua X, 123" | "Avenida X 123" | "X 123"
  const numMatch = cleaned.match(/(.*?)[,\s]+(\d{1,6})(?:\D|$)/);
  if (numMatch) {
    const street = numMatch[1].replace(/[.,]$/,'').trim();
    const number = numMatch[2];
    if (street && number) return { street, number };
  }
  // Sem número explícito
  return null;
}

// Busca ViaCEP por UF/Cidade/Logradouro e geocodifica com número (quando possível)
async function geocodeWithViaCepAddressLookup(address: string, userLocation?: { lat?: number; lng?: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  try {
    if (!userLocation?.city || !userLocation?.state) return null;

    const parts = extractStreetAndNumberLoose(address);
    if (!parts) return null; // só aplicável quando há número explícito

    const uf = userLocation.state.toUpperCase();
    const city = encodeURIComponent(userLocation.city);
    const streetQuery = encodeURIComponent(parts.street);
    const url = `https://viacep.com.br/ws/${uf}/${city}/${streetQuery}/json/`;
    const resp = await fetch(url);
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) return null;

    // Escolher o melhor logradouro (normalização simples)
    const target = data.find((d: any) => normalizeStr(d.logradouro || '').includes(normalizeStr(parts.street))) || data[0];
    const street = target.logradouro || parts.street;
    const bairro = target.bairro || '';
    const localidade = target.localidade || userLocation.city;
    const ufRet = target.uf || uf;
    const cep = (target.cep || '').replace(/\D/g, '');

    // Geocodificar usando Nominatim estruturado com número + cidade/UF
    const structuredStreet = [street, parts.number].filter(Boolean).join(' ');
    const result = await geocodeWithNominatim(structuredStreet, { ...userLocation, city: localidade, state: ufRet });
    if (!result) return null;

    return {
      ...result,
      confidence: Math.max(0.93, result.confidence || 0),
      provider: 'viacep-addr+nominatim',
      formatted_address: `${street}, ${parts.number || ''}${parts.number ? ', ' : ''}${bairro ? bairro + ', ' : ''}${localidade} - ${ufRet}, ${cep}`.trim()
    };
  } catch (e) {
    console.error('Erro ViaCEP (logradouro):', e);
    return null;
  }
}


// Utilitário: distância Haversine (km)
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

const MAX_LOCAL_DISTANCE_KM = 50; // limite para considerar "na região" quando só temos coordenadas

// Provider 2: Mapbox Geocoding API
async function geocodeWithMapbox(address: string, userLocation?: { lat?: number; lng?: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
  if (!mapboxToken) return null;

  try {
    // Construir query com contexto de localização se disponível (cidade/estado)
    let query = address;
    if (userLocation?.city) {
      query = `${address}, ${userLocation.city}`;
      if (userLocation.state) {
        query += `, ${userLocation.state}`;
      }
    }

    // Montar URL com proximidade se tivermos coordenadas do dispositivo
    const baseUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
    const params: string[] = [
      'country=BR',
      'types=address,poi',
      'limit=5',
      'language=pt',
      `access_token=${mapboxToken}`
    ];
    if (typeof userLocation?.lng === 'number' && typeof userLocation?.lat === 'number') {
      params.push(`proximity=${userLocation.lng},${userLocation.lat}`);
    }

    const response = await fetch(`${baseUrl}?${params.join('&')}`);
    const data = await response.json();

    if (data.features && data.features.length > 0) {
      // Filtrar e ordenar resultados por qualidade (casa > rua/POI) e proximidade
      const features = data.features
        .filter((feature: MapboxFeature) => {
          const [lng, lat] = feature.center;
          if (!isValidBrazilianCoordinate(lat, lng)) return false;

          // Respeitar cidade quando informada
          if (userLocation?.city) {
            const featureContext = feature.context || [];
            const featureCity = featureContext.find((ctx) =>
              ctx.id.startsWith('place') || ctx.id.startsWith('locality')
            );
            const cityOk = featureCity && normalizeStr(featureCity.text) === normalizeStr(userLocation.city);
            if (!cityOk) return false;
          } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
            const dist = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
            if (dist > MAX_LOCAL_DISTANCE_KM) return false;
          }

          return true;
        })
        .map((feature: MapboxFeature): MapboxFeatureResult & { hasNumber: boolean; dist: number } => {
          const [lng, lat] = feature.center;
          // Tenta detectar número (endereço tipo address geralmente contém número no place_name)
          const hasNumber = /,\s*\d+/.test(feature.place_name);
          const dist = (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number')
            ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
            : Infinity;

          let confidence = feature.relevance || 0.8;
          if (userLocation?.city || (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number')) {
            confidence = Math.min(1.0, confidence + 0.2);
          }

          return {
            feature,
            lat,
            lng,
            confidence,
            address: feature.place_name,
            formatted_address: feature.place_name,
            hasNumber,
            dist
          };
        })
        // Ordenar: com número primeiro, depois por distância, depois por confiança
        .sort((a, b) => {
          if (a.hasNumber !== b.hasNumber) return a.hasNumber ? -1 : 1;
          if (a.dist !== b.dist) return a.dist - b.dist;
          return (b.confidence - a.confidence);
        });

      if (features.length > 0) {
        const best = features[0];

        return {
          lat: best.lat,
          lng: best.lng,
          address: best.address,
          confidence: best.hasNumber ? Math.max(0.86, best.confidence) : best.confidence,
          provider: 'mapbox',
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

// Provider 2b: Photon (Komoot) - open source, sem chave
async function geocodeWithPhoton(address: string, userLocation?: { lat?: number; lng?: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  try {
    // Montar query com viés local quando possível
    const params: string[] = [
      `q=${encodeURIComponent(address)}`,
      'lang=pt',
      'limit=5'
    ];
    if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
      params.push(`lat=${userLocation.lat}`);
      params.push(`lon=${userLocation.lng}`);
    }
    const url = `https://photon.komoot.io/api/?${params.join('&')}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data || !Array.isArray(data.features) || data.features.length === 0) return null;

    type PhotonFeature = { geometry: { coordinates: [number, number] }; properties: { name?: string; city?: string; state?: string; country?: string; countrycode?: string; street?: string; housenumber?: string; }; };

    const results = (data.features as PhotonFeature[])
      .map((f) => {
        const [lng, lat] = f.geometry.coordinates;
        const hasNumber = !!f.properties.housenumber;
        const nameParts = [
          f.properties.street || f.properties.name,
          f.properties.housenumber,
          f.properties.city,
          f.properties.state
        ].filter(Boolean);
        const place = nameParts.join(', ');
        const dist = (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number')
          ? haversineKm(userLocation.lat, userLocation.lng, lat, lng)
          : Infinity;
        return { lat, lng, place, props: f.properties, hasNumber, dist };
      })
      .filter((r) => isValidBrazilianCoordinate(r.lat, r.lng) && (!r.props.countrycode || r.props.countrycode.toLowerCase() === 'br'))
      .filter((r) => {
        if (userLocation?.city) {
          // Quando o servidor vem com city/state, filtra estritamente. Caso forceLocalSearch=false, o POST já removeu city/state.
          const rc = normalizeStr(r.props.city || '');
          const uc = normalizeStr(userLocation.city);
          if (!rc || rc !== uc) {
            return false;
          }
        } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
          if (r.dist > MAX_LOCAL_DISTANCE_KM) {
            return false;
          }
        }
        return true;
      })
      // Ordenar: com número primeiro, depois mais próximo
      .sort((a, b) => {
        if (a.hasNumber !== b.hasNumber) return a.hasNumber ? -1 : 1;
        return (a.dist || Infinity) - (b.dist || Infinity);
      });

    if (results.length === 0) return null;
    const best = results[0];
    return {
      lat: best.lat,
      lng: best.lng,
      address: best.place || `${address}${userLocation?.city ? ', ' + userLocation.city : ''}`,
      confidence: best.hasNumber ? 0.85 : 0.7,
      provider: 'photon',
      formatted_address: best.place || `${address}`
    };
  } catch (e) {
    console.error('Erro Photon:', e);
    return null;
  }
}


// Provider 3: Nominatim (fallback gratuito)
async function geocodeWithNominatim(address: string, userLocation?: { lat?: number; lng?: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  try {
    // 1) Tente busca estruturada se soubermos a cidade/estado do usuário
    if (userLocation?.city) {
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('countrycodes', 'br');
      url.searchParams.set('limit', '5');
      url.searchParams.set('addressdetails', '1');
      url.searchParams.set('extratags', '1');
      url.searchParams.set('namedetails', '1');
      url.searchParams.set('street', address); // rua + número que o usuário falou
      url.searchParams.set('city', userLocation.city);
      if (userLocation.state) url.searchParams.set('state', userLocation.state);
      url.searchParams.set('country', 'Brasil');

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'RotaFacil/1.0 (contato@rotafacil.com)',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      });
      const data = await response.json();

      if (Array.isArray(data) && data.length > 0) {
        const results = data
          .map((r: any) => ({ ...r, lat: parseFloat(r.lat), lon: parseFloat(r.lon) }))
          .filter((r: any) => isValidBrazilianCoordinate(r.lat, r.lon))
          .filter((r: any) => normalizeStr(r.display_name || '').includes(normalizeStr(userLocation.city!)));

        if (results.length > 0) {
          // Preferir casa (house) ou building; senão, pegar o mais detalhado
          results.sort((a: any, b: any) => {
            const rank = (x: any) => (
              x.type === 'house' ? 3 : x.class === 'building' ? 2 : x.osm_type === 'way' ? 1 : 0
            );
            return rank(b) - rank(a);
          });

          const r = results[0];
          let confidence = 0.85;
          if (r.osm_type === 'way') confidence = 0.9;
          if (r.class === 'building') confidence = 0.92;
          if (r.type === 'house') confidence = 0.96;

          return {
            lat: r.lat,
            lng: r.lon,
            address: r.display_name,
            confidence,
            provider: 'nominatim-structured',
            formatted_address: r.display_name
          };
        }
      }
    }

    // 2) Fallback: busca por q= com possível viewbox limitado às coordenadas do dispositivo
    const url2 = new URL('https://nominatim.openstreetmap.org/search');
    url2.searchParams.set('format', 'json');
    url2.searchParams.set('q', address);
    url2.searchParams.set('countrycodes', 'br');
    url2.searchParams.set('limit', '5');
    url2.searchParams.set('addressdetails', '1');
    url2.searchParams.set('extratags', '1');
    url2.searchParams.set('namedetails', '1');

    if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
      // Aproxima uma caixa de ~50km
      const lat = userLocation.lat;
      const lng = userLocation.lng;
      const dLat = 0.6;
      const dLng = 0.6 / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
      const left = lng - dLng;
      const right = lng + dLng;
      const top = lat + dLat;
      const bottom = lat - dLat;
      url2.searchParams.set('viewbox', `${left},${top},${right},${bottom}`);
      url2.searchParams.set('bounded', '1');
    }

    const response = await fetch(url2.toString(), {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (contato@rotafacil.com)',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);

      if (!isValidBrazilianCoordinate(lat, lng)) {
        return null;
      }

      if (userLocation?.city) {
        const resultAddress = normalizeStr(result.display_name);
        const userCity = normalizeStr(userLocation.city);
        if (!resultAddress.includes(userCity)) {
          console.log(`Nominatim: REJEITADO - endereço fora da cidade ${userLocation.city}`);
          return null;
        }
      } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
        const dist = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        if (dist > MAX_LOCAL_DISTANCE_KM) {
          console.log(`Nominatim: REJEITADO por distância ${dist.toFixed(1)}km (> ${MAX_LOCAL_DISTANCE_KM}km)`);
          return null;
        }
      }

      let confidence = 0.6;
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

    return null;
  } catch (error) {
    console.error('Erro Nominatim:', error);
    return null;
  }
}

// Provider 4: Google Geocoding (último recurso)
async function geocodeWithGoogle(address: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
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

      if (!isValidBrazilianCoordinate(lat, lng)) {
        return null;
      }

      // FILTRO RIGOROSO: Se temos localização do usuário, APENAS aceitar endereços da mesma cidade
      if (userLocation?.city) {
        const cityComponent = result.address_components.find((component: { types: string[]; long_name: string }) =>
          component.types.includes('locality') || component.types.includes('administrative_area_level_2')
        );

        const comp = cityComponent?.long_name ? normalizeStr(cityComponent.long_name) : '';
        const want = normalizeStr(userLocation.city);
        if (!cityComponent || comp !== want) {
          console.log(`Google: REJEITADO - endereço fora da cidade ${userLocation.city} (encontrado: ${cityComponent?.long_name || 'desconhecida'})`);
          return null;
        }
      } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
        // Sem cidade: filtrar por proximidade comparando bounds do resultado
        // Quando o resultado não tem bounds, usar distância do ponto central
        const resultLocation = result.geometry.location;
        const dist = haversineKm(userLocation.lat, userLocation.lng, resultLocation.lat, resultLocation.lng);
        if (dist > MAX_LOCAL_DISTANCE_KM) {
          console.log(`Google: REJEITADO por distância ${dist.toFixed(1)}km (> ${MAX_LOCAL_DISTANCE_KM}km)`);
          return null;
        }
      }

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

    return null;
  } catch (error) {
    console.error('Erro Google:', error);
    return null;
  }
}

// Função principal de geocodificação com hierarquia de provedores
async function geocodeAddressImproved(originalAddress: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  const address = normalizeAddress(originalAddress);
  const cep = extractCEP(address);

  console.log(`Geocodificando: "${address}" (CEP: ${cep})`);
  if (userLocation) {
    console.log(`Contexto do usuário: ${userLocation.city || 'cidade desconhecida'} - ${userLocation.state || 'estado desconhecido'}`);
  }

  // 0. Verificar cache primeiro (melhoria gratuita!)
  const cachedResult = await searchGeocodingCache(originalAddress);
  if (cachedResult) {
    console.log('Resultado encontrado no cache');

    // Aplicar boost de confiança se o resultado for da mesma cidade
    let confidence = cachedResult.confidence;
    if (userLocation?.city && cachedResult.city &&
        cachedResult.city.toLowerCase() === userLocation.city.toLowerCase()) {
      confidence = Math.min(1.0, confidence + 0.2); // Boost de 20% para mesma cidade
      console.log(`Boost aplicado: resultado da mesma cidade (${cachedResult.city})`);
    }

    return {
      lat: cachedResult.lat,
      lng: cachedResult.lng,
      address: cachedResult.formatted_address,
      confidence,
      provider: cachedResult.provider,
      formatted_address: cachedResult.formatted_address
    };
  }

  // 1. Se temos CEP, tentar ViaCEP primeiro
  if (cep) {
    const viaCepResult = await geocodeWithViaCEP(cep, userLocation);
    if (viaCepResult && viaCepResult.confidence >= 0.8) {
      console.log('Geocodificação via ViaCEP+Nominatim bem-sucedida');
      return viaCepResult;
    }
  }

  // 2. Tentar Mapbox (se configurado)
  const mapboxResult = await geocodeWithMapbox(address, userLocation);
  if (mapboxResult && mapboxResult.confidence >= 0.6) {
    console.log('Geocodificação via Mapbox bem-sucedida');
    return mapboxResult;
  }

  // 2b. Se temos cidade/UF e número, tentar ViaCEP por logradouro para obter CEP correto e geocodificar com número preciso
  const viaCepAddrResult = await geocodeWithViaCepAddressLookup(address, userLocation);
  if (viaCepAddrResult && viaCepAddrResult.confidence >= 0.9) {
    console.log('Geocodificação via ViaCEP (logradouro)+Nominatim bem-sucedida');
    return viaCepAddrResult;
  }

  // 3. Tentar Photon (open-source, sem chave)
  const photonResult = await geocodeWithPhoton(address, userLocation);
  if (photonResult && photonResult.confidence >= 0.6) {
    console.log('Geocodificação via Photon bem-sucedida');
    return photonResult;
  }

  // 4. Tentar Nominatim
  const nominatimResult = await geocodeWithNominatim(address, userLocation);
  if (nominatimResult && nominatimResult.confidence >= 0.4) {
    console.log('Geocodificação via Nominatim bem-sucedida');
    return nominatimResult;
  }

  // 5. Último recurso: Google (se configurado)
  const googleResult = await geocodeWithGoogle(address, userLocation);
  if (googleResult) {
    console.log('Geocodificação via Google bem-sucedida');
    return googleResult;
  }

  // 6. Se nada funcionou, tentar versões simplificadas do endereço
  if (address.includes(',')) {
    const simplifiedAddress = address.split(',')[0].trim() + ', Brasil';
    const fallbackResult = await geocodeWithNominatim(simplifiedAddress, userLocation);
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

// Wrapper para salvar resultado no cache
async function geocodeAndCache(originalAddress: string, userLocation?: { lat: number; lng: number; city?: string; state?: string }): Promise<GeocodeResult | null> {
  const result = await geocodeAddressImproved(originalAddress, userLocation);

  if (result && !result.provider.includes('cache')) {
    // Salvar apenas se não veio do cache
    await saveToGeocodingCache(originalAddress, {
      lat: result.lat,
      lng: result.lng,
      address: result.formatted_address || result.address,
      confidence: result.confidence,
      provider: result.provider
    });
  }

  return result;
}

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
  address: string;
  formatted_address: string;
}

export async function POST(request: NextRequest) {
  try {
    const { address, userLocation, forceLocalSearch } = await request.json();

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Endereço inválido ou muito curto'
      }, { status: 400 });
    }

    // Se forceLocalSearch for false, não envie city/state para provedores rígidos
    const relaxedUserLocation = !forceLocalSearch && userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : userLocation;

    const result = await geocodeAndCache(address, relaxedUserLocation);

    if (!result) {
      // Log específico para debug de filtro de localização
      if (userLocation?.city) {
        console.log(`Geocodificação falhou para "${address}" - FILTRADO por não estar em ${userLocation.city}`);
      }

      return NextResponse.json({
        success: false,
        error: userLocation?.city
          ? `Endereço não encontrado em ${userLocation.city}. Tente ser mais específico (ex: "Rua Principal, 123" ou "Centro").`
          : 'Endereço não encontrado ou fora do Brasil',
        attempted_address: address,
        user_city: userLocation?.city || null,
        user_state: userLocation?.state || null,
        filter_active: !!userLocation?.city,
        suggestion: userLocation?.city
          ? `Tente: "${address}, ${userLocation.city}" ou seja mais específico com o nome da rua.`
          : null
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