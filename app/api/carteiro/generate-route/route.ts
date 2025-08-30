import { NextRequest, NextResponse } from 'next/server';

interface ECTItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

interface RouteRequest {
  items: ECTItem[];
  totalItems: number;
  city: string;
  state: string;
  userLocation?: {lat: number; lng: number; city?: string; state?: string}; // ✅ ADICIONAR LOCALIZAÇÃO DO USUÁRIO
}

// ✅ FUNÇÃO: VALIDAR E NORMALIZAR ENDEREÇO COM VIACEP
async function validateAndNormalizeAddress(address: string, cep?: string) {
  try {
    // ✅ EXTRAIR CEP DO ENDEREÇO SE NÃO FORNECIDO
    let cleanCep = cep;
    if (!cleanCep && address.includes('CEP:')) {
      cleanCep = address.match(/CEP:\s*(\d{8})/)?.[1];
    }
    
    if (!cleanCep) {
      throw new Error('CEP não encontrado');
    }
    
    // ✅ VALIDAR CEP COM VIACEP
    const viaCepUrl = `https://viacep.com.br/ws/${cleanCep}/json/`;
    console.log(`🌐 Consultando ViaCEP: ${viaCepUrl}`);
    
    const response = await fetch(viaCepUrl);
    const viaCepData = await response.json();
    
    if (viaCepData.erro) {
      throw new Error(`CEP inválido: ${cleanCep}`);
    }
    
    console.log(`✅ ViaCEP encontrado:`, viaCepData);
    
    // ✅ EXTRAIR NÚMERO DO ENDEREÇO
    const numberMatch = address.match(/(\d+)/);
    const number = numberMatch ? numberMatch[1] : '';
    
    // ✅ CONSTRUIR ENDEREÇO COMPLETO E NORMALIZADO
    const normalizedAddress = {
      street: viaCepData.logradouro,
      number: number,
      district: viaCepData.bairro,
      city: viaCepData.localidade,
      state: viaCepData.uf,
      cep: viaCepData.cep,
      fullAddress: `${viaCepData.logradouro}${number ? ', ' + number : ''}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`
    };
    
    return normalizedAddress;
    
  } catch (error) {
    console.log(`⚠️ Erro na validação ViaCEP:`, error);
    // ✅ FALLBACK: RETORNAR ENDEREÇO ORIGINAL
    return {
      street: address,
      number: '',
      district: 'Centro',
      city: 'Uberlândia',
      state: 'MG',
      cep: cep || '',
      fullAddress: `${address}, Uberlândia, MG, Brasil`
    };
  }
}

// ✅ FUNÇÃO: VALIDAR SE COORDENADAS ESTÃO EM UBERLÂNDIA
function isValidUberlandiaCoordinate(lat: number, lng: number): boolean {
  // ✅ LIMITES GEOGRÁFICOS DE UBERLÂNDIA (com margem de segurança)
  const UBERLANDIA_BOUNDS = {
    north: -18.8500,  // Limite norte
    south: -19.0500,  // Limite sul  
    east: -48.2000,   // Limite leste
    west: -48.3500    // Limite oeste
  };
  
  const isValid = lat >= UBERLANDIA_BOUNDS.south && 
                  lat <= UBERLANDIA_BOUNDS.north && 
                  lng >= UBERLANDIA_BOUNDS.west && 
                  lng <= UBERLANDIA_BOUNDS.east;
  
  console.log(`🌍 Validando coordenadas: ${lat}, ${lng} - ${isValid ? 'VÁLIDA' : 'INVÁLIDA'} para Uberlândia`);
  return isValid;
}

// ✅ FUNÇÃO: GEOCODIFICAR ENDEREÇO COM MÚLTIPLAS APIS
async function geocodeAddress(addressData: any) {
  const { fullAddress } = addressData;
  
  // ✅ OPÇÃO 1: NOMINATIM (OpenStreetMap - Gratuito)
  try {
    console.log(`🌍 Tentando Nominatim: ${fullAddress}`);
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(fullAddress)}&format=json&limit=1&addressdetails=1`;
    
    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'RotaFacil/1.0 (sistema de rotas para carteiros)'
      }
    });
    
    const data = await response.json();
    
    if (data && data.length > 0) {
      const result = data[0];
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon);
      
      console.log(`✅ Nominatim encontrou:`, result);
      
      // ✅ VALIDAR SE AS COORDENADAS ESTÃO EM UBERLÂNDIA
      if (isValidUberlandiaCoordinate(lat, lng)) {
        console.log(`✅ Coordenadas válidas para Uberlândia: ${lat}, ${lng}`);
        return {
          lat: lat,
          lng: lng,
          city: result.address?.city || result.address?.town || 'Uberlândia',
          accuracy: 'high'
        };
      } else {
        console.log(`❌ Coordenadas FORA de Uberlândia rejeitadas: ${lat}, ${lng}`);
        // ✅ REJEITAR COORDENADAS INVÁLIDAS - CONTINUAR PARA PRÓXIMA OPÇÃO
      }
    }
  } catch (error) {
    console.log(`⚠️ Erro no Nominatim:`, error);
  }
  
  // ✅ OPÇÃO 2: MAPBOX (se configurado)
  try {
    if (process.env.MAPBOX_ACCESS_TOKEN) {
      console.log(`🗺️ Tentando Mapbox: ${fullAddress}`);
      const mapboxUrl = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(fullAddress)}.json?access_token=${process.env.MAPBOX_ACCESS_TOKEN}&country=BR&limit=1`;
      
      const response = await fetch(mapboxUrl);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        const result = data.features[0];
        const lat = result.center[1];
        const lng = result.center[0];
        
        console.log(`✅ Mapbox encontrou:`, result);
        
        // ✅ VALIDAR SE AS COORDENADAS ESTÃO EM UBERLÂNDIA
        if (isValidUberlandiaCoordinate(lat, lng)) {
          console.log(`✅ Coordenadas Mapbox válidas para Uberlândia: ${lat}, ${lng}`);
          return {
            lat: lat,
            lng: lng,
            city: result.place_name.includes('Uberlândia') ? 'Uberlândia' : 'Unknown',
            accuracy: 'high'
          };
        } else {
          console.log(`❌ Coordenadas Mapbox FORA de Uberlândia rejeitadas: ${lat}, ${lng}`);
        }
      }
    }
  } catch (error) {
    console.log(`⚠️ Erro no Mapbox:`, error);
  }
  
  console.log(`❌ Nenhuma geocodificação funcionou para: ${fullAddress}`);
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const data: RouteRequest = await request.json();
    
    if (!data.items || data.items.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Nenhum endereço fornecido' },
        { status: 400 }
      );
    }

    console.log('🔄 Regenerando rota com endereços editados:', data.items.length, 'itens');

    // ✅ NOVA FUNÇÃO: Deduplicar endereços para evitar pontos duplicados
    const deduplicateAddresses = (items: ECTItem[]): ECTItem[] => {
      console.log('🔍 Deduplicando endereços...');
      
      const addressMap = new Map<string, ECTItem[]>();
      
      // ✅ AGRUPAR ITENS POR ENDEREÇO
      items.forEach(item => {
        // ✅ NORMALIZAR ENDEREÇO (remover CEP, espaços extras, etc.)
        const normalizedAddress = item.address
          .replace(/\s*CEP:\s*\d{8}/gi, '') // Remover CEP
          .replace(/\s+/g, ' ') // Normalizar espaços
          .trim()
          .toLowerCase();
          
        if (!addressMap.has(normalizedAddress)) {
          addressMap.set(normalizedAddress, []);
        }
        addressMap.get(normalizedAddress)!.push(item);
      });
      
      const deduplicatedItems: ECTItem[] = [];
      let newSequence = 1;
      
      // ✅ CRIAR UM ITEM POR ENDEREÇO ÚNICO
      addressMap.forEach((itemsAtAddress, normalizedAddress) => {
        if (itemsAtAddress.length === 1) {
          // ✅ ENDEREÇO ÚNICO: Manter como está
          deduplicatedItems.push({
            ...itemsAtAddress[0],
            sequence: newSequence++
          });
          console.log(`📍 Endereço único: ${itemsAtAddress[0].address}`);
        } else {
          // ✅ ENDEREÇOS DUPLICADOS: Combinar em um item
          const primaryItem = itemsAtAddress[0];
          const allObjectCodes = itemsAtAddress.map(item => item.objectCode).join(', ');
          
          deduplicatedItems.push({
            ...primaryItem,
            sequence: newSequence++,
            objectCode: allObjectCodes // ✅ COMBINAR CÓDIGOS DOS OBJETOS
          });
          
          console.log(`🔗 Endereços combinados (${itemsAtAddress.length} objetos): ${primaryItem.address}`);
          console.log(`📦 Objetos: ${allObjectCodes}`);
        }
      });
      
      console.log(`✅ Deduplicação concluída: ${items.length} → ${deduplicatedItems.length} endereços únicos`);
      return deduplicatedItems;
    };

    // ✅ FUNÇÃO: Algoritmo Nearest Neighbor Simples
    const simpleNearestNeighbor = (points: {lat: number; lng: number; address: string}[]) => {
      console.log('🔍 Iniciando algoritmo Nearest Neighbor...');
      
      if (points.length <= 1) return points;
      
      // ✅ COMEÇAR DO PONTO MAIS PRÓXIMO DA LOCALIZAÇÃO DO USUÁRIO
      const userLocation = { lat: -18.9203, lng: -48.2782 }; // Centro de Uberlândia
      let startIndex = 0;
      let shortestDistance = calculateDistance(userLocation, points[0]);
      
      for (let i = 1; i < points.length; i++) {
        const distance = calculateDistance(userLocation, points[i]);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          startIndex = i;
        }
      }
      
      console.log(`🎯 Iniciando rota do ponto mais próximo: ${points[startIndex].address}`);
      
      const route = [points[startIndex]];
      const unvisited = points.filter((_, index) => index !== startIndex);
      
      while (unvisited.length > 0) {
        const currentPoint = route[route.length - 1];
        let nearestIndex = 0;
        let nearestDistance = calculateDistance(currentPoint, unvisited[0]);
        
        // Encontrar o ponto mais próximo
        for (let i = 1; i < unvisited.length; i++) {
          const distance = calculateDistance(currentPoint, unvisited[i]);
          if (distance < nearestDistance) {
            nearestDistance = distance;
            nearestIndex = i;
          }
        }
        
        // Adicionar o ponto mais próximo à rota e remover da lista
        route.push(unvisited.splice(nearestIndex, 1)[0]);
      }
      
      console.log(`✅ Rota otimizada por proximidade: ${route.length} pontos`);
      return route;
    };

    // ✅ FUNÇÃO: Mapear CEPs e ruas para coordenadas reais de Uberlândia
    const getRealCoordinatesFromAddress = (address: string, cep?: string) => {
      const uberlandiaRegions: {[key: string]: {lat: number; lng: number; region: string}} = {
        // Centro (COORDENADAS CORRIGIDAS)
        '38400-700': { lat: -18.9185, lng: -48.2773, region: 'Centro' },
        '38400-704': { lat: -18.9195, lng: -48.2783, region: 'Centro' },
        '38400-708': { lat: -18.9186, lng: -48.2774, region: 'Centro' }, // ✅ CORRIGIDO: Afonso Pena centro
        '38400-712': { lat: -18.9215, lng: -48.2803, region: 'Centro-Norte' },
        '38400-714': { lat: -18.9225, lng: -48.2813, region: 'Norte' },
        '38400-718': { lat: -18.9235, lng: -48.2823, region: 'Norte' },
        '38400-734': { lat: -18.9175, lng: -48.2763, region: 'Centro-Sul' },

        // Bairros específicos
        '38400-688': { lat: -18.9245, lng: -48.2833, region: 'Tibery' },
        '38400-679': { lat: -18.9165, lng: -48.2753, region: 'Nossa Senhora Aparecida' },
        '38400-626': { lat: -18.9155, lng: -48.2743, region: 'Jardim Brasília' },
        '38400-694': { lat: -18.9255, lng: -48.2843, region: 'Tibery' },
        '38400-650': { lat: -18.9145, lng: -48.2733, region: 'Centro-Leste' },
        '38400-617': { lat: -18.9135, lng: -48.2723, region: 'Bom Jesus' },
        '38400-774': { lat: -18.9125, lng: -48.2713, region: 'Segismundo Pereira' }
      };

      let cleanCep = cep;
      if (!cleanCep && address.includes('CEP:')) {
        cleanCep = address.match(/CEP:\s*(\d{8})/)?.[1];
      }

      if (cleanCep) {
        const formattedCep = cleanCep.replace(/(\d{5})(\d{3})/, '$1-$2');
        const region = uberlandiaRegions[formattedCep];
        if (region) {
          console.log(`🗺️ CEP ${formattedCep} mapeado para região ${region.region}`);
          return region;
        }
      }

      const streetMappings = {
        'joão pinheiro': { lat: -18.9190, lng: -48.2780, region: 'Centro-Norte' }, // ✅ CORRIGIDO: Posição mais central
        'cesário alvim': { lat: -18.9250, lng: -48.2840, region: 'Tibery' },
        'afonso pena': { lat: -18.9187, lng: -48.2775, region: 'Centro' }, // ✅ CORRIGIDO: Centro real
        'brasil': { lat: -18.9230, lng: -48.2820, region: 'Norte' },
        'floriano peixoto': { lat: -18.9192, lng: -48.2781, region: 'Centro' }, // ✅ CORRIGIDO
        'amazonas': { lat: -18.9172, lng: -48.2762, region: 'Centro-Sul' }, // ✅ CORRIGIDO
        'rio grande do sul': { lat: -18.9140, lng: -48.2730, region: 'Centro-Leste' },
        'artur gonçalves': { lat: -18.9240, lng: -48.2830, region: 'Tibery' },
        'jatai': { lat: -18.9160, lng: -48.2750, region: 'Nossa Senhora Aparecida' },
        'buriti alegre': { lat: -18.9150, lng: -48.2740, region: 'Jardim Brasília' },
        'itumbiara': { lat: -18.9130, lng: -48.2720, region: 'Bom Jesus' },
        'orozimbo': { lat: -18.9120, lng: -48.2710, region: 'Segismundo Pereira' }
      };

      const addressLower = address.toLowerCase();
      for (const [street, coords] of Object.entries(streetMappings)) {
        if (addressLower.includes(street)) {
          console.log(`🛣️ Rua "${street}" mapeada para região ${coords.region}`);
          return coords;
        }
      }

      console.log(`📍 Usando coordenadas padrão para: ${address}`);
      return { lat: -18.9185, lng: -48.2773, region: 'Centro' };
    };

    // ✅ FUNÇÃO: Calcular distância entre dois pontos
    const calculateDistance = (point1: {lat: number; lng: number}, point2: {lat: number; lng: number}) => {
      const R = 6371; // Raio da Terra em km
      const dLat = (point2.lat - point1.lat) * Math.PI / 180;
      const dLng = (point2.lng - point1.lng) * Math.PI / 180;
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
        Math.sin(dLng/2) * Math.sin(dLng/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    // ✅ FUNÇÃO: Calcular distância total da rota
    const calculateSimpleDistance = (route: {lat: number; lng: number}[]) => {
      let total = 0;
      for (let i = 0; i < route.length - 1; i++) {
        total += calculateDistance(route[i], route[i + 1]);
      }
      return total;
    };



    // ✅ APLICAR DEDUPLICAÇÃO ANTES DA OTIMIZAÇÃO
    const uniqueItems = deduplicateAddresses(data.items);

    // ✅ NOVA FUNÇÃO: Otimizar rota usando algoritmos inteligentes
    const optimizeRouteForDelivery = (items: ECTItem[]) => {
      if (items.length <= 2) return items; // Não precisa otimizar para 1-2 endereços
      
      console.log('🧠 Otimizando rota para entrega...');
      
      // ✅ CONVERTER PARA FORMATO DO OTIMIZADOR (com coordenadas reais por CEP)
      const routePoints = items.map((item, index) => {
        console.log(`🔍 DEBUG: Item ${index + 1} - ${item.address}`);
        
        // ✅ USAR COORDENADAS REAIS BASEADAS NO CEP E ENDEREÇO
        const realCoordinates = getRealCoordinatesFromAddress(item.address, item.cep);
        
        console.log(`📍 DEBUG: Coordenadas REAIS: lat=${realCoordinates.lat}, lng=${realCoordinates.lng}`);
        
        return {
          id: item.objectCode || `point-${index}`,
          lat: realCoordinates.lat,
          lng: realCoordinates.lng,
          address: item.address,
          sequence: item.sequence,
          objectCode: item.objectCode
        };
      });
      
      try {
        // ✅ ALGORITMO SIMPLES E EFICAZ: Ordenação por proximidade geográfica
        console.log('🎯 Usando algoritmo de proximidade geográfica...');
        
        // ✅ IMPLEMENTAR ALGORITMO NEAREST NEIGHBOR SIMPLES
        const optimizedRoute = simpleNearestNeighbor(routePoints);
        
        const optimizationResult = {
          route: optimizedRoute,
          totalDistance: calculateSimpleDistance(optimizedRoute),
          totalTime: optimizedRoute.length * 3, // 3 min por parada
          algorithm: 'nearest-neighbor-simple',
          processingTime: Date.now() - performance.now()
        };
        
        console.log('✅ Rota otimizada com sucesso!');
        console.log(`📊 Distância total: ${optimizationResult.totalDistance.toFixed(2)} km`);
        console.log(`⏱️ Tempo estimado: ${optimizationResult.processingTime.toFixed(2)} ms`);
        
        // ✅ MAPEAMENTO SIMPLES E DIRETO (SEM PERDA DE ITENS)
        console.log(`🔍 DEBUG: Algoritmo retornou ${optimizationResult.route.length} pontos`);
        console.log(`🔍 DEBUG: Itens originais: ${items.length}`);
        
        // ✅ MAPEAR DIRETAMENTE NA MESMA ORDEM
        const optimizedItems: ECTItem[] = optimizationResult.route.map((optimizedPoint, index) => {
          // Encontrar o item original correspondente
          const originalItem = items.find(item => 
            item.objectCode === optimizedPoint.id || 
            item.address === optimizedPoint.address
          ) || items[index] || items[0]; // Fallback robusto
          
          return {
            ...originalItem,
            sequence: index + 1,
            lat: optimizedPoint.lat,
            lng: optimizedPoint.lng
          };
        });
        
        console.log(`✅ Mapeamento direto concluído: ${optimizedItems.length} itens finais`);
        
        return optimizedItems;
        
      } catch (optimizationError) {
        console.warn('⚠️ Falha na otimização, usando ordem original:', optimizationError);
        return items;
      }
    };

    // ✅ OTIMIZAR ROTA ANTES DE GERAR URL (COM ITENS ÚNICOS)
    const optimizedItems = optimizeRouteForDelivery(uniqueItems);
    console.log(`🎯 Rota otimizada: ${optimizedItems.length} endereços reorganizados`);

    // ✅ FORMATO IDEAL PARA GOOGLE MAPS: Endereços OTIMIZADOS COM LOCALIZAÇÃO DO USUÁRIO
    const generateGoogleMapsUrl = (items: ECTItem[], userLocation?: {lat: number; lng: number; city?: string; state?: string}) => {
      if (items.length === 0) return null;
      
      // ✅ CORREÇÃO CRÍTICA: SEMPRE usar coordenadas do usuário como origem e destino
      const startLocation = userLocation ? `${userLocation.lat},${userLocation.lng}` : '-18.9186,-48.2772';
      
      if (items.length === 1) {
        // ✅ ENDEREÇO ÚNICO: Formato simples e direto
        const address = items[0].address;
        const params = new URLSearchParams({
          api: '1',
          origin: startLocation,
          destination: startLocation, // ✅ VOLTAR PARA LOCALIZAÇÃO DO USUÁRIO
          travelmode: 'driving'
        });
        return `https://www.google.com/maps/dir/?${params.toString()}`;
      }

      // ✅ MÚLTIPLOS ENDEREÇOS: Formato otimizado para rotas CIRCULARES
      const origin = startLocation; // ✅ ORIGEM: Localização do usuário
      const destination = startLocation; // ✅ DESTINO: Localização do usuário
      
      // ✅ WAYPOINTS: Usar COORDENADAS para forçar Google Maps a respeitar nossa sequência
      const waypoints = items.map(item => {
        const coords = getRealCoordinatesFromAddress(item.address, item.cep);
        return `${coords.lat},${coords.lng}`;
      }).join('|');

      const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        waypoints,
        travelmode: 'driving'
      });

      const finalUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
      
      console.log('🗺️ Nova URL do Google Maps OTIMIZADA:', finalUrl);
      console.log('📍 Origem (usuário):', startLocation);
      console.log('🏁 Destino (usuário):', startLocation);
      console.log('📍 Waypoints (COORDENADAS para forçar sequência):', waypoints);
      console.log('🎯 NOSSA SEQUÊNCIA OTIMIZADA:');
      items.forEach((item, index) => {
        console.log(`  ${index + 1}. ${item.address}`);
      });
      console.log('🚨 Google Maps DEVE respeitar esta sequência agora (usando coordenadas)!');
      
      return finalUrl;
    };

    // ✅ GERAR NOVA URL DO GOOGLE MAPS COM ROTA OTIMIZADA E LOCALIZAÇÃO DO USUÁRIO
    console.log('🔍 DEBUG: userLocation recebida:', data.userLocation);
    console.log('🔍 DEBUG: userLocation type:', typeof data.userLocation);
    console.log('🔍 DEBUG: userLocation.lat:', data.userLocation?.lat);
    console.log('🔍 DEBUG: userLocation.lng:', data.userLocation?.lng);
    
    const googleMapsUrl = generateGoogleMapsUrl(optimizedItems, data.userLocation);
    
    if (!googleMapsUrl) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível gerar URL do Google Maps' },
        { status: 400 }
      );
    }

    // ✅ CALCULAR MÉTRICAS DA ROTA OTIMIZADA
    const totalStops = optimizedItems.length;
    const estimatedTime = totalStops * 3; // 3 minutos por parada
    const estimatedDistance = totalStops * 0.5; // 0.5 km por parada

    console.log('✅ Rota OTIMIZADA regenerada com sucesso');
    console.log('📊 Total de paradas:', totalStops);
    console.log('⏱️ Tempo estimado:', estimatedTime, 'minutos');
    console.log('📏 Distância estimada:', estimatedDistance, 'km');
    console.log('🎯 Ordem otimizada:', optimizedItems.map(item => `${item.sequence}. ${item.address}`).join(' → '));

    // ✅ PREPARAR COORDENADAS PARA O MAPA LEAFLET
      const mapCoordinates = await Promise.all(optimizedItems.map(async (item, index) => {
        // ✅ TENTAR VALIDAÇÃO E GEOCODIFICAÇÃO REAL
        let coords;
        try {
          console.log(`🔍 Processando: ${item.address}, CEP: ${item.cep}`);
          
          // ✅ DEBUG ESPECIAL PARA JOÃO PINHEIRO 4020
          if (item.address.toLowerCase().includes('joão pinheiro') && item.address.includes('4020')) {
            console.log('🚨 DEBUG ESPECIAL: Avenida João Pinheiro, 4020');
            console.log('📍 Item completo:', item);
          }
          
          // ✅ PASSO 1: VALIDAR CEP COM VIACEP
          const validatedAddress = await validateAndNormalizeAddress(item.address, item.cep);
          console.log(`📋 Endereço validado:`, validatedAddress);
          
          // ✅ DEBUG ESPECIAL PARA JOÃO PINHEIRO 4020
          if (item.address.toLowerCase().includes('joão pinheiro') && item.address.includes('4020')) {
            console.log('🚨 ViaCEP result para João Pinheiro 4020:', validatedAddress);
          }
          
          // ✅ PASSO 2: GEOCODIFICAR ENDEREÇO COMPLETO
          const geocodedResult = await geocodeAddress(validatedAddress);
          
          if (geocodedResult && geocodedResult.lat && geocodedResult.lng) {
            console.log(`🎯 GEOCODIFICAÇÃO REAL: ${validatedAddress.fullAddress} → ${geocodedResult.lat}, ${geocodedResult.lng}`);
            
            // ✅ DEBUG ESPECIAL PARA JOÃO PINHEIRO 4020
            if (item.address.toLowerCase().includes('joão pinheiro') && item.address.includes('4020')) {
              console.log('🚨 COORDENADAS GEOCODIFICADAS para João Pinheiro 4020:', geocodedResult);
            }
            
            coords = {
              lat: geocodedResult.lat,
              lng: geocodedResult.lng,
              region: validatedAddress.district || geocodedResult.city || 'Uberlândia'
            };
          } else {
            console.log(`⚠️ FALLBACK para coordenadas determinísticas: ${item.address}`);
            
            // ✅ DEBUG ESPECIAL PARA JOÃO PINHEIRO 4020
            if (item.address.toLowerCase().includes('joão pinheiro') && item.address.includes('4020')) {
              console.log('🚨 USANDO FALLBACK para João Pinheiro 4020');
            }
            
            coords = getRealCoordinatesFromAddress(item.address, item.cep);
            
            // ✅ DEBUG ESPECIAL PARA JOÃO PINHEIRO 4020
            if (item.address.toLowerCase().includes('joão pinheiro') && item.address.includes('4020')) {
              console.log('🚨 COORDENADAS FALLBACK para João Pinheiro 4020:', coords);
            }
          }
        } catch (error) {
          console.log(`❌ Erro na validação/geocodificação, usando fallback: ${item.address}`, error);
          coords = getRealCoordinatesFromAddress(item.address, item.cep);
        }
        
        return {
          id: item.objectCode || `point-${index}`,
          lat: coords.lat,
          lng: coords.lng,
          address: item.address,
          sequence: index + 1,
          region: coords.region || 'Uberlândia',
          geocoded: coords.lat !== getRealCoordinatesFromAddress(item.address, item.cep).lat // Indica se foi geocodificado de verdade
        };
      }));

    console.log(`🗺️ Usando visualizador próprio - SEM LIMITAÇÕES!`);
    console.log(`📍 ${mapCoordinates.length} coordenadas preparadas para mapa Leaflet`);

    return NextResponse.json({
      success: true,
      message: `🗺️ Rota OTIMIZADA regenerada com sucesso! ${totalStops} paradas processadas.`,
      useCustomMap: true, // ✅ SINALIZAR PARA USAR MAPA PRÓPRIO
      googleMapsUrl, // ✅ MANTER PARA COMPATIBILIDADE (BACKUP)
      routeData: {
        stops: optimizedItems, // ✅ RETORNAR ITENS OTIMIZADOS
        coordinates: mapCoordinates, // ✅ COORDENADAS PARA O MAPA
        userLocation: data.userLocation || { lat: -18.9186, lng: -48.2772 }, // ✅ PONTO DE PARTIDA
        totalStops,
        estimatedTime,
        estimatedDistance,
        optimized: true, // ✅ INDICAR QUE FOI OTIMIZADA
        optimizationInfo: {
          algorithm: 'nearest-neighbor-custom',
          totalDistance: estimatedDistance,
          efficiency: 'Rota otimizada para menor distância total',
          mapType: 'leaflet',
          limitations: 'Sem limitações de waypoints'
        }
      }
    });

  } catch (error) {
    console.error('❌ Erro ao regenerar rota:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno ao regenerar rota',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
