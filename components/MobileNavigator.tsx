'use client'

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface NavigationPoint {
  id: string;
  lat: number;
  lng: number;
  address: string;
  sequence: number;
  completed?: boolean;
  objectCode?: string;
  region?: string;
}

interface MobileNavigatorProps {
  points: NavigationPoint[];
  userLocation?: { lat: number; lng: number };
  onStopCompleted?: (stopId: string) => void;
}

export default function MobileNavigator({ points, userLocation, onStopCompleted }: MobileNavigatorProps) {
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentRouteCoordinates, setCurrentRouteCoordinates] = useState<[number, number][]>([]);
  const [currentLocation, setCurrentLocation] = useState(userLocation);
  const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());
  const [showStopsList, setShowStopsList] = useState(false);

  // ✅ GPS EM TEMPO REAL
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setCurrentLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.error('Erro GPS:', error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // ✅ CALCULAR ROTA ATUAL
  const calculateCurrentRoute = async (from: {lat: number; lng: number}, to: {lat: number; lng: number}) => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCurrentRouteCoordinates(coordinates);
      } else {
        setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
      }
    } catch (error) {
      setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
    }
  };

  // ✅ INICIAR NAVEGAÇÃO
  const startNavigation = () => {
    setIsNavigating(true);
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    setCurrentStopIndex(0);
    
    if (currentLocation && orderedPoints[0]) {
      calculateCurrentRoute(currentLocation, orderedPoints[0]);
    }
  };

  // ✅ PRÓXIMA PARADA
  const nextStop = () => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    
    if (currentStopIndex < orderedPoints.length - 1) {
      const currentPoint = orderedPoints[currentStopIndex];
      const newIndex = currentStopIndex + 1;
      const nextPoint = orderedPoints[newIndex];
      
      setCurrentStopIndex(newIndex);
      setCompletedStops(prev => new Set([...prev, currentPoint.id]));
      
      if (onStopCompleted) {
        onStopCompleted(currentPoint.id);
      }

      calculateCurrentRoute(
        { lat: currentPoint.lat, lng: currentPoint.lng }, 
        { lat: nextPoint.lat, lng: nextPoint.lng }
      );
    } else {
      // Retornar ao início
      const lastPoint = orderedPoints[currentStopIndex];
      setCompletedStops(prev => new Set([...prev, lastPoint.id]));
      
      if (currentLocation) {
        calculateCurrentRoute(
          { lat: lastPoint.lat, lng: lastPoint.lng }, 
          { lat: currentLocation.lat, lng: currentLocation.lng }
        );
        setCurrentStopIndex(-1);
      } else {
        setIsNavigating(false);
      }
    }
  };

  // ✅ ÍCONES CUSTOMIZADOS - MELHOR VISIBILIDADE
  const createCustomIcon = (sequence: number, isCompleted: boolean, isCurrent: boolean) => {
    const size = isCurrent ? 36 : 28;
    const color = isCurrent ? '#f97316' : isCompleted ? '#22c55e' : '#3b82f6';
    const borderColor = isCurrent ? '#fed7aa' : 'white';
    const fontSize = isCurrent ? '16px' : '12px';
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          color: white;
          border-radius: 50%;
          width: ${size}px;
          height: ${size}px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: ${fontSize};
          border: 3px solid ${borderColor};
          box-shadow: 0 4px 8px rgba(0,0,0,0.4);
          ${isCurrent ? 'animation: pulse 2s infinite;' : ''}
        ">
          ${isCurrent ? '🎯' : isCompleted ? '✅' : sequence}
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [size, size],
      iconAnchor: [size/2, size/2]
    });
  };

  const createUserLocationIcon = () => {
    return L.divIcon({
      html: `
        <div style="
          background-color: #dc2626;
          color: white;
          border-radius: 50%;
          width: 16px;
          height: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid white;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.3);
        ">
          📍
        </div>
      `,
      className: 'user-location-icon',
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
  };

  const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
  const currentStop = orderedPoints[currentStopIndex];

  return (
    <div className="h-screen w-full bg-gray-100 relative flex flex-col overflow-hidden">
      {/* ✅ MAPA PRINCIPAL - OCUPA TODA A TELA */}
      <div className="flex-1 relative" style={{ height: 'calc(100vh - env(safe-area-inset-bottom))' }}>
        <MapContainer
          center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [-18.9185, -48.2773]}
          zoom={isNavigating && currentStop ? 17 : 14}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {/* ✅ LOCALIZAÇÃO DO USUÁRIO */}
          {currentLocation && (
            <Marker 
              position={[currentLocation.lat, currentLocation.lng]} 
              icon={createUserLocationIcon()}
            />
          )}

          {/* ✅ MARCADORES DAS PARADAS */}
          {points.map((point, index) => {
            const isCompleted = completedStops.has(point.id);
            const isCurrent = index === currentStopIndex && isNavigating;
            
            return (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={createCustomIcon(point.sequence, isCompleted, isCurrent)}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold text-sm">{point.address}</h3>
                    <p className="text-xs text-gray-600">📦 {point.objectCode || point.id}</p>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ✅ ROTA ATUAL */}
          {currentRouteCoordinates.length > 0 && (
            <Polyline 
              positions={currentRouteCoordinates}
              color="#1e40af"
              weight={4}
              opacity={0.8}
            />
          )}
        </MapContainer>

        {/* ✅ CONTROLES FLUTUANTES ESTILO WAZE */}
        <div className="absolute top-2 left-2 right-2 z-20">
          {/* Header Compacto - Estilo Waze */}
          <div className="bg-white rounded-xl shadow-lg p-3 mb-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-lg">🚚</span>
                <div>
                  <h3 className="font-semibold text-sm text-gray-800">Rota Fácil</h3>
                  <p className="text-xs text-gray-500">
                    {isNavigating ? `Navegando` : 'Pronto para iniciar'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowStopsList(!showStopsList)}
                  className="bg-blue-500 text-white p-2 rounded-lg text-xs flex items-center justify-center"
                  style={{ minWidth: '36px', minHeight: '36px' }}
                >
                  📋
                </button>
              </div>
            </div>
          </div>

          {/* Painel de Navegação - ESTILO WAZE/MAPS */}
          {isNavigating && currentStop && (
            <div className="bg-blue-600 text-white rounded-xl shadow-xl p-4 mb-2">
              <div className="flex items-start gap-3">
                <div className="bg-white text-blue-600 rounded-full w-12 h-12 flex items-center justify-center">
                  <span className="text-2xl">🧭</span>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold opacity-90 uppercase tracking-wide">PRÓXIMA PARADA</p>
                  <h2 className="font-bold text-lg leading-tight mt-1">{currentStop.address}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-lg">📦</span>
                    <p className="text-sm font-semibold">{currentStop.objectCode || currentStop.id}</p>
                  </div>
                </div>
                <div className="text-center">
                  <div className="bg-white text-blue-600 rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm mb-1">
                    {currentStop.sequence}
                  </div>
                  <p className="text-xs opacity-75">{currentStopIndex + 1}/{points.length}</p>
                </div>
              </div>
              
              {/* Barra de Instrução */}
              <div className="mt-3 pt-3 border-t border-blue-400">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📍</span>
                  <p className="text-sm font-semibold">Procure pelo endereço e entregue o objeto ECT</p>
                </div>
              </div>
            </div>
          )}



          {/* Lista de Paradas - Expansível */}
          {showStopsList && (
            <div className="bg-white rounded-xl shadow-lg max-h-60 overflow-y-auto mt-3">
              {orderedPoints.map((stop, index) => {
                const isCompleted = completedStops.has(stop.id);
                const isCurrent = index === currentStopIndex && isNavigating;
                
                return (
                  <div
                    key={stop.id}
                    className={`p-3 border-b last:border-b-0 ${
                      isCurrent ? 'bg-orange-50' : isCompleted ? 'bg-green-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCurrent ? 'bg-orange-500 text-white' :
                        isCompleted ? 'bg-green-500 text-white' :
                        'bg-gray-300 text-gray-700'
                      }`}>
                        {isCurrent ? '🎯' : isCompleted ? '✅' : stop.sequence}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">{stop.address}</p>
                        <p className="text-xs text-gray-500">{stop.objectCode}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ CONTROLES DE ZOOM - LATERAL */}
        <div className="absolute bottom-20 right-2 z-20">
          <div className="bg-white rounded-lg shadow-lg overflow-hidden">
            <button
              onClick={() => {
                const map = document.querySelector('.leaflet-container');
                if (map) {
                  // @ts-ignore
                  map._leaflet_map?.zoomIn();
                }
              }}
              className="block w-8 h-8 bg-white hover:bg-gray-50 flex items-center justify-center border-b border-gray-200"
            >
              <span className="text-sm font-bold text-gray-600">+</span>
            </button>
            <button
              onClick={() => {
                const map = document.querySelector('.leaflet-container');
                if (map) {
                  // @ts-ignore
                  map._leaflet_map?.zoomOut();
                }
              }}
              className="block w-8 h-8 bg-white hover:bg-gray-50 flex items-center justify-center"
            >
              <span className="text-sm font-bold text-gray-600">−</span>
            </button>
          </div>
        </div>
      </div>

      {/* ✅ BOTÕES FIXOS NO BOTTOM - SEMPRE VISÍVEIS */}
      <div className="bg-white border-t border-gray-200 p-4" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
        <div className="flex gap-3">
          {!isNavigating ? (
            <button
              onClick={startNavigation}
              className="flex-1 bg-green-500 hover:bg-green-600 text-white py-4 rounded-xl font-bold text-base shadow-xl flex items-center justify-center gap-2"
              style={{ minHeight: '56px' }}
            >
              <span className="text-xl">🚀</span>
              <span>INICIAR NAVEGAÇÃO</span>
            </button>
          ) : (
            <>
              <button
                onClick={nextStop}
                disabled={currentStopIndex >= points.length - 1 && currentStopIndex !== -1}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-xl font-bold text-base shadow-xl disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ minHeight: '56px' }}
              >
                <span className="text-xl">✅</span>
                <span>PRÓXIMA PARADA</span>
              </button>
              <button
                onClick={() => setIsNavigating(false)}
                className="bg-red-500 hover:bg-red-600 text-white px-6 py-4 rounded-xl font-bold text-base shadow-xl"
                style={{ minHeight: '56px' }}
              >
                <span className="text-xl">⏹️</span>
              </button>
            </>
          )}
        </div>
        
        {/* Indicador de Progresso */}
        {isNavigating && (
          <div className="mt-3 text-center">
            <p className="text-sm text-gray-600">
              Parada <span className="font-bold text-blue-600">{currentStopIndex + 1}</span> de <span className="font-bold">{points.length}</span>
              {completedStops.size > 0 && (
                <span className="ml-2 text-green-600">• {completedStops.size} concluídas</span>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
