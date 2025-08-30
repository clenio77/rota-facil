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
      console.log('📍 Total de pontos:', points.length);
      console.log('📍 Pontos ordenados:', points.map(p => `${p.sequence}. ${p.address} (${p.lat}, ${p.lng})`));
      
      // ✅ CRIAR SEQUÊNCIA DE COORDENADAS NA ORDEM OTIMIZADA
      const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
      const waypoints = orderedPoints.map(p => `${p.lng},${p.lat}`).join(';');
      
      // ✅ INCLUIR LOCALIZAÇÃO ATUAL COMO PONTO DE PARTIDA
      const startPoint = currentLocation || { lat: -18.9203, lng: -48.2782 };
      const fullWaypoints = `${startPoint.lng},${startPoint.lat};${waypoints}`;
      
      console.log('🗺️ Waypoints OSRM completo:', fullWaypoints);
      console.log('🗺️ Total de waypoints:', fullWaypoints.split(';').length);
      
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${fullWaypoints}?overview=full&geometries=geojson&steps=true`;
      console.log('🌐 URL OSRM:', osrmUrl);
      
      const response = await fetch(osrmUrl);
      console.log('📡 Resposta OSRM status:', response.status);
      
      const data = await response.json();
      console.log('📄 Resposta OSRM completa:', data);
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        console.log('🗺️ Coordenadas da rota calculadas:', coordinates.length, 'pontos');
        console.log('🗺️ Primeiras 5 coordenadas:', coordinates.slice(0, 5));
        
        setCompleteOptimizedRoute(coordinates);
        
        console.log('✅ ROTA OTIMIZADA CALCULADA!');
        console.log(`📏 Distância total: ${(data.routes[0].distance / 1000).toFixed(2)} km`);
        console.log(`⏱️ Tempo estimado: ${Math.round(data.routes[0].duration / 60)} minutos`);
        
        return data.routes[0];
      } else {
        console.error('❌ Nenhuma rota encontrada:', data);
        console.error('❌ Código de erro OSRM:', data.code);
        console.error('❌ Mensagem de erro OSRM:', data.message);
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota otimizada:', error);
    }
    return null;
  };

  // ✅ CALCULAR ROTA ATUAL (da posição atual para próxima parada)
  const calculateCurrentRoute = async (from: {lat: number, lng: number}, to: {lat: number, lng: number}) => {
    try {
      console.log('🗺️ CALCULANDO ROTA ATUAL...');
      console.log(`📍 De: ${from.lat}, ${from.lng}`);
      console.log(`📍 Para: ${to.lat}, ${to.lng}`);
      
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      console.log('🌐 URL OSRM atual:', osrmUrl);
      
      const response = await fetch(osrmUrl);
      const data = await response.json();
      
      console.log('📄 Resposta OSRM rota atual:', data);
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        console.log('🗺️ Coordenadas da rota atual:', coordinates.length, 'pontos');
        console.log('🗺️ Primeiras 3 coordenadas da rota atual:', coordinates.slice(0, 3));
        
        setCurrentRouteCoordinates(coordinates);
        return data.routes[0];
      } else {
        console.error('❌ Nenhuma rota atual encontrada');
      }
    } catch (error) {
      console.error('❌ Erro ao calcular rota atual:', error);
    }
    return null;
  };

  // ✅ FALLBACK: LINHA DIRETA ENTRE PONTOS (se OSRM falhar)
  const createFallbackRoute = () => {
    console.log('🔄 CRIANDO ROTA FALLBACK (linha direta)...');
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    const startPoint = currentLocation || { lat: -18.9203, lng: -48.2782 };
    
    // ✅ CONECTAR: localização atual → todos os pontos em sequência
    const fallbackCoordinates: [number, number][] = [
      [startPoint.lat, startPoint.lng],
      ...orderedPoints.map(p => [p.lat, p.lng] as [number, number])
    ];
    
    console.log('📍 Rota fallback criada com', fallbackCoordinates.length, 'pontos');
    setCompleteOptimizedRoute(fallbackCoordinates);
  };

  // ✅ CALCULAR ROTA COMPLETA NA INICIALIZAÇÃO
  useEffect(() => {
    if (points.length > 0) {
      // ✅ TENTAR OSRM PRIMEIRO, FALLBACK SE FALHAR
      calculateCompleteOptimizedRoute().then(result => {
        if (!result) {
          console.log('⚠️ OSRM falhou, usando rota fallback...');
          setTimeout(() => createFallbackRoute(), 2000); // 2 segundos de delay
        }
      });
    }
  }, [points, currentLocation]);

  // ✅ INICIAR NAVEGAÇÃO (seguindo ordem otimizada)
  const startNavigation = () => {
    console.log('🚀 INICIANDO NAVEGAÇÃO...');
    console.log('📍 Localização atual:', currentLocation);
    console.log('📍 Pontos recebidos:', points.map(p => `${p.sequence}. ${p.address} (${p.lat}, ${p.lng})`));
    
    setIsNavigating(true);
    setCurrentStopIndex(0);
    
    // ✅ CALCULAR ROTA PARA PRIMEIRA PARADA NA SEQUÊNCIA OTIMIZADA
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    console.log('📍 Primeira parada ordenada:', orderedPoints[0]);
    
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
      if (onStopCompleted) {
        onStopCompleted(currentPoint.id);
      }

      // ✅ CALCULAR ROTA DA PARADA ATUAL PARA A PRÓXIMA (NÃO DA LOCALIZAÇÃO INICIAL!)
      calculateCurrentRoute(
        { lat: currentPoint.lat, lng: currentPoint.lng }, 
        { lat: nextPoint.lat, lng: nextPoint.lng }
      );
    } else {
      // ✅ NAVEGAÇÃO CONCLUÍDA
      setIsNavigating(false);
      alert('🎉 Navegação concluída! Todas as entregas foram realizadas.');
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
      // ✅ PARADAS SUBSEQUENTES: da parada anterior para esta
      const previousPoint = orderedPoints[index - 1];
      console.log(`➡️ Parada ${index + 1}: de ${previousPoint.address} para ${targetPoint.address}`);
      calculateCurrentRoute(
        { lat: previousPoint.lat, lng: previousPoint.lng }, 
        { lat: targetPoint.lat, lng: targetPoint.lng }
      );
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
              
              // ✅ DEBUG: Log da parada atual
              console.log('🎯 DEBUG Parada Atual:', {
                currentStopIndex,
                currentStop,
                totalPoints: points.length,
                orderedPoints: orderedPoints.map(p => `${p.sequence}. ${p.address}`)
              });
              
              return currentStop ? (
                <>
                  <p className="text-blue-100">{currentStop.address}</p>
                  <p className="text-sm text-blue-200">
                    Sequência: {currentStopIndex + 1}º de {points.length} paradas | ID: {currentStop.id}
                  </p>
                  <p className="text-xs text-blue-300 mt-1">
                    ✅ Coordenadas: {currentStop.lat}, {currentStop.lng}
                  </p>
                  <p className="text-xs text-blue-300">
                    ✅ Seguindo ordem otimizada por proximidade geográfica
                  </p>
                  {/* ✅ MOSTRAR ORIGEM E DESTINO DA ROTA ATUAL */}
                  {currentStopIndex > 0 && (
                    <div className="mt-2 p-2 bg-blue-800 rounded">
                      <p className="text-xs text-blue-200">
                        🧭 <strong>Rota atual:</strong><br/>
                        📍 <strong>De:</strong> {orderedPoints[currentStopIndex - 1]?.address || 'Localização atual'}<br/>
                        🎯 <strong>Para:</strong> {currentStop.address}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-blue-100">Calculando próxima parada...</p>
              );
            })()}
          </div>
        )}

        {/* ✅ INFO DA ROTA COMPLETA */}
        {!isNavigating && (
          <div className={`mt-3 p-3 rounded-lg ${
            completeOptimizedRoute.length > 0 ? 'bg-green-700' : 'bg-orange-700'
          }`}>
            <h3 className="font-bold text-lg">
              {completeOptimizedRoute.length > 0 ? '🗺️ Rota Otimizada Calculada:' : '⏳ Calculando Rota...'}
            </h3>
            {completeOptimizedRoute.length > 0 ? (
              <>
                <p className="text-green-100">
                  ✅ {points.length} paradas ordenadas por proximidade geográfica
                </p>
                <p className="text-sm text-green-200">
                  📍 Linha pontilhada azul = rota completa otimizada ({completeOptimizedRoute.length} pontos)
                </p>
              </>
            ) : (
              <>
                <p className="text-orange-100">
                  🔄 Conectando {points.length} paradas via OSRM...
                </p>
                <p className="text-sm text-orange-200">
                  ⚠️ Se demorar muito, verifique o console (F12)
                </p>
              </>
            )}
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
          {currentLocation && (() => {
            // ✅ CRIAR ÍCONE PERSONALIZADO PARA LOCALIZAÇÃO ATUAL
            const userLocationIcon = L.divIcon({
              html: `
                <div style="
                  background: #EF4444;
                  color: white;
                  border-radius: 50%;
                  width: 35px;
                  height: 35px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 16px;
                  border: 3px solid white;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                  animation: pulse 2s infinite;
                ">
                  📍
                </div>
                <style>
                  @keyframes pulse {
                    0% { transform: scale(1); }
                    50% { transform: scale(1.1); }
                    100% { transform: scale(1); }
                  }
                </style>
              `,
              className: 'user-location-marker',
              iconSize: [35, 35],
              iconAnchor: [17.5, 17.5]
            });

            return (
              <Marker 
                position={[currentLocation.lat, currentLocation.lng]}
                icon={userLocationIcon}
              >
                <Popup maxWidth={300}>
                  <div className="p-2">
                    {/* ✅ CABEÇALHO */}
                    <div className="text-center p-2 rounded-t mb-2 bg-red-100 text-red-800">
                      <h4 className="font-bold text-lg">
                        📍 SUA LOCALIZAÇÃO
                      </h4>
                      <p className="text-sm">
                        Ponto de partida da rota
                      </p>
                    </div>

                    {/* ✅ COORDENADAS ATUAIS */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">🌍 Coordenadas GPS:</h5>
                      <p className="text-sm font-mono bg-gray-100 p-2 rounded">
                        {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        📍 {(() => {
                          // ✅ DETECTAR REGIÃO BASEADA NAS COORDENADAS
                          const lat = currentLocation.lat;
                          const lng = currentLocation.lng;
                          
                          if (lat >= -19.0 && lat <= -18.8 && lng >= -48.4 && lng <= -48.2) {
                            return "Uberlândia, MG";
                          } else if (lat >= -19.95 && lat <= -19.85 && lng >= -43.95 && lng <= -43.85) {
                            return "Belo Horizonte, MG";
                          } else if (lat >= -23.6 && lat <= -23.4 && lng >= -46.8 && lng <= -46.6) {
                            return "São Paulo, SP";
                          } else {
                            return "Brasil";
                          }
                        })()}
                      </p>
                    </div>

                    {/* ✅ STATUS DA NAVEGAÇÃO */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">🚚 Status:</h5>
                      <p className="text-sm bg-blue-50 p-2 rounded border-l-4 border-blue-400">
                        {isNavigating ? (
                          <>🎯 <strong>Navegando</strong> - Rota ativa para {points.length} paradas</>
                        ) : (
                          <>⏳ <strong>Aguardando</strong> - Clique "Iniciar Navegação" para começar</>
                        )}
                      </p>
                    </div>

                    {/* ✅ INFORMAÇÕES DA ROTA */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">📋 Rota Otimizada:</h5>
                      <div className="text-xs bg-green-50 p-2 rounded">
                        <p>📦 <strong>{points.length} entregas</strong> programadas</p>
                        <p>🧭 Sequência otimizada por proximidade</p>
                        <p>📍 {isNavigating ? `Parada atual: ${currentStopIndex + 1}/${points.length}` : 'Aguardando início'}</p>
                      </div>
                    </div>

                    {/* ✅ AÇÃO */}
                    <div className="text-center">
                      {!isNavigating ? (
                        <button
                          onClick={startNavigation}
                          className="bg-green-500 text-white px-4 py-2 rounded font-bold hover:bg-green-600"
                        >
                          🚀 Iniciar Navegação
                        </button>
                      ) : (
                        <button
                          onClick={() => setIsNavigating(false)}
                          className="bg-red-500 text-white px-4 py-2 rounded font-bold hover:bg-red-600"
                        >
                          ⏹️ Parar Navegação
                        </button>
                      )}
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })()}

          {/* ✅ PONTOS DE ENTREGA (ordenados por sequência) */}
          {[...points].sort((a, b) => a.sequence - b.sequence).map((point, index) => {
            // ✅ DETERMINAR STATUS E COR DO MARCADOR
            const isCurrent = index === currentStopIndex;
            const isCompleted = index < currentStopIndex;
            const isPending = index > currentStopIndex;
            
            // ✅ CRIAR ÍCONE PERSONALIZADO
            const customIcon = L.divIcon({
              html: `
                <div style="
                  background: ${isCurrent ? '#3B82F6' : isCompleted ? '#10B981' : '#6B7280'};
                  color: white;
                  border-radius: 50%;
                  width: 30px;
                  height: 30px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-weight: bold;
                  font-size: 12px;
                  border: 2px solid white;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                ">
                  ${isCurrent ? '🎯' : isCompleted ? '✅' : index + 1}
                </div>
              `,
              className: 'custom-marker',
              iconSize: [30, 30],
              iconAnchor: [15, 15]
            });

            return (
              <Marker
                key={point.id}
                position={[point.lat, point.lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => navigateToStop(index)
                }}
              >
                <Popup maxWidth={300}>
                  <div className="p-2">
                    {/* ✅ CABEÇALHO COM STATUS */}
                    <div className={`text-center p-2 rounded-t mb-2 ${
                      isCurrent ? 'bg-blue-100 text-blue-800' : 
                      isCompleted ? 'bg-green-100 text-green-800' : 
                      'bg-gray-100 text-gray-800'
                    }`}>
                      <h4 className="font-bold text-lg">
                        {isCurrent ? '🎯 PARADA ATUAL' : isCompleted ? '✅ CONCLUÍDA' : '⏳ PENDENTE'}
                      </h4>
                      <p className="text-sm">
                        {index + 1}º de {points.length} paradas
                      </p>
                    </div>

                    {/* ✅ INFORMAÇÕES DO OBJETO ECT */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">📦 Objeto ECT:</h5>
                      <p className="font-mono text-sm bg-gray-100 p-2 rounded">
                        {point.id}
                      </p>
                    </div>

                    {/* ✅ ENDEREÇO COMPLETO */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">🏠 Endereço:</h5>
                      <p className="text-sm bg-yellow-50 p-2 rounded border-l-4 border-yellow-400">
                        {point.address}
                      </p>
                    </div>

                    {/* ✅ COORDENADAS */}
                    <div className="mb-3">
                      <h5 className="font-bold text-gray-700 mb-1">📍 Coordenadas:</h5>
                      <p className="text-xs text-gray-600 font-mono">
                        {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
                      </p>
                    </div>

                    {/* ✅ AÇÕES */}
                    <div className="text-center">
                      <button
                        onClick={() => navigateToStop(index)}
                        className={`px-4 py-2 rounded font-bold text-sm ${
                          isCurrent 
                            ? 'bg-blue-500 text-white hover:bg-blue-600' 
                            : isCompleted 
                            ? 'bg-green-500 text-white hover:bg-green-600' 
                            : 'bg-gray-500 text-white hover:bg-gray-600'
                        }`}
                      >
                        {isCurrent ? '🎯 Ver Rota Atual' : isCompleted ? '🔄 Revisar Entrega' : '🧭 Navegar Para Aqui'}
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* ✅ ROTA OTIMIZADA COMPLETA (em azul claro) */}
          {completeOptimizedRoute.length > 0 ? (
            <Polyline
              positions={completeOptimizedRoute}
              color="lightblue"
              weight={3}
              opacity={0.6}
              dashArray="5, 10"
            />
          ) : (
            // ✅ DEBUG: Mostrar que não há rota calculada
            console.log('⚠️ ROTA OTIMIZADA NÃO DISPONÍVEL:', completeOptimizedRoute.length)
          )}

          {/* ✅ ROTA ATUAL (da posição para próxima parada - em azul escuro) */}
          {currentRouteCoordinates.length > 0 ? (
            <Polyline
              positions={currentRouteCoordinates}
              color="darkblue"
              weight={5}
              opacity={0.9}
            />
          ) : (
            // ✅ DEBUG: Mostrar que não há rota atual
            console.log('⚠️ ROTA ATUAL NÃO DISPONÍVEL:', currentRouteCoordinates.length)
          )}
        </MapContainer>
      </div>

      {/* ✅ LISTA DE PARADAS (ordenada pela sequência otimizada) */}
      <div className="bg-white border-t p-4 max-h-48 overflow-y-auto">
        <h3 className="font-bold mb-2">📋 Rota Otimizada (Sequência de Entrega):</h3>
        <div className="space-y-2">
          {[...points].sort((a, b) => a.sequence - b.sequence).map((point, index) => {
            const isCurrent = index === currentStopIndex;
            const isCompleted = index < currentStopIndex;
            
            return (
              <div
                key={point.id}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-blue-100 border-blue-500 shadow-md'
                    : isCompleted
                    ? 'bg-green-100 border-green-500'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
                }`}
                onClick={() => navigateToStop(index)}
              >
                {/* ✅ LINHA PRINCIPAL */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">
                        {isCompleted ? '✅' : isCurrent ? '🎯' : '⏳'}
                      </span>
                      <span className="font-bold text-gray-800">
                        {index + 1}º Parada
                      </span>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        isCurrent ? 'bg-blue-500 text-white' :
                        isCompleted ? 'bg-green-500 text-white' :
                        'bg-gray-400 text-white'
                      }`}>
                        {isCurrent ? 'ATUAL' : isCompleted ? 'FEITO' : 'PENDENTE'}
                      </span>
                    </div>
                    
                    {/* ✅ ENDEREÇO */}
                    <p className="text-sm text-gray-700 mb-1">
                      🏠 {point.address}
                    </p>
                    
                    {/* ✅ OBJETO ECT */}
                    <p className="text-xs font-mono text-gray-600 bg-gray-200 px-2 py-1 rounded">
                      📦 {point.id}
                    </p>
                  </div>
                  
                  <div className="text-right text-xs text-gray-500">
                    <div>#{point.sequence}</div>
                    <div className="mt-1">
                      {point.lat.toFixed(4)}<br/>
                      {point.lng.toFixed(4)}
                    </div>
                  </div>
                </div>
                
                {/* ✅ INFO ADICIONAL PARA PARADA ATUAL */}
                {isCurrent && (
                  <div className="mt-2 pt-2 border-t border-blue-300">
                    <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">
                      📍 <strong>Próxima entrega na sequência otimizada</strong><br/>
                      🧭 Clique para ver detalhes da rota
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
