// Hook para obter localização do usuário com contexto de cidade
import { useState, useEffect } from 'react';

export interface UserLocation {
  lat: number;
  lng: number;
  city?: string;
  state?: string;
  country?: string;
  fullAddress?: string;
  confidence?: number;
  provider?: string;
}

export function useGeolocation() {
  const [position, setPosition] = useState<UserLocation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getLocationWithContext = async (lat: number, lng: number) => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fazer reverse geocoding para obter contexto da cidade
      const response = await fetch('/api/reverse-geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setPosition({
            lat,
            lng,
            city: data.city,
            state: data.state,
            country: data.country,
            fullAddress: data.fullAddress,
            confidence: data.confidence,
            provider: data.provider
          });
          return;
        }
      }
      
      // Fallback: apenas coordenadas se reverse geocoding falhar
      setPosition({ lat, lng });
      
    } catch (err) {
      console.error('Erro ao obter contexto da localização:', err);
      // Fallback: apenas coordenadas
      setPosition({ lat, lng });
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada pelo navegador');
      return;
    }

    setIsLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        getLocationWithContext(lat, lng);
      },
      (err) => {
        let errorMessage = 'Erro ao obter localização';
        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Permissão de localização negada';
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Localização indisponível';
            break;
          case err.TIMEOUT:
            errorMessage = 'Tempo limite excedido';
            break;
        }
        setError(errorMessage);
        setIsLoading(false);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 10000,
        maximumAge: 300000 // 5 minutos
      }
    );
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  return {
    position,
    isLoading,
    error,
    refresh: getCurrentLocation
  };
}
