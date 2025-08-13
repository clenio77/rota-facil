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
    const { stops, origin, roundtrip } = await request.json();

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos 2 paradas são necessárias' },
        { status: 400 }
      );
    }

    // Validar coordenadas
    const validStops: Stop[] = stops.filter((stop: Stop) => 
      stop.lat && stop.lng && 
      !isNaN(stop.lat) && !isNaN(stop.lng)
    );

    if (validStops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    const hasOrigin = origin && typeof origin.lat === 'number' && typeof origin.lng === 'number';
    const originLat: number | undefined = hasOrigin ? origin.lat : undefined;
    const originLng: number | undefined = hasOrigin ? origin.lng : undefined;
    const isRoundtrip: boolean = Boolean(roundtrip);

    // 1) Tentar usar Mapbox Optimization API com tráfego, se token disponível
    const mapboxToken = process.env.MAPBOX_ACCESS_TOKEN;
    if (mapboxToken) {
      try {
        // Se houver origem, a primeira coordenada será fixa (source=first)
        const coordinateList = hasOrigin
          ? [`${originLng},${originLat}`, ...validStops.map(s => `${s.lng},${s.lat}`)]
          : validStops.map(s => `${s.lng},${s.lat}`);
        const coordinates = coordinateList.join(';');
        const params = new URLSearchParams({
          geometries: 'geojson',
          steps: 'true',
          overview: 'full',
          access_token: mapboxToken,
          roundtrip: isRoundtrip ? 'true' : 'false',
        });
        if (hasOrigin) params.set('source', 'first');
        const url = `https://api.mapbox.com/optimized-trips/v1/mapbox/driving-traffic/${coordinates}?${params.toString()}`;
        const response = await fetch(url, { method: 'GET' });
        if (response.ok) {
          const data: {
            trips?: Array<{ distance?: number; duration?: number; geometry?: { type: string; coordinates: [number, number][] } }>;
            waypoints?: Array<{ waypoint_index?: number | null }>;
          } = await response.json();
          if (data && data.trips && data.trips.length > 0) {
            const trip = data.trips[0];
            // data.waypoints está na ordem original; cada item possui waypoint_index (ordem na rota)
            const order = (data.waypoints || [])
              .map((wp, idx: number) => ({ inputIndex: idx, order: wp.waypoint_index ?? undefined }))
              .filter((x) => x.order !== undefined)
              .sort((a, b) => (a.order as number) - (b.order as number))
              .map((x) => x.inputIndex);

            // Se origem foi incluída (índice 0), remova-a da ordem e ajuste índices para mapearem os stops
            const stopOrder = hasOrigin ? order.filter(i => i !== 0).map(i => i - 1) : order;
            const optimizedStops = stopOrder.map((i: number, idx: number) => ({
              ...validStops[i],
              sequence: idx + 1,
            }));

            return NextResponse.json({
              success: true,
              optimizedStops,
              distance: (trip.distance || 0) / 1000,
              duration: (trip.duration || 0) / 60,
              geometry: trip.geometry,
              provider: 'mapbox',
            });
          }
        }
      } catch (err) {
        console.error('Erro ao chamar Mapbox Optimization API:', err);
        // segue para fallback
      }
    }

    // 2) Fallback: usar algoritmo simples para ordem (com origem se houver)
    const simpleOrder = optimizeRouteSimple(validStops, hasOrigin ? originLat : undefined, hasOrigin ? originLng : undefined);
    const optimizedStops = simpleOrder.map((stop, index) => ({ ...stop, sequence: index + 1 }));

    // 3) Tentar obter geometria via OSRM para a ordem calculada
    const osrmUrl = process.env.OSRM_URL || 'http://router.project-osrm.org';
    const routeCoordsParts: string[] = [];
    if (hasOrigin && originLng !== undefined && originLat !== undefined) {
      routeCoordsParts.push(`${originLng},${originLat}`);
    }
    routeCoordsParts.push(...optimizedStops.map(s => `${s.lng},${s.lat}`));
    if (hasOrigin && isRoundtrip && originLng !== undefined && originLat !== undefined) {
      routeCoordsParts.push(`${originLng},${originLat}`);
    }
    try {
      if (routeCoordsParts.length >= 2) {
        const url = `${osrmUrl}/route/v1/driving/${routeCoordsParts.join(';')}?overview=full&geometries=geojson&steps=true`;
        const resp = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (resp.ok) {
          const osrmData = await resp.json() as OSRMResponse;
          if (osrmData.routes && osrmData.routes.length > 0) {
            const route = osrmData.routes[0];
            return NextResponse.json({
              success: true,
              optimizedStops,
              distance: route.distance / 1000,
              duration: route.duration / 60,
              geometry: route.geometry,
              provider: 'simple+osrm',
            });
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar geometria no OSRM:', e);
    }

    // 4) Último recurso: algoritmo simples com distância haversine
    console.log('Usando algoritmo de otimização simples (sem geometria de rota)');
    // Calcular distância total aproximada
    let totalDistance = 0;
    const path: Array<{ lat: number; lng: number }> = [];
    if (hasOrigin && originLat !== undefined && originLng !== undefined) {
      path.push({ lat: originLat, lng: originLng });
    }
    path.push(...optimizedStops);
    if (hasOrigin && isRoundtrip && originLat !== undefined && originLng !== undefined) {
      path.push({ lat: originLat, lng: originLng });
    }
    for (let i = 0; i < path.length - 1; i++) {
      totalDistance += calculateDistance(
        path[i].lat,
        path[i].lng,
        path[i + 1].lat,
        path[i + 1].lng
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