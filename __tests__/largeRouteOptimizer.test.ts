import { kMeansClustering, optimizeLargeRoute } from '../lib/largeRouteOptimizer';
import { RoutePoint } from '../lib/routeOptimizer';

describe('Large Route Optimizer - K-Means & Hierarchical TSP', () => {
  // Gerar paradas simuladas para testes
  const createMockPoints = (count: number, baseLat = -18.9186, baseLng = -48.2772): RoutePoint[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `stop-${i + 1}`,
      lat: baseLat + (Math.random() - 0.5) * 0.1,
      lng: baseLng + (Math.random() - 0.5) * 0.1,
      address: `Mock Stop ${i + 1}`
    }));
  };

  test('kMeansClustering should group points into K clusters', () => {
    const points = createMockPoints(30);
    const k = 3;
    const clusters = kMeansClustering(points, k);

    expect(clusters.length).toBeLessThanOrEqual(k);
    expect(clusters.length).toBeGreaterThan(0);

    // O total de pontos em todos os clusters deve ser igual ao original
    const totalPointsInClusters = clusters.reduce((sum, c) => sum + c.length, 0);
    expect(totalPointsInClusters).toBe(points.length);
  });

  test('optimizeLargeRoute should optimize a route with 30 stops using hierarchical clustering', () => {
    const points = createMockPoints(30);
    const origin: RoutePoint = {
      id: 'origin',
      lat: -18.9186,
      lng: -48.2772,
      address: 'Central Station'
    };

    const result = optimizeLargeRoute(points, origin, {
      maxClusterSize: 10,
      algorithm: 'auto',
      roundTrip: true
    });

    expect(result.success).toBeUndefined(); // a assinatura de LargeRouteResult não tem success
    expect(result.route.length).toBe(points.length + 2); // 30 paradas + origem no início + origem no fim (roundtrip)
    expect(result.route[0].id).toBe('origin');
    expect(result.route[result.route.length - 1].id).toBe('origin');

    // Verificar se as sequências estão corretas
    result.route.forEach((p, idx) => {
      expect(p.sequence).toBe(idx + 1);
    });

    expect(result.totalDistance).toBeGreaterThan(0);
    expect(result.clustersCount).toBe(3); // 30 pontos / maxClusterSize 10 = 3 clusters
  });

  test('optimizeLargeRoute should delegate directly for small routes (< maxClusterSize)', () => {
    const points = createMockPoints(5);
    const origin: RoutePoint = {
      id: 'origin',
      lat: -18.9186,
      lng: -48.2772,
      address: 'Central Station'
    };

    const result = optimizeLargeRoute(points, origin, {
      maxClusterSize: 10,
      algorithm: 'auto',
      roundTrip: false
    });

    expect(result.route.length).toBe(points.length + 1); // 5 paradas + origem (sem roundtrip)
    expect(result.clustersCount).toBe(1);
    expect(result.algorithm).toContain('direct-');
  });

  test('optimizeLargeRoute should handle empty or single points gracefully', () => {
    const emptyPoints: RoutePoint[] = [];
    const origin: RoutePoint = {
      id: 'origin',
      lat: -18.9186,
      lng: -48.2772,
      address: 'Central Station'
    };

    const result = optimizeLargeRoute(emptyPoints, origin);
    expect(result.route.length).toBe(1); // apenas a origem
    expect(result.totalDistance).toBe(0);
  });
});
