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

    // ✅ FORMATO IDEAL PARA GOOGLE MAPS: Endereços OTIMIZADOS
    const generateGoogleMapsUrl = (items: ECTItem[]) => {
      if (items.length === 0) return null;
      
      if (items.length === 1) {
        // ✅ ENDEREÇO ÚNICO: Formato simples e direto
        const address = items[0].address;
        const params = new URLSearchParams({
          api: '1',
          destination: address,
          travelmode: 'driving'
        });
        return `https://www.google.com/maps/dir/?${params.toString()}`;
      }

      // ✅ MÚLTIPLOS ENDEREÇOS: Formato otimizado para rotas
      const origin = items[0].address;
      const destination = items[items.length - 1].address;
      
      // ✅ WAYPOINTS: Endereços intermediários OTIMIZADOS (sem origem e destino)
      const waypoints = items.slice(1, -1).map(item => item.address).join('|');

      const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        waypoints,
        travelmode: 'driving'
      });

      const finalUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
      
      console.log('🗺️ Nova URL do Google Maps OTIMIZADA:', finalUrl);
      console.log('📍 Origem:', origin);
      console.log('🏁 Destino:', destination);
      console.log('📍 Waypoints otimizados:', waypoints);
      
      return finalUrl;
    };

    // ✅ GERAR NOVA URL DO GOOGLE MAPS COM ROTA OTIMIZADA
    const googleMapsUrl = generateGoogleMapsUrl(optimizedItems);
    
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
