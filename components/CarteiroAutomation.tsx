'use client';

import React, { useState, useCallback } from 'react';

// ✅ INTERFACE: Configuração de Automação
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

interface ScheduledRoute {
  id: string;
  date: string;
  time: string;
  items: any[];
  status: 'pending' | 'processing' | 'ready' | 'delivered';
}

interface CarteiroAutomationProps {
  onScheduleRoute: (config: AutoRouteConfig) => void;
  scheduledRoutes: ScheduledRoute[];
  isAutoProcessing: boolean;
}

export default function CarteiroAutomation({ 
  onScheduleRoute, 
  scheduledRoutes, 
  isAutoProcessing 
}: CarteiroAutomationProps) {
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

  // ✅ FUNCIONALIDADE: Solicitar Permissão de Notificação
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permissão de notificação concedida');
      }
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Configuração de Automação */}
      <div className="bg-white rounded-lg shadow-lg p-6">
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

      {/* Rotas Agendadas */}
      {scheduledRoutes.length > 0 && (
        <div className="bg-white rounded-lg shadow-lg p-6">
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

      {/* Botão de Agendamento */}
      {autoConfig.mode !== 'manual' && (
        <div className="text-center">
          <button
            onClick={() => onScheduleRoute(autoConfig)}
            disabled={isAutoProcessing}
            className={`px-8 py-3 rounded-lg font-semibold transition-all ${
              isAutoProcessing
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl transform hover:scale-105'
            }`}
          >
            {isAutoProcessing ? (
              <>
                <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                Agendando Rota Automática...
              </>
            ) : (
              <>
                <span className="mr-2">🤖</span>
                Agendar Rota Automática
              </>
            )}
          </button>
          <p className="text-sm text-gray-600 mt-2">
            Modo: <strong>{autoConfig.mode === 'semi-auto' ? 'Semi-Automático' : 'Piloto Automático'}</strong>
          </p>
        </div>
      )}
    </div>
  );
}
