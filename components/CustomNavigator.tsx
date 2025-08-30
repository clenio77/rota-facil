'use client'

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface NavigationPoint {
  id: string;
  lat: number;
  lng: number;
  address: string;
  sequence: number;
  completed?: boolean;
}

interface CustomNavigatorProps {
  points: NavigationPoint[];
  userLocation?: { lat: number; lng: number };
  onStopCompleted?: (stopId: string) => void;
}

export default function CustomNavigator({ points, userLocation, onStopCompleted }: CustomNavigatorProps) {
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentRouteCoordinates, setCurrentRouteCoordinates] = useState<[number, number][]>([]);
  const [completeOptimizedRoute, setCompleteOptimizedRoute] = useState<[number, number][]>([]);
  const [currentLocation, setCurrentLocation] = useState(userLocation);

  // ✅ OBTER LOCALIZAÇÃO EM TEMPO REAL
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
        { enableHighAccuracy: true, maximumAge: 10000 }
      );

      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // ✅ CALCULAR ROTA OTIMIZADA COMPLETA (todos os pontos em sequência)
  const calculateCompleteOptimizedRoute = async () => {
    try {
      console.log('🔍 CALCULANDO ROTA OTIMIZADA COMPLETA...');
      console.log('📍 Pontos ordenados:', points.map(p => `${p.sequence}. ${p.address}`));
      
      // ✅ CRIAR SEQUÊNCIA DE COORDENADAS NA ORDEM OTIMIZADA
      const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
      const waypoints = orderedPoints.map(p => `${p.lng},${p.lat}`).join(';');
      
      // ✅ INCLUIR LOCALIZAÇÃO ATUAL COMO PONTO DE PARTIDA
      const startPoint = currentLocation || { lat: -18.9203, lng: -48.2782 };
      const fullWaypoints = `${startPoint.lng},${startPoint.lat};${waypoints}`;
      
      console.log('🗺️ Waypoints OSRM:', fullWaypoints);
      
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${fullWaypoints}?overview=full&geometries=geojson&steps=true`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCompleteOptimizedRoute(coordinates);
        
        console.log('✅ ROTA OTIMIZADA CALCULADA!');
        console.log(`📏 Distância total: ${(data.routes[0].distance / 1000).toFixed(2)} km`);
        console.log(`⏱️ Tempo estimado: ${Math.round(data.routes[0].duration / 60)} minutos`);
        
        return data.routes[0];
      } else {
        console.error('❌ Nenhuma rota encontrada:', data);
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota otimizada:', error);
    }
    return null;
  };

  // ✅ CALCULAR ROTA ATUAL (da posição atual para próxima parada)
  const calculateCurrentRoute = async (from: {lat: number, lng: number}, to: {lat: number, lng: number}) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCurrentRouteCoordinates(coordinates);
        return data.routes[0];
      }
    } catch (error) {
      console.error('Erro ao calcular rota atual:', error);
    }
    return null;
  };

  // ✅ CALCULAR ROTA COMPLETA NA INICIALIZAÇÃO
  useEffect(() => {
    if (points.length > 0) {
      calculateCompleteOptimizedRoute();
    }
  }, [points, currentLocation]);

  // ✅ INICIAR NAVEGAÇÃO (seguindo ordem otimizada)
  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStopIndex(0);
    
    // ✅ CALCULAR ROTA PARA PRIMEIRA PARADA NA SEQUÊNCIA OTIMIZADA
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    if (currentLocation && orderedPoints[0]) {
      calculateCurrentRoute(currentLocation, orderedPoints[0]);
    }
  };

  // ✅ PRÓXIMA PARADA (seguindo sequência otimizada)
  const nextStop = () => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    
    if (currentStopIndex < orderedPoints.length - 1) {
      const newIndex = currentStopIndex + 1;
      setCurrentStopIndex(newIndex);
      
      // ✅ MARCAR PARADA ATUAL COMO CONCLUÍDA
      if (onStopCompleted) {
        onStopCompleted(orderedPoints[currentStopIndex].id);
      }

      // ✅ CALCULAR ROTA PARA PRÓXIMA PARADA NA SEQUÊNCIA
      if (currentLocation && orderedPoints[newIndex]) {
        calculateCurrentRoute(currentLocation, orderedPoints[newIndex]);
      }
    } else {
      // ✅ NAVEGAÇÃO CONCLUÍDA
      setIsNavigating(false);
      alert('🎉 Navegação concluída! Todas as entregas foram realizadas.');
    }
  };

  // ✅ NAVEGAR DIRETAMENTE PARA UMA PARADA (respeitando ordem otimizada)
  const navigateToStop = (index: number) => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    setCurrentStopIndex(index);
    
    if (currentLocation && orderedPoints[index]) {
      calculateCurrentRoute(currentLocation, orderedPoints[index]);
    }
  };

  const currentStop = points[currentStopIndex];
  const center = currentLocation || { lat: -18.9203, lng: -48.2782 };

  return (
    <div className="h-screen flex flex-col">
      {/* ✅ PAINEL DE CONTROLE */}
      <div className="bg-blue-600 text-white p-4 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold">🚚 Navegação Carteiro</h2>
            <p className="text-blue-100">
              Parada {currentStopIndex + 1} de {points.length}
            </p>
          </div>
          <div className="flex gap-2">
            {!isNavigating ? (
              <button
                onClick={startNavigation}
                className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-bold"
              >
                🚀 Iniciar Navegação
              </button>
            ) : (
              <>
                <button
                  onClick={nextStop}
                  disabled={currentStopIndex >= points.length - 1}
                  className="bg-orange-500 hover:bg-orange-600 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                >
                  ✅ Próxima Parada
                </button>
                <button
                  onClick={() => setIsNavigating(false)}
                  className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg font-bold"
                >
                  ⏹️ Parar
                </button>
              </>
            )}
          </div>
        </div>

        {/* ✅ INFO DA PARADA ATUAL */}
        {isNavigating && (
          <div className="mt-3 bg-blue-700 p-3 rounded-lg">
            <h3 className="font-bold text-lg">📍 Parada Atual (Rota Otimizada):</h3>
            {(() => {
              const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
              const currentStop = orderedPoints[currentStopIndex];
              return currentStop ? (
                <>
                  <p className="text-blue-100">{currentStop.address}</p>
                  <p className="text-sm text-blue-200">
                    Sequência: {currentStopIndex + 1}º de {points.length} paradas | ID: {currentStop.id}
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    ✅ Seguindo ordem otimizada por proximidade geográfica
                  </p>
                </>
              ) : (
                <p className="text-blue-100">Calculando próxima parada...</p>
              );
            })()}
          </div>
        )}

        {/* ✅ INFO DA ROTA COMPLETA */}
        {!isNavigating && completeOptimizedRoute.length > 0 && (
          <div className="mt-3 bg-green-700 p-3 rounded-lg">
            <h3 className="font-bold text-lg">🗺️ Rota Otimizada Calculada:</h3>
            <p className="text-green-100">
              ✅ {points.length} paradas ordenadas por proximidade geográfica
            </p>
            <p className="text-sm text-green-200">
              📍 Linha pontilhada azul = rota completa otimizada
            </p>
          </div>
        )}
      </div>

      {/* ✅ MAPA PRINCIPAL */}
      <div className="flex-1 relative">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={15}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          />

          {/* ✅ LOCALIZAÇÃO ATUAL */}
          {currentLocation && (
            <Marker position={[currentLocation.lat, currentLocation.lng]}>
              <Popup>📍 Sua Localização</Popup>
            </Marker>
          )}

          {/* ✅ PONTOS DE ENTREGA (ordenados por sequência) */}
          {[...points].sort((a, b) => a.sequence - b.sequence).map((point, index) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              eventHandlers={{
                click: () => navigateToStop(index)
              }}
            >
              <Popup>
                <div className="text-center">
                  <h4 className="font-bold">
                    {index === currentStopIndex ? '🎯' : index < currentStopIndex ? '✅' : '⏳'} 
                    Parada {point.sequence}
                  </h4>
                  <p className="text-sm">{point.address}</p>
                  <p className="text-xs text-gray-500">ID: {point.id}</p>
                  <button
                    onClick={() => navigateToStop(index)}
                    className={`mt-2 px-3 py-1 rounded text-sm ${
                      index === currentStopIndex 
                        ? 'bg-blue-500 text-white' 
                        : index < currentStopIndex 
                        ? 'bg-green-500 text-white' 
                        : 'bg-gray-500 text-white'
                    }`}
                  >
                    {index === currentStopIndex ? '🎯 Parada Atual' : index < currentStopIndex ? '✅ Concluído' : '🧭 Navegar'}
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ✅ ROTA OTIMIZADA COMPLETA (em azul claro) */}
          {completeOptimizedRoute.length > 0 && (
            <Polyline
              positions={completeOptimizedRoute}
              color="lightblue"
              weight={3}
              opacity={0.6}
              dashArray="5, 10"
            />
          )}

          {/* ✅ ROTA ATUAL (da posição para próxima parada - em azul escuro) */}
          {currentRouteCoordinates.length > 0 && (
            <Polyline
              positions={currentRouteCoordinates}
              color="darkblue"
              weight={5}
              opacity={0.9}
            />
          )}
        </MapContainer>
      </div>

      {/* ✅ LISTA DE PARADAS (ordenada pela sequência otimizada) */}
      <div className="bg-white border-t p-4 max-h-48 overflow-y-auto">
        <h3 className="font-bold mb-2">📋 Rota Otimizada (Sequência de Entrega):</h3>
        <div className="space-y-2">
          {[...points].sort((a, b) => a.sequence - b.sequence).map((point, index) => (
            <div
              key={point.id}
              className={`p-2 rounded-lg border cursor-pointer ${
                index === currentStopIndex
                  ? 'bg-blue-100 border-blue-500'
                  : index < currentStopIndex
                  ? 'bg-green-100 border-green-500'
                  : 'bg-gray-50 border-gray-300'
              }`}
              onClick={() => navigateToStop(index)}
            >
              <div className="flex justify-between items-center">
                <span className="font-medium">
                  {index < currentStopIndex ? '✅' : index === currentStopIndex ? '🎯' : '⏳'} 
                  {index + 1}º → {point.address}
                </span>
                <span className="text-sm text-gray-500">#{point.sequence}</span>
              </div>
              {index === currentStopIndex && (
                <div className="mt-1 text-xs text-blue-600">
                  📍 Próxima entrega na sequência otimizada
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
