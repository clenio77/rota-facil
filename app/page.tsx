'use client'

import React, { useState, useRef } from 'react';
import StopCard from '../components/StopCard';
import MapDisplay from '../components/MapDisplay';
import { supabase } from '../lib/supabaseClient';

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
  geometry?: any;
  error?: string;
}

export default function HomePage() {
  const [stops, setStops] = useState<Stop[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-custom p-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Minhas Paradas</h2>
        <p className="text-gray-600 mb-4">
          Tire fotos dos pacotes para adicionar os endereços automaticamente
        </p>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{stops.length}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{confirmedStops.length}</div>
            <div className="text-sm text-gray-500">Confirmadas</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stops.filter(s => s.status === 'processing' || s.status === 'uploading').length}
            </div>
            <div className="text-sm text-gray-500">Processando</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary flex-1 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Parada
          </button>
          
          {confirmedStops.length >= 2 && (
            <button
              onClick={handleOptimizeRoute}
              disabled={isOptimizing}
              className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50"
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

      {/* Map Display */}
      {showMap && confirmedStops.length > 0 && (
        <div className="bg-white rounded-xl shadow-custom p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Rota Otimizada</h3>
          <div className="h-96">
            <MapDisplay stops={confirmedStops} />
          </div>
        </div>
      )}

      {/* Stops List */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />
    </div>
  );
}
