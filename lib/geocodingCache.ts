// RotaFácil - Sistema de Cache Inteligente para Geocodificação
import { getSupabase } from './supabaseClient';
import crypto from 'crypto';

export interface CachedGeocodingResult {
  lat: number;
  lng: number;
  formatted_address: string;
  confidence: number;
  provider: string;
  city?: string;
  state?: string;
  cep?: string;
}

export interface GeocodingCacheEntry {
  id: number;
  address_hash: string;
  original_address: string;
  normalized_address: string;
  lat: number;
  lng: number;
  confidence: number;
  provider: string;
  city?: string;
  state?: string;
  cep?: string;
  hits: number;
  created_at: string;
  last_used_at: string;
}

// Função para normalizar endereço para cache
export function normalizeAddressForCache(address: string): string {
  return address
    .toLowerCase()
    .trim()
    // Remover acentos
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
    // Normalizar tipos de logradouros
    .replace(/\b(rua|r\.)\b/g, 'rua')
    .replace(/\b(avenida|av\.)\b/g, 'avenida')
    .replace(/\b(alameda|al\.)\b/g, 'alameda')
    .replace(/\b(travessa|tv\.)\b/g, 'travessa')
    .replace(/\b(estrada|est\.)\b/g, 'estrada')
    .replace(/\b(rodovia|rod\.)\b/g, 'rodovia')
    // Remover números de apartamento/complemento comuns
    .replace(/\b(ap|apt|apartamento|apto)\s*\d+\b/g, '')
    .replace(/\b(bl|bloco)\s*[a-z0-9]+\b/g, '')
    .replace(/\b(casa|cs)\s*\d+\b/g, '')
    // Normalizar espaços e pontuação
    .replace(/\s+/g, ' ')
    .replace(/[,;]+/g, ',')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}

// Função para gerar hash do endereço
export function generateAddressHash(normalizedAddress: string): string {
  return crypto.createHash('md5').update(normalizedAddress).digest('hex');
}

// Função para extrair informações adicionais do endereço
export function extractAddressInfo(address: string): { city?: string; state?: string; cep?: string } {
  const cepMatch = address.match(/\b(\d{5}-?\d{3})\b/);
  const stateMatch = address.match(/\b([A-Z]{2})\b/);
  
  // Lista simplificada de cidades grandes para identificação
  const cities = ['são paulo', 'rio de janeiro', 'brasília', 'salvador', 'fortaleza', 'belo horizonte', 'manaus', 'curitiba', 'recife', 'goiânia'];
  const cityMatch = cities.find(city => address.toLowerCase().includes(city));
  
  return {
    cep: cepMatch ? cepMatch[1].replace('-', '') : undefined,
    state: stateMatch ? stateMatch[1] : undefined,
    city: cityMatch
  };
}

// Função para calcular similaridade entre endereços (fuzzy matching)
export function calculateAddressSimilarity(address1: string, address2: string): number {
  const norm1 = normalizeAddressForCache(address1);
  const norm2 = normalizeAddressForCache(address2);
  
  // Similaridade exata
  if (norm1 === norm2) return 1.0;
  
  // Similaridade de Levenshtein simplificada
  const longer = norm1.length > norm2.length ? norm1 : norm2;
  const shorter = norm1.length > norm2.length ? norm2 : norm1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  const similarity = (longer.length - editDistance) / longer.length;
  
  return Math.max(0, similarity);
}

// Implementação simples da distância de Levenshtein
function levenshteinDistance(str1: string, str2: string): number {
  const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
  
  for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
  for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
  
  for (let j = 1; j <= str2.length; j++) {
    for (let i = 1; i <= str1.length; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,
        matrix[j - 1][i] + 1,
        matrix[j - 1][i - 1] + indicator
      );
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Função para buscar no cache com matching fuzzy
export async function searchGeocodingCache(originalAddress: string): Promise<CachedGeocodingResult | null> {
  try {
    const supabase = getSupabase();
    const normalizedAddress = normalizeAddressForCache(originalAddress);
    const addressHash = generateAddressHash(normalizedAddress);
    
    // 1. Busca exata por hash
    const { data: exactMatch } = await supabase
      .from('geocoding_cache')
      .select('*')
      .eq('address_hash', addressHash)
      .single();
    
    if (exactMatch) {
      // Incrementar hits e atualizar last_used_at
      await supabase
        .from('geocoding_cache')
        .update({ 
          hits: exactMatch.hits + 1,
          last_used_at: new Date().toISOString()
        })
        .eq('id', exactMatch.id);
      
      console.log('Cache hit exato:', originalAddress);
      return {
        lat: exactMatch.lat,
        lng: exactMatch.lng,
        formatted_address: exactMatch.original_address,
        confidence: exactMatch.confidence,
        provider: exactMatch.provider + '+cache',
        city: exactMatch.city,
        state: exactMatch.state,
        cep: exactMatch.cep
      };
    }
    
    // 2. Busca fuzzy para endereços similares (apenas se confiável)
    const addressInfo = extractAddressInfo(originalAddress);
    let query = supabase
      .from('geocoding_cache')
      .select('*')
      .gte('confidence', 0.7); // Apenas resultados confiáveis
    
    // Filtrar por cidade/estado se disponível
    if (addressInfo.city) {
      query = query.eq('city', addressInfo.city);
    }
    if (addressInfo.state) {
      query = query.eq('state', addressInfo.state);
    }
    
    const { data: candidates } = await query.limit(10);
    
    if (candidates && candidates.length > 0) {
      // Calcular similaridade para cada candidato
      const similarities = candidates.map(candidate => ({
        ...candidate,
        similarity: calculateAddressSimilarity(normalizedAddress, candidate.normalized_address)
      }));
      
      // Encontrar melhor match com similaridade > 0.8
      const bestMatch = similarities
        .filter(s => s.similarity > 0.8)
        .sort((a, b) => b.similarity - a.similarity)[0];
      
      if (bestMatch) {
        // Incrementar hits
        await supabase
          .from('geocoding_cache')
          .update({ 
            hits: bestMatch.hits + 1,
            last_used_at: new Date().toISOString()
          })
          .eq('id', bestMatch.id);
        
        console.log(`Cache hit fuzzy (${(bestMatch.similarity * 100).toFixed(1)}%):`, originalAddress);
        return {
          lat: bestMatch.lat,
          lng: bestMatch.lng,
          formatted_address: bestMatch.original_address,
          confidence: bestMatch.confidence * bestMatch.similarity, // Reduzir confiança pelo fuzzy
          provider: bestMatch.provider + '+cache-fuzzy',
          city: bestMatch.city,
          state: bestMatch.state,
          cep: bestMatch.cep
        };
      }
    }
    
    console.log('Cache miss:', originalAddress);
    return null;
    
  } catch (error) {
    console.error('Erro ao buscar no cache:', error);
    return null;
  }
}

// Função para salvar resultado no cache
export async function saveToGeocodingCache(
  originalAddress: string,
  result: {
    lat: number;
    lng: number;
    address: string;
    confidence: number;
    provider: string;
  }
): Promise<void> {
  try {
    const supabase = getSupabase();
    const normalizedAddress = normalizeAddressForCache(originalAddress);
    const addressHash = generateAddressHash(normalizedAddress);
    const addressInfo = extractAddressInfo(originalAddress);
    
    await supabase
      .from('geocoding_cache')
      .upsert({
        address_hash: addressHash,
        original_address: originalAddress,
        normalized_address: normalizedAddress,
        lat: result.lat,
        lng: result.lng,
        confidence: result.confidence,
        provider: result.provider,
        city: addressInfo.city,
        state: addressInfo.state,
        cep: addressInfo.cep,
        hits: 1,
        last_used_at: new Date().toISOString()
      });
    
    console.log('Resultado salvo no cache:', originalAddress);
    
  } catch (error) {
    console.error('Erro ao salvar no cache:', error);
    // Não falhar se o cache não funcionar
  }
}

// Função para limpar cache antigo (para ser executada periodicamente)
export async function cleanupOldCache(): Promise<number> {
  try {
    const supabase = getSupabase();
    
    // Chamar função do banco que remove entradas antigas
    const { data, error } = await supabase.rpc('cleanup_old_geocoding_cache');
    
    if (error) {
      console.error('Erro ao limpar cache:', error);
      return 0;
    }
    
    console.log(`Cache limpo: ${data} entradas removidas`);
    return data;
    
  } catch (error) {
    console.error('Erro ao limpar cache:', error);
    return 0;
  }
}

// Função para obter estatísticas do cache
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalHits: number;
  topProviders: Array<{ provider: string; count: number }>;
  hitRate: number;
}> {
  try {
    const supabase = getSupabase();
    
    const { data: stats } = await supabase
      .from('geocoding_cache')
      .select('provider, hits');
    
    if (!stats) return { totalEntries: 0, totalHits: 0, topProviders: [], hitRate: 0 };
    
    const totalEntries = stats.length;
    const totalHits = stats.reduce((sum, entry) => sum + entry.hits, 0);
    
    const providerCounts = stats.reduce((acc, entry) => {
      acc[entry.provider] = (acc[entry.provider] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const topProviders = Object.entries(providerCounts)
      .map(([provider, count]) => ({ provider, count }))
      .sort((a, b) => b.count - a.count);
    
    const hitRate = totalEntries > 0 ? totalHits / totalEntries : 0;
    
    return {
      totalEntries,
      totalHits,
      topProviders,
      hitRate
    };
    
  } catch (error) {
    console.error('Erro ao obter estatísticas do cache:', error);
    return { totalEntries: 0, totalHits: 0, topProviders: [], hitRate: 0 };
  }
}