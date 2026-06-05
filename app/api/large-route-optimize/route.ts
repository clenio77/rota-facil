import { NextRequest, NextResponse } from 'next/server';
import { optimizeLargeRoute } from '../../../lib/largeRouteOptimizer';

interface Stop {
  id: string;
  lat: number;
  lng: number;
  address: string;
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

export async function POST(request: NextRequest) {
  try {
    const { stops, origin, roundtrip, maxClusterSize } = await request.json();

    if (!stops || !Array.isArray(stops) || stops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Pelo menos 2 paradas são necessárias para otimizar' },
        { status: 400 }
      );
    }

    // Validar e estruturar paradas
    const validStops = stops.filter((stop: any) =>
      stop.id && stop.lat && stop.lng &&
      !isNaN(Number(stop.lat)) && !isNaN(Number(stop.lng))
    ).map((stop: any) => ({
      id: String(stop.id),
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      address: stop.address || `Parada ${stop.id}`
    }));

    if (validStops.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Número de paradas válidas é insuficiente' },
        { status: 400 }
      );
    }

    const hasOrigin = origin && typeof origin.lat === 'number' && typeof origin.lng === 'number';
    const parsedOrigin = hasOrigin ? {
      id: 'origin',
      lat: Number(origin.lat),
      lng: Number(origin.lng),
      address: origin.address || 'Ponto de Partida'
    } : undefined;

    const isRoundtrip = roundtrip !== false;
    const clusterSize = maxClusterSize ? Number(maxClusterSize) : 15;

    // 1) Resolver a otimização hierárquica TSP com K-Means
    const result = optimizeLargeRoute(validStops, parsedOrigin, {
      maxClusterSize: clusterSize,
      algorithm: 'auto',
      roundTrip: isRoundtrip
    });

    // 2) Tentar obter a geometria da rota completa no OSRM para desenhar no mapa
    const osrmUrl = process.env.OSRM_URL || 'http://router.project-osrm.org';
    const routeCoords = result.route.map(s => `${s.lng},${s.lat}`);

    try {
      // Se a rota for muito grande (ex: >100 pontos), o GET do OSRM pode ultrapassar o limite de URL.
      // Nesse caso, o OSRM aceita requisições longas, mas vamos tentar obter a geometria.
      if (routeCoords.length >= 2 && routeCoords.length <= 150) {
        const url = `${osrmUrl}/route/v1/driving/${routeCoords.join(';')}?overview=full&geometries=geojson&steps=false`;
        
        const resp = await fetch(url, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        });

        if (resp.ok) {
          const osrmData = await resp.json() as OSRMResponse;
          if (osrmData.routes && osrmData.routes.length > 0) {
            const route = osrmData.routes[0];
            return NextResponse.json({
              success: true,
              optimizedStops: result.route,
              distance: route.distance / 1000,
              duration: route.duration / 60,
              geometry: route.geometry,
              algorithm: result.algorithm,
              provider: 'large-kmeans+osrm',
              clusters: result.clusters,
              clustersCount: result.clustersCount,
              processingTime: result.processingTime
            });
          }
        }
      }
    } catch (e) {
      console.error('Erro ao buscar geometria no OSRM para rota grande:', e);
    }

    // 3) Fallback: retornar as paradas ordenadas usando aproximação de distância Haversine
    return NextResponse.json({
      success: true,
      optimizedStops: result.route,
      distance: result.totalDistance,
      duration: result.totalTime,
      algorithm: result.algorithm,
      provider: 'large-kmeans-approx',
      clusters: result.clusters,
      clustersCount: result.clustersCount,
      processingTime: result.processingTime
    });

  } catch (error) {
    console.error('Erro na API de otimização de larga escala:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro ao processar otimização de larga escala',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
