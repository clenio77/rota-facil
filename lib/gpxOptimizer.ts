// GPX Optimizer - Sistema avançado de otimização de rotas GPX
// Implementa algoritmos TSP, 2-opt e heurísticas para otimização de waypoints

export interface GPXWaypoint {
  lat: number;
  lng: number;
  name: string;
  elevation?: number;
  time?: string;
  description?: string;
}

export interface GPXTrack {
  name: string;
  points: GPXWaypoint[];
}

export interface GPXRoute {
  name: string;
  waypoints: GPXWaypoint[];
}

export interface GPXData {
  waypoints: GPXWaypoint[];
  tracks: GPXTrack[];
  routes: GPXRoute[];
  metadata?: {
    name?: string;
    description?: string;
    author?: string;
    time?: string;
  };
}

export interface OptimizationResult {
  originalDistance: number;
  optimizedDistance: number;
  distanceSaved: number;
  percentageImprovement: number;
  originalDuration: number;
  optimizedDuration: number;
  timeSaved: number;
  algorithm: string;
  optimizedWaypoints: GPXWaypoint[];
}

export interface OptimizationOptions {
  algorithm: 'nearest-neighbor' | 'two-opt' | 'christofides' | 'genetic' | 'auto';
  startPoint?: GPXWaypoint;
  endPoint?: GPXWaypoint;
  roundTrip: boolean;
  maxIterations?: number;
  preserveOrder?: boolean;
  weightDistance?: number;
  weightTime?: number;
  filterByLocation?: boolean;
  maxDistanceFromUser?: number;
}

// Classe principal do GPX Optimizer
export class GPXOptimizer {
  private static readonly EARTH_RADIUS = 6371; // km

  // Calcular distância entre dois pontos usando fórmula de Haversine
  static calculateDistance(point1: GPXWaypoint, point2: GPXWaypoint): number {
    const dLat = this.toRadians(point2.lat - point1.lat);
    const dLng = this.toRadians(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(point1.lat)) * Math.cos(this.toRadians(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  // Calcular distância total de uma rota
  static calculateTotalDistance(waypoints: GPXWaypoint[]): number {
    if (waypoints.length < 2) return 0;
    
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDistance += this.calculateDistance(waypoints[i], waypoints[i + 1]);
    }
    return totalDistance;
  }

  // Algoritmo Nearest Neighbor (mais rápido para datasets grandes)
  static optimizeNearestNeighbor(
    waypoints: GPXWaypoint[], 
    options: OptimizationOptions
  ): GPXWaypoint[] {
    if (waypoints.length <= 2) return waypoints;

    const unvisited = [...waypoints];
    const optimized: GPXWaypoint[] = [];
    
    // Ponto inicial
    let current = options.startPoint || unvisited[0];
    optimized.push(current);
    unvisited.splice(unvisited.indexOf(current), 1);

    // Encontrar o próximo ponto mais próximo
    while (unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = this.calculateDistance(current, unvisited[0]);

      for (let i = 1; i < unvisited.length; i++) {
        const distance = this.calculateDistance(current, unvisited[i]);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      current = unvisited[nearestIndex];
      optimized.push(current);
      unvisited.splice(nearestIndex, 1);
    }

    // Se for round trip, voltar ao início
    if (options.roundTrip && optimized.length > 1) {
      optimized.push(optimized[0]);
    }

    return optimized;
  }

  // Algoritmo 2-opt para melhorar uma rota existente
  static optimize2Opt(waypoints: GPXWaypoint[], maxIterations: number = 1000): GPXWaypoint[] {
    if (waypoints.length <= 3) return waypoints;

    let bestRoute = [...waypoints];
    let bestDistance = this.calculateTotalDistance(bestRoute);
    let improved = true;
    let iterations = 0;

    while (improved && iterations < maxIterations) {
      improved = false;
      iterations++;

      for (let i = 1; i < bestRoute.length - 2; i++) {
        for (let j = i + 1; j < bestRoute.length - 1; j++) {
          // Criar nova rota invertendo o segmento entre i e j
          const newRoute = [...bestRoute];
          this.reverseSegment(newRoute, i, j);
          
          const newDistance = this.calculateTotalDistance(newRoute);
          
          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }

    return bestRoute;
  }

  private static reverseSegment(route: GPXWaypoint[], start: number, end: number): void {
    while (start < end) {
      [route[start], route[end]] = [route[end], route[start]];
      start++;
      end--;
    }
  }

  // Algoritmo genético simplificado
  static optimizeGenetic(
    waypoints: GPXWaypoint[], 
    options: OptimizationOptions
  ): GPXWaypoint[] {
    if (waypoints.length <= 3) return waypoints;

    const populationSize = Math.min(50, waypoints.length * 2);
    const generations = options.maxIterations || 100;
    const mutationRate = 0.1;
    const eliteSize = Math.floor(populationSize * 0.2);

    // Gerar população inicial
    let population = this.generateInitialPopulation(waypoints, populationSize, options);

    for (let gen = 0; gen < generations; gen++) {
      // Avaliar fitness
      const fitness = population.map(route => 1 / (1 + this.calculateTotalDistance(route)));
      
      // Seleção e reprodução
      const newPopulation: GPXWaypoint[][] = [];
      
      // Manter elite
      const sortedIndices = fitness
        .map((f, i) => ({ fitness: f, index: i }))
        .sort((a, b) => b.fitness - a.fitness)
        .map(item => item.index);
      
      for (let i = 0; i < eliteSize; i++) {
        newPopulation.push([...population[sortedIndices[i]]]);
      }

      // Gerar resto da população
      while (newPopulation.length < populationSize) {
        const parent1 = this.tournamentSelection(population, fitness);
        const parent2 = this.tournamentSelection(population, fitness);
        const child = this.crossover(parent1, parent2);
        
        if (Math.random() < mutationRate) {
          this.mutate(child);
        }
        
        newPopulation.push(child);
      }

      population = newPopulation;
    }

    // Retornar melhor solução
    const finalFitness = population.map(route => this.calculateTotalDistance(route));
    const bestIndex = finalFitness.indexOf(Math.min(...finalFitness));
    return population[bestIndex];
  }

  private static generateInitialPopulation(
    waypoints: GPXWaypoint[], 
    size: number, 
    options: OptimizationOptions
  ): GPXWaypoint[][] {
    const population: GPXWaypoint[][] = [];
    
    // Adicionar solução nearest neighbor
    population.push(this.optimizeNearestNeighbor(waypoints, options));
    
    // Adicionar soluções aleatórias
    for (let i = 1; i < size; i++) {
      const shuffled = [...waypoints];
      for (let j = shuffled.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1));
        [shuffled[j], shuffled[k]] = [shuffled[k], shuffled[j]];
      }
      population.push(shuffled);
    }
    
    return population;
  }

  private static tournamentSelection(population: GPXWaypoint[][], fitness: number[]): GPXWaypoint[] {
    const tournamentSize = 3;
    let best = Math.floor(Math.random() * population.length);
    
    for (let i = 1; i < tournamentSize; i++) {
      const competitor = Math.floor(Math.random() * population.length);
      if (fitness[competitor] > fitness[best]) {
        best = competitor;
      }
    }
    
    return [...population[best]];
  }

  private static crossover(parent1: GPXWaypoint[], parent2: GPXWaypoint[]): GPXWaypoint[] {
    const start = Math.floor(Math.random() * parent1.length);
    const end = Math.floor(Math.random() * (parent1.length - start)) + start;
    
    const child: GPXWaypoint[] = new Array(parent1.length);
    
    // Copiar segmento do parent1
    for (let i = start; i <= end; i++) {
      child[i] = parent1[i];
    }
    
    // Preencher resto com parent2
    let parent2Index = 0;
    for (let i = 0; i < child.length; i++) {
      if (!child[i]) {
        while (child.includes(parent2[parent2Index])) {
          parent2Index++;
        }
        child[i] = parent2[parent2Index];
        parent2Index++;
      }
    }
    
    return child;
  }

  private static mutate(route: GPXWaypoint[]): void {
    const i = Math.floor(Math.random() * route.length);
    const j = Math.floor(Math.random() * route.length);
    [route[i], route[j]] = [route[j], route[i]];
  }

  // Método principal de otimização
  static optimize(waypoints: GPXWaypoint[], options: OptimizationOptions): OptimizationResult {
    const originalDistance = this.calculateTotalDistance(waypoints);
    const originalDuration = originalDistance / 50 * 60; // Assumindo 50 km/h média

    let optimizedWaypoints: GPXWaypoint[];
    let algorithm: string;

    switch (options.algorithm) {
      case 'nearest-neighbor':
        optimizedWaypoints = this.optimizeNearestNeighbor(waypoints, options);
        algorithm = 'Nearest Neighbor';
        break;
      case 'two-opt':
        const nnResult = this.optimizeNearestNeighbor(waypoints, options);
        optimizedWaypoints = this.optimize2Opt(nnResult, options.maxIterations);
        algorithm = 'Nearest Neighbor + 2-opt';
        break;
      case 'genetic':
        optimizedWaypoints = this.optimizeGenetic(waypoints, options);
        algorithm = 'Genetic Algorithm';
        break;
      case 'auto':
        // Escolher algoritmo baseado no tamanho do dataset
        if (waypoints.length <= 10) {
          const nnResult = this.optimizeNearestNeighbor(waypoints, options);
          optimizedWaypoints = this.optimize2Opt(nnResult, options.maxIterations);
          algorithm = 'Auto (NN + 2-opt)';
        } else if (waypoints.length <= 50) {
          optimizedWaypoints = this.optimizeGenetic(waypoints, options);
          algorithm = 'Auto (Genetic)';
        } else {
          optimizedWaypoints = this.optimizeNearestNeighbor(waypoints, options);
          algorithm = 'Auto (Nearest Neighbor)';
        }
        break;
      default:
        optimizedWaypoints = this.optimizeNearestNeighbor(waypoints, options);
        algorithm = 'Nearest Neighbor (default)';
    }

    const optimizedDistance = this.calculateTotalDistance(optimizedWaypoints);
    const optimizedDuration = optimizedDistance / 50 * 60;

    return {
      originalDistance,
      optimizedDistance,
      distanceSaved: originalDistance - optimizedDistance,
      percentageImprovement: ((originalDistance - optimizedDistance) / originalDistance) * 100,
      originalDuration,
      optimizedDuration,
      timeSaved: originalDuration - optimizedDuration,
      algorithm,
      optimizedWaypoints
    };
  }
}
