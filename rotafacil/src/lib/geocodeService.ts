// Serviço de geocodificação usando Nominatim
import axios from 'axios';

export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const response = await axios.get(url);
    const result = response.data[0];
    if (result) {
      return { lat: parseFloat(result.lat), lng: parseFloat(result.lon) };
    }
    return null;
  } catch {
    return null;
  }
}
