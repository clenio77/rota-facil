'use client'

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// ✅ IMPORT DINÂMICO DO NAVEGADOR
const CustomNavigator = dynamic(() => import('../../components/CustomNavigator'), {
  ssr: false,
  loading: () => (
    <div className="h-screen flex items-center justify-center bg-blue-600 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold">🚚 Carregando Navegador...</h2>
        <p className="text-blue-200">Preparando rota otimizada</p>
      </div>
    </div>
  )
});

interface NavigationPoint {
  id: string;
  lat: number;
  lng: number;
  address: string;
  sequence: number;
}

interface NavigationData {
  points: NavigationPoint[];
  userLocation?: { lat: number; lng: number };
}

function NavigatorContent() {
  const searchParams = useSearchParams();
  const [navigationData, setNavigationData] = useState<NavigationData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const dataParam = searchParams.get('data');
      if (dataParam) {
        const decoded = decodeURIComponent(dataParam);
        const parsed = JSON.parse(decoded);
        
        console.log('🗺️ Dados de navegação recebidos:', parsed);
        setNavigationData(parsed);
      } else {
        setError('Dados de navegação não encontrados');
      }
    } catch (err) {
      console.error('Erro ao carregar dados de navegação:', err);
      setError('Erro ao carregar dados de navegação');
    }
  }, [searchParams]);

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-red-600 text-white">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">❌ Erro no Navegador</h2>
          <p className="mb-4">{error}</p>
          <button
            onClick={() => window.close()}
            className="bg-white text-red-600 px-6 py-3 rounded-lg font-bold"
          >
            🔙 Fechar
          </button>
        </div>
      </div>
    );
  }

  if (!navigationData) {
    return (
      <div className="h-screen flex items-center justify-center bg-blue-600 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">🚚 Carregando...</h2>
        </div>
      </div>
    );
  }

  return (
    <CustomNavigator
      points={navigationData.points}
      userLocation={navigationData.userLocation}
      onStopCompleted={(stopId) => {
        console.log('✅ Parada concluída:', stopId);
        // Aqui poderia salvar no backend que a parada foi concluída
      }}
    />
  );
}

export default function NavigatorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-blue-600 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold">🚚 Inicializando...</h2>
        </div>
      </div>
    }>
      <NavigatorContent />
    </Suspense>
  );
}
