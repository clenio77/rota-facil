'use client'

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
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
  
  // 🧭 ESTADOS PARA NAVEGAÇÃO TURN-BY-TURN
  const [routeInstructions, setRouteInstructions] = useState<any[]>([]);
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0);
  const [distanceToNextManeuver, setDistanceToNextManeuver] = useState<number>(0);
  const [userHeading, setUserHeading] = useState<number>(0);
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  
  // 🗺️ ESTADOS PARA ZOOM DINÂMICO
  const [mapZoom, setMapZoom] = useState(14);
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [lastUserPosition, setLastUserPosition] = useState<{lat: number; lng: number} | null>(null);
  const [userSpeed, setUserSpeed] = useState<number>(0);

  // ✅ GPS EM TEMPO REAL COM ZOOM DINÂMICO
  useEffect(() => {
    if ('geolocation' in navigator) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          const newLocation = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setCurrentLocation(newLocation);
          
          // 🗺️ CALCULAR VELOCIDADE E ZOOM DINÂMICO
          if (lastUserPosition && isNavigating) {
            const distance = calculateDistance(
              lastUserPosition.lat, lastUserPosition.lng,
              newLocation.lat, newLocation.lng
            );
            const timeElapsed = 1; // assumindo 1 segundo entre updates
            const speed = (distance / timeElapsed) * 3.6; // converter para km/h
            setUserSpeed(speed);
            
            // 🗺️ AJUSTAR ZOOM BASEADO NA VELOCIDADE E PROXIMIDADE
            updateMapZoom(newLocation, speed);
          }
          
          setLastUserPosition(newLocation);
          
          // 🗺️ CENTRALIZAR MAPA NO USUÁRIO DURANTE NAVEGAÇÃO
          if (isNavigating && isFollowingUser) {
            setMapCenter([newLocation.lat, newLocation.lng]);
          }
          
          // 🧭 Atualizar orientação do usuário
          if (position.coords.heading !== null) {
            setUserHeading(position.coords.heading);
          }
          
          // 🧭 Calcular distância até próxima manobra
          if (isNavigating && routeInstructions.length > 0) {
            updateNavigationProgress(newLocation);
          }
        },
        (error) => console.error('Erro GPS:', error),
        { enableHighAccuracy: true, timeout: 20000, maximumAge: 1000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    }
  }, [isNavigating, routeInstructions, currentInstructionIndex, lastUserPosition, isFollowingUser]);

  // 🗺️ ZOOM INTELIGENTE ESTILO MAPS/WAZE
  const updateMapZoom = (userLocation: {lat: number; lng: number}, speed: number) => {
    let newZoom = 18; // zoom padrão mais próximo
    
    // 🚗 Zoom baseado na velocidade (mais agressivo)
    if (speed > 40) {
      newZoom = 16; // velocidade alta
    } else if (speed > 20) {
      newZoom = 17; // velocidade média
    } else if (speed > 5) {
      newZoom = 18; // velocidade baixa
    } else {
      newZoom = 19; // parado - máximo detalhe
    }
    
    // 🔄 Aplicar zoom suavemente apenas com mudanças significativas
    if (Math.abs(newZoom - mapZoom) >= 1) {
      setMapZoom(newZoom);
    }
  };

  // 🧭 FUNÇÃO PARA CALCULAR DISTÂNCIA ENTRE DOIS PONTOS (HAVERSINE)
  const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371e3; // raio da Terra em metros
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lng2-lng1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // distância em metros
  };

  // 🧭 ATUALIZAR PROGRESSO DA NAVEGAÇÃO
  const updateNavigationProgress = (userLocation: {lat: number; lng: number}) => {
    if (currentInstructionIndex < routeInstructions.length) {
      const currentInstruction = routeInstructions[currentInstructionIndex];
      const distanceToManeuver = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        currentInstruction.location[0],
        currentInstruction.location[1]
      );
      
      setDistanceToNextManeuver(distanceToManeuver);
      
      // 🧭 Se chegou perto da manobra (30m), avançar para próxima instrução
      if (distanceToManeuver < 30 && currentInstructionIndex < routeInstructions.length - 1) {
        setCurrentInstructionIndex(currentInstructionIndex + 1);
        
        // 🔊 Anunciar próxima instrução (se houver)
        if (currentInstructionIndex + 1 < routeInstructions.length) {
          const nextInstruction = routeInstructions[currentInstructionIndex + 1];
          announceInstruction(nextInstruction.direction);
        }
      }
    }
  };

  // 🔊 FUNÇÃO PARA ANUNCIAR INSTRUÇÕES (SÍNTESE DE VOZ)
  const announceInstruction = (instruction: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(instruction);
      utterance.lang = 'pt-BR';
      utterance.volume = 0.8;
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  // 🧭 CALCULAR ROTA COM INSTRUÇÕES TURN-BY-TURN
  const calculateCurrentRoute = async (from: {lat: number; lng: number}, to: {lat: number; lng: number}) => {
    try {
      // ✅ Usar OSRM com steps=true para obter instruções detalhadas
      const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=true`;
      const response = await fetch(osrmUrl);
      const data = await response.json();

      console.log('🧭 OSRM Response com instruções:', data);

      if (data.routes && data.routes[0]) {
        const route = data.routes[0];
        
        // ✅ Coordenadas da rota
        const coordinates = route.geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setCurrentRouteCoordinates(coordinates);
        
        // 🧭 Extrair instruções de navegação
        const instructions: any[] = [];
        if (route.legs && route.legs[0] && route.legs[0].steps) {
          route.legs[0].steps.forEach((step: any, index: number) => {
            const maneuver = step.maneuver;
            const instruction = {
              index,
              distance: step.distance,
              duration: step.duration,
              instruction: step.name || 'Continue em frente',
              maneuver: maneuver.type,
              modifier: maneuver.modifier,
              location: [maneuver.location[1], maneuver.location[0]], // lat, lng
              icon: getManeuverIcon(maneuver.type, maneuver.modifier),
              direction: getManeuverDirection(maneuver.type, maneuver.modifier)
            };
            instructions.push(instruction);
          });
        }
        
        console.log('🧭 Instruções extraídas:', instructions);
        setRouteInstructions(instructions);
        setCurrentInstructionIndex(0);
        setIsFollowingUser(true);
        
      } else {
        // Fallback para linha reta
        setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
        setRouteInstructions([]);
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
      setCurrentRouteCoordinates([[from.lat, from.lng], [to.lat, to.lng]]);
      setRouteInstructions([]);
    }
  };

  // 🧭 FUNÇÃO PARA OBTER ÍCONE DA MANOBRA
  const getManeuverIcon = (type: string, modifier?: string) => {
    switch (type) {
      case 'depart': return '🚀';
      case 'arrive': return '🏁';
      case 'turn':
        if (modifier === 'left') return '↰';
        if (modifier === 'right') return '↱';
        if (modifier === 'sharp left') return '⬅️';
        if (modifier === 'sharp right') return '➡️';
        if (modifier === 'slight left') return '↖️';
        if (modifier === 'slight right') return '↗️';
        return '↑';
      case 'merge': return '🔀';
      case 'on ramp': return '🛣️';
      case 'off ramp': return '🛤️';
      case 'fork': return '🍴';
      case 'continue': return '↑';
      case 'roundabout': return '🔄';
      default: return '↑';
    }
  };

  // 🧭 FUNÇÃO PARA OBTER DIREÇÃO EM PORTUGUÊS
  const getManeuverDirection = (type: string, modifier?: string) => {
    switch (type) {
      case 'depart': return 'Iniciar rota';
      case 'arrive': return 'Chegada ao destino';
      case 'turn':
        if (modifier === 'left') return 'Vire à esquerda';
        if (modifier === 'right') return 'Vire à direita';
        if (modifier === 'sharp left') return 'Vire fortemente à esquerda';
        if (modifier === 'sharp right') return 'Vire fortemente à direita';
        if (modifier === 'slight left') return 'Mantenha-se à esquerda';
        if (modifier === 'slight right') return 'Mantenha-se à direita';
        return 'Continue em frente';
      case 'merge': return 'Entre na via';
      case 'on ramp': return 'Entre na rampa';
      case 'off ramp': return 'Saia da rampa';
      case 'fork': return 'Mantenha-se na pista';
      case 'continue': return 'Continue em frente';
      case 'roundabout': return 'Entre na rotatória';
      default: return 'Continue em frente';
    }
  };

  // ✅ INICIAR NAVEGAÇÃO COM ZOOM DINÂMICO
  const startNavigation = () => {
    setIsNavigating(true);
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    setCurrentStopIndex(0);
    setCurrentInstructionIndex(0);
    setRouteInstructions([]);
    
    // 🗺️ ATIVAR SEGUIMENTO AUTOMÁTICO PERMANENTE
    setIsFollowingUser(true);
    setMapZoom(18); // zoom mais próximo para navegação
    
    if (currentLocation) {
      setMapCenter([currentLocation.lat, currentLocation.lng]);
      
      if (orderedPoints[0]) {
        calculateCurrentRoute(currentLocation, orderedPoints[0]);
        
        // 🔊 Anunciar início da navegação
        announceInstruction("Navegação iniciada. Siga as instruções.");
      }
    }
  };

  // ✅ PRÓXIMA PARADA COM TURN-BY-TURN
  const nextStop = () => {
    const orderedPoints = [...points].sort((a, b) => a.sequence - b.sequence);
    
    if (currentStopIndex < orderedPoints.length - 1) {
      const currentPoint = orderedPoints[currentStopIndex];
      const newIndex = currentStopIndex + 1;
      const nextPoint = orderedPoints[newIndex];
      
      setCurrentStopIndex(newIndex);
      setCompletedStops(prev => new Set([...prev, currentPoint.id]));
      
      // 🧭 Resetar instruções para nova rota
      setCurrentInstructionIndex(0);
      setRouteInstructions([]);
      
      if (onStopCompleted) {
        onStopCompleted(currentPoint.id);
      }

      calculateCurrentRoute(
        { lat: currentPoint.lat, lng: currentPoint.lng }, 
        { lat: nextPoint.lat, lng: nextPoint.lng }
      );
      
      // 🔊 Anunciar nova parada
      announceInstruction(`Navegando para próxima parada: ${nextPoint.address}`);
      
    } else {
      // Retornar ao início
      const lastPoint = orderedPoints[currentStopIndex];
      setCompletedStops(prev => new Set([...prev, lastPoint.id]));
      
      // 🧭 Resetar instruções para retorno
      setCurrentInstructionIndex(0);
      setRouteInstructions([]);
      
      if (currentLocation) {
        calculateCurrentRoute(
          { lat: lastPoint.lat, lng: lastPoint.lng }, 
          { lat: currentLocation.lat, lng: currentLocation.lng }
        );
        setCurrentStopIndex(-1);
        
        // 🔊 Anunciar retorno
        announceInstruction("Retornando ao ponto de partida.");
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

  // 🗺️ COMPONENTE PARA ATUALIZAR MAPA DINAMICAMENTE
  const MapUpdater = () => {
    const map = useMap();
    
    useEffect(() => {
      if (isNavigating && mapCenter && isFollowingUser) {
        // 🎯 CENTRALIZAR SUAVEMENTE NO USUÁRIO
        map.setView(mapCenter, mapZoom, {
          animate: true,
          duration: 0.5
        });
      }
    }, [map, mapCenter, mapZoom, isNavigating, isFollowingUser]);
    
    return null;
  };

  return (
    <div className="h-screen w-full bg-gray-100 relative flex flex-col overflow-hidden">
      
      {/* ✅ HEADER COM BOTÕES - SEMPRE NO TOPO */}
      <div className="bg-white border-b border-gray-200 p-3 shadow-lg z-50">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowStopsList(!showStopsList)}
              className="bg-blue-500 text-white p-2 rounded-lg flex items-center justify-center"
              style={{ minWidth: '40px', minHeight: '40px' }}
            >
              📋
            </button>
            <div>
              <h3 className="font-semibold text-sm text-gray-800">Rota Fácil</h3>
              <p className="text-xs text-gray-500">
                {isNavigating ? `${currentStopIndex + 1}/${points.length}` : 'Pronto'}
              </p>
            </div>
          </div>
          
          {/* BOTÕES DE AÇÃO NO TOPO */}
          <div className="flex gap-2">
            {!isNavigating ? (
              <button
                onClick={startNavigation}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-1"
                style={{ minHeight: '40px' }}
              >
                <span>🚀</span>
                <span>INICIAR</span>
              </button>
            ) : (
              <>
                <button
                  onClick={nextStop}
                  disabled={currentStopIndex >= points.length - 1 && currentStopIndex !== -1}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-3 py-2 rounded-lg font-bold text-sm disabled:opacity-50 flex items-center gap-1"
                  style={{ minHeight: '40px' }}
                >
                  <span>✅</span>
                  <span>PRÓXIMA</span>
                </button>
                <button
                  onClick={() => setIsNavigating(false)}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-lg font-bold"
                  style={{ minHeight: '40px', minWidth: '40px' }}
                >
                  ⏹️
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ✅ SIDEBAR LISTA DE PARADAS */}
      <div className={`fixed top-0 left-0 h-full bg-white shadow-2xl transition-transform duration-300 z-40 ${
        showStopsList ? 'translate-x-0' : '-translate-x-full'
      } w-80 md:w-96`}>
        <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold">📋 Lista de Entregas</h3>
            <p className="text-blue-100 text-sm">
              {completedStops.size} de {points.length} concluídas
            </p>
          </div>
          <button
            onClick={() => setShowStopsList(false)}
            className="bg-blue-700 hover:bg-blue-800 p-2 rounded-lg"
          >
            ✕
          </button>
        </div>
        
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
                        📦 {stop.objectCode || stop.id}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded ${
                      isCurrent ? 'bg-orange-200 text-orange-800' :
                      isCompleted ? 'bg-green-200 text-green-800' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {isCurrent ? 'Atual' : isCompleted ? 'OK' : 'Pendente'}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* OVERLAY PARA FECHAR SIDEBAR */}
      {showStopsList && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setShowStopsList(false)}
        />
      )}

      {/* ✅ MAPA PRINCIPAL */}
      <div className="flex-1 relative">
        <MapContainer
          center={mapCenter || (currentLocation ? [currentLocation.lat, currentLocation.lng] : [-18.9185, -48.2773])}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          key={mapCenter ? `${mapCenter[0]}-${mapCenter[1]}-${mapZoom}` : 'default'}
        >
          <TileLayer
            attribution='&copy; OpenStreetMap'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* 🗺️ ATUALIZADOR DINÂMICO DO MAPA */}
          <MapUpdater />

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

        {/* 🎯 DESTINO - SUPER MINIMALISTA */}
        {isNavigating && currentStop && (
          <div className="absolute top-4 left-4 right-4 z-20">
            <div className="bg-blue-600 text-white rounded-lg shadow-lg p-3">
              <div className="flex items-center gap-3">
                <div className="bg-white text-blue-600 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs">
                  {currentStop.sequence}
                </div>
                <div className="flex-1">
                  <h2 className="font-bold text-sm leading-tight">{currentStop.address}</h2>
                  <p className="text-xs opacity-90">📦 {currentStop.objectCode || currentStop.id}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ✅ ZOOM MÍNIMO - APENAS SE NECESSÁRIO */}
        {!isNavigating && (
          <div className="absolute bottom-20 right-2 z-20">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <button
                onClick={() => setMapZoom(prev => Math.min(prev + 1, 19))}
                className="block w-8 h-8 bg-white hover:bg-gray-50 flex items-center justify-center border-b border-gray-200"
              >
                <span className="text-sm font-bold text-gray-600">+</span>
              </button>
              <button
                onClick={() => setMapZoom(prev => Math.max(prev - 1, 10))}
                className="block w-8 h-8 bg-white hover:bg-gray-50 flex items-center justify-center"
              >
                <span className="text-sm font-bold text-gray-600">−</span>
              </button>
            </div>
          </div>
        )}
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
