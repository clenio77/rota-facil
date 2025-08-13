"use client";
import { MapContainer, TileLayer, Polyline, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';

type MapDisplayProps = {
  route: { geometry: { coordinates: [number, number][] } };
  stops: { lat: number; lng: number }[];
};

export default function MapDisplay({ route, stops }: MapDisplayProps) {
  const center: LatLngExpression = stops.length ? [stops[0].lat, stops[0].lng] : [-15.78, -47.93];
  // Polyline expects array of LatLngExpression: [lat, lng]
  const polylinePositions: LatLngExpression[] = route
    ? route.geometry.coordinates.map(([lng, lat]) => [lat, lng])
    : [];
  return (
    <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {polylinePositions.length > 0 && (
        <Polyline positions={polylinePositions} pathOptions={{ color: 'blue' }} />
      )}
      {stops.map((stop, idx) => (
        <Marker key={idx} position={[stop.lat, stop.lng]} />
      ))}
    </MapContainer>
  );
}
