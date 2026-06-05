// RotaFácil - Serviço de Geocodificação Centralizado 🌍🔍
// Unifica e otimiza a lógica de geocodificação usando múltiplos provedores em cascata.

import { searchGeocodingCache, saveToGeocodingCache } from './geocodingCache';
import { CONFIG } from './config';

export interface GeocodeResult {
  lat: number;
  lng: number;
  address: string;
  confidence: number;
  provider: string;
  formatted_address?: string;
}

export interface UserLocationContext {
  lat?: number;
  lng?: number;
  city?: string;
  state?: string;
}

interface MapboxFeature {
  id: string;
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

// 📏 Limite para considerar "na região" do usuário
const MAX_LOCAL_DISTANCE_KM = 50;

// 🇧🇷 Validação geográfica: limites aproximados do território brasileiro
export function isValidBrazilianCoordinate(lat: number, lng: number): boolean {
  return lat >= -33.7 && lat <= 5.3 && lng >= -73.9 && lng <= -28.8;
}

// 🧹 Normalização de endereços para otimizar correspondências nos provedores
export function normalizeAddress(address: string): string {
  return address
    .replace(/\s+/g, ' ')
    .replace(/[,]{2,}/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .replace(/\b(rua|r)\.?(?=\s|$)/gi, 'Rua')
    .replace(/\b(avenida|av)\.?(?=\s|$)/gi, 'Avenida')
    .replace(/\b(alameda|al)\.?(?=\s|$)/gi, 'Alameda')
    .replace(/\b(travessa|tv)\.?(?=\s|$)/gi, 'Travessa')
    .replace(/\b(estrada|est)\.?(?=\s|$)/gi, 'Estrada')
    .replace(/\b(rodovia|rod)\.?(?=\s|$)/gi, 'Rodovia')
    .replace(/\b(n[º°]?\.?\s*)/gi, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// 📬 Extração de CEP brasileiro (8 dígitos com ou sem hífen)
export function extractCEP(address: string): string | null {
  const cepMatch = address.match(/\b(\d{5}-?\d{3})\b/);
  return cepMatch ? cepMatch[1].replace('-', '') : null;
}

// 🔤 Utilitário para remover acentos e normalizar strings em minúsculo
export function normalizeStr(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// 📐 Distância Haversine em km entre dois pontos geográficos
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371; // Raio da Terra em km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 🏠 Extrai rua e número de forma tolerante (ex: "Av. Paulista, 1000" -> "Av. Paulista", "1000")
export function extractStreetAndNumberLoose(text: string): { street: string; number?: string } | null {
  // Tratamento especial para "teste123"
  if (text.toLowerCase().includes('teste123')) return null;

  const cleaned = text.replace(/\s+/g, ' ').trim();
  
  const patterns = [
    // Padrão 1: Nome da rua + vírgula + número
    /^(.+?),\s*(\d{1,6})(?:\D.*)?$/,
    // Padrão 2: Nome da rua + espaço + número (no final)
    /^(.+?)\s+(\d{1,6})(?:\s*[^\d].*)?$/,
    // Padrão 3: Capturar número no meio (mais conservador)
    /^(.+?)\s+(\d{1,6})\s*(?:,|$)/
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const street = match[1].replace(/[.,]$/, '').trim();
      const number = match[2];

      // Ignorar se o número for parte de um CEP (ex: 01311-100 ou 38400000)
      const textAfter = cleaned.substring(cleaned.indexOf(number) + number.length);
      const isPartOfCEP = /^\s*-\s*\d{3}/.test(textAfter) || (number.length === 5 && /^\d{3}/.test(textAfter));

      if (isPartOfCEP) continue;

      const numValue = parseInt(number);
      if (numValue > 0 && numValue <= 99999) {
        return { street, number };
      }
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// 🔌 PROVEDORES DE GEOCODIFICAÇÃO
// -----------------------------------------------------------------------------

// 1. ViaCEP + Nominatim (para CEPs estruturados)
export async function geocodeWithViaCEP(cep: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');
    if (cleanCEP.length !== 8) return null;

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    const data = await response.json();

    if (data.erro) return null;

    // Filtro rigoroso: se houver cidade do usuário, comparar
    if (userLocation?.city) {
      const cepCity = normalizeStr(data.localidade);
      const userCity = normalizeStr(userLocation.city);

      if (cepCity !== userCity) {
        console.log(`ViaCEP: CEP de ${data.localidade} rejeitado, usuário está em ${userLocation.city}`);
        return null;
      }
    }

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
    console.error('Erro no geocodeWithViaCEP:', error);
    return null;
  }
}

// 2. ViaCEP Address Lookup (busca CEP/Bairro pela UF, Cidade e Nome de Logradouro)
export async function geocodeWithViaCepAddressLookup(address: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  try {
    if (!userLocation?.city || !userLocation?.state) {
      return null;
    }

    const parts = extractStreetAndNumberLoose(address);
    if (!parts) {
      return null;
    }

    const uf = userLocation.state.toUpperCase();
    const city = encodeURIComponent(userLocation.city);
    const streetQuery = encodeURIComponent(parts.street);
    const url = `https://viacep.com.br/ws/${uf}/${city}/${streetQuery}/json/`;

    const resp = await fetch(url);
    const data = await resp.json();
    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    // Buscar match exato ou parcial
    const exactMatch = data.find((d: any) => normalizeStr(d.logradouro || '') === normalizeStr(parts.street));
    const partialMatch = data.find((d: any) => normalizeStr(d.logradouro || '').includes(normalizeStr(parts.street)));
    const target = exactMatch || partialMatch || data[0];

    const street = target.logradouro || parts.street;
    const bairro = target.bairro || '';
    const localidade = target.localidade || userLocation.city;
    const ufRet = target.uf || uf;
    const cep = (target.cep || '').replace(/\D/g, '');

    const structuredStreet = [street, parts.number].filter(Boolean).join(' ');
    const result = await geocodeWithNominatim(structuredStreet, { ...userLocation, city: localidade, state: ufRet });
    
    if (!result) return null;

    return {
      ...result,
      confidence: 0.98, // Prioridade muito alta por ser estruturado com CEP oficial
      provider: 'viacep-addr+nominatim',
      formatted_address: `${street}, ${parts.number || ''}${parts.number ? ', ' : ''}${bairro ? bairro + ', ' : ''}${localidade} - ${ufRet}, ${cep}`.trim()
    };
  } catch (e) {
    console.error('Erro no geocodeWithViaCepAddressLookup:', e);
    return null;
  }
}

// 3. Mapbox Geocoding API (com chave de acesso)
export async function geocodeWithMapbox(address: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  const mapboxToken = CONFIG.mapbox.token;
  if (!mapboxToken) return null;

  try {
    let query = address;
    if (userLocation?.city) {
      query = `${address}, ${userLocation.city}`;
      if (userLocation.state) {
        query += `, ${userLocation.state}`;
      }
    }

    const baseUrl = `${CONFIG.mapbox.geocodingUrl}/${encodeURIComponent(query)}.json`;
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
      const features = data.features
        .filter((feature: MapboxFeature) => {
          const [lng, lat] = feature.center;
          if (!isValidBrazilianCoordinate(lat, lng)) return false;

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
        .sort((a, b) => {
          if (a.hasNumber !== b.hasNumber) return a.hasNumber ? -1 : 1;
          if (a.dist !== b.dist) return a.dist - b.dist;
          return b.confidence - a.confidence;
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
    console.error('Erro no geocodeWithMapbox:', error);
    return null;
  }
}

// 4. Photon (Komoot API) - Open source, sem limite e sem chave
export async function geocodeWithPhoton(address: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  try {
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

    type PhotonFeature = {
      geometry: { coordinates: [number, number] };
      properties: {
        name?: string;
        city?: string;
        state?: string;
        country?: string;
        countrycode?: string;
        street?: string;
        housenumber?: string;
      };
    };

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
          const rc = normalizeStr(r.props.city || '');
          const uc = normalizeStr(userLocation.city);
          if (!rc || rc !== uc) return false;
        } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
          if (r.dist > MAX_LOCAL_DISTANCE_KM) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.hasNumber !== b.hasNumber) return a.hasNumber ? -1 : 1;
        return a.dist - b.dist;
      });

    if (results.length === 0) return null;
    const best = results[0];

    return {
      lat: best.lat,
      lng: best.lng,
      address: best.place || `${address}${userLocation?.city ? ', ' + userLocation.city : ''}`,
      confidence: best.hasNumber ? 0.85 : 0.7,
      provider: 'photon',
      formatted_address: best.place || address
    };
  } catch (e) {
    console.error('Erro no geocodeWithPhoton:', e);
    return null;
  }
}

// 5. Nominatim (OpenStreetMap com suporte a busca estruturada por proximidade)
export async function geocodeWithNominatim(address: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  try {
    if (userLocation?.city) {
      const streetParts = extractStreetAndNumberLoose(address);
      const url = new URL('https://nominatim.openstreetmap.org/search');
      url.searchParams.set('format', 'json');
      url.searchParams.set('countrycodes', 'br');
      url.searchParams.set('limit', '10');
      url.searchParams.set('addressdetails', '1');

      if (streetParts && streetParts.number) {
        url.searchParams.set('street', `${streetParts.street} ${streetParts.number}`);
      } else {
        url.searchParams.set('street', address);
      }
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
          .filter((r: any) => isValidBrazilianCoordinate(r.lat, r.lon));

        let cityFilteredResults = results;
        const userCityNorm = normalizeStr(userLocation.city);

        const exactCityResults = results.filter((r: any) => {
          const displayName = normalizeStr(r.display_name || '');
          return displayName.includes(userCityNorm) ||
                 displayName.includes(userCityNorm.replace(/\s+/g, '')) ||
                 (r.address && normalizeStr(r.address.city || '').includes(userCityNorm)) ||
                 (r.address && normalizeStr(r.address.town || '').includes(userCityNorm)) ||
                 (r.address && normalizeStr(r.address.municipality || '').includes(userCityNorm));
        });

        if (exactCityResults.length > 0) {
          cityFilteredResults = exactCityResults;
        } else if (userLocation.lat && userLocation.lng) {
          const nearbyResults = results.filter((r: any) => {
            const distance = haversineKm(userLocation.lat!, userLocation.lng!, r.lat, r.lon);
            return distance <= 20;
          });
          if (nearbyResults.length > 0) {
            cityFilteredResults = nearbyResults;
          } else {
            const regionResults = results.filter((r: any) => {
              const distance = haversineKm(userLocation.lat!, userLocation.lng!, r.lat, r.lon);
              return distance <= 50;
            });
            if (regionResults.length > 0) cityFilteredResults = regionResults;
          }
        }

        let filteredResults = cityFilteredResults;
        if (streetParts && streetParts.number && cityFilteredResults.length > 0) {
          const numberResults = cityFilteredResults.filter((r: any) => {
            const displayName = r.display_name || '';
            const addressObj = r.address || {};
            return displayName.includes(streetParts.number!) || addressObj.house_number === streetParts.number;
          });
          if (numberResults.length > 0) filteredResults = numberResults;
        }

        if (filteredResults.length > 0) {
          filteredResults.sort((a: any, b: any) => {
            const rank = (x: any) => (
              x.type === 'house' ? 3 : x.class === 'building' ? 2 : x.osm_type === 'way' ? 1 : 0
            );
            return rank(b) - rank(a);
          });

          const r = filteredResults[0];
          let confidence = 0.85;
          if (r.osm_type === 'way') confidence = 0.9;
          if (r.class === 'building') confidence = 0.92;
          if (r.type === 'house') confidence = 0.96;

          if (streetParts && streetParts.number &&
              (r.display_name.includes(streetParts.number) || r.address?.house_number === streetParts.number)) {
            confidence = Math.min(0.98, confidence + 0.05);
          }

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

    // Fallback: Busca genérica simplificada
    const url2 = new URL('https://nominatim.openstreetmap.org/search');
    url2.searchParams.set('format', 'json');
    url2.searchParams.set('q', address);
    url2.searchParams.set('countrycodes', 'br');
    url2.searchParams.set('limit', '5');
    url2.searchParams.set('addressdetails', '1');

    if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
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

      if (!isValidBrazilianCoordinate(lat, lng)) return null;

      if (userLocation?.city) {
        const resultAddress = normalizeStr(result.display_name);
        const userCity = normalizeStr(userLocation.city);
        if (!resultAddress.includes(userCity)) return null;
      } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
        const dist = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        if (dist > MAX_LOCAL_DISTANCE_KM) return null;
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
    console.error('Erro no geocodeWithNominatim:', error);
    return null;
  }
}

// 6. Google Geocoding API (como último recurso)
export async function geocodeWithGoogle(address: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
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

      if (!isValidBrazilianCoordinate(lat, lng)) return null;

      if (userLocation?.city) {
        const cityComponent = result.address_components.find((component: { types: string[]; long_name: string }) =>
          component.types.includes('locality') || component.types.includes('administrative_area_level_2')
        );
        const comp = cityComponent?.long_name ? normalizeStr(cityComponent.long_name) : '';
        const want = normalizeStr(userLocation.city);
        if (!cityComponent || comp !== want) return null;
      } else if (typeof userLocation?.lat === 'number' && typeof userLocation?.lng === 'number') {
        const dist = haversineKm(userLocation.lat, userLocation.lng, lat, lng);
        if (dist > MAX_LOCAL_DISTANCE_KM) return null;
      }

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
    console.error('Erro no geocodeWithGoogle:', error);
    return null;
  }
}

// -----------------------------------------------------------------------------
// 🚀 ORQUESTRADOR CASCA DE GEOCODIFICAÇÃO
// -----------------------------------------------------------------------------

export async function geocodeAddressImproved(originalAddress: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  const address = normalizeAddress(originalAddress);
  const cep = extractCEP(address);

  console.log(`Geocodificando: "${address}" (CEP: ${cep || 'não encontrado'})`);

  // 0. Retornar resultado fake imediato para validação de deploy/teste
  if (address.includes('teste123')) {
    return {
      lat: -18.9186,
      lng: -48.2772,
      address: 'TESTE DEPLOY FUNCIONOU',
      confidence: 0.99,
      provider: 'teste-deploy',
      formatted_address: 'Deploy funcionou - busca flexível ativa'
    };
  }

  // 1. Se temos CEP estruturado válido, priorizar ViaCEP
  if (cep) {
    const viaCepResult = await geocodeWithViaCEP(cep, userLocation);
    if (viaCepResult && viaCepResult.confidence >= 0.8) {
      return viaCepResult;
    }
  }

  // 2. Se temos cidade/UF e número de endereço, tentar ViaCEP por logradouro de rua
  if (userLocation?.city && userLocation?.state) {
    const viaCepAddrResult = await geocodeWithViaCepAddressLookup(address, userLocation);
    if (viaCepAddrResult && viaCepAddrResult.confidence >= 0.95) {
      return viaCepAddrResult;
    }
  }

  // 3. Tentar Mapbox (chave de acesso configurada)
  const mapboxResult = await geocodeWithMapbox(address, userLocation);
  if (mapboxResult && mapboxResult.confidence >= 0.6) {
    return mapboxResult;
  }

  // 4. Tentar Photon (Komoot API)
  const photonResult = await geocodeWithPhoton(address, userLocation);
  if (photonResult && photonResult.confidence >= 0.6) {
    return photonResult;
  }

  // 5. Tentar Nominatim estruturado e geográfico
  const nominatimResult = await geocodeWithNominatim(address, userLocation);
  if (nominatimResult && nominatimResult.confidence >= 0.3) {
    return nominatimResult;
  }

  // 6. Fallback Inteligente: Relaxar a busca de cidade mas limitar a distância física (max 25km)
  if (userLocation?.city && userLocation?.lat && userLocation?.lng) {
    const relaxedLocation = { lat: userLocation.lat, lng: userLocation.lng };
    const fallbackResult = await geocodeWithNominatim(address, relaxedLocation);

    if (fallbackResult && fallbackResult.confidence >= 0.3) {
      const distance = haversineKm(userLocation.lat, userLocation.lng, fallbackResult.lat, fallbackResult.lng);
      if (distance <= 25) {
        return {
          ...fallbackResult,
          confidence: Math.max(0.4, fallbackResult.confidence - 0.1),
          provider: fallbackResult.provider + '-nearby'
        };
      }
    }
  }

  // 7. Penúltimo recurso: Google Geocoding API
  const googleResult = await geocodeWithGoogle(address, userLocation);
  if (googleResult) {
    return googleResult;
  }

  // 8. Último recurso: Busca simplificada por partes de endereço
  if (address.includes(',')) {
    const simplifiedAddress = address.split(',')[0].trim();
    const simplifiedResult = await geocodeWithNominatim(simplifiedAddress, userLocation);

    if (simplifiedResult) {
      if (userLocation?.lat && userLocation?.lng) {
        const distance = haversineKm(userLocation.lat, userLocation.lng, simplifiedResult.lat, simplifiedResult.lng);
        if (distance <= 50) {
          return {
            ...simplifiedResult,
            confidence: Math.max(0.25, simplifiedResult.confidence - 0.2),
            provider: simplifiedResult.provider + '-simplified'
          };
        }
      } else {
        return {
          ...simplifiedResult,
          confidence: Math.max(0.25, simplifiedResult.confidence - 0.2),
          provider: simplifiedResult.provider + '-simplified'
        };
      }
    }
  }

  // 9. Último recurso: Busca por palavras-chave principais
  const keywords = address.split(/[\s,]+/).filter(word =>
    word.length > 3 &&
    !['rua', 'avenida', 'av', 'r', 'número', 'num', 'nº'].includes(word.toLowerCase())
  );

  if (keywords.length > 0) {
    const keywordAddress = keywords.slice(0, 2).join(' ');
    const keywordResult = await geocodeWithNominatim(keywordAddress, userLocation);

    if (keywordResult) {
      return {
        ...keywordResult,
        confidence: Math.max(0.2, keywordResult.confidence - 0.3),
        provider: keywordResult.provider + '-keywords'
      };
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
// 💾 WRAPPER COM SUPORTE A CACHE PERSISTENTE
// -----------------------------------------------------------------------------

export async function geocodeAndCache(originalAddress: string, userLocation?: UserLocationContext): Promise<GeocodeResult | null> {
  // 1. Verificar cache local antes
  const cached = await searchGeocodingCache(originalAddress);
  if (cached) {
    console.log(`Geocodificação: hit de cache para "${originalAddress}"`);
    return {
      lat: cached.latitude,
      lng: cached.longitude,
      address: cached.address || originalAddress,
      confidence: 1.0,
      provider: 'local-cache',
      formatted_address: cached.address
    };
  }

  // 2. Resolver via orquestrador casca
  const result = await geocodeAddressImproved(originalAddress, userLocation);

  // 3. Persistir no cache se for um resultado válido
  if (result) {
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
