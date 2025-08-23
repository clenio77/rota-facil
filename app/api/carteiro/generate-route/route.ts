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

    // ✅ FORMATO IDEAL PARA GOOGLE MAPS: Endereços específicos e legíveis
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
      
      // ✅ WAYPOINTS: Endereços intermediários (sem origem e destino)
      const waypoints = items.slice(1, -1).map(item => item.address).join('|');

      const params = new URLSearchParams({
        api: '1',
        origin,
        destination,
        waypoints,
        travelmode: 'driving'
      });

      const finalUrl = `https://www.google.com/maps/dir/?${params.toString()}`;
      
      console.log('🗺️ Nova URL do Google Maps gerada:', finalUrl);
      console.log('📍 Origem:', origin);
      console.log('🏁 Destino:', destination);
      console.log('📍 Waypoints:', waypoints);
      
      return finalUrl;
    };

    // ✅ GERAR NOVA URL DO GOOGLE MAPS
    const googleMapsUrl = generateGoogleMapsUrl(data.items);
    
    if (!googleMapsUrl) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível gerar URL do Google Maps' },
        { status: 400 }
      );
    }

    // ✅ CALCULAR MÉTRICAS DA ROTA
    const totalStops = data.items.length;
    const estimatedTime = totalStops * 3; // 3 minutos por parada
    const estimatedDistance = totalStops * 0.5; // 0.5 km por parada

    console.log('✅ Rota regenerada com sucesso');
    console.log('📊 Total de paradas:', totalStops);
    console.log('⏱️ Tempo estimado:', estimatedTime, 'minutos');
    console.log('📏 Distância estimada:', estimatedDistance, 'km');

    return NextResponse.json({
      success: true,
      message: `🗺️ Rota regenerada com sucesso! ${totalStops} paradas processadas.`,
      googleMapsUrl,
      routeData: {
        stops: data.items,
        totalStops,
        estimatedTime,
        estimatedDistance,
        optimized: true
      }
    });

  } catch (error) {
    console.error('❌ Erro ao gerar rota:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno ao gerar rota',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
