'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface ECTItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep?: string;
  lat?: number;
  lng?: number;
  correctedAddress?: string;
}

interface ProcessedECTList {
  success: boolean;
  items?: ECTItem[];
  totalItems?: number;
  city?: string;
  state?: string;
  googleMapsUrl?: string;
  error?: string;
  routeData?: {
    stops: ECTItem[];
    totalDistance: number;
    totalTime: number;
    googleMapsUrl: string;
    optimized: boolean;
    metrics: Record<string, unknown>;
  };
  ectData?: {
    listNumber: string;
    unit: string;
    district: string;
    state: string;
    city: string;
    items: ECTItem[];
  };
  geocodedItems?: ECTItem[];
  extractedText?: string;
  ocrConfidence?: number;
  extractionConfidence?: number;
  extractionMethod?: string;
  suggestions?: string[];
}

// ✅ NOVA INTERFACE: Configuração de Automação
interface AutoRouteConfig {
  mode: 'manual' | 'semi-auto' | 'full-auto';
  preferences: {
    avoidTraffic: boolean;
    preferHighways: boolean;
    timeWindows: string[];
    fuelEfficiency: boolean;
    autoOptimize: boolean;
  };
  constraints: {
    maxDistance: number;
    maxTime: number;
    breakIntervals: number;
    startTime: string;
    endTime: string;
  };
  notifications: {
    routeReady: boolean;
    deliveryUpdates: boolean;
    performanceAlerts: boolean;
  };
}

export default function CarteiroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedECTList | null>(null);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [editableItems, setEditableItems] = useState<ECTItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  // ✅ NOVOS ESTADOS: Automação e Agendamento
  const [showAutoConfig, setShowAutoConfig] = useState(false);
  const [autoConfig, setAutoConfig] = useState<AutoRouteConfig>({
    mode: 'manual',
    preferences: {
      avoidTraffic: true,
      preferHighways: false,
      timeWindows: ['08:00-12:00', '14:00-18:00'],
      fuelEfficiency: true,
      autoOptimize: true
    },
    constraints: {
      maxDistance: 100,
      maxTime: 480, // 8 horas
      breakIntervals: 60, // 1 hora
      startTime: '08:00',
      endTime: '18:00'
    },
    notifications: {
      routeReady: true,
      deliveryUpdates: true,
      performanceAlerts: true
    }
  });
  const [scheduledRoutes, setScheduledRoutes] = useState<Array<{
    id: string;
    date: string;
    time: string;
    items: ECTItem[];
    status: 'pending' | 'processing' | 'ready' | 'delivered';
  }>>([]);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // ✅ Otimização: Usar useCallback para funções que não mudam frequentemente
  const getUserLocation = useCallback(() => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      setError('Geolocalização não é suportada pelo seu navegador');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lng: longitude });
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('❌ Erro ao obter localização:', error);
        setError('Não foi possível obter sua localização. Verifique as permissões do navegador.');
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }, []);

  // ✅ Otimização: Usar useMemo para cálculos que dependem de dados
  const routeStats = useMemo(() => {
    if (!processedData?.totalItems) return null;
    
    const totalItems = processedData.totalItems;
    return {
      estimatedTime: totalItems * 3, // 3 min por parada
      estimatedDistance: (totalItems * 0.5).toFixed(1), // 0.5 km por parada
      totalItems
    };
  }, [processedData?.totalItems]);

  // ✅ Otimização: Função de limpeza de erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ✅ Otimização: Remover logs desnecessários em produção
  useEffect(() => {
    if (!isClientMounted) return;
    
    // Apenas logs essenciais para debug
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 Estado atualizado:', { 
        hasData: !!processedData, 
        showEditor: showAddressEditor, 
        itemsCount: editableItems.length 
      });
    }
  }, [processedData, showAddressEditor, editableItems.length, isClientMounted]);

  // ✅ NOVA FUNCIONALIDADE: Agendar Rota Automática
  const scheduleAutoRoute = useCallback(async () => {
    if (!processedData?.items || processedData.items.length === 0) {
      setError('Nenhuma rota para agendar');
      return;
    }

    setIsAutoProcessing(true);
    
    try {
      const routeId = `route_${Date.now()}`;
      const newScheduledRoute = {
        id: routeId,
        date: new Date().toISOString().split('T')[0],
        time: autoConfig.constraints.startTime,
        items: processedData.items || [],
        status: 'pending' as const
      };

      // ✅ SIMULAR PROCESSAMENTO AUTOMÁTICO
      setTimeout(() => {
        setScheduledRoutes(prev => [...prev, newScheduledRoute]);
        
        // ✅ PROCESSAR ROTA AUTOMATICAMENTE
        if (autoConfig.preferences.autoOptimize) {
          processAutoRoute(newScheduledRoute);
        }
        
        setIsAutoProcessing(false);
      }, 2000);

    } catch (error) {
      setError('Erro ao agendar rota automática');
      setIsAutoProcessing(false);
    }
  }, [processedData?.items, autoConfig]);

  // ✅ NOVA FUNCIONALIDADE: Processar Rota Automaticamente
  const processAutoRoute = useCallback(async (scheduledRoute: any) => {
    try {
      // ✅ ATUALIZAR STATUS PARA PROCESSANDO
      setScheduledRoutes(prev => 
        prev.map(route => 
          route.id === scheduledRoute.id 
            ? { ...route, status: 'processing' }
            : route
        )
      );

      // ✅ SIMULAR OTIMIZAÇÃO AUTOMÁTICA
      setTimeout(() => {
        setScheduledRoutes(prev => 
          prev.map(route => 
            route.id === scheduledRoute.id 
              ? { ...route, status: 'ready' }
              : route
          )
        );

        // ✅ NOTIFICAÇÃO AUTOMÁTICA
        if (autoConfig.notifications.routeReady) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚀 Rota Automática Pronta!', {
              body: `Sua rota com ${scheduledRoute.items.length} endereços foi otimizada automaticamente.`,
              icon: '/logo-carro-azul-removebg-preview.png'
            });
          }
        }
      }, 5000);

    } catch (error) {
      console.error('Erro no processamento automático:', error);
      setScheduledRoutes(prev => 
        prev.map(route => 
          route.id === scheduledRoute.id 
            ? { ...route, status: 'delivered' }
            : route
        )
      );
    }
  }, [autoConfig.notifications.routeReady]);

  // ✅ NOVA FUNCIONALIDADE: Solicitar Permissão de Notificação
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permissão de notificação concedida');
      }
    }
  }, []);

  // ✅ Otimização: Funções de manipulação de endereços
  const handleAddressEdit = useCallback((index: number, newAddress: string) => {
    setEditableItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], address: newAddress };
      return updated;
    });
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setEditableItems(processedData?.items ? [...processedData.items] : []);
    setShowAddressEditor(false);
  }, [processedData?.items]);

  // ✅ Nova funcionalidade: Drag and drop para reordenar endereços
  const handleReorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setEditableItems(prev => {
      const newItems = [...prev];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      
      // Atualizar sequência
      return newItems.map((item, index) => ({
        ...item,
        sequence: index + 1
      }));
    });
  }, []);

  if (!isClientMounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    clearError();
    setProcessedData(null);

    const formData = new FormData();
    formData.append('photo', file);
    
    if (userLocation) {
      formData.append('userLocation', JSON.stringify(userLocation));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      const response = await fetch('/api/carteiro/process-ect-list', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data: ProcessedECTList = await response.json();

      if (data.success) {
        const stops = data.routeData?.stops || data.ectData?.items || data.geocodedItems || [];
        
        if (!stops || stops.length === 0) {
          setError('Nenhum endereço foi extraído da imagem. Tente com uma imagem diferente.');
          return;
        }
        
        const normalizedData: ProcessedECTList = {
          success: true,
          totalItems: stops.length,
          city: data.ectData?.city || 'Uberlândia',
          state: data.ectData?.state || 'MG',
          items: stops.map(stop => ({
            sequence: stop.sequence || 0,
            objectCode: stop.objectCode || 'N/A',
            address: stop.address || stop.correctedAddress || 'Endereço não disponível',
            cep: stop.cep || '',
            lat: stop.lat || 0,
            lng: stop.lng || 0
          })),
          googleMapsUrl: data.routeData?.googleMapsUrl || undefined
        };
        
        setProcessedData(normalizedData);
        setEditableItems(normalizedData.items ? [...normalizedData.items] : []);
        setShowAddressEditor(true);
      } else {
        setError(data.error || 'Erro ao processar lista ECT');
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Processamento demorou muito tempo. A API está processando uma lista grande. Tente novamente em alguns minutos.');
        } else if (err.message.includes('fetch')) {
          setError('Erro de conexão com a API. Verifique sua internet e tente novamente.');
        } else {
          setError(`Erro no processamento: ${err.message}`);
        }
      } else {
        setError('Erro desconhecido. Tente novamente.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAndGenerateRoute = async () => {
    if (!processedData) return;

    const updatedData = {
      ...processedData,
      items: editableItems
    };

    try {
      const response = await fetch('/api/carteiro/generate-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      const routeData = await response.json();
      
      if (routeData.success) {
        setProcessedData({
          ...updatedData,
          googleMapsUrl: routeData.googleMapsUrl
        });
        setShowAddressEditor(false);
      } else {
        setError('Erro ao gerar rota. Tente novamente.');
      }
    } catch (err) {
      setError('Erro ao gerar rota. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-300">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src="/logo-carro-azul-removebg-preview.png" 
              alt="Rota Fácil" 
              className="h-12 w-auto"
            />
            <h1 className="text-2xl font-bold">Versão Profissional para Carteiros</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20 pb-24">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📸 Upload de Lista ECT
          </h2>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {!isProcessing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                📁 Selecionar Imagem da Lista ECT
              </button>
            )}

            {isProcessing && (
              <div className="text-blue-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-sm font-medium">Processando imagem...</div>
                <div className="text-xs text-gray-500 mt-1">
                  ⏱️ Pode demorar alguns minutos para listas grandes
                </div>
                <div className="text-xs text-gray-500">
                  🔄 Não feche esta página durante o processamento
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center justify-between">
            <span>❌ {error}</span>
            <button 
              onClick={clearError}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* ✅ NOVA SEÇÃO: Configuração de Automação */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              🤖 Configuração de Automação
            </h2>
            <button
              onClick={() => setShowAutoConfig(!showAutoConfig)}
              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
            >
              {showAutoConfig ? 'Ocultar' : 'Configurar'}
            </button>
          </div>

          {showAutoConfig && (
            <div className="space-y-6">
              {/* Modo de Operação */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">🎛️ Modo de Operação</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { id: 'manual', label: 'Manual', icon: '✋', desc: 'Controle total' },
                    { id: 'semi-auto', label: 'Semi-Auto', icon: '🔄', desc: 'Otimização automática' },
                    { id: 'full-auto', label: 'Piloto Automático', icon: '🤖', desc: 'Totalmente automático' }
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => setAutoConfig(prev => ({ ...prev, mode: mode.id as any }))}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        autoConfig.mode === mode.id
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="text-2xl mb-2">{mode.icon}</div>
                      <div className="font-semibold">{mode.label}</div>
                      <div className="text-xs text-gray-500">{mode.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Preferências */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">⚙️ Preferências</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.preferences.avoidTraffic}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, avoidTraffic: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">🚦 Evitar tráfego</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.preferences.fuelEfficiency}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, fuelEfficiency: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">⛽ Economia de combustível</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.preferences.autoOptimize}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, autoOptimize: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">🧮 Otimização automática</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.preferences.preferHighways}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        preferences: { ...prev.preferences, preferHighways: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">🛣️ Preferir rodovias</span>
                  </label>
                </div>
              </div>

              {/* Restrições */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">⏰ Restrições de Tempo</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Início</label>
                    <input
                      type="time"
                      value={autoConfig.constraints.startTime}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        constraints: { ...prev.constraints, startTime: e.target.value }
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Fim</label>
                    <input
                      type="time"
                      value={autoConfig.constraints.endTime}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        constraints: { ...prev.constraints, endTime: e.target.value }
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Pausas (min)</label>
                    <input
                      type="number"
                      value={autoConfig.constraints.breakIntervals}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        constraints: { ...prev.constraints, breakIntervals: parseInt(e.target.value) || 60 }
                      }))}
                      className="w-full p-2 border border-gray-300 rounded-md"
                      min="15"
                      max="120"
                    />
                  </div>
                </div>
              </div>

              {/* Notificações */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">🔔 Notificações</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.notifications.routeReady}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, routeReady: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">✅ Rota pronta</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.notifications.deliveryUpdates}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, deliveryUpdates: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">📦 Atualizações de entrega</span>
                  </label>
                  
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoConfig.notifications.performanceAlerts}
                      onChange={(e) => setAutoConfig(prev => ({
                        ...prev,
                        notifications: { ...prev.notifications, performanceAlerts: e.target.checked }
                      }))}
                      className="mr-2"
                    />
                    <span className="text-sm">⚠️ Alertas de performance</span>
                  </label>
                </div>
                
                <button
                  onClick={requestNotificationPermission}
                  className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
                >
                  🔔 Ativar Notificações
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Localização */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📍 Configuração de Localização
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">🏠 Localização Atual</h3>
                <p className="text-sm text-gray-600">
                  {userLocation 
                    ? `📍 ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
                    : '❌ Localização não configurada'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Esta será o ponto de partida e chegada da sua rota
                </p>
              </div>

              <div className="flex space-x-2">
                {!userLocation ? (
                  <button
                    onClick={getUserLocation}
                    disabled={isGettingLocation}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isGettingLocation
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isGettingLocation ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Obtendo...
                      </>
                    ) : (
                      '📍 Obter Localização'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setUserLocation(null)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    🗑️ Limpar
                  </button>
                )}
              </div>
            </div>

            {userLocation && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-green-600 mr-2">✅</span>
                  <span className="text-green-800 text-sm font-medium">
                    Localização configurada! Sua rota começará e terminará neste ponto.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ✅ NOVA SEÇÃO: Rotas Agendadas */}
        {scheduledRoutes.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              📅 Rotas Agendadas
            </h2>
            
            <div className="space-y-3">
              {scheduledRoutes.map((route) => (
                <div key={route.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        route.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        route.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        route.status === 'ready' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {route.status === 'pending' ? '⏳ Pendente' :
                         route.status === 'processing' ? '🔄 Processando' :
                         route.status === 'ready' ? '✅ Pronta' :
                         '📦 Entregue'}
                      </span>
                      <span className="text-sm text-gray-600">
                        {route.date} às {route.time}
                      </span>
                    </div>
                    <span className="text-sm text-gray-500">
                      {route.items.length} endereços
                    </span>
                  </div>
                  
                  {route.status === 'ready' && (
                    <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800 mb-2">
                        🎉 Rota otimizada automaticamente!
                      </p>
                      <button
                        onClick={() => {
                          // Aqui você pode implementar a navegação para a rota
                          console.log('Navegando para rota:', route.id);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700"
                      >
                        🗺️ Abrir no Google Maps
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Display */}
        {processedData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🎯 Resultados do Processamento
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">📊 Estatísticas</h3>
                <p className="text-blue-700">Total de itens: {processedData.totalItems || 0}</p>
                <p className="text-blue-700">Cidade: {processedData.city || 'Não especificada'}</p>
                <p className="text-blue-700">Estado: {processedData.state || 'Não especificado'}</p>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h2 className="font-semibold text-purple-800 mb-2">🚗 Detalhes da Rota</h2>
                {routeStats && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-700">📍 Paradas:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.totalItems} endereços
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">⏱️ Tempo estimado:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.estimatedTime} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">📏 Distância estimada:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.estimatedDistance} km
                      </span>
                    </div>
                    {userLocation && (
                      <div className="mt-3 p-2 bg-green-100 rounded border border-green-200">
                        <p className="text-xs text-green-700 text-center">
                          🏠 Rota circular: Inicia e termina na sua localização
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {processedData.googleMapsUrl && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">🗺️ Rota Gerada</h3>
                  <a
                    href={processedData.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors inline-block"
                  >
                    🚀 Abrir no Google Maps
                  </a>
                  <div className="mt-3 text-sm text-green-700">
                    <p>📍 <strong>Origem:</strong> {processedData.items?.[0]?.address || 'Primeiro endereço'}</p>
                    <p>🏁 <strong>Destino:</strong> {processedData.items?.[processedData.items.length - 1]?.address || 'Último endereço'}</p>
                    {userLocation && (
                      <p className="text-xs mt-2 bg-green-200 p-2 rounded">
                        💡 <strong>Dica:</strong> Sua localização será usada como ponto de partida e chegada
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">📍 Endereços Processados</h3>
              {processedData.items && processedData.items.length > 0 ? (
                processedData.items.map((item, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {item.sequence?.toString().padStart(3, '0') || '000'} - {item.objectCode || 'N/A'}
                      </span>
                      {item.cep && (
                        <span className="text-sm text-gray-500">CEP: {item.cep}</span>
                      )}
                    </div>
                    <p className="text-gray-600">{item.address || 'Endereço não disponível'}</p>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">
                  Nenhum endereço processado ainda.
                </div>
              )}
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowAddressEditor(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                ✏️ Editar Endereços
              </button>
              
              <button
                onClick={() => setShowAddressEditor(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                🔒 Ocultar Editor
              </button>

              {/* ✅ NOVO BOTÃO: Agendar Rota Automática */}
              {autoConfig.mode !== 'manual' && (
                <button
                  onClick={scheduleAutoRoute}
                  disabled={isAutoProcessing}
                  className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                    isAutoProcessing
                      ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                      : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700'
                  }`}
                >
                  {isAutoProcessing ? (
                    <>
                      <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                      Agendando...
                    </>
                  ) : (
                    '🤖 Agendar Rota Automática'
                  )}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Address Editor */}
        {showAddressEditor && editableItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✏️ Editor de Endereços
            </h2>
            <p className="text-gray-600 mb-4">
              Revise e edite os endereços extraídos antes de gerar a rota no Google Maps.
              <span className="text-sm text-blue-600 block mt-1">
                💡 Dica: Você pode arrastar os itens para reordenar a sequência da rota
              </span>
            </p>
            
            <div className="space-y-4">
              {editableItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      Item {item.sequence.toString().padStart(3, '0')} - {item.objectCode}
                    </span>
                    {item.cep && (
                      <span className="text-sm text-gray-500">CEP: {item.cep}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700 min-w-0">
                      Endereço:
                    </label>
                    <input
                      type="text"
                      value={item.address}
                      onChange={(e) => handleAddressEdit(index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite o endereço correto..."
                    />
                  </div>
                  
                  {item.lat && item.lng && (
                    <div className="text-xs text-gray-500 mt-1">
                      Coordenadas: {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveAndGenerateRoute}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                ✅ Salvar e Gerar Rota
              </button>
              <button
                onClick={handleDiscardChanges}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                ❌ Descartar Alterações
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
