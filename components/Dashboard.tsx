'use client';

import React, { useState, useEffect } from 'react';
import { analytics, DailyStats, WeeklyStats } from '../lib/analytics';
import dynamic from 'next/dynamic';

const LiveMonitoringTab = dynamic(() => import('./LiveMonitoringTab').then(mod => mod.LiveMonitoringTab), {
  ssr: false,
  loading: () => (
    <div className="py-8 flex flex-col items-center justify-center text-gray-400 space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
      <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      <p className="font-semibold text-xs animate-pulse">Carregando Mapa...</p>
    </div>
  )
});

interface DashboardProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Dashboard({ isOpen, onClose }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'today' | 'week' | 'records' | 'live'>('today');
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [weekStats, setWeekStats] = useState<WeeklyStats | null>(null);
  const [records, setRecords] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      loadStats();
    }
  }, [isOpen]);

  const loadStats = () => {
    setTodayStats(analytics.getDailyStats());
    setWeekStats(analytics.getWeeklyStats());
    setRecords(analytics.getPersonalRecords());
  };

  const handleExportPDF = () => {
    try {
      const rawStops = window.localStorage.getItem('rotafacil:stops:v1');
      if (!rawStops) {
        alert('Nenhuma parada encontrada no sistema para exportar.');
        return;
      }
      const stops = JSON.parse(rawStops);
      
      const stats = {
        estimatedTime: stops.length * 3,
        estimatedDistance: (stops.length * 0.5).toFixed(1),
        estimatedCost: todayStats ? todayStats.totalFuelCost : stops.length * 0.5 * 0.58,
        totalItems: stops.length
      };

      const reportData = {
        items: stops.map((s: any, idx: number) => ({
          sequence: s.sequence || idx + 1,
          objectCode: s.objectCode || `OBJ-${idx + 1}`,
          address: s.address,
          completed: s.status === 'delivered' || s.completed || false,
          status: s.status,
          signature: s.signature || null,
          receiverName: s.receiverName || null,
          receiverDoc: s.receiverDoc || null
        })),
        stats,
        city: 'Cidade atual',
        state: 'Estado atual',
        date: new Date().toLocaleDateString('pt-BR')
      };

      window.localStorage.setItem('rotafacil:active_report_data', JSON.stringify(reportData));
      window.open('/relatorio', '_blank');
    } catch (e) {
      console.error(e);
      alert('Erro ao exportar relatório.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col justify-between">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">📊 Dashboard</h2>
              <p className="text-blue-100">Suas estatísticas de entrega</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          {[
            { id: 'today', label: 'Hoje', icon: '📅' },
            { id: 'week', label: 'Semana', icon: '📈' },
            { id: 'records', label: 'Recordes', icon: '🏆' },
            { id: 'live', label: 'Monitor', icon: '🛰️' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 py-4 px-2 text-center font-medium transition-colors ${activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-gray-500 hover:text-gray-700'
                }`}
            >
              <div className="text-lg">{tab.icon}</div>
              <div className="text-sm">{tab.label}</div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] flex-1">
          {activeTab === 'today' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📅 Estatísticas de Hoje</h3>

              {todayStats ? (
                <div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-blue-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{todayStats.totalDeliveries}</div>
                      <div className="text-sm text-blue-800">Entregas</div>
                    </div>

                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">{todayStats.totalDistance} km</div>
                      <div className="text-sm text-green-800">Distância</div>
                    </div>

                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-purple-600">{Math.floor(todayStats.totalTime / 60)}h {todayStats.totalTime % 60}m</div>
                      <div className="text-sm text-purple-800">Tempo Total</div>
                    </div>

                    <div className="bg-yellow-50 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-yellow-600">R$ {todayStats.totalFuelCost.toFixed(2)}</div>
                      <div className="text-sm text-yellow-800">Combustível</div>
                    </div>
                  </div>

                  <button
                    onClick={handleExportPDF}
                    className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm text-sm"
                  >
                    <span>📋</span>
                    <span>Exportar Relatório PDF do Dia</span>
                  </button>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">📭</div>
                  <p>Nenhuma entrega registrada hoje</p>
                  <p className="text-sm mt-1">Comece uma rota para ver suas estatísticas!</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'week' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📈 Estatísticas da Semana</h3>

              {weekStats && (
                <>
                  {/* Médias Semanais */}
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 mb-6">
                    <h4 className="font-semibold text-gray-900 mb-3">📊 Médias Semanais</h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-600">Entregas/dia:</span>
                        <span className="font-bold ml-2">{weekStats.averages.deliveriesPerDay}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Distância/dia:</span>
                        <span className="font-bold ml-2">{weekStats.averages.distancePerDay} km</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Tempo/dia:</span>
                        <span className="font-bold ml-2">{Math.floor(weekStats.averages.timePerDay / 60)}h {weekStats.averages.timePerDay % 60}m</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Eficiência:</span>
                        <span className="font-bold ml-2">{weekStats.averages.efficiency}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Gráfico Simples dos Últimos 7 Dias */}
                  <div className="bg-gray-50 rounded-xl p-4">
                    <h4 className="font-semibold text-gray-900 mb-3">📈 Entregas por Dia</h4>
                    <div className="space-y-2">
                      {weekStats.days.slice(-7).map((day, index) => {
                        const maxDeliveries = Math.max(...weekStats.days.map(d => d.totalDeliveries));
                        const percentage = maxDeliveries > 0 ? (day.totalDeliveries / maxDeliveries) * 100 : 0;
                        const dayName = new Date(day.date).toLocaleDateString('pt-BR', { weekday: 'short' });

                        return (
                          <div key={day.date} className="flex items-center gap-3">
                            <div className="w-8 text-xs text-gray-600 font-medium">{dayName}</div>
                            <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                              <div
                                className="bg-gradient-to-r from-blue-500 to-purple-500 h-6 rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                                style={{ width: `${Math.max(percentage, 5)}%` }}
                              >
                                {day.totalDeliveries > 0 && (
                                  <span className="text-white text-xs font-bold">{day.totalDeliveries}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'records' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">🏆 Seus Recordes</h3>

              {records && (
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl p-4 border border-yellow-200">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🥇</div>
                      <div>
                        <div className="font-bold text-gray-900">Mais Entregas em um Dia</div>
                        <div className="text-2xl font-bold text-yellow-600">{records.mostDeliveries}</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">🚗</div>
                      <div>
                        <div className="font-bold text-gray-900">Maior Distância</div>
                        <div className="text-2xl font-bold text-green-600">{records.longestDistance.toFixed(1)} km</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-4 border border-blue-200">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⚡</div>
                      <div>
                        <div className="font-bold text-gray-900">Melhor Eficiência</div>
                        <div className="text-2xl font-bold text-blue-600">{records.bestEfficiency}%</div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">⏱️</div>
                      <div>
                        <div className="font-bold text-gray-900">Entrega Mais Rápida</div>
                        <div className="text-2xl font-bold text-purple-600">
                          {records.fastestDelivery > 0 ? `${records.fastestDelivery} min` : 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl">📊</div>
                      <div>
                        <div className="font-bold text-gray-900">Total de Sessões</div>
                        <div className="text-2xl font-bold text-gray-600">{records.totalSessions}</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'live' && (
            <LiveMonitoringTab />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <button
            onClick={onClose}
            className="w-full btn-primary"
          >
            Fechar Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
