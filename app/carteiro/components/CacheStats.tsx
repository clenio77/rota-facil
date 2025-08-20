'use client'

import React, { useState, useEffect } from 'react';
import { getCacheStats, cleanExpiredCache, clearCache } from '../../../lib/geocodeCache';

interface CacheStatsData {
  totalEntries: number;
  expiredEntries: number;
  validEntries: number;
  avgConfidence: number;
  oldestEntryAge: number;
  newestEntryAge: number;
  cacheSize: number;
  maxSize: number;
}

export default function CacheStats() {
  const [stats, setStats] = useState<CacheStatsData | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const loadStats = () => {
    const cacheStats = getCacheStats();
    setStats(cacheStats);
  };

  useEffect(() => {
    loadStats();
    // Atualizar stats a cada 30 segundos
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCleanExpired = async () => {
    setIsLoading(true);
    try {
      const removed = cleanExpiredCache();
      loadStats();
      alert(`${removed} entradas expiradas removidas do cache`);
    } catch (error) {
      alert('Erro ao limpar cache');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearAll = async () => {
    if (!confirm('Deseja limpar todo o cache? Isso pode tornar futuras geocodificações mais lentas.')) {
      return;
    }
    
    setIsLoading(true);
    try {
      clearCache();
      loadStats();
      alert('Cache limpo completamente');
    } catch (error) {
      alert('Erro ao limpar cache');
    } finally {
      setIsLoading(false);
    }
  };

  if (!stats) return null;

  const cacheUsagePercent = (stats.cacheSize / stats.maxSize) * 100;
  const validPercent = stats.totalEntries > 0 ? (stats.validEntries / stats.totalEntries) * 100 : 0;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {/* Botão de Toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-full shadow-lg transition-colors"
        title="Estatísticas do Cache"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>

      {/* Modal de Estatísticas */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl border border-gray-200 p-6 w-80">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900">📊 Cache Stats</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          {/* Estatísticas Principais */}
          <div className="space-y-4">
            {/* Uso do Cache */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Uso do Cache</span>
                <span className="font-medium">{stats.cacheSize}/{stats.maxSize}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${cacheUsagePercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {cacheUsagePercent.toFixed(1)}% utilizado
              </div>
            </div>

            {/* Entradas Válidas */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">Entradas Válidas</span>
                <span className="font-medium">{stats.validEntries}/{stats.totalEntries}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${validPercent}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {validPercent.toFixed(1)}% válidas
              </div>
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-blue-600">
                  {(stats.avgConfidence * 100).toFixed(0)}%
                </div>
                <div className="text-xs text-blue-700">Confiança Média</div>
              </div>
              
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-green-600">
                  {stats.expiredEntries}
                </div>
                <div className="text-xs text-green-700">Expiradas</div>
              </div>
            </div>

            {/* Idade das Entradas */}
            {stats.totalEntries > 0 && (
              <div className="text-xs text-gray-500">
                <div>Entrada mais antiga: {stats.oldestEntryAge} dias</div>
                <div>Entrada mais recente: {stats.newestEntryAge} dias</div>
              </div>
            )}

            {/* Ações */}
            <div className="flex space-x-2 pt-2 border-t">
              <button
                onClick={handleCleanExpired}
                disabled={isLoading || stats.expiredEntries === 0}
                className="flex-1 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-300 text-white text-xs py-2 px-3 rounded transition-colors"
              >
                {isLoading ? '...' : 'Limpar Expiradas'}
              </button>
              
              <button
                onClick={handleClearAll}
                disabled={isLoading || stats.totalEntries === 0}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white text-xs py-2 px-3 rounded transition-colors"
              >
                {isLoading ? '...' : 'Limpar Tudo'}
              </button>
            </div>

            {/* Benefícios do Cache */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="text-xs text-green-800">
                <div className="font-medium mb-1">💡 Benefícios do Cache:</div>
                <div>• Geocodificação instantânea</div>
                <div>• Reduz uso de APIs externas</div>
                <div>• Funciona offline para endereços conhecidos</div>
                <div>• Melhora performance geral</div>
              </div>
            </div>

            {/* Informações Técnicas */}
            <div className="text-xs text-gray-400 border-t pt-2">
              <div>Cache expira em 30 dias</div>
              <div>Confiança mínima: 70%</div>
              <div>Atualização automática: 30s</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
