'use client'

import React from 'react';

interface ECTDeliveryItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep: string;
  arRequired: boolean;
  arOrder: string;
  lat?: number;
  lng?: number;
  geocodedAddress?: string;
  geocodingProvider?: string;
  geocodingError?: string;
}

interface ECTListData {
  listNumber: string;
  unit: string;
  district: string;
  state: string;
  city: string;
  items: ECTDeliveryItem[];
}

interface ECTListResultProps {
  ectData: ECTListData;
  geocodedItems: ECTDeliveryItem[];
  routeData: { googleMapsUrl: string };
}

export default function ECTListResult({ ectData, geocodedItems, routeData }: ECTListResultProps) {
  const validItems = geocodedItems.filter(item => item.lat && item.lng);
  const failedItems = geocodedItems.filter(item => !item.lat || !item.lng);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
      {/* Cabeçalho da Lista ECT */}
      <div className="border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          📮 Lista ECT Processada
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="font-medium text-gray-600">Lista:</span>
            <p className="text-gray-900">{ectData.listNumber}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Unidade:</span>
            <p className="text-gray-900">{ectData.unit}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Distrito:</span>
            <p className="text-gray-900">{ectData.district}</p>
          </div>
          <div>
            <span className="font-medium text-gray-600">Local:</span>
            <p className="text-gray-900">{ectData.city}, {ectData.state}</p>
          </div>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center bg-green-50 rounded-lg py-3">
          <div className="text-2xl font-bold text-green-600">{validItems.length}</div>
          <div className="text-sm text-green-700">Endereços OK</div>
        </div>
        <div className="text-center bg-yellow-50 rounded-lg py-3">
          <div className="text-2xl font-bold text-yellow-600">{failedItems.length}</div>
          <div className="text-sm text-yellow-700">Falharam</div>
        </div>
        <div className="text-center bg-blue-50 rounded-lg py-3">
          <div className="text-2xl font-bold text-blue-600">{ectData.items.length}</div>
          <div className="text-sm text-blue-700">Total</div>
        </div>
      </div>

      {/* Lista de Itens */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">
          📋 Itens da Lista ({ectData.items.length})
        </h3>
        <div className="space-y-3">
          {ectData.items.map((item) => {
            const geocoded = geocodedItems.find(g => g.sequence === item.sequence);
            const isSuccess = geocoded?.lat && geocoded?.lng;
            
            return (
              <div
                key={item.sequence}
                className={`border rounded-lg p-4 ${
                  isSuccess ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-lg font-bold text-gray-700">
                        {item.sequence.toString().padStart(3, '0')}
                      </span>
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                        {item.objectCode}
                      </span>
                      {item.arRequired && (
                        <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">
                          AR
                        </span>
                      )}
                    </div>
                    
                    <div className="text-gray-800 font-medium mb-1">
                      {item.address}
                    </div>
                    
                    <div className="text-sm text-gray-600">
                      CEP: {item.cep} | Ordem: {item.arOrder}
                    </div>
                    
                    {geocoded && (
                      <div className="mt-2 text-sm">
                        {isSuccess ? (
                          <div className="text-green-700">
                            ✅ <span className="font-medium">Geocodificado:</span> {geocoded.geocodedAddress}
                            <br />
                            📍 Coordenadas: {geocoded.lat?.toFixed(6)}, {geocoded.lng?.toFixed(6)}
                            <br />
                            🔧 Provedor: {geocoded.geocodingProvider}
                          </div>
                        ) : (
                          <div className="text-red-700">
                            ❌ <span className="font-medium">Erro na geocodificação:</span> {geocoded.geocodingError}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="text-right">
                    {isSuccess ? (
                      <span className="text-green-600 text-2xl">✅</span>
                    ) : (
                      <span className="text-red-600 text-2xl">❌</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Ações */}
      {validItems.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">
            🚀 Próximos Passos
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href={routeData.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors text-center font-medium"
            >
              🗺️ Abrir no Google Maps
            </a>
            
            <button
              onClick={() => {
                const addresses = validItems
                  .map(item => `${item.sequence}. ${item.geocodedAddress || item.address}`)
                  .join('\n');
                navigator.clipboard.writeText(addresses);
                alert('Endereços copiados para a área de transferência!');
              }}
              className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              📋 Copiar Endereços
            </button>
          </div>
          
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">💡 Dicas para o carteiro:</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Siga a sequência numérica das paradas</li>
              <li>• Verifique se precisa de AR (Aviso de Recebimento)</li>
              <li>• Use o Google Maps para navegação entre paradas</li>
              <li>• Confirme a entrega em cada endereço</li>
            </ul>
          </div>
        </div>
      )}

      {/* Avisos para itens que falharam */}
      {failedItems.length > 0 && (
        <div className="border-t pt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="font-medium text-yellow-800 mb-2">
              ⚠️ {failedItems.length} endereço(s) não foram geocodificados
            </h4>
            <p className="text-sm text-yellow-700 mb-3">
              Os seguintes itens precisam de atenção manual:
            </p>
            <ul className="text-sm text-yellow-700 space-y-1">
              {failedItems.map(item => (
                <li key={item.sequence}>
                  • <strong>{item.sequence.toString().padStart(3, '0')}</strong>: {item.address} - {item.cep}
                </li>
              ))}
            </ul>
            <p className="text-sm text-yellow-700 mt-3">
              💡 Digite manualmente estes endereços ou verifique se estão corretos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
