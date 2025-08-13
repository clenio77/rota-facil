// Hook para obter localização do usuário
import { useState, useEffect } from 'react';

export function useGeolocation() {
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setPosition(null)
    );
  }, []);

  return position;
}
