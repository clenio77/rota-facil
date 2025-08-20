'use client'

import React from 'react';

interface RouteResultProps {
  routeData: {
    stops: Array<{
      address: string;
      lat: number;
      lng: number;
      sequence: number;
    }>;
    totalDistance: number;
    totalTime: number;
    googleMapsUrl: string;
  };
}

export default function RouteResult({ routeData }: RouteResultProps) {
  const handleOpenGoogleMaps = () => {
    window.open(routeData.googleMapsUrl, '_blank');
  };

  const handleCopyAddresses = () => {
    const addresses = routeData.stops
      .map(stop => stop.address || `${stop.lat}, ${stop.lng}`)
      .join('\n');
    navigator.clipboard.writeText(addresses);
    // Aqui você poderia adicionar um toast de confirmação
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <span className="text-3xl">🎉</span>
        </div>
        <h3 className="text-2xl font-semibold text-gray-800 mb-2">
          Rota Gerada com Sucesso!
        </h3>
        <p className="text-gray-600">
          Sua lista foi processada e a rota está otimizada
        </p>
      </div>

      {/* Resumo da Rota */}
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600 mb-1">
            {routeData.stops.length}
          </div>
          <div className="text-sm text-blue-700">Paradas</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600 mb-1">
            {routeData.totalDistance.toFixed(1)} km
          </div>
          <div className="text-sm text-green-700">Distância Total</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600 mb-1">
            {Math.round(routeData.totalTime)} min
          </div>
          <div className="text-sm text-purple-700">Tempo Estimado</div>
        </div>
      </div>

      {/* Lista de Paradas */}
      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">
          📍 Lista de Paradas Otimizada
        </h4>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {routeData.stops.map((stop, index) => (
            <div
              key={index}
              className="flex items-center space-x-4 p-3 bg-gray-50 rounded-lg"
            >
              <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                {stop.sequence}
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-800">{stop.address || `${stop.lat}, ${stop.lng}`}</p>
                <p className="text-sm text-gray-500">
                  Coordenadas: {stop.lat.toFixed(6)}, {stop.lng.toFixed(6)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Ações */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleOpenGoogleMaps}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
        >
          <span>🗺️</span>
          <span>Abrir no Google Maps</span>
        </button>
        
        <button
          onClick={handleCopyAddresses}
          className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center justify-center space-x-2"
        >
          <span>📋</span>
          <span>Copiar Endereços</span>
        </button>
      </div>

      {/* Informações Adicionais */}
      <div className="mt-6 p-4 bg-green-50 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">✅ Próximos Passos:</h4>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Clique em &quot;Abrir no Google Maps&quot; para iniciar a navegação</li>
          <li>• Siga a rota na ordem das paradas numeradas</li>
          <li>• Use &quot;Copiar Endereços&quot; se precisar da lista em outro app</li>
          <li>• A rota está otimizada para menor tempo de viagem</li>
        </ul>
      </div>

      {/* Estatísticas */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">📊 Estatísticas da Rota:</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-blue-600 font-medium">Paradas processadas:</span>
            <span className="ml-2 text-blue-700">{routeData.stops.length}</span>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Distância total:</span>
            <span className="ml-2 text-blue-700">{routeData.totalDistance.toFixed(1)} km</span>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Tempo estimado:</span>
            <span className="ml-2 text-blue-700">{Math.round(routeData.totalTime)} minutos</span>
          </div>
          <div>
            <span className="text-blue-600 font-medium">Média por parada:</span>
            <span className="ml-2 text-blue-700">
              {(routeData.totalDistance / routeData.stops.length).toFixed(1)} km
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
