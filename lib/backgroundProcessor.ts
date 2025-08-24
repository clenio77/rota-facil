// 🔄 PROCESSAMENTO EM BACKGROUND - OPEN SOURCE
// Sistema de processamento assíncrono para otimização de rotas

// ✅ INTERFACES TIPADAS ESPECÍFICAS
export interface BackgroundTask {
  id: string;
  type: 'route-optimization' | 'data-processing' | 'notification-send';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  data: TaskData;
  result?: TaskResult;
  error?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

export interface TaskData {
  points?: RoutePoint[];
  algorithm?: string;
  options?: OptimizationOptions;
  message?: string;
  recipient?: string;
}

export interface TaskResult {
  route?: RoutePoint[];
  totalDistance?: number;
  algorithm?: string;
  processingTime?: number;
  processed?: boolean;
  timestamp?: number;
  dataSize?: number;
}

export interface RoutePoint {
  id: string;
  lat: number;
  lng: number;
  address: string;
  sequence?: number;
}

export interface OptimizationOptions {
  maxIterations?: number;
  timeLimit?: number;
  constraints?: {
    maxDistance?: number;
    maxTime?: number;
  };
}

export interface BackgroundProcessorConfig {
  maxConcurrentTasks: number;
  taskTimeout: number;
  retryAttempts: number;
  enableNotifications: boolean;
  storageKey: string;
}

export class BackgroundProcessor {
  private tasks: Map<string, BackgroundTask> = new Map();
  private activeTasks: Set<string> = new Set();
  private config: BackgroundProcessorConfig;
  private worker?: Worker;
  private isInitialized = false;

  constructor(config: Partial<BackgroundProcessorConfig> = {}) {
    this.config = {
      maxConcurrentTasks: 3,
      taskTimeout: 300000, // 5 minutos
      retryAttempts: 2,
      enableNotifications: true,
      storageKey: 'rotafacil-background-tasks',
      ...config
    };

    this.initialize();
  }

  private async initialize() {
    try {
      // Carregar tarefas salvas
      await this.loadTasks();
      
      // Inicializar Web Worker se disponível
      if (typeof Worker !== 'undefined') {
        this.initializeWorker();
      }
      
      this.isInitialized = true;
      console.log('✅ Background Processor inicializado');
    } catch (error) {
      console.error('❌ Erro ao inicializar Background Processor:', error);
    }
  }

  private initializeWorker() {
    try {
      // Criar Web Worker inline para processamento
      const workerCode = `
        self.onmessage = function(e) {
          const { taskId, type, data } = e.data;
          
          try {
            let result;
            
            switch (type) {
              case 'route-optimization':
                result = processRouteOptimization(data);
                break;
              case 'data-processing':
                result = processData(data);
                break;
              default:
                throw new Error('Tipo de tarefa não suportado');
            }
            
            self.postMessage({
              taskId,
              status: 'completed',
              result,
              progress: 100
            });
          } catch (error) {
            self.postMessage({
              taskId,
              status: 'failed',
              error: error.message,
              progress: 0
            });
          }
        };

        function processRouteOptimization(data) {
          // Simular processamento de otimização
          const { points, algorithm, options } = data;
          
          // Algoritmo simples de otimização
          let optimizedRoute = [...points];
          let totalDistance = 0;
          
          // Calcular distância total
          for (let i = 0; i < optimizedRoute.length - 1; i++) {
            const distance = calculateDistance(optimizedRoute[i], optimizedRoute[i + 1]);
            totalDistance += distance;
          }
          
          // Aplicar otimização básica (nearest neighbor)
          if (algorithm === 'nearest-neighbor' || algorithm === 'auto') {
            optimizedRoute = nearestNeighborOptimization(optimizedRoute);
          }
          
          return {
            route: optimizedRoute,
            totalDistance,
            algorithm: algorithm || 'auto',
            processingTime: Date.now() - performance.now()
          };
        }

        function processData(data) {
          // Simular processamento de dados
          return {
            processed: true,
            timestamp: Date.now(),
            dataSize: JSON.stringify(data).length
          };
        }

        function calculateDistance(point1, point2) {
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

        function nearestNeighborOptimization(points) {
          if (points.length <= 1) return points;
          
          const route = [points[0]];
          const unvisited = points.slice(1);
          
          while (unvisited.length > 0) {
            let nearestIndex = 0;
            let nearestDistance = calculateDistance(route[route.length - 1], unvisited[0]);
            
            for (let i = 1; i < unvisited.length; i++) {
              const distance = calculateDistance(route[route.length - 1], unvisited[i]);
              if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = i;
              }
            }
            
            route.push(unvisited.splice(nearestIndex, 1)[0]);
          }
          
          return route;
        }
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      console.log('✅ Web Worker inicializado');
    } catch (error) {
      console.warn('⚠️ Web Worker não disponível, usando processamento síncrono:', error);
    }
  }

  private handleWorkerMessage(event: MessageEvent) {
    const { taskId, status, result, error, progress } = event.data;
    const task = this.tasks.get(taskId);
    
    if (task) {
      task.status = status;
      task.progress = progress;
      
      if (status === 'completed') {
        task.result = result;
        task.completedAt = new Date();
        this.activeTasks.delete(taskId);
      } else if (status === 'failed') {
        task.error = error;
        task.status = 'failed';
        this.activeTasks.delete(taskId);
      }
      
      this.saveTasks();
      this.notifyTaskUpdate(task);
    }
  }

  private handleWorkerError(error: ErrorEvent) {
    console.error('❌ Erro no Web Worker:', error);
  }

  // 🚀 ADICIONAR NOVA TAREFA
  async addTask(type: BackgroundTask['type'], data: TaskData): Promise<string> {
    const task: BackgroundTask = {
      id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      status: 'pending',
      progress: 0,
      data,
      createdAt: new Date()
    };

    this.tasks.set(task.id, task);
    await this.saveTasks();
    
    // Processar tarefa se possível
    this.processNextTask();
    
    return task.id;
  }

  // 🔄 PROCESSAR PRÓXIMA TAREFA
  private async processNextTask() {
    if (this.activeTasks.size >= this.config.maxConcurrentTasks) {
      return; // Limite de tarefas ativas atingido
    }

    const pendingTask = Array.from(this.tasks.values())
      .find(task => task.status === 'pending');

    if (pendingTask) {
      await this.processTask(pendingTask);
    }
  }

  // ⚙️ PROCESSAR TAREFA ESPECÍFICA
  private async processTask(task: BackgroundTask) {
    if (task.status !== 'pending') return;

    task.status = 'processing';
    task.startedAt = new Date();
    this.activeTasks.add(task.id);
    
    await this.saveTasks();
    this.notifyTaskUpdate(task);

    try {
      if (this.worker) {
        // Usar Web Worker para processamento assíncrono
        this.worker.postMessage({
          taskId: task.id,
          type: task.type,
          data: task.data
        });
      } else {
        // Fallback para processamento síncrono
        await this.processTaskSync(task);
      }
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Erro desconhecido';
      this.activeTasks.delete(task.id);
      await this.saveTasks();
      this.notifyTaskUpdate(task);
    }
  }

  // 🔄 PROCESSAMENTO SÍNCRONO (FALLBACK)
  private async processTaskSync(task: BackgroundTask): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        task.status = 'failed';
        task.error = 'Timeout da tarefa';
        this.activeTasks.delete(task.id);
        reject(new Error('Timeout da tarefa'));
      }, this.config.taskTimeout);

      try {
        // Simular processamento
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 20;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            clearTimeout(timeout);
            
            task.status = 'completed';
            task.progress = progress;
            task.completedAt = new Date();
            task.result = { processed: true, timestamp: Date.now() };
            
            this.activeTasks.delete(task.id);
            this.saveTasks();
            this.notifyTaskUpdate(task);
            resolve();
          } else {
            task.progress = progress;
            this.notifyTaskUpdate(task);
          }
        }, 100);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  // 📊 OBTER STATUS DAS TAREFAS
  getTaskStatus(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  getAllTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values());
  }

  getActiveTasks(): BackgroundTask[] {
    return Array.from(this.activeTasks).map(id => this.tasks.get(id)!);
  }

  getPendingTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter(task => task.status === 'pending');
  }

  // 🗑️ REMOVER TAREFA
  async removeTask(taskId: string): Promise<boolean> {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    if (task.status === 'processing') {
      this.activeTasks.delete(taskId);
    }

    this.tasks.delete(taskId);
    await this.saveTasks();
    return true;
  }

  // 🔄 LIMPAR TAREFAS COMPLETADAS
  async clearCompletedTasks(): Promise<number> {
    const completedTasks = Array.from(this.tasks.values())
      .filter(task => task.status === 'completed' || task.status === 'failed');
    
    completedTasks.forEach(task => {
      this.tasks.delete(task.id);
      this.activeTasks.delete(task.id);
    });

    await this.saveTasks();
    return completedTasks.length;
  }

  // 💾 SALVAR TAREFAS NO STORAGE
  private async saveTasks(): Promise<void> {
    try {
      const tasksData = Array.from(this.tasks.values());
      localStorage.setItem(this.config.storageKey, JSON.stringify(tasksData));
    } catch (error) {
      console.error('❌ Erro ao salvar tarefas:', error);
    }
  }

  // 📂 CARREGAR TAREFAS DO STORAGE
  private async loadTasks(): Promise<void> {
    try {
      const tasksData = localStorage.getItem(this.config.storageKey);
      if (tasksData) {
        const tasks = JSON.parse(tasksData);
        tasks.forEach((task: BackgroundTask) => {
          task.createdAt = new Date(task.createdAt);
          if (task.startedAt) task.startedAt = new Date(task.startedAt);
          if (task.completedAt) task.completedAt = new Date(task.completedAt);
          
          this.tasks.set(task.id, task);
          if (task.status === 'processing') {
            this.activeTasks.add(task.id);
          }
        });
      }
    } catch (error) {
      console.error('❌ Erro ao carregar tarefas:', error);
    }
  }

  // 🔔 NOTIFICAR ATUALIZAÇÃO DE TAREFA
  private notifyTaskUpdate(task: BackgroundTask) {
    if (!this.config.enableNotifications) return;

    // Disparar evento customizado
    const event = new CustomEvent('taskUpdate', { detail: task });
    window.dispatchEvent(event);

    // Notificação push se disponível
    if (task.status === 'completed' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('✅ Tarefa Concluída', {
        body: `Tarefa ${task.type} foi processada com sucesso!`,
        icon: '/logo-carro-azul-removebg-preview.png'
      });
    }
  }

  // 📈 OBTER ESTATÍSTICAS
  getStats() {
    const total = this.tasks.size;
    const pending = this.getPendingTasks().length;
    const processing = this.activeTasks.size;
    const completed = Array.from(this.tasks.values()).filter(t => t.status === 'completed').length;
    const failed = Array.from(this.tasks.values()).filter(t => t.status === 'failed').length;

    return {
      total,
      pending,
      processing,
      completed,
      failed,
      successRate: total > 0 ? (completed / total) * 100 : 0
    };
  }

  // 🧹 LIMPEZA E DESTRUIÇÃO
  async cleanup() {
    // Cancelar todas as tarefas ativas
    this.activeTasks.clear();
    
    // Limpar Web Worker
    if (this.worker) {
      this.worker.terminate();
      this.worker = undefined;
    }
    
    // Salvar estado
    await this.saveTasks();
    
    console.log('🧹 Background Processor limpo');
  }
}

// 🚀 INSTÂNCIA GLOBAL
export const backgroundProcessor = new BackgroundProcessor();

// 🔔 HOOK PARA REAGIR A ATUALIZAÇÕES DE TAREFAS
export function useBackgroundTasks() {
  const [tasks, setTasks] = React.useState<BackgroundTask[]>([]);
  const [stats, setStats] = React.useState(backgroundProcessor.getStats());

  React.useEffect(() => {
    const handleTaskUpdate = () => {
      setTasks(backgroundProcessor.getAllTasks());
      setStats(backgroundProcessor.getStats());
    };

    window.addEventListener('taskUpdate', handleTaskUpdate);
    handleTaskUpdate(); // Carregar estado inicial

    return () => {
      window.removeEventListener('taskUpdate', handleTaskUpdate);
    };
  }, []);

  return { tasks, stats, backgroundProcessor };
}

// 📱 FUNÇÃO PARA PROCESSAR ROTA EM BACKGROUND
export async function processRouteInBackground(
  points: RoutePoint[],
  algorithm: string = 'auto',
  options: OptimizationOptions = {}
): Promise<string> {
  return backgroundProcessor.addTask('route-optimization', {
    points,
    algorithm,
    options
  });
}

// 🔄 FUNÇÃO PARA AGUARDAR CONCLUSÃO DA TAREFA
export function waitForTaskCompletion(taskId: string): Promise<BackgroundTask> {
  return new Promise((resolve, reject) => {
    const checkTask = () => {
      const task = backgroundProcessor.getTaskStatus(taskId);
      
      if (!task) {
        reject(new Error('Tarefa não encontrada'));
        return;
      }
      
      if (task.status === 'completed') {
        resolve(task);
      } else if (task.status === 'failed') {
        reject(new Error(task.error || 'Tarefa falhou'));
      } else {
        // Aguardar um pouco e verificar novamente
        setTimeout(checkTask, 1000);
      }
    };
    
    checkTask();
  });
}
