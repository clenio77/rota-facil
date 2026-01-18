'use client';

import React, { useState, useEffect } from 'react';
import { monitoringService, TelemetryUpdate } from '../lib/monitoringService';

export const LiveMonitoringTab: React.FC = () => {
    const [lastUpdate, setLastUpdate] = useState<TelemetryUpdate | null>(null);
    const [history, setHistory] = useState<TelemetryUpdate[]>([]);
    const [isLive, setIsLive] = useState(false);

    useEffect(() => {
        // In a real scenario, we'd fetch the active route ID from context
        const activeRouteId = localStorage.getItem('rota-facil-active-route-id') || 'demo-route-123';

        setIsLive(true);
        const subscription = monitoringService.subscribeToRoute(activeRouteId, (update) => {
            setLastUpdate(update);
            setHistory(prev => [update, ...prev].slice(0, 5)); // Keep last 5 updates
        });

        return () => {
            subscription.unsubscribe();
            setIsLive(false);
        };
    }, []);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-emerald-900 font-bold flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Monitoramento Ativo
                    </h3>
                    <p className="text-emerald-700 text-xs">Transmitindo telemetria em tempo real</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Live</span>
                </div>
            </div>

            {lastUpdate ? (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Velocidade</div>
                        <div className="text-xl font-black text-gray-800">
                            {lastUpdate.speed ? Math.round(lastUpdate.speed * 3.6) : 0} <span className="text-sm font-normal text-gray-400">km/h</span>
                        </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="text-gray-500 text-[10px] uppercase font-bold tracking-wider">Última Atualização</div>
                        <div className="text-xl font-black text-gray-800">
                            {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    </div>
                    <div className="col-span-2 bg-slate-900 rounded-xl p-4 text-white shadow-lg overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <svg className="w-20 h-20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                        </div>
                        <div className="relative z-10">
                            <div className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Coordenadas Atuais</div>
                            <div className="font-mono text-sm">
                                {lastUpdate.lat.toFixed(6)}, {lastUpdate.lng.toFixed(6)}
                            </div>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
                                    <div className="h-full bg-emerald-500 w-full animate-progress-fast"></div>
                                </div>
                                <span className="text-[10px] text-emerald-400 font-bold">SINAL GPS: FORTE</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-medium animate-pulse">Aguardando telemetria...</p>
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3 px-1">Log de Movimentação</h4>
                    <div className="space-y-2">
                        {history.map((h, i) => (
                            <div key={i} className="flex items-center justify-between text-[11px] p-2 bg-gray-50 rounded-lg border border-gray-100">
                                <span className="text-gray-600 font-mono">{h.lat.toFixed(4)}, {h.lng.toFixed(4)}</span>
                                <span className="text-gray-400">{new Date().toLocaleTimeString()}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
