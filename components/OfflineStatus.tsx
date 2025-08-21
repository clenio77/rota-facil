'use client';

import React, { useState, useEffect } from 'react';
import { offlineManager, OfflineStatus } from '../lib/offlineManager';

interface OfflineStatusProps {
  className?: string;
}

export default function OfflineStatusIndicator({ className = '' }: OfflineStatusProps) {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    lastSync: 0,
    pendingActions: 0,
    cacheSize: 0,
    syncInProgress: false
  });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Listener para mudanças de status
    const handleStatusChange = (newStatus: OfflineStatus) => {
      setStatus(newStatus);
    };

    offlineManager.addStatusListener(handleStatusChange);
    
    // Carregar status inicial
    setStatus(offlineManager.getStatus());

    return () => {
      offlineManager.removeStatusListener(handleStatusChange);
    };
  }, []);

  const formatLastSync = (timestamp: number) => {
    if (timestamp === 0) return 'Nunca';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d atrás`;
    if (hours > 0) return `${hours}h atrás`;
    if (minutes > 0) return `${minutes}m atrás`;
    return 'Agora';
  };

  const getStatusColor = () => {
    if (!status.isOnline) return 'bg-red-500';
    if (status.syncInProgress) return 'bg-yellow-500 animate-pulse';
    if (status.pendingActions > 0) return 'bg-orange-500';
    return 'bg-green-500';
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.syncInProgress) return 'Sincronizando';
    if (status.pendingActions > 0) return `${status.pendingActions} pendentes`;
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return '📴';
    if (status.syncInProgress) return '🔄';
    if (status.pendingActions > 0) return '⏳';
    return '🌐';
  };

  return (
    <>
      {/* 📊 STATUS INDICATOR */}
      <button
        onClick={() => setShowDetails(true)}
        className={`fixed top-4 right-4 z-40 bg-white rounded-xl shadow-lg p-3 border-2 border-gray-200 hover:border-gray-300 transition-all ${className}`}
        title="Status de conexão"
      >
        <div className="flex items-center gap-2">
          <div className={`w-3 h-3 rounded-full ${getStatusColor()}`}></div>
          <span className="text-sm font-medium text-gray-700">
            {getStatusIcon()} {getStatusText()}
          </span>
        </div>
      </button>

      {/* 📋 DETAILS MODAL */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            {/* Header */}
            <div className={`p-6 text-white ${
              status.isOnline 
                ? 'bg-gradient-to-r from-green-600 to-blue-600' 
                : 'bg-gradient-to-r from-red-600 to-orange-600'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold flex items-center gap-2">
                    {getStatusIcon()} Status de Conexão
                  </h2>
                  <p className="text-white/80">
                    {status.isOnline ? 'Conectado à internet' : 'Modo offline ativo'}
                  </p>
                </div>
                <button
                  onClick={() => setShowDetails(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Connection Status */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  🌐 Status da Conexão
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Estado:</span>
                    <span className={`font-semibold ${status.isOnline ? 'text-green-600' : 'text-red-600'}`}>
                      {status.isOnline ? 'Online' : 'Offline'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Última sincronização:</span>
                    <span className="font-semibold text-gray-900">
                      {formatLastSync(status.lastSync)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sync Queue */}
              {status.pendingActions > 0 && (
                <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                  <h3 className="font-semibold text-orange-900 mb-3 flex items-center gap-2">
                    ⏳ Ações Pendentes
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orange-700">Total pendente:</span>
                      <span className="font-bold text-orange-900">{status.pendingActions}</span>
                    </div>
                    <p className="text-orange-700 text-xs">
                      Estas ações serão sincronizadas automaticamente quando a conexão for restaurada.
                    </p>
                  </div>
                </div>
              )}

              {/* Sync Status */}
              {status.syncInProgress && (
                <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                  <h3 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                    🔄 Sincronização em Andamento
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-blue-700">Sincronizando dados...</span>
                  </div>
                </div>
              )}

              {/* Offline Features */}
              {!status.isOnline && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <h3 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                    ✅ Funcionalidades Offline
                  </h3>
                  <ul className="text-sm text-green-700 space-y-1">
                    <li>• ✅ Visualizar rotas salvas</li>
                    <li>• ✅ Marcar entregas como realizadas</li>
                    <li>• ✅ Usar comandos de voz</li>
                    <li>• ✅ Ver estatísticas locais</li>
                    <li>• ❌ Otimizar novas rotas</li>
                    <li>• ❌ Processar novas fotos</li>
                  </ul>
                </div>
              )}

              {/* Tips */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  💡 Dicas para Modo Offline
                </h3>
                <ul className="text-sm text-gray-700 space-y-1">
                  <li>• Processe todas as fotos antes de sair</li>
                  <li>• Otimize a rota enquanto tem sinal</li>
                  <li>• Suas ações ficam salvas localmente</li>
                  <li>• Sincronização automática ao voltar online</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4">
              <button
                onClick={() => setShowDetails(false)}
                className="w-full btn-primary"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hook para usar status offline
export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    lastSync: 0,
    pendingActions: 0,
    cacheSize: 0,
    syncInProgress: false
  });

  useEffect(() => {
    const handleStatusChange = (newStatus: OfflineStatus) => {
      setStatus(newStatus);
    };

    offlineManager.addStatusListener(handleStatusChange);
    setStatus(offlineManager.getStatus());

    return () => {
      offlineManager.removeStatusListener(handleStatusChange);
    };
  }, []);

  return status;
}

// Hook para ações offline
export function useOfflineActions() {
  const queueAction = async (
    type: 'delivery_update' | 'route_start' | 'analytics_update' | 'photo_upload',
    data: any,
    maxRetries: number = 3
  ) => {
    await offlineManager.queueAction({
      type,
      data,
      maxRetries
    });
  };

  const cacheData = async (
    key: string,
    data: any,
    priority: 'high' | 'medium' | 'low' = 'medium',
    expiryHours?: number
  ) => {
    await offlineManager.cacheData(key, data, priority, expiryHours);
  };

  const getCachedData = async (key: string) => {
    return await offlineManager.getCachedData(key);
  };

  return {
    queueAction,
    cacheData,
    getCachedData
  };
}
