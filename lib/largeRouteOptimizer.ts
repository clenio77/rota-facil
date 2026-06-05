// RotaFácil - Otimizador de Rotas em Grande Escala (50+ pontos)
// Implementa K-Means Clustering e resolução hierárquica de TSP

import { RoutePoint, optimizeRoute } from './routeOptimizer';

export interface LargeRouteOptions {
  maxClusterSize?: number; // Tamanho máximo sugerido para cada cluster (ex: 15)
  algorithm?: 'nearest-neighbor' | 'two-opt' | 'genetic' | 'auto';
  roundTrip?: boolean;
}

export interface LargeRouteResult {
  route: RoutePoint[];
  totalDistance: number;
  totalTime: number;
  algorithm: string;
  processingTime: number;
  clustersCount: number;
  clusters: {
    id: number;
    center: { lat: number; lng: number };
    pointsCount: number;
  }[];
}

// Auxiliar: calcula distância geodésica (Haversine) em km
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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

function calculateDistanceBetweenPoints(p1: RoutePoint, p2: RoutePoint): number {
  return calculateHaversineDistance(p1.lat, p1.lng, p2.lat, p2.lng);
}

// 🧮 ALGORITMO: K-Means Clustering para coordenadas geográficas
export function kMeansClustering(points: RoutePoint[], k: number): RoutePoint[][] {
  if (points.length <= k) return points.map(p => [p]);
  
  // 1. Inicializar centroides escolhendo pontos reais espalhados
  let centroids = points.slice(0, k).map(p => ({ lat: p.lat, lng: p.lng }));
  let clusters: RoutePoint[][] = Array.from({ length: k }, () => []);
  let converged = false;
  let iterations = 0;
  const maxIterations = 100;

  while (!converged && iterations < maxIterations) {
    iterations++;
    const nextClusters: RoutePoint[][] = Array.from({ length: k }, () => []);

    // Atribuir cada ponto ao centroide mais próximo
    for (const point of points) {
      let minDistance = Infinity;
      let closestCentroidIndex = 0;

      for (let i = 0; i < k; i++) {
        const distance = calculateHaversineDistance(
          point.lat,
          point.lng,
          centroids[i].lat,
          centroids[i].lng
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestCentroidIndex = i;
        }
      }
      nextClusters[closestCentroidIndex].push(point);
    }

    // Recalcular centroides
    const nextCentroids = centroids.map((centroid, index) => {
      const clusterPoints = nextClusters[index];
      if (clusterPoints.length === 0) return centroid;

      let sumLat = 0;
      let sumLng = 0;
      for (const p of clusterPoints) {
        sumLat += p.lat;
        sumLng += p.lng;
      }
      return {
        lat: sumLat / clusterPoints.length,
        lng: sumLng / clusterPoints.length
      };
    });

    // Verificar se houve alteração significativa
    let maxShift = 0;
    for (let i = 0; i < k; i++) {
      const shift = calculateHaversineDistance(
        centroids[i].lat,
        centroids[i].lng,
        nextCentroids[i].lat,
        nextCentroids[i].lng
      );
      if (shift > maxShift) maxShift = shift;
    }

    centroids = nextCentroids;
    clusters = nextClusters;

    if (maxShift < 0.005) { // menos de 5 metros
      converged = true;
    }
  }

  return clusters.filter(c => c.length > 0);
}

// 🎯 SOLVER HIERÁRQUICO TSP
export function optimizeLargeRoute(
  points: RoutePoint[],
  origin?: RoutePoint,
  options: LargeRouteOptions = {}
): LargeRouteResult {
  const startTime = performance.now();
  const maxClusterSize = options.maxClusterSize || 15;
  const targetAlgorithm = options.algorithm || 'auto';
  const isRoundTrip = options.roundTrip !== false;

  if (points.length <= maxClusterSize) {
    // Para conjuntos pequenos, delegar diretamente ao solver normal
    const tsStart = origin ? { id: origin.id, lat: origin.lat, lng: origin.lng, address: origin.address } : undefined;
    
    // Filtrar paradas
    const allPoints = tsStart ? [tsStart, ...points.filter(p => p.id !== tsStart.id)] : points;
    
    const result = optimizeRoute(allPoints, {
      algorithm: targetAlgorithm,
      maxIterations: 1000,
      timeLimit: 10,
      constraints: { maxDistance: 1000, maxTime: 1000, timeWindows: false, priorities: false }
    });

    // Adicionar ponto final se roundtrip e se houver de fato paradas
    const finalRoute = [...result.route];
    if (isRoundTrip && origin && points.length > 0 && finalRoute.length > 0 && finalRoute[0].id === origin.id) {
      finalRoute.push({ ...origin, sequence: finalRoute.length + 1 });
    }

    const totalDistance = calculateTotalDistanceOfRoute(finalRoute);
    const totalTime = finalRoute.length * 3;

    return {
      route: finalRoute.map((p, idx) => ({ ...p, sequence: idx + 1 })),
      totalDistance,
      totalTime,
      algorithm: `direct-${result.algorithm}`,
      processingTime: performance.now() - startTime,
      clustersCount: 1,
      clusters: [{ id: 1, center: origin || points[0], pointsCount: points.length }]
    };
  }

  // 1. Clusterização Geográfica K-Means
  const k = Math.ceil(points.length / maxClusterSize);
  const clusteredPoints = kMeansClustering(points, k);

  // 2. Definir centroides dos clusters
  const clusterCentroids = clusteredPoints.map((cluster, idx) => {
    let sumLat = 0;
    let sumLng = 0;
    for (const p of cluster) {
      sumLat += p.lat;
      sumLng += p.lng;
    }
    return {
      id: `centroid-${idx}`,
      lat: sumLat / cluster.length,
      lng: sumLng / cluster.length,
      address: `Cluster ${idx + 1}`,
      clusterIndex: idx
    };
  });

  // 3. Otimizar a rota dos clusters (qual cluster visitar primeiro)
  const clusterTSPPoints = clusterCentroids.map(c => ({
    id: c.id,
    lat: c.lat,
    lng: c.lng,
    address: c.address
  }));

  const startClusterNode = origin ? { id: 'origin', lat: origin.lat, lng: origin.lng, address: origin.address } : undefined;
  const clusterSolverInput = startClusterNode ? [startClusterNode, ...clusterTSPPoints] : clusterTSPPoints;

  const clusterRouteResult = optimizeRoute(clusterSolverInput, {
    algorithm: 'nearest-neighbor',
    maxIterations: 100,
    timeLimit: 5,
    constraints: { maxDistance: 1000, maxTime: 1000, timeWindows: false, priorities: false }
  });

  // Obter ordem de visitação dos clusters
  const visitedClusterIndices: number[] = clusterRouteResult.route
    .map(node => {
      const found = clusterCentroids.find(c => c.id === node.id);
      return found ? found.clusterIndex : -1;
    })
    .filter(idx => idx !== -1);

  // 4. Otimizar paradas locais dentro de cada cluster
  const finalOrderedRoute: RoutePoint[] = [];
  if (origin) {
    finalOrderedRoute.push({ ...origin, sequence: 1 });
  }

  let lastPoint = origin || null;

  for (const clusterIdx of visitedClusterIndices) {
    const clusterPoints = [...clusteredPoints[clusterIdx]];
    if (clusterPoints.length === 0) continue;

    // Otimizar paradas locais do cluster
    // Ponto de entrada do cluster: se tivermos lastPoint, tentar começar pelo ponto do cluster mais próximo de lastPoint
    let startLocalPoint = clusterPoints[0];
    if (lastPoint) {
      let minDistance = Infinity;
      let minIdx = 0;
      for (let i = 0; i < clusterPoints.length; i++) {
        const distance = calculateDistanceBetweenPoints(lastPoint, clusterPoints[i]);
        if (distance < minDistance) {
          minDistance = distance;
          minIdx = i;
          startLocalPoint = clusterPoints[i];
        }
      }
      // Reordenar temporariamente para colocar o mais próximo no início
      clusterPoints.splice(minIdx, 1);
      clusterPoints.unshift(startLocalPoint);
    }

    const localTSPResult = optimizeRoute(clusterPoints, {
      algorithm: 'two-opt',
      maxIterations: 500,
      timeLimit: 5,
      constraints: { maxDistance: 1000, maxTime: 1000, timeWindows: false, priorities: false }
    });

    // Adicionar as paradas na rota consolidada
    localTSPResult.route.forEach(point => {
      if (origin && point.id === origin.id) return; // evitar duplicar a origem se estivesse na lista
      finalOrderedRoute.push(point);
    });

    if (finalOrderedRoute.length > 0) {
      lastPoint = finalOrderedRoute[finalOrderedRoute.length - 1];
    }
  }

  // Se for roundtrip, voltar ao ponto inicial e se houver de fato paradas
  if (isRoundTrip && origin && points.length > 0) {
    finalOrderedRoute.push({
      ...origin,
      sequence: finalOrderedRoute.length + 1
    });
  }

  const processingTime = performance.now() - startTime;
  const totalDistance = calculateTotalDistanceOfRoute(finalOrderedRoute);
  const totalTime = finalOrderedRoute.length * 3; // 3 min de tempo de parada estimado

  const clusterMeta = clusterCentroids.map((c, idx) => ({
    id: idx + 1,
    center: { lat: c.lat, lng: c.lng },
    pointsCount: clusteredPoints[c.clusterIndex].length
  }));

  return {
    route: finalOrderedRoute.map((p, index) => ({ ...p, sequence: index + 1 })),
    totalDistance,
    totalTime,
    algorithm: `hierarchical-kmeans (K=${k})`,
    processingTime,
    clustersCount: k,
    clusters: clusterMeta
  };
}

function calculateTotalDistanceOfRoute(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += calculateDistanceBetweenPoints(route[i], route[i + 1]);
  }
  return total;
}
