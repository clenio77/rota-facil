'use client';

import React, { useState, useCallback } from 'react';
import { useGeolocation, UserLocation } from '../hooks/useGeolocation';
import CityIndicator from './CityIndicator';

interface OptimizationResult {
  success: boolean;
  optimization?: {
    originalDistance: number;
    optimizedDistance: number;
    distanceSaved: number;
    percentageImprovement: number;
    originalDuration: number;
    optimizedDuration: number;
    timeSaved: number;
    algorithm: string;
    processingTime: number;
    totalWaypoints: number;
    originalWaypointsCount: number;
  };
  filterInfo?: {
    applied: boolean;
    originalCount: number;
    filteredCount: number;
  };
  originalWaypoints?: Array<{
    id: number;
    lat: number;
    lng: number;
    name: string;
    sequence: number;
    filtered: boolean;
  }>;
  optimizedWaypoints?: Array<{
    id: number;
    lat: number;
    lng: number;
    name: string;
    sequence: number;
  }>;
  optimizedGPX?: string;
  metadata?: {
    originalFileName: string;
    optimizedFileName: string;
    processedAt: string;
    fileSize: number;
    optimizedFileSize: number;
  };
  error?: string;
}

interface OptimizationOptions {
  algorithm: 'nearest-neighbor' | 'two-opt' | 'genetic' | 'auto';
  roundTrip: boolean;
  maxIterations: number;
  preserveOrder: boolean;
  filterByLocation: boolean;
  maxDistanceFromUser: number;
}

export default function GPXOptimizer() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [options, setOptions] = useState<OptimizationOptions>({
    algorithm: 'auto',
    roundTrip: false,
    maxIterations: 1000,
    preserveOrder: false,
    filterByLocation: true,
    maxDistanceFromUser: 50
  });

  // Geolocalização
  const { position: deviceLocation } = useGeolocation();
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!file.name.toLowerCase().endsWith('.gpx')) {
        alert('Por favor, selecione um arquivo GPX válido');
        return;
      }
      setSelectedFile(file);
      setResult(null);
    }
  }, []);

  const handleOptimize = useCallback(async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('options', JSON.stringify(options));
      
      // Adicionar localização do usuário se disponível e filtro ativado
      const currentLocation = userLocation || deviceLocation;
      if (currentLocation && options.filterByLocation) {
        formData.append('userLocation', JSON.stringify(currentLocation));
      }

      const response = await fetch('/api/gpx-optimize', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      setResult(data);

      if (!data.success) {
        console.error('Erro na otimização:', data.error);
      }
    } catch (error) {
      console.error('Erro ao processar arquivo:', error);
      setResult({
        success: false,
        error: 'Erro de conexão ao processar arquivo'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [selectedFile, options, userLocation, deviceLocation]);

  const handleDownload = useCallback(() => {
    if (!result?.optimizedGPX || !result?.metadata) return;

    const blob = new Blob([result.optimizedGPX], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.metadata.optimizedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [result]);

  const formatDistance = (km: number) => {
    return km >= 1 ? `${km.toFixed(1)} km` : `${(km * 1000).toFixed(0)} m`;
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return hours > 0 ? `${hours}h ${mins}min` : `${mins}min`;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          <span className="inline-block mr-2 text-2xl">🚀</span>
          GPX Optimizer
        </h1>
        <p className="text-gray-600">
          Otimize suas rotas GPX com algoritmos avançados e filtro de localização inteligente
        </p>
      </div>

      {/* Location Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <span className="mr-2">📍</span>
          Localização e Filtros
        </h2>
        
        <div className="space-y-4">
          <CityIndicator 
            currentLocation={userLocation || deviceLocation}
            onLocationChange={setUserLocation}
            className="mb-4"
          />
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.filterByLocation}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  filterByLocation: e.target.checked
                }))}
                className="mr-2"
              />
              <span className="text-sm font-medium">Filtrar pontos por proximidade</span>
            </label>
            
            {options.filterByLocation && (
              <div className="flex items-center space-x-2">
                <label className="text-sm text-gray-600">Raio máximo:</label>
                <input
                  type="number"
                  value={options.maxDistanceFromUser}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    maxDistanceFromUser: parseInt(e.target.value) || 50
                  }))}
                  className="w-20 p-1 border border-gray-300 rounded text-sm"
                  min="1"
                  max="500"
                />
                <span className="text-sm text-gray-600">km</span>
              </div>
            )}
          </div>
          
          {options.filterByLocation && !userLocation && !deviceLocation && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ Ative a localização do dispositivo ou configure manualmente para usar o filtro de proximidade
              </p>
            </div>
          )}
          
          {options.filterByLocation && (userLocation || deviceLocation) && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Apenas pontos dentro de {options.maxDistanceFromUser}km da sua localização serão otimizados
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center">
          <span className="mr-2">📁</span>
          Upload do Arquivo GPX
        </h2>
        
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          <input
            type="file"
            accept=".gpx"
            onChange={handleFileSelect}
            className="hidden"
            id="gpx-upload"
          />
          <label htmlFor="gpx-upload" className="cursor-pointer">
            <div className="space-y-2">
              <div className="text-4xl mx-auto text-gray-400">📁</div>
              <p className="text-lg font-medium text-gray-700">
                {selectedFile ? selectedFile.name : 'Clique para selecionar arquivo GPX'}
              </p>
              <p className="text-sm text-gray-500">
                Suporte para waypoints, tracks e routes
              </p>
            </div>
          </label>
        </div>

        {selectedFile && (
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-blue-900">{selectedFile.name}</p>
                <p className="text-sm text-blue-700">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200"
              >
                <span className="mr-1">⚙️</span>
                Opções Avançadas
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Advanced Options */}
      {showAdvanced && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold mb-4">Opções de Otimização</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Algoritmo
              </label>
              <select
                value={options.algorithm}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  algorithm: e.target.value as OptimizationOptions['algorithm']
                }))}
                className="w-full p-2 border border-gray-300 rounded-md"
              >
                <option value="auto">Automático (Recomendado)</option>
                <option value="nearest-neighbor">Vizinho Mais Próximo</option>
                <option value="two-opt">2-opt (Melhor qualidade)</option>
                <option value="genetic">Algoritmo Genético</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Máximo de Iterações
              </label>
              <input
                type="number"
                value={options.maxIterations}
                onChange={(e) => setOptions(prev => ({ 
                  ...prev, 
                  maxIterations: parseInt(e.target.value) || 1000
                }))}
                className="w-full p-2 border border-gray-300 rounded-md"
                min="100"
                max="10000"
                step="100"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.roundTrip}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    roundTrip: e.target.checked
                  }))}
                  className="mr-2"
                />
                Viagem de ida e volta
              </label>

              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={options.preserveOrder}
                  onChange={(e) => setOptions(prev => ({ 
                    ...prev, 
                    preserveOrder: e.target.checked
                  }))}
                  className="mr-2"
                />
                Preservar ordem original
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Optimize Button */}
      {selectedFile && (
        <div className="text-center">
          <button
            onClick={handleOptimize}
            disabled={isProcessing}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center mx-auto"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Otimizando...
              </>
            ) : (
              <>
                <span className="mr-2">⚡</span>
                Otimizar Rota
              </>
            )}
          </button>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="bg-white rounded-lg shadow-md p-6">
          {result.success ? (
            <div className="space-y-6">
              {/* Success Header */}
              <div className="text-center">
                <h3 className="text-2xl font-bold text-green-600 mb-2">
                  ✅ Otimização Concluída!
                </h3>
                <p className="text-gray-600">
                  Processado em {result.optimization?.processingTime}ms usando {result.optimization?.algorithm}
                </p>
              </div>

              {/* Filter Info */}
              {result.filterInfo?.applied && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-800 mb-2">🎯 Filtro de Localização Aplicado</h4>
                  <p className="text-blue-700 text-sm">
                    {result.filterInfo.filteredCount} de {result.filterInfo.originalCount} pontos foram otimizados
                    ({result.filterInfo.originalCount - result.filterInfo.filteredCount} pontos filtrados por distância)
                  </p>
                </div>
              )}

              {/* Metrics */}
              {result.optimization && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-3xl mx-auto text-green-600 mb-2">🛣️</div>
                    <p className="text-sm text-green-700">Distância Economizada</p>
                    <p className="text-2xl font-bold text-green-800">
                      {formatDistance(result.optimization.distanceSaved)}
                    </p>
                    <p className="text-sm text-green-600">
                      {result.optimization.percentageImprovement.toFixed(1)}% de melhoria
                    </p>
                  </div>

                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-3xl mx-auto text-blue-600 mb-2">⏱️</div>
                    <p className="text-sm text-blue-700">Tempo Economizado</p>
                    <p className="text-2xl font-bold text-blue-800">
                      {formatTime(result.optimization.timeSaved)}
                    </p>
                    <p className="text-sm text-blue-600">
                      De {formatTime(result.optimization.originalDuration)} para {formatTime(result.optimization.optimizedDuration)}
                    </p>
                  </div>

                  <div className="bg-purple-50 p-4 rounded-lg text-center">
                    <div className="text-3xl mx-auto text-purple-600 mb-2">📍</div>
                    <p className="text-sm text-purple-700">Pontos Otimizados</p>
                    <p className="text-2xl font-bold text-purple-800">
                      {result.optimization.totalWaypoints}
                    </p>
                    <p className="text-sm text-purple-600">
                      {result.optimization.originalWaypointsCount && result.optimization.originalWaypointsCount !== result.optimization.totalWaypoints
                        ? `de ${result.optimization.originalWaypointsCount} total`
                        : 'Waypoints processados'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Download Button */}
              <div className="text-center">
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center mx-auto"
                >
                  <span className="mr-2">💾</span>
                  Baixar GPX Otimizado
                </button>
              </div>

              {/* Detailed Stats */}
              {result.optimization && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-2 flex items-center">
                    <span className="mr-2">📊</span>
                    Estatísticas Detalhadas
                  </h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Distância Original:</span>
                      <span className="font-medium ml-2">{formatDistance(result.optimization.originalDistance)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Distância Otimizada:</span>
                      <span className="font-medium ml-2">{formatDistance(result.optimization.optimizedDistance)}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Algoritmo Usado:</span>
                      <span className="font-medium ml-2">{result.optimization.algorithm}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Tempo de Processamento:</span>
                      <span className="font-medium ml-2">{result.optimization.processingTime}ms</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-red-600">
              <h3 className="text-xl font-semibold mb-2">❌ Erro na Otimização</h3>
              <p>{result.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
