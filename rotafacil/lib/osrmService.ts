import axios from 'axios';

export async function getOptimizedRoute(coordinates: Array<{ lat: number; lng: number }>) {
  const coordsStr = coordinates.map(c => `${c.lng},${c.lat}`).join(';');
  const url = `http://localhost:5000/route/v1/driving/${coordsStr}?overview=full&geometries=geojson`;
  const response = await axios.get(url);
  return response.data;
}
