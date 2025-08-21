/**
 * 🔄 OFFLINE MANAGER - Sistema de Cache e Sincronização
 * Garante funcionamento offline para carteiros em áreas sem sinal
 */

export interface OfflineAction {
  id: string;
  type: 'delivery_update' | 'route_start' | 'analytics_update' | 'photo_upload';
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  expiry?: number;
  priority: 'high' | 'medium' | 'low';
}

export interface OfflineStatus {
  isOnline: boolean;
  lastSync: number;
  pendingActions: number;
  cacheSize: number;
  syncInProgress: boolean;
}

class OfflineManager {
  private dbName = 'rota-facil-offline';
  private dbVersion = 1;
  private db: IDBDatabase | null = null;
  private isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private syncQueue: OfflineAction[] = [];
  private syncInProgress = false;
  private listeners: ((status: OfflineStatus) => void)[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeDB();
      this.setupNetworkListeners();
      this.loadSyncQueue();
    }
  }

  /**
   * 🗄️ Inicializar IndexedDB
   */
  private async initializeDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Store para cache de dados
        if (!db.objectStoreNames.contains('cache')) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('priority', 'priority', { unique: false });
          cacheStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para ações pendentes
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Store para rotas offline
        if (!db.objectStoreNames.contains('routes')) {
          const routeStore = db.createObjectStore('routes', { keyPath: 'id' });
          routeStore.createIndex('date', 'date', { unique: false });
        }

        // Store para mapas offline
        if (!db.objectStoreNames.contains('maps')) {
          const mapStore = db.createObjectStore('maps', { keyPath: 'tileKey' });
          mapStore.createIndex('region', 'region', { unique: false });
        }
      };
    });
  }

  /**
   * 🌐 Configurar listeners de rede
   */
  private setupNetworkListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Conexão restaurada - iniciando sincronização');
      this.syncPendingActions();
      this.notifyListeners();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📴 Modo offline ativado');
      this.notifyListeners();
    });
  }

  /**
   * 💾 Cache de dados com prioridade
   */
  async cacheData(key: string, data: any, priority: 'high' | 'medium' | 'low' = 'medium', expiryHours?: number): Promise<void> {
    if (!this.db) await this.initializeDB();

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      priority,
      expiry: expiryHours ? Date.now() + (expiryHours * 60 * 60 * 1000) : undefined
    };

    const transaction = this.db!.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(entry);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`💾 Dados cacheados: ${key} (${priority})`);
  }

  /**
   * 📖 Recuperar dados do cache
   */
  async getCachedData(key: string): Promise<any | null> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['cache'], 'readonly');
    const store = transaction.objectStore('cache');

    return new Promise<any | null>((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const entry = request.result as CacheEntry;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // Verificar expiração
        if (entry.expiry && Date.now() > entry.expiry) {
          this.removeCachedData(key);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 🗑️ Remover dados do cache
   */
  async removeCachedData(key: string): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * ⏳ Adicionar ação à fila de sincronização
   */
  async queueAction(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    const fullAction: OfflineAction = {
      ...action,
      id: `${action.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.syncQueue.push(fullAction);

    // Salvar no IndexedDB
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    await new Promise<void>((resolve, reject) => {
      const request = store.put(fullAction);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`⏳ Ação adicionada à fila: ${fullAction.type}`);

    // Tentar sincronizar se online
    if (this.isOnline) {
      this.syncPendingActions();
    }

    this.notifyListeners();
  }

  /**
   * 🔄 Carregar fila de sincronização
   */
  private async loadSyncQueue(): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');

    return new Promise<void>((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => {
        this.syncQueue = request.result;
        console.log(`🔄 Carregadas ${this.syncQueue.length} ações pendentes`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 🚀 Sincronizar ações pendentes
   */
  private async syncPendingActions(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    this.notifyListeners();

    console.log(`🚀 Iniciando sincronização de ${this.syncQueue.length} ações`);

    const actionsToSync = [...this.syncQueue];
    const successfulActions: string[] = [];

    for (const action of actionsToSync) {
      try {
        await this.executeAction(action);
        successfulActions.push(action.id);
        console.log(`✅ Ação sincronizada: ${action.type}`);
      } catch (error) {
        console.error(`❌ Erro ao sincronizar ${action.type}:`, error);
        
        // Incrementar contador de tentativas
        action.retryCount++;
        
        // Remover se excedeu tentativas
        if (action.retryCount >= action.maxRetries) {
          console.warn(`🚫 Ação ${action.type} removida após ${action.maxRetries} tentativas`);
          successfulActions.push(action.id);
        }
      }
    }

    // Remover ações bem-sucedidas da fila
    this.syncQueue = this.syncQueue.filter(action => !successfulActions.includes(action.id));

    // Atualizar IndexedDB
    await this.updateSyncQueueInDB();

    this.syncInProgress = false;
    this.notifyListeners();

    console.log(`🏁 Sincronização concluída. ${successfulActions.length} ações processadas`);
  }

  /**
   * ⚡ Executar ação específica
   */
  private async executeAction(action: OfflineAction): Promise<void> {
    switch (action.type) {
      case 'delivery_update':
        await this.syncDeliveryUpdate(action.data);
        break;
      case 'route_start':
        await this.syncRouteStart(action.data);
        break;
      case 'analytics_update':
        await this.syncAnalyticsUpdate(action.data);
        break;
      case 'photo_upload':
        await this.syncPhotoUpload(action.data);
        break;
      default:
        throw new Error(`Tipo de ação desconhecido: ${action.type}`);
    }
  }

  /**
   * 📦 Sincronizar atualização de entrega
   */
  private async syncDeliveryUpdate(data: any): Promise<void> {
    // Implementar sincronização com servidor
    // Por enquanto, apenas simular
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('📦 Entrega sincronizada:', data);
  }

  /**
   * 🚀 Sincronizar início de rota
   */
  private async syncRouteStart(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('🚀 Início de rota sincronizado:', data);
  }

  /**
   * 📊 Sincronizar dados de analytics
   */
  private async syncAnalyticsUpdate(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 300));
    console.log('📊 Analytics sincronizado:', data);
  }

  /**
   * 📸 Sincronizar upload de foto
   */
  private async syncPhotoUpload(data: any): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 2000));
    console.log('📸 Foto sincronizada:', data);
  }

  /**
   * 💾 Atualizar fila no IndexedDB
   */
  private async updateSyncQueueInDB(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');

    // Limpar store
    await new Promise<void>((resolve, reject) => {
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = () => reject(clearRequest.error);
    });

    // Adicionar ações restantes
    for (const action of this.syncQueue) {
      await new Promise<void>((resolve, reject) => {
        const addRequest = store.put(action);
        addRequest.onsuccess = () => resolve();
        addRequest.onerror = () => reject(addRequest.error);
      });
    }
  }

  /**
   * 📊 Obter status offline
   */
  getStatus(): OfflineStatus {
    return {
      isOnline: this.isOnline,
      lastSync: this.getLastSyncTime(),
      pendingActions: this.syncQueue.length,
      cacheSize: 0, // TODO: Calcular tamanho real do cache
      syncInProgress: this.syncInProgress
    };
  }

  /**
   * 🕐 Obter último tempo de sincronização
   */
  private getLastSyncTime(): number {
    const stored = localStorage.getItem('rota-facil-last-sync');
    return stored ? parseInt(stored) : 0;
  }

  /**
   * 📢 Notificar listeners sobre mudanças
   */
  private notifyListeners(): void {
    const status = this.getStatus();
    this.listeners.forEach(listener => listener(status));
  }

  /**
   * 👂 Adicionar listener de status
   */
  addStatusListener(listener: (status: OfflineStatus) => void): void {
    this.listeners.push(listener);
  }

  /**
   * 🚫 Remover listener de status
   */
  removeStatusListener(listener: (status: OfflineStatus) => void): void {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * 🧹 Limpar cache antigo
   */
  async cleanupCache(): Promise<void> {
    if (!this.db) await this.initializeDB();

    const transaction = this.db!.transaction(['cache'], 'readwrite');
    const store = transaction.objectStore('cache');
    const index = store.index('timestamp');

    // Remover entradas mais antigas que 7 dias
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000);

    return new Promise<void>((resolve, reject) => {
      const request = index.openCursor(IDBKeyRange.upperBound(cutoff));
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      request.onerror = () => reject(request.error);
    });
  }
}

// Instância singleton
export const offlineManager = new OfflineManager();
