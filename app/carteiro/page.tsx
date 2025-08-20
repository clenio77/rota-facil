'use client'

import React, { useState } from 'react';
import PhotoUpload from './components/PhotoUpload';
import ProcessingStatus from './components/ProcessingStatus';
import RouteResult from './components/RouteResult';
import ECTListResult from './components/ECTListResult';
import { useGeolocation } from '../../hooks/useGeolocation';

interface RouteData {
  stops: Array<{
    address: string;
    lat: number;
    lng: number;
    sequence: number;
  }>;
  totalDistance: number;
  totalTime: number;
  googleMapsUrl: string;
}

export default function CarteiroPage() {
  const [processing, setProcessing] = useState(false);
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Hook de geolocalização para filtrar por cidade
  const { position: deviceLocation, isLoading: locationLoading } = useGeolocation();

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            📮 RotaFácil para Carteiros
          </h1>
          <p className="text-lg text-gray-600">
            Processe suas listas de entrega e gere rotas otimizadas em segundos
          </p>
          
          {/* Indicador de Localização */}
          {deviceLocation && (
            <div className="mt-4 inline-flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
              <span>📍</span>
              <span>Filtro ativo: {deviceLocation.city || 'Localizando...'}, {deviceLocation.state || ''}</span>
            </div>
          )}
          {locationLoading && (
            <div className="mt-4 inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
              <span>🔄</span>
              <span>Detectando sua localização...</span>
            </div>
          )}
        </div>

        {/* Interface Principal */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-800 mb-6">
            🚀 Como funciona?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📸</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">1. Tire uma foto</h3>
              <p className="text-gray-600 text-sm">
                Fotografe a lista de entrega do sistema Correios
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-green-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🤖</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">2. Processamento automático</h3>
              <p className="text-gray-600 text-sm">
                IA extrai endereços e gera coordenadas precisas
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-purple-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🗺️</span>
              </div>
              <h3 className="font-semibold text-gray-800 mb-2">3. Rota otimizada</h3>
              <p className="text-gray-600 text-sm">
                Receba rota otimizada para Google Maps
              </p>
            </div>
          </div>

          {/* Upload de Foto */}
          <PhotoUpload 
            onProcessingStart={() => setProcessing(true)}
            onProcessingComplete={(data) => {
              setRouteData((data as { routeData: RouteData }).routeData);
              setProcessing(false);
            }}
            onError={(error) => {
              setError(error);
              setProcessing(false);
            }}
            userLocation={deviceLocation}
          />
        </div>

        {/* Status do Processamento */}
        {processing && (
          <ProcessingStatus />
        )}

        {/* Resultado da Rota */}
        {routeData && (
          <>
            {/* Verificar se é resultado de lista ECT */}
            {routeData.ectData ? (
              <ECTListResult 
                ectData={routeData.ectData}
                geocodedItems={routeData.geocodedItems}
                routeData={routeData}
              />
            ) : (
              <RouteResult routeData={routeData} />
            )}
          </>
        )}

        {/* Mensagem de Erro */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
            <div className="flex">
              <div className="flex-shrink-0">
                <span className="text-red-400">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">
                  Erro no processamento
                </h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => setError(null)}
                    className="bg-red-100 text-red-800 px-3 py-2 rounded-md text-sm font-medium hover:bg-red-200"
                  >
                    Tentar novamente
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Informações Adicionais */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-800 mb-4">
            💡 Dicas para melhor resultado
          </h3>
          <ul className="text-blue-700 space-y-2">
            <li>• Tire a foto em boa luz e com a tela bem visível</li>
            <li>• Certifique-se de que todos os endereços estão legíveis</li>
            <li>• A foto deve incluir a lista completa de entregas</li>
            <li>• Use o modo paisagem para capturar mais conteúdo</li>
            {deviceLocation && (
              <li>• ✅ <strong>Filtro ativo:</strong> Priorizando endereços em {deviceLocation.city}</li>
            )}
            {!deviceLocation && !locationLoading && (
              <li>• ⚠️ <strong>Permitir localização</strong> para filtrar endereços da sua cidade</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
