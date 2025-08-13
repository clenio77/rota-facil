'use client'

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet icon issue in Next.js
delete (L.Icon.Default.prototype as L.Icon.Default & { _getIconUrl?: string })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Stop {
  id: number;
  address: string;
  lat?: number;
  lng?: number;
  sequence?: number;
}

interface RouteGeometry {
  coordinates: [number, number][];
  type: string;
}

interface MapDisplayProps {
  stops: Stop[];
  routeGeometry?: RouteGeometry;
  origin?: { lat: number; lng: number };
}

export default function MapDisplay({ stops, routeGeometry, origin }: MapDisplayProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Inicializar mapa
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current).setView(
        [-23.5505, -46.6333], // São Paulo como padrão
        12
      );

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Limpar marcadores anteriores
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Adicionar marcadores
    const bounds = L.latLngBounds([]);
    const validStops = stops.filter(s => s.lat && s.lng);

    // Origem (se fornecida)
    if (origin && typeof origin.lat === 'number' && typeof origin.lng === 'number') {
      const originMarker = L.marker([origin.lat, origin.lng], {
        icon: L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #10B981; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">S</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        })
      }).addTo(map).bindPopup('<strong>Ponto de partida</strong>');
      bounds.extend([origin.lat, origin.lng]);
    }

    validStops.forEach((stop) => {
      if (!stop.lat || !stop.lng) return;

      const marker = L.marker([stop.lat, stop.lng])
        .addTo(map)
        .bindPopup(`
          <div class="p-2">
            <strong>${stop.sequence ? `#${stop.sequence} - ` : ''}${stop.address}</strong>
          </div>
        `);

      // Adicionar número da sequência ao marcador
      if (stop.sequence) {
        const icon = L.divIcon({
          className: 'custom-div-icon',
          html: `<div style="background-color: #3B82F6; color: white; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 14px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${stop.sequence}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 28],
        });
        marker.setIcon(icon);
      }

      bounds.extend([stop.lat, stop.lng]);
    });

    // Adicionar linha da rota se disponível
    if (routeGeometry && routeGeometry.coordinates) {
      const latlngs = routeGeometry.coordinates.map((coord: [number, number]) => 
        L.latLng(coord[1], coord[0])
      );
      
      const polyline = L.polyline(latlngs, {
        color: '#3B82F6',
        weight: 4,
        opacity: 0.7,
      }).addTo(map);
      // Ajustar o mapa à geometria da rota
      const routeBounds = polyline.getBounds();
      map.fitBounds(routeBounds, { padding: [50, 50] });
    } else if (validStops.length > 1) {
      // Desenhar linha conectando os pontos na ordem da sequência
      const sortedStops = [...validStops].sort((a, b) => 
        (a.sequence || 0) - (b.sequence || 0)
      );
      
      const latlngs = sortedStops
        .filter(s => s.lat && s.lng)
        .map(s => L.latLng(s.lat!, s.lng!));
      
      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: '#3B82F6',
          weight: 4,
          opacity: 0.7,
          dashArray: '10, 10',
        }).addTo(map);
      }
    }

    // Ajustar zoom para mostrar todos os marcadores
    if (validStops.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Cleanup
    return () => {
      // Não destruir o mapa, apenas limpar quando o componente for desmontado
    };
  }, [stops, routeGeometry, origin]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-full rounded-lg"
      style={{ minHeight: '400px' }}
    />
  );
}