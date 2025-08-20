// Cache local para geocodificação - evita chamadas desnecessárias
// Usa localStorage para persistir entre sessões

interface CachedGeocode {
  address: string;
  lat: number;
  lng: number;
  formatted_address: string;
  timestamp: number;
  confidence: number;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  confidence?: number;
}

// Configurações do cache
const CACHE_CONFIG = {
  key: 'rotafacil:geocode:cache:v1',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias em millisegundos
  maxEntries: 1000, // Máximo de endereços em cache
  minConfidence: 0.7 // Confiança mínima para cachear
};

// Função para normalizar endereço para uso como chave
function normalizeAddressKey(address: string): string {
  return address
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ') // Múltiplos espaços para um
    .trim();
}

// Função para carregar cache do localStorage
function loadCache(): Map<string, CachedGeocode> {
  try {
    if (typeof window === 'undefined') return new Map();
    
    const cached = localStorage.getItem(CACHE_CONFIG.key);
    if (!cached) return new Map();
    
    const data = JSON.parse(cached);
    const cache = new Map<string, CachedGeocode>();
    
    // Filtrar entradas expiradas
    const now = Date.now();
    Object.entries(data).forEach(([key, value]) => {
      const entry = value as CachedGeocode;
      if (now - entry.timestamp < CACHE_CONFIG.maxAge) {
        cache.set(key, entry);
      }
    });
    
    return cache;
  } catch (error) {
    console.warn('Erro ao carregar cache de geocodificação:', error);
    return new Map();
  }
}

// Função para salvar cache no localStorage
function saveCache(cache: Map<string, CachedGeocode>): void {
  try {
    if (typeof window === 'undefined') return;
    
    // Limitar número de entradas
    if (cache.size > CACHE_CONFIG.maxEntries) {
      // Remover entradas mais antigas
      const entries = Array.from(cache.entries())
        .sort((a, b) => b[1].timestamp - a[1].timestamp)
        .slice(0, CACHE_CONFIG.maxEntries);
      
      cache.clear();
      entries.forEach(([key, value]) => cache.set(key, value));
    }
    
    // Converter Map para Object para JSON
    const data = Object.fromEntries(cache);
    localStorage.setItem(CACHE_CONFIG.key, JSON.stringify(data));
  } catch (error) {
    console.warn('Erro ao salvar cache de geocodificação:', error);
  }
}

// Função para buscar endereço no cache
export function getCachedGeocode(address: string): GeocodeResult | null {
  try {
    const cache = loadCache();
    const key = normalizeAddressKey(address);
    const cached = cache.get(key);
    
    if (cached) {
      console.log(`Cache hit para endereço: ${address}`);
      return {
        lat: cached.lat,
        lng: cached.lng,
        formatted_address: cached.formatted_address,
        confidence: cached.confidence
      };
    }
    
    return null;
  } catch (error) {
    console.warn('Erro ao buscar no cache:', error);
    return null;
  }
}

// Função para salvar resultado de geocodificação no cache
export function setCachedGeocode(
  address: string, 
  result: GeocodeResult
): void {
  try {
    // Só cachear resultados com confiança mínima
    if ((result.confidence || 1) < CACHE_CONFIG.minConfidence) {
      return;
    }
    
    const cache = loadCache();
    const key = normalizeAddressKey(address);
    
    const cached: CachedGeocode = {
      address: address,
      lat: result.lat,
      lng: result.lng,
      formatted_address: result.formatted_address,
      timestamp: Date.now(),
      confidence: result.confidence || 1
    };
    
    cache.set(key, cached);
    saveCache(cache);
    
    console.log(`Endereço cacheado: ${address}`);
  } catch (error) {
    console.warn('Erro ao salvar no cache:', error);
  }
}

// Função para limpar cache expirado
export function cleanExpiredCache(): number {
  try {
    const cache = loadCache();
    const initialSize = cache.size;
    const now = Date.now();
    
    // Remover entradas expiradas
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp >= CACHE_CONFIG.maxAge) {
        cache.delete(key);
      }
    }
    
    saveCache(cache);
    const removed = initialSize - cache.size;
    
    if (removed > 0) {
      console.log(`Cache limpo: ${removed} entradas expiradas removidas`);
    }
    
    return removed;
  } catch (error) {
    console.warn('Erro ao limpar cache:', error);
    return 0;
  }
}

// Função para obter estatísticas do cache
export function getCacheStats() {
  try {
    const cache = loadCache();
    const now = Date.now();
    
    let totalEntries = 0;
    let expiredEntries = 0;
    let avgConfidence = 0;
    let oldestEntry = now;
    let newestEntry = 0;
    
    for (const [, value] of cache.entries()) {
      totalEntries++;
      avgConfidence += value.confidence;
      
      if (now - value.timestamp >= CACHE_CONFIG.maxAge) {
        expiredEntries++;
      }
      
      if (value.timestamp < oldestEntry) {
        oldestEntry = value.timestamp;
      }
      
      if (value.timestamp > newestEntry) {
        newestEntry = value.timestamp;
      }
    }
    
    return {
      totalEntries,
      expiredEntries,
      validEntries: totalEntries - expiredEntries,
      avgConfidence: totalEntries > 0 ? avgConfidence / totalEntries : 0,
      oldestEntryAge: totalEntries > 0 ? Math.floor((now - oldestEntry) / (24 * 60 * 60 * 1000)) : 0,
      newestEntryAge: totalEntries > 0 ? Math.floor((now - newestEntry) / (24 * 60 * 60 * 1000)) : 0,
      cacheSize: totalEntries,
      maxSize: CACHE_CONFIG.maxEntries
    };
  } catch (error) {
    console.warn('Erro ao obter estatísticas do cache:', error);
    return {
      totalEntries: 0,
      expiredEntries: 0,
      validEntries: 0,
      avgConfidence: 0,
      oldestEntryAge: 0,
      newestEntryAge: 0,
      cacheSize: 0,
      maxSize: CACHE_CONFIG.maxEntries
    };
  }
}

// Função para limpar todo o cache
export function clearCache(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CACHE_CONFIG.key);
      console.log('Cache de geocodificação limpo completamente');
    }
  } catch (error) {
    console.warn('Erro ao limpar cache:', error);
  }
}

// Função para geocodificar com cache
export async function geocodeWithCache(
  address: string,
  userLocation?: { lat: number; lng: number; city?: string; state?: string }
): Promise<GeocodeResult | null> {
  // Primeiro, tentar cache
  const cached = getCachedGeocode(address);
  if (cached) {
    return cached;
  }
  
  // Se não estiver em cache, fazer chamada para API
  try {
    const response = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address,
        userLocation
      }),
    });
    
    const result = await response.json();
    
    if (result.success && result.lat && result.lng) {
      const geocodeResult: GeocodeResult = {
        lat: result.lat,
        lng: result.lng,
        formatted_address: result.address || address,
        confidence: result.confidence || 0.8
      };
      
      // Salvar no cache
      setCachedGeocode(address, geocodeResult);
      
      return geocodeResult;
    }
    
    return null;
  } catch (error) {
    console.error('Erro na geocodificação:', error);
    return null;
  }
}

// Inicializar limpeza automática do cache (executar uma vez por sessão)
if (typeof window !== 'undefined') {
  // Limpar cache expirado ao carregar
  setTimeout(() => {
    cleanExpiredCache();
  }, 1000);
}
