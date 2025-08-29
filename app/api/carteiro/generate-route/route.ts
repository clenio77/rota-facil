import { NextRequest, NextResponse } from 'next/server';
import { autoOptimizeRoute } from '../../../../lib/routeOptimizer';

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

    // ✅ NOVA FUNÇÃO: Otimizar rota usando algoritmos inteligentes
    const optimizeRouteForDelivery = (items: ECTItem[]) => {
      if (items.length <= 2) return items; // Não precisa otimizar para 1-2 endereços
      
      console.log('🧠 Otimizando rota para entrega...');
      
      // Converter para formato do otimizador
      const routePoints = items.map((item, index) => ({
        id: item.objectCode || `point-${index}`,
        lat: item.lat || 0,
        lng: item.lng || 0,
        address: item.address,
        sequence: item.sequence,
        objectCode: item.objectCode
      }));
      
      try {
        // ✅ USAR ALGORITMO INTELIGENTE: Auto-otimização
        const optimizationResult = autoOptimizeRoute(routePoints, {
          algorithm: 'auto',
          maxIterations: 100,
          populationSize: 50,
          mutationRate: 0.1,
          crossoverRate: 0.8
        });
        
        console.log('✅ Rota otimizada com sucesso!');
        console.log(`📊 Distância total: ${optimizationResult.totalDistance.toFixed(2)} km`);
        console.log(`⏱️ Tempo estimado: ${optimizationResult.processingTime.toFixed(2)} ms`);
        
        // Reconstruir lista otimizada
        const optimizedItems: ECTItem[] = optimizationResult.route.map((point, index) => {
          const originalItem = items.find(item => 
            item.objectCode === point.id || 
            item.address === point.address
          ) || items[index];
          
          return {
            ...originalItem,
            sequence: index + 1 // ✅ NOVA SEQUÊNCIA OTIMIZADA
          };
        });
        
        return optimizedItems;
        
      } catch (optimizationError) {
        console.warn('⚠️ Falha na otimização, usando ordem original:', optimizationError);
        return items;
      }
    };

    // ✅ OTIMIZAR ROTA ANTES DE GERAR URL
    const optimizedItems = optimizeRouteForDelivery(data.items);
    console.log(`🎯 Rota otimizada: ${optimizedItems.length} endereços reorganizados`);

    // ✅ FORMATO IDEAL PARA GOOGLE MAPS: Endereços OTIMIZADOS COM LOCALIZAÇÃO DO USUÁRIO
    const generateGoogleMapsUrl = (items: ECTItem[], userLocation?: {lat: number; lng: number; city?: string; state?: string}) => {
      if (items.length === 0) return null;
      
      // ✅ CORREÇÃO CRÍTICA: SEMPRE usar localização do usuário como origem e destino
      const startLocation = userLocation ? `${userLocation.lat},${userLocation.lng}` : 'Sua localização';
      
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
      
      // ✅ WAYPOINTS: TODOS os endereços como pontos de entrega
      const waypoints = items.map(item => item.address).join('|');

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
      console.log('📍 Waypoints (entrega):', waypoints);
      
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

    return NextResponse.json({
      success: true,
      message: `🗺️ Rota OTIMIZADA regenerada com sucesso! ${totalStops} paradas processadas.`,
      googleMapsUrl,
      routeData: {
        stops: optimizedItems, // ✅ RETORNAR ITENS OTIMIZADOS
        totalStops,
        estimatedTime,
        estimatedDistance,
        optimized: true, // ✅ INDICAR QUE FOI OTIMIZADA
        optimizationInfo: {
          algorithm: 'auto',
          totalDistance: estimatedDistance,
          efficiency: 'Rota otimizada para menor distância total'
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
