/**
 * 📊 ANALYTICS SYSTEM - Sistema de Métricas para Carteiros
 * Armazena e analisa dados de performance de entregas
 */

export interface DeliveryMetrics {
  id: string;
  date: string;
  startTime: number;
  endTime?: number;
  totalStops: number;
  completedStops: number;
  totalDistance: number; // km
  totalTime: number; // minutos
  fuelCost: number; // R$
  averageTimePerStop: number; // minutos
  efficiency: number; // 0-100%
  route: {
    optimized: boolean;
    originalDistance?: number;
    savedDistance?: number;
  };
  location: {
    city: string;
    state: string;
  };
}

export interface DailyStats {
  date: string;
  totalDeliveries: number;
  totalDistance: number;
  totalTime: number;
  totalFuelCost: number;
  efficiency: number;
}

export interface WeeklyStats {
  week: string;
  days: DailyStats[];
  averages: {
    deliveriesPerDay: number;
    distancePerDay: number;
    timePerDay: number;
    fuelCostPerDay: number;
    efficiency: number;
  };
}

class AnalyticsSystem {
  private readonly STORAGE_KEY = 'rota-facil-analytics';
  private readonly MAX_RECORDS = 1000; // Limite para não sobrecarregar localStorage

  /**
   * 📊 Iniciar nova sessão de entrega
   */
  startDeliverySession(totalStops: number, location: { city: string; state: string }): string {
    const sessionId = `delivery_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const metrics: DeliveryMetrics = {
      id: sessionId,
      date: new Date().toISOString().split('T')[0],
      startTime: Date.now(),
      totalStops,
      completedStops: 0,
      totalDistance: 0,
      totalTime: 0,
      fuelCost: 0,
      averageTimePerStop: 0,
      efficiency: 0,
      route: {
        optimized: false
      },
      location
    };

    this.saveMetrics(metrics);
    console.log('📊 Sessão de entrega iniciada:', sessionId);
    return sessionId;
  }

  /**
   * 🏁 Finalizar sessão de entrega
   */
  endDeliverySession(
    sessionId: string, 
    completedStops: number, 
    totalDistance: number, 
    routeOptimized: boolean = false,
    originalDistance?: number
  ): void {
    const metrics = this.getMetrics(sessionId);
    if (!metrics) {
      console.error('Sessão não encontrada:', sessionId);
      return;
    }

    const endTime = Date.now();
    const totalTime = Math.round((endTime - metrics.startTime) / 1000 / 60); // minutos
    const fuelCost = totalDistance * 0.15; // R$ 0,15 por km
    const efficiency = Math.round((completedStops / metrics.totalStops) * 100);
    const averageTimePerStop = completedStops > 0 ? Math.round(totalTime / completedStops) : 0;

    const updatedMetrics: DeliveryMetrics = {
      ...metrics,
      endTime,
      completedStops,
      totalDistance,
      totalTime,
      fuelCost,
      averageTimePerStop,
      efficiency,
      route: {
        optimized: routeOptimized,
        originalDistance,
        savedDistance: originalDistance ? Math.max(0, originalDistance - totalDistance) : 0
      }
    };

    this.saveMetrics(updatedMetrics);
    console.log('🏁 Sessão de entrega finalizada:', updatedMetrics);
  }

  /**
   * 📈 Obter estatísticas diárias
   */
  getDailyStats(date?: string): DailyStats | null {
    const targetDate = date || new Date().toISOString().split('T')[0];
    const allMetrics = this.getAllMetrics();
    const dayMetrics = allMetrics.filter(m => m.date === targetDate && m.endTime);

    if (dayMetrics.length === 0) return null;

    const totalDeliveries = dayMetrics.reduce((sum, m) => sum + m.completedStops, 0);
    const totalDistance = dayMetrics.reduce((sum, m) => sum + m.totalDistance, 0);
    const totalTime = dayMetrics.reduce((sum, m) => sum + m.totalTime, 0);
    const totalFuelCost = dayMetrics.reduce((sum, m) => sum + m.fuelCost, 0);
    const avgEfficiency = dayMetrics.reduce((sum, m) => sum + m.efficiency, 0) / dayMetrics.length;

    return {
      date: targetDate,
      totalDeliveries,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime,
      totalFuelCost: Math.round(totalFuelCost * 100) / 100,
      efficiency: Math.round(avgEfficiency)
    };
  }

  /**
   * 📊 Obter estatísticas semanais
   */
  getWeeklyStats(weekStart?: string): WeeklyStats {
    const startDate = weekStart ? new Date(weekStart) : this.getWeekStart(new Date());
    const days: DailyStats[] = [];

    // Gerar stats para 7 dias
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const dayStats = this.getDailyStats(dateStr);
      
      if (dayStats) {
        days.push(dayStats);
      } else {
        days.push({
          date: dateStr,
          totalDeliveries: 0,
          totalDistance: 0,
          totalTime: 0,
          totalFuelCost: 0,
          efficiency: 0
        });
      }
    }

    // Calcular médias
    const validDays = days.filter(d => d.totalDeliveries > 0);
    const averages = {
      deliveriesPerDay: validDays.length > 0 ? Math.round(validDays.reduce((sum, d) => sum + d.totalDeliveries, 0) / validDays.length) : 0,
      distancePerDay: validDays.length > 0 ? Math.round((validDays.reduce((sum, d) => sum + d.totalDistance, 0) / validDays.length) * 100) / 100 : 0,
      timePerDay: validDays.length > 0 ? Math.round(validDays.reduce((sum, d) => sum + d.totalTime, 0) / validDays.length) : 0,
      fuelCostPerDay: validDays.length > 0 ? Math.round((validDays.reduce((sum, d) => sum + d.totalFuelCost, 0) / validDays.length) * 100) / 100 : 0,
      efficiency: validDays.length > 0 ? Math.round(validDays.reduce((sum, d) => sum + d.efficiency, 0) / validDays.length) : 0
    };

    return {
      week: startDate.toISOString().split('T')[0],
      days,
      averages
    };
  }

  /**
   * 🏆 Obter recordes pessoais
   */
  getPersonalRecords() {
    const allMetrics = this.getAllMetrics().filter(m => m.endTime);
    
    if (allMetrics.length === 0) {
      return {
        mostDeliveries: 0,
        longestDistance: 0,
        bestEfficiency: 0,
        fastestDelivery: 0,
        totalSessions: 0
      };
    }

    return {
      mostDeliveries: Math.max(...allMetrics.map(m => m.completedStops)),
      longestDistance: Math.max(...allMetrics.map(m => m.totalDistance)),
      bestEfficiency: Math.max(...allMetrics.map(m => m.efficiency)),
      fastestDelivery: Math.min(...allMetrics.map(m => m.averageTimePerStop).filter(t => t > 0)),
      totalSessions: allMetrics.length
    };
  }

  /**
   * 💾 Salvar métricas no localStorage
   */
  private saveMetrics(metrics: DeliveryMetrics): void {
    try {
      const allMetrics = this.getAllMetrics();
      const existingIndex = allMetrics.findIndex(m => m.id === metrics.id);
      
      if (existingIndex >= 0) {
        allMetrics[existingIndex] = metrics;
      } else {
        allMetrics.push(metrics);
      }

      // Manter apenas os últimos registros para não sobrecarregar
      if (allMetrics.length > this.MAX_RECORDS) {
        allMetrics.splice(0, allMetrics.length - this.MAX_RECORDS);
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(allMetrics));
    } catch (error) {
      console.error('Erro ao salvar métricas:', error);
    }
  }

  /**
   * 📖 Obter métricas específicas
   */
  private getMetrics(sessionId: string): DeliveryMetrics | null {
    const allMetrics = this.getAllMetrics();
    return allMetrics.find(m => m.id === sessionId) || null;
  }

  /**
   * 📚 Obter todas as métricas
   */
  private getAllMetrics(): DeliveryMetrics[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Erro ao carregar métricas:', error);
      return [];
    }
  }

  /**
   * 📅 Obter início da semana
   */
  private getWeekStart(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  /**
   * 🗑️ Limpar dados antigos (manter apenas últimos 90 dias)
   */
  cleanOldData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];

    const allMetrics = this.getAllMetrics();
    const recentMetrics = allMetrics.filter(m => m.date >= cutoffStr);
    
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(recentMetrics));
    console.log(`🗑️ Dados antigos removidos. Mantidos ${recentMetrics.length} registros.`);
  }
}

// Instância singleton
export const analytics = new AnalyticsSystem();

// Limpar dados antigos na inicialização (executar apenas uma vez por dia)
if (typeof window !== 'undefined') {
  const lastCleanup = localStorage.getItem('rota-facil-last-cleanup');
  const today = new Date().toISOString().split('T')[0];
  if (lastCleanup !== today) {
    analytics.cleanOldData();
    localStorage.setItem('rota-facil-last-cleanup', today);
  }
}
