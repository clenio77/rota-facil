// Sistema de Monitoramento de Performance para RotaFácil
// Implementa métricas de performance, lazy loading e cache inteligente

import { logger, LogCategory } from './logger';

export interface PerformanceMetric {
  name: string;
  duration: number;
  timestamp: number;
  category: string;
  context?: Record<string, any>;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccess: number;
}

export interface LazyLoadConfig {
  threshold: number;
  rootMargin: string;
  fallback?: () => React.ReactNode;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetric[] = [];
  private cache: Map<string, CacheEntry<any>> = new Map();
  private observers: Map<string, IntersectionObserver> = new Map();
  private maxMetrics: number = 1000;
  private maxCacheSize: number = 100;

  private constructor() {
    this.setupPerformanceObserver();
  }

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Monitorar performance de operação
  public async measure<T>(
    name: string,
    category: string,
    operation: () => Promise<T>,
    context?: Record<string, any>
  ): Promise<T> {
    const startTime = performance.now();
    const startTimestamp = Date.now();

    try {
      const result = await operation();
      const duration = performance.now() - startTime;

      this.recordMetric({
        name,
        duration,
        timestamp: startTimestamp,
        category,
        context,
      });

      logger.performance(`${category}: ${name}`, duration, context);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name: `${name}_error`,
        duration,
        timestamp: startTimestamp,
        category,
        context: { ...context, error: error.message },
      });

      throw error;
    }
  }

  // Medir operação síncrona
  public measureSync<T>(
    name: string,
    category: string,
    operation: () => T,
    context?: Record<string, any>
  ): T {
    const startTime = performance.now();
    const startTimestamp = Date.now();

    try {
      const result = operation();
      const duration = performance.now() - startTime;

      this.recordMetric({
        name,
        duration,
        timestamp: startTimestamp,
        category,
        context,
      });

      logger.performance(`${category}: ${name}`, duration, context);
      return result;
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.recordMetric({
        name: `${name}_error`,
        duration,
        timestamp: startTimestamp,
        category,
        context: { ...context, error: error.message },
      });

      throw error;
    }
  }

  // Registrar métrica
  private recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);
    
    // Manter apenas as últimas métricas
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  // Obter métricas por categoria
  public getMetricsByCategory(category: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.category === category);
  }

  // Obter estatísticas de performance
  public getPerformanceStats(category?: string): {
    total: number;
    average: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const metrics = category ? this.getMetricsByCategory(category) : this.metrics;
    
    if (metrics.length === 0) {
      return { total: 0, average: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const durations = metrics.map(m => m.duration).sort((a, b) => a - b);
    const total = durations.reduce((sum, d) => sum + d, 0);
    const average = total / durations.length;
    const min = durations[0];
    const max = durations[durations.length - 1];
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      total: metrics.length,
      average,
      min,
      max,
      p95: durations[p95Index] || 0,
      p99: durations[p99Index] || 0,
    };
  }

  // Sistema de cache inteligente
  public setCache<T>(key: string, data: T, ttl: number = 300000): void {
    // Limpar cache se necessário
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanupCache();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccess: Date.now(),
    });
  }

  public getCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) return null;

    // Verificar se expirou
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Atualizar estatísticas de acesso
    entry.accessCount++;
    entry.lastAccess = Date.now();

    return entry.data;
  }

  public hasCache(key: string): boolean {
    return this.cache.has(key);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  // Limpeza automática do cache
  private cleanupCache(): void {
    const now = Date.now();
    const entries = Array.from(this.cache.entries());
    
    // Ordenar por último acesso (LRU)
    entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
    
    // Remover 20% dos itens menos usados
    const toRemove = Math.floor(this.maxCacheSize * 0.2);
    entries.slice(0, toRemove).forEach(([key]) => this.cache.delete(key));
  }

  // Lazy loading com Intersection Observer
  public setupLazyLoading(
    elementId: string,
    callback: () => void,
    config: LazyLoadConfig
  ): void {
    const element = document.getElementById(elementId);
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            callback();
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: config.threshold,
        rootMargin: config.rootMargin,
      }
    );

    observer.observe(element);
    this.observers.set(elementId, observer);
  }

  // Limpar observer
  public cleanupLazyLoading(elementId: string): void {
    const observer = this.observers.get(elementId);
    if (observer) {
      observer.disconnect();
      this.observers.delete(elementId);
    }
  }

  // Configurar observer de performance nativo
  private setupPerformanceObserver(): void {
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver((list) => {
          list.getEntries().forEach((entry) => {
            if (entry.entryType === 'measure') {
              this.recordMetric({
                name: entry.name,
                duration: entry.duration,
                timestamp: Date.now(),
                category: 'browser',
                context: { entryType: entry.entryType },
              });
            }
          });
        });

        observer.observe({ entryTypes: ['measure', 'navigation'] });
      } catch (error) {
        logger.warn(LogCategory.PERFORMANCE, 'PerformanceObserver não disponível', { error: error.message });
      }
    }
  }

  // Gerar relatório de performance
  public generateReport(): string {
    const stats = this.getPerformanceStats();
    const categoryStats = ['OCR', 'GEOCODING', 'ROUTE_OPTIMIZATION', 'API'].map(cat => ({
      category: cat,
      stats: this.getPerformanceStats(cat),
    }));

    let report = `📊 RELATÓRIO DE PERFORMANCE\n`;
    report += `================================\n\n`;
    report += `📈 ESTATÍSTICAS GERAIS:\n`;
    report += `   Total de operações: ${stats.total}\n`;
    report += `   Tempo médio: ${stats.average.toFixed(2)}ms\n`;
    report += `   Tempo mínimo: ${stats.min.toFixed(2)}ms\n`;
    report += `   Tempo máximo: ${stats.max.toFixed(2)}ms\n`;
    report += `   P95: ${stats.p95.toFixed(2)}ms\n`;
    report += `   P99: ${stats.p99.toFixed(2)}ms\n\n`;

    report += `🏷️  POR CATEGORIA:\n`;
    categoryStats.forEach(({ category, stats }) => {
      if (stats.total > 0) {
        report += `   ${category}:\n`;
        report += `     Total: ${stats.total} | Média: ${stats.average.toFixed(2)}ms | P95: ${stats.p95.toFixed(2)}ms\n`;
      }
    });

    report += `\n💾 CACHE:\n`;
    report += `   Itens em cache: ${this.cache.size}\n`;
    report += `   Tamanho máximo: ${this.maxCacheSize}\n`;

    return report;
  }

  // Exportar métricas
  public exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  // Limpar métricas antigas
  public clearOldMetrics(maxAge: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - maxAge;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
  }
}

// Instância singleton
export const performanceMonitor = PerformanceMonitor.getInstance();

// Helpers para uso rápido
export const measure = <T>(
  name: string,
  category: string,
  operation: () => Promise<T>,
  context?: Record<string, any>
): Promise<T> => performanceMonitor.measure(name, category, operation, context);

export const measureSync = <T>(
  name: string,
  category: string,
  operation: () => T,
  context?: Record<string, any>
): T => performanceMonitor.measureSync(name, category, operation, context);

export const setCache = <T>(key: string, data: T, ttl?: number): void => 
  performanceMonitor.setCache(key, data, ttl);

export const getCache = <T>(key: string): T | null => 
  performanceMonitor.getCache<T>(key);

export const hasCache = (key: string): boolean => 
  performanceMonitor.hasCache(key);
