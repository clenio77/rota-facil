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

interface CustomNavigatorProps {
  points: NavigationPoint[];
  userLocation?: { lat: number; lng: number };
  onStopCompleted?: (stopId: string) => void;
}

export default function CustomNavigatorSidebar({ points, userLocation, onStopCompleted }: CustomNavigatorProps) {
  // ✅ CSS MOBILE FIX - Adicionar viewport meta se necessário
  React.useEffect(() => {
    // Garantir que viewport está configurado para mobile
    let viewportMeta = document.querySelector('meta[name="viewport"]');
    if (!viewportMeta) {
      viewportMeta = document.createElement('meta');
      viewportMeta.setAttribute('name', 'viewport');
      document.head.appendChild(viewportMeta);
    }
    viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no');
  }, []);
  const [currentStopIndex, setCurrentStopIndex] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentRouteCoordinates, setCurrentRouteCoordinates] = useState<[number, number][]>([]);
  const [completeOptimizedRoute, setCompleteOptimizedRoute] = useState<[number, number][]>([]);
  const [currentLocation, setCurrentLocation] = useState(userLocation);
  
  // ✅ ESTADOS PARA SIDEBAR MENU
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedStop, setSelectedStop] = useState<NavigationPoint | null>(null);
  const [completedStops, setCompletedStops] = useState<Set<string>>(new Set());

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
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, []);

  // ✅ CALCULAR ROTA OTIMIZADA COMPLETA AO INICIALIZAR
  useEffect(() => {
    if (points.length > 0) {
      calculateCompleteOptimizedRoute();
    }
  }, [points]);

  // ✅ FUNÇÃO: Calcular rota otimizada completa
  const calculateCompleteOptimizedRoute = async () => {
    if (!currentLocation || points.length === 0) return;

    try {
      const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
      const waypoints = [
        [currentLocation.lng, currentLocation.lat], // Início
        ...orderedPoints.map(p => [p.lng, p.lat]),   // Todas as paradas
        [currentLocation.lng, currentLocation.lat]   // Retorno
      ];

      const waypointsStr = waypoints.map(p => p.join(',')).join(';');
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${waypointsStr}?overview=full&geometries=geojson`;

      console.log('🗺️ Calculando rota otimizada completa:', osrmUrl);

      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCompleteOptimizedRoute(coordinates);
        console.log('✅ Rota otimizada completa calculada:', coordinates.length, 'pontos');
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota otimizada completa:', error);
    }
  };

  // ✅ FUNÇÃO: Calcular rota atual entre dois pontos
  const calculateCurrentRoute = async (from: {lat: number; lng: number}, to: {lat: number; lng: number}) => {
    try {
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      
      console.log('🧭 Calculando rota atual:', `${from.lat},${from.lng} → ${to.lat},${to.lng}`);
      console.log('🔗 URL OSRM:', osrmUrl);

      const response = await fetch(osrmUrl);
      const data = await response.json();

      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCurrentRouteCoordinates(coordinates);
        console.log('✅ Rota atual calculada:', coordinates.length, 'pontos');
      } else {
        console.log('⚠️ OSRM não retornou rota, usando linha direta');
        setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
      }
    } catch (error) {
      console.error('❌ Erro OSRM, usando linha direta:', error);
      setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
    }
  };

  // ✅ INICIAR NAVEGAÇÃO
  const startNavigation = () => {
    setIsNavigating(true);
    
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    setCurrentStopIndex(0);
    
    if (currentLocation && orderedPoints[0]) {
      console.log(`🧭 Calculando rota: ${currentLocation.lat},${currentLocation.lng} → ${orderedPoints[0].lat},${orderedPoints[0].lng}`);
      calculateCurrentRoute(currentLocation, orderedPoints[0]);
    }
  };

  // ✅ PRÓXIMA PARADA (seguindo sequência otimizada)
  const nextStop = () => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    
    if (currentStopIndex < orderedPoints.length - 1) {
      const currentPoint = orderedPoints[currentStopIndex];
      const newIndex = currentStopIndex + 1;
      const nextPoint = orderedPoints[newIndex];
      
      console.log('➡️ AVANÇANDO PARA PRÓXIMA PARADA...');
      console.log(`📍 Da parada atual: ${currentPoint.address} (${currentPoint.lat}, ${currentPoint.lng})`);
      console.log(`📍 Para próxima parada: ${nextPoint.address} (${nextPoint.lat}, ${nextPoint.lng})`);
      
      setCurrentStopIndex(newIndex);
      
      // ✅ MARCAR PARADA ATUAL COMO CONCLUÍDA
      setCompletedStops(prev => new Set([...prev, currentPoint.id]));
      if (onStopCompleted) {
        onStopCompleted(currentPoint.id);
      }

      // ✅ CALCULAR ROTA DA PARADA ATUAL PARA A PRÓXIMA
      calculateCurrentRoute(
        { lat: currentPoint.lat, lng: currentPoint.lng }, 
        { lat: nextPoint.lat, lng: nextPoint.lng }
      );
    } else {
      // ✅ ÚLTIMA ENTREGA CONCLUÍDA - RETORNAR AO PONTO INICIAL
      const lastPoint = orderedPoints[currentStopIndex];
      
      console.log('🏁 ÚLTIMA ENTREGA CONCLUÍDA - RETORNANDO AO PONTO INICIAL...');
      console.log(`📍 Da última parada: ${lastPoint.address} (${lastPoint.lat}, ${lastPoint.lng})`);
      console.log(`📍 Para ponto inicial: (${currentLocation?.lat}, ${currentLocation?.lng})`);
      
      // ✅ MARCAR ÚLTIMA PARADA COMO CONCLUÍDA
      setCompletedStops(prev => new Set([...prev, lastPoint.id]));
      if (onStopCompleted) {
        onStopCompleted(lastPoint.id);
      }
      
      if (currentLocation) {
        // ✅ CALCULAR ROTA DE RETORNO AO PONTO INICIAL
        calculateCurrentRoute(
          { lat: lastPoint.lat, lng: lastPoint.lng }, 
          { lat: currentLocation.lat, lng: currentLocation.lng }
        );
        
        // ✅ MARCAR COMO RETORNO AO INÍCIO
        setCurrentStopIndex(-1); // -1 indica retorno ao início
        
        alert('🏁 Última entrega concluída! Retornando ao ponto de partida...');
      } else {
        // ✅ SEM LOCALIZAÇÃO INICIAL - FINALIZAR
        setIsNavigating(false);
        alert('🎉 Navegação concluída! Todas as entregas foram realizadas.');
      }
    }
  };

  // ✅ NAVEGAR DIRETAMENTE PARA UMA PARADA (respeitando ordem otimizada)
  const navigateToStop = (index: number) => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    const targetPoint = orderedPoints[index];
    
    console.log('🎯 NAVEGAÇÃO DIRETA PARA PARADA...');
    console.log(`📍 Destino: ${targetPoint.address} (${targetPoint.lat}, ${targetPoint.lng})`);
    
    setCurrentStopIndex(index);
    
    // ✅ DECIDIR ORIGEM DA ROTA
    if (index === 0) {
      // ✅ PRIMEIRA PARADA: usar localização atual
      if (currentLocation && targetPoint) {
        console.log(`🚀 Primeira parada: de localização atual para ${targetPoint.address}`);
        calculateCurrentRoute(currentLocation, targetPoint);
      }
    } else {
      // ✅ OUTRAS PARADAS: usar parada anterior
      const previousPoint = orderedPoints[index - 1];
      console.log(`🔄 Parada ${index + 1}: de ${previousPoint.address} para ${targetPoint.address}`);
      calculateCurrentRoute(
        { lat: previousPoint.lat, lng: previousPoint.lng },
        { lat: targetPoint.lat, lng: targetPoint.lng }
      );
    }
  };

  // ✅ CRIAR ÍCONES CUSTOMIZADOS PARA MARCADORES
  const createCustomIcon = (sequence: number, isCompleted: boolean, isCurrent: boolean) => {
    const color = isCurrent ? '#f97316' : isCompleted ? '#22c55e' : '#3b82f6'; // orange, green, blue
    const bgColor = isCurrent ? '#fed7aa' : isCompleted ? '#dcfce7' : '#dbeafe';
    
    return L.divIcon({
      html: `
        <div style="
          background-color: ${color};
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          border: 3px solid ${bgColor};
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        ">
          ${isCurrent ? '🎯' : isCompleted ? '✅' : sequence}
        </div>
      `,
      className: 'custom-div-icon',
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });
  };

  const createUserLocationIcon = () => {
    return L.divIcon({
      html: `
        <div style="
          background-color: #dc2626;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 12px;
          border: 3px solid #fef2f2;
          box-shadow: 0 0 0 3px rgba(220, 38, 38, 0.3);
          animation: pulse 2s infinite;
        ">
          📍
        </div>
      `,
      className: 'user-location-icon',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  return (
    <div className="h-screen w-full bg-gray-100 relative flex overflow-hidden">
      {/* ✅ SIDEBAR MENU - PARADAS E OBJETOS */}
      <div className={`fixed top-0 left-0 h-full bg-white shadow-2xl transition-transform duration-300 z-50 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      } w-80 md:w-96 max-w-full`}>
        {/* Header do Sidebar */}
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">📋 Lista de Entregas</h3>
            <p className="text-blue-100 text-sm">
              {completedStops.size} de {points.length} concluídas
            </p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Lista de Paradas */}
        <div className="overflow-y-auto h-full pb-20">
          {[...points].sort((a, b) => a.sequence - b.sequence).map((stop, index) => {
            const isCompleted = completedStops.has(stop.id);
            const isCurrent = index === currentStopIndex && isNavigating;
            
            return (
              <div
                key={stop.id}
                className={`p-4 border-b cursor-pointer transition-colors ${
                  isCurrent ? 'bg-orange-100 border-orange-200' :
                  isCompleted ? 'bg-green-50 border-green-200' :
                  'bg-white hover:bg-gray-50'
                }`}
                onClick={() => setSelectedStop(selectedStop?.id === stop.id ? null : stop)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      isCurrent ? 'bg-orange-500 text-white' :
                      isCompleted ? 'bg-green-500 text-white' :
                      'bg-gray-300 text-gray-700'
                    }`}>
                      {isCurrent ? '🎯' : isCompleted ? '✅' : stop.sequence}
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-gray-800">
                        {stop.address}
                      </p>
                      <p className="text-xs text-gray-500">
                        {stop.objectCode || stop.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded ${
                      isCurrent ? 'bg-orange-200 text-orange-800' :
                      isCompleted ? 'bg-green-200 text-green-800' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {isCurrent ? 'Atual' : isCompleted ? 'Concluída' : 'Pendente'}
                    </div>
                  </div>
                </div>

                {/* Detalhes Expandidos */}
                {selectedStop?.id === stop.id && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <div className="text-xs space-y-1">
                      <p><strong>📍 Coordenadas:</strong> {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}</p>
                      <p><strong>🏘️ Região:</strong> {stop.region || 'Não definida'}</p>
                      <p><strong>📦 Objeto ECT:</strong> {stop.objectCode || stop.id}</p>
                      <p><strong>📍 Sequência:</strong> {stop.sequence}º de {points.length}</p>
                    </div>
                    {isNavigating && !isCompleted && index !== currentStopIndex && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigateToStop(index);
                          setSidebarOpen(false);
                        }}
                        className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs"
                      >
                        🧭 Navegar Aqui
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ✅ OVERLAY PARA FECHAR SIDEBAR NO MOBILE */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ✅ ÁREA PRINCIPAL - MAPA E CONTROLES */}
      <div className="flex-1 flex flex-col">
        {/* Header Principal - SEMPRE VISÍVEL NO MOBILE */}
        <div className="sticky top-0 bg-blue-600 text-white p-3 shadow-lg flex justify-between items-center z-30 w-full">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg touch-manipulation"
              style={{
                minWidth: '44px',
                minHeight: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                WebkitTapHighlightColor: 'transparent'
              }}
            >
              📋
            </button>
            <div>
              <h2 className="text-lg font-bold">🚚 Navegação Carteiro</h2>
              <p className="text-blue-100 text-sm">
                {isNavigating ? `Parada ${currentStopIndex + 1} de ${points.length}` : 'Pronto para navegar'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {!isNavigating ? (
              <button
                onClick={startNavigation}
                className="bg-green-500 hover:bg-green-600 px-3 py-2 rounded-lg font-bold text-sm touch-manipulation"
                style={{
                  minWidth: '80px',
                  minHeight: '44px',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                🚀 Iniciar
              </button>
            ) : (
              <>
                <button
                  onClick={nextStop}
                  disabled={currentStopIndex >= points.length - 1}
                  className="bg-orange-500 hover:bg-orange-600 px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50 touch-manipulation"
                  style={{
                    minWidth: '80px',
                    minHeight: '44px',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  ✅ Próxima
                </button>
                <button
                  onClick={() => setIsNavigating(false)}
                  className="bg-red-500 hover:bg-red-600 px-3 py-2 rounded-lg font-bold text-sm touch-manipulation"
                  style={{
                    minWidth: '70px',
                    minHeight: '44px',
                    WebkitTapHighlightColor: 'transparent'
                  }}
                >
                  ⏹️ Parar
                </button>
              </>
            )}
          </div>
        </div>

        {/* INFO DA PARADA ATUAL - COMPACTO */}
        {isNavigating && (
          <div className="bg-blue-700 text-white p-3 w-full">
            {(() => {
              const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
              
              // ✅ DETECTAR SE ESTÁ RETORNANDO AO PONTO INICIAL
              if (currentStopIndex === -1) {
                return (
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-bold">🏁 Retornando ao Ponto de Partida</p>
                      <p className="text-blue-100 text-sm">Todas as entregas concluídas!</p>
                    </div>
                    <button
                      onClick={() => {
                        setIsNavigating(false);
                        setCurrentStopIndex(0);
                        alert('🎉 Navegação TOTALMENTE concluída! Você retornou ao ponto de partida.');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm font-bold"
                    >
                      ✅ Cheguei
                    </button>
                  </div>
                );
              }
              
              const currentStop = orderedPoints[currentStopIndex];
              return currentStop ? (
                <div>
                  <p className="font-bold">{currentStop.address}</p>
                  <p className="text-blue-100 text-sm">
                    {currentStop.objectCode || currentStop.id} • Sequência {currentStopIndex + 1}
                  </p>
                </div>
              ) : (
                <p>Carregando...</p>
              );
            })()}
          </div>
        )}

        {/* ✅ MAPA PRINCIPAL - OCUPA ESPAÇO RESTANTE */}
        <div className="flex-1 relative">
          <MapContainer
            center={currentLocation ? [currentLocation.lat, currentLocation.lng] : [-18.9185, -48.2773]}
            zoom={15}
            style={{ height: '100%', width: '100%' }}
            zoomControl={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* ✅ MARCADOR DA LOCALIZAÇÃO DO USUÁRIO */}
            {currentLocation && (
              <Marker 
                position={[currentLocation.lat, currentLocation.lng]} 
                icon={createUserLocationIcon()}
              >
                <Popup>
                  <div className="text-center">
                    <h3 className="font-bold text-red-600">📍 Sua Localização</h3>
                    <p className="text-sm">GPS: {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}</p>
                    <p className="text-xs text-gray-600 mt-1">🎯 Ponto de partida e retorno</p>
                  </div>
                </Popup>
              </Marker>
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
                      <h3 className="font-bold text-blue-600">
                        {isCurrent ? '🎯 Parada Atual' : isCompleted ? '✅ Concluída' : `📍 Parada ${point.sequence}`}
                      </h3>
                      <p className="text-sm font-semibold">{point.address}</p>
                      <p className="text-xs text-gray-600">📦 {point.objectCode || point.id}</p>
                      <p className="text-xs text-gray-500">📍 {point.lat.toFixed(6)}, {point.lng.toFixed(6)}</p>
                      {isNavigating && !isCompleted && index !== currentStopIndex && (
                        <button
                          onClick={() => navigateToStop(index)}
                          className="mt-2 bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs"
                        >
                          🧭 Navegar Aqui
                        </button>
                      )}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* ✅ ROTA OTIMIZADA COMPLETA (linha tracejada azul clara) */}
            {completeOptimizedRoute.length > 0 && (
              <Polyline 
                positions={completeOptimizedRoute}
                color="#60a5fa"
                weight={3}
                opacity={0.7}
                dashArray="10,10"
              />
            )}

            {/* ✅ ROTA ATUAL (linha sólida azul escura) */}
            {currentRouteCoordinates.length > 0 && (
              <Polyline 
                positions={currentRouteCoordinates}
                color="#1e40af"
                weight={5}
                opacity={0.9}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
