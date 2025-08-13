'use client'

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import StopCard from '../components/StopCard';
import { getSupabase } from '../lib/supabaseClient';
// SpeechRecognition types for browsers (ambient declarations)
// Minimal subset to type usage without depending on lib.dom updates
interface MinimalSpeechRecognitionEventResult {
  transcript: string;
}
interface MinimalSpeechRecognitionResult {
  0: MinimalSpeechRecognitionEventResult;
}
interface MinimalSpeechRecognitionEventResults {
  0: MinimalSpeechRecognitionResult;
}
interface MinimalSpeechRecognitionEvent {
  results: MinimalSpeechRecognitionEventResults;
}
type MinimalSpeechRecognitionHandler = (e: MinimalSpeechRecognitionEvent) => void;
interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: MinimalSpeechRecognitionHandler;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type MinimalSpeechRecognitionConstructor = new () => MinimalSpeechRecognition;
declare global {
  interface Window {
    SpeechRecognition?: MinimalSpeechRecognitionConstructor;
    webkitSpeechRecognition?: MinimalSpeechRecognitionConstructor;
  }
}

const MapDisplay = dynamic(() => import('../components/MapDisplay'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">Carregando mapa...</div>
});

interface Stop {
  id: number;
  photoUrl: string;
  status: 'uploading' | 'processing' | 'confirmed' | 'error' | 'optimized';
  address: string;
  lat?: number;
  lng?: number;
  sequence?: number;
}

interface OptimizedStop extends Stop {
  sequence: number;
}

interface OptimizeResponse {
  success: boolean;
  optimizedStops: OptimizedStop[];
  distance?: number;
  duration?: number;
  geometry?: {
    type: string;
    coordinates: [number, number][];
  };
  error?: string;
}

export default function HomePage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Route summary state
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | undefined>(undefined);
  const [routeDurationMin, setRouteDurationMin] = useState<number | undefined>(undefined);
  const [routeGeometry, setRouteGeometry] = useState<{ type: string; coordinates: [number, number][] } | undefined>(undefined);
  const [routeProvider, setRouteProvider] = useState<string | undefined>(undefined);

  // Voice input state
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);

  // Função para capturar imagem
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Criar preview local
    const localUrl = URL.createObjectURL(file);
    const newStop: Stop = {
      id: Date.now(),
      photoUrl: localUrl,
      status: 'uploading',
      address: '',
    };

    setStops(prev => [...prev, newStop]);

    try {
      // Upload para Supabase Storage
      const fileName = `delivery-${Date.now()}-${file.name}`;
      const supabase = getSupabase();
      const { error: uploadError } = await supabase.storage
        .from('delivery-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('delivery-photos')
        .getPublicUrl(fileName);

      // Atualizar status para processando
      setStops(prev => prev.map(stop => 
        stop.id === newStop.id 
          ? { ...stop, photoUrl: publicUrl, status: 'processing' }
          : stop
      ));

      // Chamar API de OCR
      const response = await fetch('/api/ocr-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl }),
      });

      const result = await response.json();

      if (result.success) {
        setStops(prev => prev.map(stop => 
          stop.id === newStop.id 
            ? { 
                ...stop, 
                status: 'confirmed', 
                address: result.address,
                lat: result.lat,
                lng: result.lng
              }
            : stop
        ));
      } else {
        throw new Error(result.error || 'Erro ao processar imagem');
      }
    } catch (error) {
      console.error('Erro:', error);
      setStops(prev => prev.map(stop => 
        stop.id === newStop.id 
          ? { ...stop, status: 'error' }
          : stop
      ));
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover parada
  const handleRemove = (id: number) => {
    setStops(prev => prev.filter(stop => stop.id !== id));
  };

  // Retentar processamento
  const handleRetry = async (id: number) => {
    const stop = stops.find(s => s.id === id);
    if (!stop) return;

    setStops(prev => prev.map(s => 
      s.id === id ? { ...s, status: 'processing' } : s
    ));

    try {
      const response = await fetch('/api/ocr-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: stop.photoUrl }),
      });

      const result = await response.json();

      if (result.success) {
        setStops(prev => prev.map(s => 
          s.id === id 
            ? { 
                ...s, 
                status: 'confirmed', 
                address: result.address,
                lat: result.lat,
                lng: result.lng
              }
            : s
        ));
      } else {
        throw new Error(result.error || 'Erro ao processar imagem');
      }
    } catch (error) {
      console.error('Erro:', error);
      setStops(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error' } : s
      ));
    }
  };

  // Otimizar rota
  const handleOptimizeRoute = async () => {
    const validStops = stops.filter(s => s.status === 'confirmed' && s.lat && s.lng);
    if (validStops.length < 2) {
      alert('Adicione pelo menos 2 paradas confirmadas para otimizar a rota');
      return;
    }

    setIsOptimizing(true);

    try {
      const response = await fetch('/api/route-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: validStops.map(s => ({ id: s.id, lat: s.lat, lng: s.lng }))
        }),
      });

      const result: OptimizeResponse = await response.json();

      if (result.success) {
        // Atualizar paradas com sequência otimizada
        const optimizedStops = stops.map(stop => {
          const optimizedData = result.optimizedStops.find((os) => os.id === stop.id);
          if (optimizedData) {
            return {
              ...stop,
              sequence: optimizedData.sequence,
              status: 'optimized' as const,
            };
          }
          return stop;
        });

        setStops(optimizedStops);
        setShowMap(true);
        setRouteDistanceKm(result.distance);
        setRouteDurationMin(result.duration);
        setRouteGeometry(result.geometry);
        setRouteProvider((result as any).provider);
      } else {
        throw new Error(result.error || 'Erro ao otimizar rota');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao otimizar rota. Tente novamente.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const confirmedStops = stops.filter(s => s.status === 'confirmed' || s.status === 'optimized');

  // Voice capture handlers
  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results && e.results[0] && e.results[0][0]
        ? e.results[0][0].transcript
        : '';
      setVoiceText(text);
      setIsVoiceDialogOpen(true);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
  };

  const handleConfirmVoiceAddress = async () => {
    const address = voiceText.trim();
    if (!address) { alert('Digite ou dite um endereço.'); return; }
    try {
      // Geocodificar no servidor para evitar restrições do Nominatim no cliente
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      });
      const data = await res.json();
      if (!data.success || !data.lat || !data.lng) {
        alert('Não foi possível geocodificar este endereço.');
        return;
      }
      const newStop: Stop = {
        id: Date.now(),
        photoUrl: '',
        status: 'confirmed',
        address: data.address || address,
        lat: data.lat,
        lng: data.lng,
      };
      setStops(prev => [...prev, newStop]);
      setIsVoiceDialogOpen(false);
      setVoiceText('');
    } catch (err) {
      console.error(err);
      alert('Erro ao confirmar o endereço.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-custom p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Minhas Paradas</h2>
            <p className="text-gray-600">Use foto (OCR) ou voz para adicionar endereços</p>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 w-full sm:w-auto mt-3 sm:mt-0">
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-blue-600">{stops.length}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-green-600">{confirmedStops.length}</div>
              <div className="text-xs text-gray-500">Confirmadas</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-orange-600">
                {stops.filter(s => s.status === 'processing' || s.status === 'uploading').length}
              </div>
              <div className="text-xs text-gray-500">Processando</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Parada
          </button>
          <button
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
            className="btn-secondary w-full flex items-center justify-center gap-2"
            aria-pressed={isListening}
            title="Segure para falar o endereço"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 18v3m-4 0h8" />
            </svg>
            {isListening ? 'Gravando...' : 'Falar endereço'}
          </button>
          
          {confirmedStops.length >= 2 && (
            <button
              onClick={handleOptimizeRoute}
              disabled={isOptimizing}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2"
            >
              {isOptimizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Otimizando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Otimizar Rota
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content Grid: List + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stops List */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Route summary card (if available) visible on mobile as well */}
          {showMap && (routeDistanceKm || routeDurationMin) && (
            <div className="bg-white rounded-xl shadow-custom p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Distância</div>
                <div className="text-lg font-semibold">{routeDistanceKm?.toFixed(1)} km</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Duração</div>
                <div className="text-lg font-semibold">{routeDurationMin?.toFixed(0)} min</div>
              </div>
              {routeProvider && (
                <span className="badge badge-info">{routeProvider}</span>
              )}
            </div>
          )}

          <div className="space-y-4">
        {stops.length === 0 ? (
          <div className="bg-white rounded-xl shadow-custom p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma parada adicionada</h3>
            <p className="text-gray-500 mb-4">Tire uma foto do pacote para começar</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tirar Foto
            </button>
          </div>
        ) : (
          stops
            .sort((a, b) => (a.sequence || 999) - (b.sequence || 999))
            .map(stop => (
              <StopCard
                key={stop.id}
                {...stop}
                onRemove={handleRemove}
                onRetry={handleRetry}
              />
            ))
        )}
          </div>
        </div>

        {/* Map Display - sticky on large screens */}
        <div className="order-1 lg:order-2">
          {showMap && confirmedStops.length > 0 && (
            <div className="bg-white rounded-xl shadow-custom p-4 lg:p-6 lg:sticky lg:top-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Rota Otimizada</h3>
              <div className="h-96 lg:h-[600px]">
                <MapDisplay stops={confirmedStops} routeGeometry={routeGeometry} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />

      {/* Voice confirmation dialog */}
      {isVoiceDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-custom p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Confirmar endereço</h3>
            <p className="text-sm text-gray-600 mb-3">Revise o endereço reconhecido, ajuste se necessário e confirme.</p>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[96px]"
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder="Ex.: Rua Exemplo, 123 - Bairro, Cidade - UF"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setIsVoiceDialogOpen(false); setVoiceText(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmVoiceAddress}
                className="btn-primary px-4 py-2"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
