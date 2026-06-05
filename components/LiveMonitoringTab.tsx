'use client';

import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { monitoringService, TelemetryUpdate } from '../lib/monitoringService';

export const LiveMonitoringTab: React.FC = () => {
    const [lastUpdate, setLastUpdate] = useState<TelemetryUpdate | null>(null);
    const [history, setHistory] = useState<TelemetryUpdate[]>([]);
    const [isLive, setIsLive] = useState(false);

    const mapRef = useRef<L.Map | null>(null);
    const markerRef = useRef<L.Marker | null>(null);
    const polylineRef = useRef<L.Polyline | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    // 🛰️ Subscrever ao monitoramento em tempo real do Supabase
    useEffect(() => {
        const activeRouteId = localStorage.getItem('rota-facil-active-route-id') || 'demo-route-123';

        setIsLive(true);
        const subscription = monitoringService.subscribeToRoute(activeRouteId, (update) => {
            setLastUpdate(update);
            setHistory(prev => [update, ...prev].slice(0, 15)); // Manter histórico de 15 pontos
        });

        // Simulação local de telemetria caso Supabase esteja em modo de demonstração local
        let intervalId: NodeJS.Timeout;
        if (activeRouteId === 'demo-route-123') {
            let step = 0;
            // Coordenadas simuladas em Uberlândia
            const demoRoute = [
                { lat: -18.9186, lng: -48.2772, speed: 10, heading: 90 },
                { lat: -18.9192, lng: -48.2755, speed: 12, heading: 95 },
                { lat: -18.9200, lng: -48.2738, speed: 15, heading: 90 },
                { lat: -18.9208, lng: -48.2720, speed: 14, heading: 85 },
                { lat: -18.9220, lng: -48.2705, speed: 16, heading: 100 },
                { lat: -18.9215, lng: -48.2685, speed: 11, heading: 180 },
                { lat: -18.9202, lng: -48.2690, speed: 8, heading: 270 }
            ];
            intervalId = setInterval(() => {
                const currentData = demoRoute[step % demoRoute.length];
                const simulatedUpdate: TelemetryUpdate = {
                    route_id: 'demo-route-123',
                    lat: currentData.lat,
                    lng: currentData.lng,
                    speed: currentData.speed,
                    heading: currentData.heading,
                    status: 'active'
                };
                setLastUpdate(simulatedUpdate);
                setHistory(prev => [simulatedUpdate, ...prev].slice(0, 15));
                step++;
            }, 6000); // Mudar posição a cada 6 segundos
        }

        return () => {
            subscription.unsubscribe();
            setIsLive(false);
            if (intervalId) clearInterval(intervalId);
            
            // Limpar o mapa ao desmontar
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, []);

    // 🗺️ Inicializar e atualizar o mapa Leaflet conforme a telemetria é recebida
    useEffect(() => {
        if (!mapContainerRef.current || !lastUpdate) return;

        const position: [number, number] = [lastUpdate.lat, lastUpdate.lng];

        // 1. Inicializar mapa se não existir
        if (!mapRef.current) {
            mapRef.current = L.map(mapContainerRef.current, {
                zoomControl: false,
                attributionControl: false
            }).setView(position, 16);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapRef.current);
        }

        const map = mapRef.current;

        // 2. Criar ou atualizar marcador do veículo com ícone de direção estilo Uber/Waze
        const carIcon = L.divIcon({
            html: `
                <div style="
                    background-color: #2563eb;
                    border: 3px solid white;
                    border-radius: 50%;
                    width: 32px;
                    height: 32px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                    transform: rotate(${lastUpdate.heading || 0}deg);
                    transition: transform 0.5s ease-in-out;
                ">
                    🚗
                </div>
            `,
            className: 'custom-car-icon',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        if (!markerRef.current) {
            markerRef.current = L.marker(position, { icon: carIcon }).addTo(map);
        } else {
            markerRef.current.setLatLng(position);
            markerRef.current.setIcon(carIcon);
        }

        // Atualizar popup
        const speedKmh = lastUpdate.speed ? Math.round(lastUpdate.speed * 3.6) : 0;
        markerRef.current.bindPopup(`
            <div style="text-align: center; font-family: sans-serif; font-size: 11px;">
                <strong>Veículo em Movimento</strong><br/>
                Velocidade: ${speedKmh} km/h<br/>
                Alt: ${lastUpdate.lat.toFixed(5)}, ${lastUpdate.lng.toFixed(5)}
            </div>
        `);

        // 3. Atualizar Polyline com rastro da rota percorrida
        const coordinates = history.map(h => L.latLng(h.lat, h.lng));
        if (!polylineRef.current) {
            polylineRef.current = L.polyline(coordinates, {
                color: '#3b82f6',
                weight: 5,
                opacity: 0.6,
                dashArray: '5, 10'
            }).addTo(map);
        } else {
            polylineRef.current.setLatLngs(coordinates);
        }

        // 4. Centralizar visualização suavemente no veículo
        map.panTo(position);

    }, [lastUpdate, history]);

    return (
        <div className="space-y-4 animate-in fade-in duration-500">
            {/* Header de Status */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between shadow-sm">
                <div>
                    <h3 className="text-emerald-900 font-bold flex items-center gap-2">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                        </span>
                        Acompanhamento em Tempo Real
                    </h3>
                    <p className="text-emerald-700 text-xs">Transmitindo geolocalização e telemetria</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-tighter">Live</span>
                </div>
            </div>

            {/* Container do Mapa Leaflet */}
            <div className="border border-gray-200 rounded-2xl overflow-hidden shadow-md relative">
                <div
                    ref={mapContainerRef}
                    style={{ height: '280px', width: '100%' }}
                    className="bg-gray-100"
                />
                
                {/* Overlay flutuante de velocidade */}
                {lastUpdate && (
                    <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur px-3 py-1.5 rounded-xl border border-gray-200 shadow-lg z-[1000] flex items-center gap-2">
                        <span className="text-lg">⚡</span>
                        <div>
                            <div className="text-[8px] font-bold text-gray-500 uppercase tracking-wider">Velocidade</div>
                            <div className="text-xs font-black text-gray-900">
                                {lastUpdate.speed ? Math.round(lastUpdate.speed * 3.6) : 0} km/h
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Painel de telemetria detalhada */}
            {lastUpdate ? (
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="text-gray-500 text-[9px] uppercase font-bold tracking-wider mb-0.5">Sinal de GPS</div>
                        <div className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Excelente (Forte)
                        </div>
                    </div>
                    <div className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                        <div className="text-gray-500 text-[9px] uppercase font-bold tracking-wider mb-0.5">Bateria do Dispositivo</div>
                        <div className="text-xs font-bold text-gray-700">
                            {lastUpdate.battery_level ? `${lastUpdate.battery_level}%` : 'Carregando...'}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="py-8 flex flex-col items-center justify-center text-gray-400 space-y-3 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                    <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="font-semibold text-xs animate-pulse">Buscando sinal do entregador...</p>
                </div>
            )}
        </div>
    );
};
