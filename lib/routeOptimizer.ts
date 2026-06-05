// 🧠 ALGORITMOS DE OTIMIZAÇÃO DE ROTAS - OPEN SOURCE
// Implementação de algoritmos clássicos para otimização de rotas

export interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
  address: string;
  sequence?: number;
  priority?: number;
  timeWindow?: {
    start: string;
    end: string;
  };
}

export interface OptimizationResult {
  route: RoutePoint[];
  totalDistance: number;
  totalTime: number;
  algorithm: string;
  processingTime: number;
  improvements: {
    distanceSaved: number;
    timeSaved: number;
    percentageImprovement: number;
  };
}

export interface OptimizationOptions {
  algorithm: 'nearest-neighbor' | 'two-opt' | 'genetic' | 'ant-colony' | 'auto';
  maxIterations: number;
  timeLimit: number;
  constraints: {
    maxDistance: number;
    maxTime: number;
    timeWindows: boolean;
    priorities: boolean;
  };
}

// 📏 FUNÇÃO PARA CALCULAR DISTÂNCIA ENTRE DOIS PONTOS (Haversine)
function calculateDistance(point1: RoutePoint, point2: RoutePoint): number {
  const R = 6371; // Raio da Terra em km
  const dLat = (point2.lat - point1.lat) * Math.PI / 180;
  const dLon = (point2.lng - point1.lng) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// 🧮 ALGORITMO 1: NEAREST NEIGHBOR (Vizinho Mais Próximo)
export function nearestNeighborOptimization(
  points: RoutePoint[], 
  startPoint?: RoutePoint,
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const startTime = performance.now();
  
  if (points.length <= 1) {
    return {
      route: points,
      totalDistance: 0,
      totalTime: 0,
      algorithm: 'nearest-neighbor',
      processingTime: 0,
      improvements: { distanceSaved: 0, timeSaved: 0, percentageImprovement: 0 }
    };
  }

  const start = startPoint || points[0];
  const unvisited = points.filter(p => p.id !== start.id);
  const route = [start];
  let currentPoint = start;
  let totalDistance = 0;

  while (unvisited.length > 0) {
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

    // Adicionar o ponto mais próximo à rota
    const nearestPoint = unvisited.splice(nearestIndex, 1)[0];
    route.push(nearestPoint);
    totalDistance += nearestDistance;
    currentPoint = nearestPoint;
  }

  const processingTime = performance.now() - startTime;
  const totalTime = route.length * 3; // 3 min por parada

  return {
    route: route.map((point, index) => ({ ...point, sequence: index + 1 })),
    totalDistance,
    totalTime,
    algorithm: 'nearest-neighbor',
    processingTime,
    improvements: { distanceSaved: 0, timeSaved: 0, percentageImprovement: 0 }
  };
}

// 🔄 ALGORITMO 2: 2-OPT IMPROVEMENT (Melhoria Local)
export function twoOptOptimization(
  initialRoute: RoutePoint[],
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const startTime = performance.now();
  const maxIterations = options.maxIterations || 1000;
  
  if (initialRoute.length <= 3) {
    return {
      route: initialRoute,
      totalDistance: calculateTotalDistance(initialRoute),
      totalTime: initialRoute.length * 3,
      algorithm: '2-opt',
      processingTime: 0,
      improvements: { distanceSaved: 0, timeSaved: 0, percentageImprovement: 0 }
    };
  }

  let route = [...initialRoute];
  let bestDistance = calculateTotalDistance(route);
  let improved = true;
  let iterations = 0;

  while (improved && iterations < maxIterations) {
    improved = false;
    iterations++;

    for (let i = 1; i < route.length - 2; i++) {
      for (let j = i + 1; j < route.length; j++) {
        if (j - i === 1) continue;

        // Tentar troca 2-opt
        const newRoute = [...route];
        const segment = newRoute.slice(i, j + 1);
        segment.reverse();
        newRoute.splice(i, j - i + 1, ...segment);

        const newDistance = calculateTotalDistance(newRoute);
        
        if (newDistance < bestDistance) {
          route = newRoute;
          bestDistance = newDistance;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
  }

  const processingTime = performance.now() - startTime;
  const totalTime = route.length * 3;

  return {
    route: route.map((point, index) => ({ ...point, sequence: index + 1 })),
    totalDistance: bestDistance,
    totalTime,
    algorithm: '2-opt',
    processingTime,
    improvements: { 
      distanceSaved: 0, 
      timeSaved: 0, 
      percentageImprovement: 0 
    }
  };
}

// 🧬 ALGORITMO 3: ALGORITMO GENÉTICO (Evolução)
export function geneticAlgorithmOptimization(
  points: RoutePoint[],
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const startTime = performance.now();
  const populationSize = 50;
  const generations = options.maxIterations || 100;
  const mutationRate = 0.1;
  
  if (points.length <= 1) {
    return {
      route: points,
      totalDistance: 0,
      totalTime: 0,
      algorithm: 'genetic',
      processingTime: 0,
      improvements: { distanceSaved: 0, timeSaved: 0, percentageImprovement: 0 }
    };
  }

  // Inicializar população
  let population = Array.from({ length: populationSize }, () => 
    shuffleArray([...points])
  );

  let bestRoute = population[0];
  let bestDistance = calculateTotalDistance(bestRoute);

  // Evolução
  for (let generation = 0; generation < generations; generation++) {
    // Avaliar fitness
    const fitness = population.map(route => ({
      route,
      fitness: 1 / (calculateTotalDistance(route) + 1)
    }));

    // Ordenar por fitness
    fitness.sort((a, b) => b.fitness - a.fitness);

    // Manter os melhores
    const newPopulation = fitness.slice(0, populationSize / 2).map(f => f.route);

    // Cruzamento e mutação
    while (newPopulation.length < populationSize) {
      const parent1 = fitness[Math.floor(Math.random() * fitness.length / 2)].route;
      const parent2 = fitness[Math.floor(Math.random() * fitness.length / 2)].route;
      
      const child = crossover(parent1, parent2);
      
      if (Math.random() < mutationRate) {
        mutate(child);
      }
      
      newPopulation.push(child);
    }

    population = newPopulation;

    // Atualizar melhor rota
    const currentBest = fitness[0].route;
    const currentDistance = calculateTotalDistance(currentBest);
    
    if (currentDistance < bestDistance) {
      bestRoute = currentBest;
      bestDistance = currentDistance;
    }
  }

  const processingTime = performance.now() - startTime;
  const totalTime = bestRoute.length * 3;

  return {
    route: bestRoute.map((point, index) => ({ ...point, sequence: index + 1 })),
    totalDistance: bestDistance,
    totalTime,
    algorithm: 'genetic',
    processingTime,
    improvements: { 
      distanceSaved: 0, 
      timeSaved: 0, 
      percentageImprovement: 0 
    }
  };
}

// 🐜 ALGORITMO 4: ANT COLONY OPTIMIZATION (Colônia de Formigas)
export function antColonyOptimization(
  points: RoutePoint[],
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const startTime = performance.now();
  const antCount = 20;
  const iterations = options.maxIterations || 50;
  const evaporationRate = 0.1;
  const alpha = 1; // Importância do feromônio
  const beta = 2;  // Importância da distância
  
  if (points.length <= 1) {
    return {
      route: points,
      totalDistance: 0,
      totalTime: 0,
      algorithm: 'ant-colony',
      processingTime: 0,
      improvements: { distanceSaved: 0, timeSaved: 0, percentageImprovement: 0 }
    };
  }

  // Mapeamento de ID para índice sequencial 0..N-1
  const idToIdx = new Map<string, number>();
  points.forEach((p, idx) => idToIdx.set(p.id, idx));

  // Matriz de feromônios
  const pheromones = Array(points.length).fill(0).map(() => 
    Array(points.length).fill(1)
  );

  let bestRoute = points;
  let bestDistance = calculateTotalDistance(points);

  for (let iteration = 0; iteration < iterations; iteration++) {
    // Cada formiga constrói uma rota
    const antRoutes: RoutePoint[][] = [];
    
    for (let ant = 0; ant < antCount; ant++) {
      const route = constructAntRoute(points, pheromones, alpha, beta, idToIdx);
      antRoutes.push(route);
      
      const distance = calculateTotalDistance(route);
      if (distance < bestDistance) {
        bestRoute = route;
        bestDistance = distance;
      }
    }

    // Evaporar feromônios
    for (let i = 0; i < points.length; i++) {
      for (let j = 0; j < points.length; j++) {
        pheromones[i][j] *= (1 - evaporationRate);
      }
    }

    // Depositar feromônios
    antRoutes.forEach(route => {
      const distance = calculateTotalDistance(route);
      const pheromoneDeposit = 1 / distance;
      
      for (let i = 0; i < route.length - 1; i++) {
        const current = route[i];
        const next = route[i + 1];
        
        const currentIndex = idToIdx.get(current.id);
        const nextIndex = idToIdx.get(next.id);
        
        if (currentIndex !== undefined && nextIndex !== undefined &&
            currentIndex >= 0 && currentIndex < pheromones.length && 
            nextIndex >= 0 && nextIndex < pheromones.length) {
          pheromones[currentIndex][nextIndex] += pheromoneDeposit;
          pheromones[nextIndex][currentIndex] += pheromoneDeposit;
        }
      }
    });
  }

  const processingTime = performance.now() - startTime;
  const totalTime = bestRoute.length * 3;

  return {
    route: bestRoute.map((point, index) => ({ ...point, sequence: index + 1 })),
    totalDistance: bestDistance,
    totalTime,
    algorithm: 'ant-colony',
    processingTime,
    improvements: { 
      distanceSaved: 0, 
      timeSaved: 0, 
      percentageImprovement: 0 
    }
  };
}

// 🎯 ALGORITMO PRINCIPAL: SELEÇÃO AUTOMÁTICA
export function autoOptimizeRoute(
  points: RoutePoint[],
  options: Partial<OptimizationOptions> = {}
): OptimizationResult {
  const startTime = performance.now();
  
  if (points.length <= 5) {
    // Para poucos pontos, usar 2-opt
    return twoOptOptimization(points, options);
  } else if (points.length <= 20) {
    // Para quantidade média, usar genético
    return geneticAlgorithmOptimization(points, options);
  } else {
    // Para muitos pontos, usar nearest neighbor + 2-opt
    const initialRoute = nearestNeighborOptimization(points, undefined, options);
    return twoOptOptimization(initialRoute.route, options);
  }
}

// 🔧 FUNÇÕES AUXILIARES
function calculateTotalDistance(route: RoutePoint[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) {
    total += calculateDistance(route[i], route[i + 1]);
  }
  return total;
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function crossover(parent1: RoutePoint[], parent2: RoutePoint[]): RoutePoint[] {
  const start = Math.floor(Math.random() * parent1.length);
  const end = Math.floor(Math.random() * parent1.length);
  
  const child = [...parent1];
  const segment = parent2.slice(start, end);
  
  // Inserir segmento do parent2
  for (let i = 0; i < segment.length; i++) {
    const index = (start + i) % parent1.length;
    child[index] = segment[i];
  }
  
  return child;
}

function mutate(route: RoutePoint[]): void {
  const i = Math.floor(Math.random() * route.length);
  const j = Math.floor(Math.random() * route.length);
  
  if (i !== j) {
    [route[i], route[j]] = [route[j], route[i]];
  }
}

function constructAntRoute(
  points: RoutePoint[], 
  pheromones: number[][], 
  alpha: number, 
  beta: number,
  idToIdx: Map<string, number>
): RoutePoint[] {
  const unvisited = [...points];
  const route = [unvisited.shift()!];
  
  while (unvisited.length > 0) {
    const current = route[route.length - 1];
    const probabilities = unvisited.map(point => {
      const currentIndex = idToIdx.get(current.id);
      const pointIndex = idToIdx.get(point.id);
      
      let pheromone = 1;
      if (currentIndex !== undefined && pointIndex !== undefined &&
          currentIndex >= 0 && currentIndex < pheromones.length && 
          pointIndex >= 0 && pointIndex < pheromones.length) {
        pheromone = pheromones[currentIndex][pointIndex];
      }
      
      const distance = calculateDistance(current, point);
      const heuristic = 1 / distance;
      return Math.pow(pheromone, alpha) * Math.pow(heuristic, beta);
    });
    
    const total = probabilities.reduce((sum, p) => sum + p, 0);
    const random = Math.random() * total;
    
    let cumulative = 0;
    for (let i = 0; i < unvisited.length; i++) {
      cumulative += probabilities[i];
      if (cumulative >= random) {
        route.push(unvisited.splice(i, 1)[0]);
        break;
      }
    }
  }
  
  return route;
}

// 📊 FUNÇÃO PARA COMPARAR ALGORITMOS
export function compareAlgorithms(
  points: RoutePoint[],
  options: Partial<OptimizationOptions> = {}
): Record<string, OptimizationResult> {
  const results: Record<string, OptimizationResult> = {};
  
  // Testar todos os algoritmos
  results['nearest-neighbor'] = nearestNeighborOptimization(points, options);
  results['2-opt'] = twoOptOptimization(points, options);
  results['genetic'] = geneticAlgorithmOptimization(points, options);
  results['ant-colony'] = antColonyOptimization(points, options);
  results['auto'] = autoOptimizeRoute(points, options);
  
  // Calcular melhorias
  const baseline = results['nearest-neighbor'].totalDistance;
  
  Object.values(results).forEach(result => {
    const improvement = baseline - result.totalDistance;
    result.improvements = {
      distanceSaved: improvement,
      timeSaved: improvement * 0.1, // Estimativa de tempo
      percentageImprovement: (improvement / baseline) * 100
    };
  });
  
  return results;
}

// 🚀 FUNÇÃO PRINCIPAL DE EXPORTAÇÃO
export function optimizeRoute(
  points: RoutePoint[],
  options: OptimizationOptions
): OptimizationResult {
  switch (options.algorithm) {
    case 'nearest-neighbor':
      return nearestNeighborOptimization(points, undefined, options);
    case 'two-opt':
      return twoOptOptimization(points, options);
    case 'genetic':
      return geneticAlgorithmOptimization(points, options);
    case 'ant-colony':
      return antColonyOptimization(points, options);
    case 'auto':
    default:
      return autoOptimizeRoute(points, options);
  }
}
