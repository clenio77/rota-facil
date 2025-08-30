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
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
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

  // ✅ CALCULAR ROTA USANDO OSRM
  const calculateRoute = async (from: {lat: number, lng: number}, to: {lat: number, lng: number}) => {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      
      if (data.routes && data.routes[0]) {
        const coordinates = data.routes[0].geometry.coordinates.map((coord: [number, number]) => [coord[1], coord[0]] as [number, number]);
        setRouteCoordinates(coordinates);
        return data.routes[0];
      }
    } catch (error) {
      console.error('Erro ao calcular rota:', error);
    }
    return null;
  };

  // ✅ INICIAR NAVEGAÇÃO
  const startNavigation = () => {
    setIsNavigating(true);
    setCurrentStopIndex(0);
    if (currentLocation && points[0]) {
      calculateRoute(currentLocation, points[0]);
    }
  };

  // ✅ PRÓXIMA PARADA
  const nextStop = () => {
    if (currentStopIndex < points.length - 1) {
      const newIndex = currentStopIndex + 1;
      setCurrentStopIndex(newIndex);
      
      // ✅ MARCAR PARADA ATUAL COMO CONCLUÍDA
      if (onStopCompleted) {
        onStopCompleted(points[currentStopIndex].id);
      }

      // ✅ CALCULAR ROTA PARA PRÓXIMA PARADA
      if (currentLocation && points[newIndex]) {
        calculateRoute(currentLocation, points[newIndex]);
      }
    } else {
      // ✅ NAVEGAÇÃO CONCLUÍDA
      setIsNavigating(false);
      alert('🎉 Navegação concluída! Todas as entregas foram realizadas.');
    }
  };

  // ✅ NAVEGAR DIRETAMENTE PARA UMA PARADA
  const navigateToStop = (index: number) => {
    setCurrentStopIndex(index);
    if (currentLocation && points[index]) {
      calculateRoute(currentLocation, points[index]);
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
        {isNavigating && currentStop && (
          <div className="mt-3 bg-blue-700 p-3 rounded-lg">
            <h3 className="font-bold text-lg">📍 Parada Atual:</h3>
            <p className="text-blue-100">{currentStop.address}</p>
            <p className="text-sm text-blue-200">ID: {currentStop.id}</p>
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

          {/* ✅ PONTOS DE ENTREGA */}
          {points.map((point, index) => (
            <Marker
              key={point.id}
              position={[point.lat, point.lng]}
              eventHandlers={{
                click: () => navigateToStop(index)
              }}
            >
              <Popup>
                <div className="text-center">
                  <h4 className="font-bold">Parada {point.sequence}</h4>
                  <p className="text-sm">{point.address}</p>
                  <button
                    onClick={() => navigateToStop(index)}
                    className="mt-2 bg-blue-500 text-white px-3 py-1 rounded text-sm"
                  >
                    🧭 Navegar para aqui
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}

          {/* ✅ ROTA CALCULADA */}
          {routeCoordinates.length > 0 && (
            <Polyline
              positions={routeCoordinates}
              color="blue"
              weight={5}
              opacity={0.7}
            />
          )}
        </MapContainer>
      </div>

      {/* ✅ LISTA DE PARADAS */}
      <div className="bg-white border-t p-4 max-h-48 overflow-y-auto">
        <h3 className="font-bold mb-2">📋 Lista de Paradas:</h3>
        <div className="space-y-2">
          {points.map((point, index) => (
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
                  {point.sequence}. {point.address}
                </span>
                <span className="text-sm text-gray-500">{point.id}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
