
"use client";
import { useRef, useState, useEffect } from "react";
// Nome da tabela no Supabase
const TABLE_NAME = 'stops';
import StopCard from '../components/StopCard';
import dynamic from 'next/dynamic';
import { supabase } from '../lib/supabaseClient';
import { geocodeAddress } from '../lib/geocodeService';

const MapDisplay = dynamic(() => import('../components/MapDisplay'), { ssr: false });

type Stop = {
  lat?: number;
  lng?: number;
  photoUrl: string;
  status: string;
  address: string;
};

export default function Home() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Exemplo de rota (pode ser gerada após otimização)
  const [route, setRoute] = useState<{ geometry: { coordinates: [number, number][] } } | null>(null);

  // Buscar paradas salvas ao carregar a página
  useEffect(() => {
    const fetchStops = async () => {
      const { data } = await supabase.from(TABLE_NAME).select('*').order('created_at', { ascending: false });
      if (data) {
        setStops(data);
      }
    };
    fetchStops();
  }, []);

  // Atualizar rota otimizada sempre que as paradas mudarem
  useEffect(() => {
    const optimizeRoute = async () => {
      const coords = stops.filter(s => s.lat && s.lng).map(s => ({ lat: s.lat!, lng: s.lng! }));
      if (coords.length < 2) {
        setRoute(null);
        return;
      }
      const res = await fetch('/api/route-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coordinates: coords })
      });
      const result = await res.json();
      setRoute(result.route);
    };
    optimizeRoute();
  }, [stops]);

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    // Upload para Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from('delivery-photos').upload(fileName, file);
    if (uploadError) {
      setError('Erro ao fazer upload da imagem.');
      setLoading(false);
      return;
    }
    // Obter URL pública
    const { data: publicData } = supabase.storage.from('delivery-photos').getPublicUrl(fileName);
    const photoUrl = publicData.publicUrl;
    // Adicionar parada com status uploading
    const newStop: Stop = { photoUrl, status: 'uploading', address: '' };
    // Persistir no Supabase
    const { error: insertError } = await supabase.from(TABLE_NAME).insert([newStop]);
    if (insertError) {
      setError('Erro ao salvar parada no banco.');
    }
    setStops((prev) => [...prev, newStop]);
    // Chamar API de OCR
    try {
      const res = await fetch('/api/ocr-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: photoUrl })
      });
      const result = await res.json();
      // Geocodificar endereço
      let coords = null;
      if (result.address) {
        coords = await geocodeAddress(result.address);
      }
      // Atualizar parada com endereço e coordenadas
      setStops((prev) => prev.map((stop, idx) => idx === prev.length - 1 ? {
        ...stop,
        status: 'confirmado',
        address: result.address || 'Endereço não identificado',
        lat: coords?.lat,
        lng: coords?.lng
      } : stop));
      // Atualizar no Supabase
      await supabase.from(TABLE_NAME).update({
        status: 'confirmado',
        address: result.address || 'Endereço não identificado',
        lat: coords?.lat,
        lng: coords?.lng
      }).eq('photoUrl', photoUrl);
    } catch {
      setError('Erro ao processar OCR.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-gray-100 p-8">
      <h1 className="text-3xl font-extrabold text-blue-700 mb-8 text-center drop-shadow">RotaFácil</h1>
      <div className="mb-8 rounded-xl shadow-lg overflow-hidden">
        <MapDisplay route={route ?? { geometry: { coordinates: [] } }} stops={stops.filter(s => s.lat && s.lng) as { lat: number; lng: number }[]} />
      </div>
      <div className="space-y-4 mb-20">
        {stops.map((stop, idx) => (
          <StopCard key={idx} photoUrl={stop.photoUrl} status={stop.status} address={stop.address} />
        ))}
      </div>
      {error && <div className="text-red-600 font-semibold mb-4">{error}</div>}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <button
        onClick={handleCapture}
        disabled={loading}
        className="fixed bottom-8 right-8 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-full shadow-lg p-6 text-2xl transition-all duration-200 flex items-center justify-center"
        aria-label="Capturar imagem"
      >
        {loading ? (
          <span className="animate-spin h-6 w-6 border-4 border-white border-t-blue-600 rounded-full"></span>
        ) : (
          <span>+</span>
        )}
      </button>
    </div>
  );
}
