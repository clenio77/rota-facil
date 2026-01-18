'use client'

import React, { useState } from 'react';
import { UserLocation } from '../hooks/useGeolocation';

interface CityIndicatorProps {
  currentLocation: UserLocation | null;
  onLocationChange: (location: UserLocation) => void;
  className?: string;
}

export default function CityIndicator({ currentLocation, onLocationChange, className = '' }: CityIndicatorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customCity, setCustomCity] = useState('');
  const [customState, setCustomState] = useState('');

  const handleCustomLocationSubmit = async () => {
    if (!customCity.trim()) return;

    try {
      // Geocodificar o endereço ou CEP customizado
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: customCity, // Agora pode ser CEP ou endereço completo
          forceLocalSearch: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Criar nova localização com os dados retornados
          const newLocation: UserLocation = {
            lat: data.lat,
            lng: data.lng,
            city: data.city || customCity.toLowerCase(),
            state: data.state || customState.toLowerCase() || undefined,
            country: 'Brasil',
            fullAddress: data.address, // Guardar o endereço completo validado
            provider: data.provider
          };

          onLocationChange(newLocation);
          setIsEditing(false);
          setCustomCity('');
          setCustomState('');
        } else {
          alert('Não foi possível encontrar este endereço. Tente ser mais específico.');
        }
      }
    } catch (error) {
      console.error('Erro ao geocodificar local customizado:', error);
      alert('Erro ao buscar endereço. Verifique sua conexão.');
    }
  };

  if (!currentLocation) {
    return (
      <div className={`bg-gray-100 rounded-lg p-2 sm:p-3 text-center ${className}`}>
        <p className="text-xs sm:text-sm text-gray-600">Localização não disponível</p>
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-800 underline mt-1"
        >
          Inserir endereço manualmente
        </button>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`bg-white border border-blue-300 rounded-lg p-2 sm:p-3 ${className}`}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Endereço ou CEP (Onde a rota começa?)
            </label>
            <input
              type="text"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="Ex: 38412-881 ou Rua Principal, Uberlândia"
              className="w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCustomLocationSubmit}
              disabled={!customCity.trim()}
              className="flex-1 px-4 py-2 text-xs font-bold bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              Confirmar Local de Início
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setCustomCity('');
                setCustomState('');
              }}
              className="px-4 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-2 sm:p-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-blue-900">
              {currentLocation.city ? currentLocation.city.charAt(0).toUpperCase() + currentLocation.city.slice(1) : 'Localização atual'}
            </p>
            {currentLocation.state && (
              <p className="text-xs text-blue-700">
                {currentLocation.state.toUpperCase()}, Brasil
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setIsEditing(true)}
          className="text-xs text-blue-600 hover:text-blue-800 underline self-start sm:self-auto"
        >
          Alterar
        </button>
      </div>

      {currentLocation.fullAddress && (
        <p className="text-xs text-blue-600 mt-1 truncate">
          {currentLocation.fullAddress}
        </p>
      )}
    </div>
  );
}
