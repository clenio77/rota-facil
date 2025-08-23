'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Stop {
  id: number;
  address: string;
  status: string;
  photoUrl?: string;
  timestamp?: string;
}

interface RouteStats {
  totalStops: number;
  completedStops: number;
  pendingStops: number;
  totalDistance: number;
  estimatedTime: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stops, setStops] = useState<Stop[]>([]);
  const [stats, setStats] = useState<RouteStats>({
    totalStops: 0,
    completedStops: 0,
    pendingStops: 0,
    totalDistance: 0,
    estimatedTime: 0
  });

  useEffect(() => {
    // Carregar paradas do localStorage
    try {
      const storedStops = localStorage.getItem('rota-facil-stops');
      if (storedStops) {
        const parsedStops = JSON.parse(storedStops) as Stop[];
        setStops(parsedStops);
        
        // Calcular estatísticas
        const completed = parsedStops.filter(stop => stop.status === 'completed').length;
        const pending = parsedStops.filter(stop => stop.status === 'pending' || stop.status === 'uploading').length;
        
        setStats({
          totalStops: parsedStops.length,
          completedStops: completed,
          pendingStops: pending,
          totalDistance: parsedStops.length * 0.5, // Estimativa simples
          estimatedTime: parsedStops.length * 3 // 3 min por parada
        });
      }
    } catch (error) {
      console.error('Erro ao carregar paradas:', error);
    }
  }, []);

  const handleBackToMain = () => {
    router.push('/');
  };

  const handleViewRoute = () => {
    router.push('/');
  };

  const handleViewCarteiro = () => {
    router.push('/carteiro');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-300">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 relative">
                <img
                  src="/logo-carro-azul-removebg-preview.png"
                  alt="Rota Fácil Logo"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <h1 className="text-lg font-bold leading-tight">ROTA FÁCIL</h1>
                <p className="text-xs opacity-90 leading-tight">DASHBOARD</p>
              </div>
            </div>
            <button
              onClick={handleBackToMain}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20 pb-24">
        <div className="max-w-4xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard de Rotas</h1>
            <p className="text-gray-600">Visualize estatísticas e gerencie suas rotas de entrega</p>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-blue-600 mb-2">{stats.totalStops}</div>
              <div className="text-gray-600">Total de Paradas</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">{stats.completedStops}</div>
              <div className="text-gray-600">Entregas Concluídas</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-orange-600 mb-2">{stats.pendingStops}</div>
              <div className="text-gray-600">Pendentes</div>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <div className="text-3xl font-bold text-purple-600 mb-2">{stats.estimatedTime}min</div>
              <div className="text-gray-600">Tempo Estimado</div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Gerenciar Rotas</h3>
              <p className="text-gray-600 mb-4">
                Visualize e edite suas rotas atuais, adicione novas paradas e otimize o trajeto.
              </p>
              <button
                onClick={handleViewRoute}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Ver Minhas Rotas
              </button>
            </div>
            
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Processar ECT</h3>
              <p className="text-gray-600 mb-4">
                Faça upload de listas ECT para extrair endereços automaticamente e criar rotas otimizadas.
              </p>
              <button
                onClick={handleViewCarteiro}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Ir para Carteiro
              </button>
            </div>
          </div>

          {/* Recent Stops */}
          {stops.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Paradas Recentes</h3>
              <div className="space-y-3">
                {stops.slice(0, 5).map((stop) => (
                  <div key={stop.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${
                        stop.status === 'completed' ? 'bg-green-500' :
                        stop.status === 'pending' ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className="text-gray-800">{stop.address || 'Endereço não definido'}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      stop.status === 'completed' ? 'bg-green-100 text-green-800' :
                      stop.status === 'pending' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'
                    }`}>
                      {stop.status === 'completed' ? 'Concluída' :
                       stop.status === 'pending' ? 'Pendente' : 'Processando'}
                    </span>
                  </div>
                ))}
              </div>
              {stops.length > 5 && (
                <div className="text-center mt-4">
                  <button
                    onClick={handleViewRoute}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Ver todas as {stops.length} paradas →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Empty State */}
          {stops.length === 0 && (
            <div className="bg-white rounded-lg shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Nenhuma rota encontrada</h3>
              <p className="text-gray-600 mb-6">
                Comece criando sua primeira rota de entrega para ver estatísticas e acompanhar o progresso.
              </p>
              <button
                onClick={handleViewRoute}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
              >
                Criar Primeira Rota
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
