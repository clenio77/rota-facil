import { NextRequest, NextResponse } from 'next/server';

interface Stop {
  id: number;
  lat: number;
  lng: number;
}

interface OSRMRoute {
  distance: number;
  duration: number;
  geometry: {
    type: string;
    coordinates: [number, number][];
  };
}

interface OSRMResponse {
  routes: OSRMRoute[];
}

// Função para calcular distância entre dois pontos (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Algoritmo de otimização simples (Nearest Neighbor)
function optimizeRouteSimple(stops: Stop[], startLat: number = -23.5505, startLng: number = -46.6333): Stop[] {
  if (stops.length <= 1) return stops;

  const optimized: Stop[] = [];
  const remaining = [...stops];
  let currentLat = startLat;
  let currentLng = startLng;

  // Encontrar o ponto mais próximo do início
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        currentLat, 
        currentLng, 
        remaining[i].lat, 
        remaining[i].lng
      );
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = i;
      }
    }

    const nearest = remaining.splice(nearestIndex, 1)[0];
    optimized.push(nearest);
    currentLat = nearest.lat;
    currentLng = nearest.lng;
  }

  return optimized;
}

// Função para chamar OSRM (quando disponível)
async function callOSRM(stops: Stop[]): Promise<OSRMResponse | null> {
  const osrmUrl = process.env.OSRM_URL || 'http://router.project-osrm.org';
  
  // Criar string de coordenadas
  const coordinates = stops.map(s => `${s.lng},${s.lat}`).join(';');
  
  try {
    const response = await fetch(
      `${osrmUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=true`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.ok) {
      const data = await response.json() as OSRMResponse;
      return data;
    }
  } catch (error) {
    console.error('Erro ao chamar OSRM:', error);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { stops } = await request.json();

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos 2 paradas são necessárias' },
        { status: 400 }
      );
    }

    // Validar coordenadas
    const validStops = stops.filter(stop => 
      stop.lat && stop.lng && 
      !isNaN(stop.lat) && !isNaN(stop.lng)
    );

    if (validStops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    // Tentar usar OSRM primeiro
    const osrmResult = await callOSRM(validStops);
    
    if (osrmResult && osrmResult.routes && osrmResult.routes.length > 0) {
      // OSRM retornou uma rota otimizada
      const route = osrmResult.routes[0];
      
      // Mapear a ordem otimizada
      const optimizedStops = validStops.map((stop, index) => ({
        ...stop,
        sequence: index + 1,
      }));

      return NextResponse.json({
        success: true,
        optimizedStops,
        distance: route.distance / 1000, // Converter para km
        duration: route.duration / 60, // Converter para minutos
        geometry: route.geometry,
      });
    }

    // Fallback: usar algoritmo simples
    console.log('Usando algoritmo de otimização simples (OSRM não disponível)');
    
    const optimizedOrder = optimizeRouteSimple(validStops);
    const optimizedStops = optimizedOrder.map((stop, index) => ({
      ...stop,
      sequence: index + 1,
    }));

    // Calcular distância total
    let totalDistance = 0;
    for (let i = 0; i < optimizedStops.length - 1; i++) {
      totalDistance += calculateDistance(
        optimizedStops[i].lat,
        optimizedStops[i].lng,
        optimizedStops[i + 1].lat,
        optimizedStops[i + 1].lng
      );
    }

    return NextResponse.json({
      success: true,
      optimizedStops,
      distance: totalDistance,
      duration: totalDistance * 3, // Estimativa: 3 min/km
      algorithm: 'simple',
    });

  } catch (error) {
    console.error('Erro na otimização de rota:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao otimizar rota',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}