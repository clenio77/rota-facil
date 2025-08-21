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
      // Geocodificar a cidade customizada SEM forçar filtro local
      const response = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: `${customCity}, ${customState || 'Brasil'}`,
          // Não enviar userLocation com city/state para não restringir a busca
          forceLocalSearch: false
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Criar nova localização com a cidade customizada
          const newLocation: UserLocation = {
            lat: data.lat,
            lng: data.lng,
            city: customCity.toLowerCase(),
            state: customState.toLowerCase() || undefined,
            country: 'Brasil'
          };
          
          onLocationChange(newLocation);
          setIsEditing(false);
          setCustomCity('');
          setCustomState('');
        }
      }
    } catch (error) {
      console.error('Erro ao geocodificar cidade customizada:', error);
    }
  };

  if (!currentLocation) {
    return (
      <div className={`bg-gray-100 rounded-lg p-3 text-center ${className}`}>
        <p className="text-sm text-gray-600">Localização não disponível</p>
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className={`bg-white border border-blue-300 rounded-lg p-3 ${className}`}>
        <div className="space-y-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Cidade
            </label>
            <input
              type="text"
              value={customCity}
              onChange={(e) => setCustomCity(e.target.value)}
              placeholder="Ex: São Paulo"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Estado (opcional)
            </label>
            <input
              type="text"
              value={customState}
              onChange={(e) => setCustomState(e.target.value)}
              placeholder="Ex: SP"
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCustomLocationSubmit}
              disabled={!customCity.trim()}
              className="flex-1 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setCustomCity('');
                setCustomState('');
              }}
              className="px-3 py-1 text-xs bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
          <div>
            <p className="text-sm font-medium text-blue-900">
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
          className="text-xs text-blue-600 hover:text-blue-800 underline"
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
