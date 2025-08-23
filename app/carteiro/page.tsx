'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface ECTItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep?: string;
  lat?: number;
  lng?: number;
}

interface ProcessedECTList {
  success: boolean;
  items: ECTItem[];
  totalItems: number;
  city: string;
  state: string;
  googleMapsUrl?: string;
  error?: string;
}

export default function CarteiroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedECTList | null>(null);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [editableItems, setEditableItems] = useState<ECTItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ✅ DEBUG: Monitorar mudanças nos estados
  useEffect(() => {
    console.log('🔍 ESTADO ATUALIZADO - processedData:', processedData);
    console.log('🔍 ESTADO ATUALIZADO - showAddressEditor:', showAddressEditor);
    console.log('🔍 ESTADO ATUALIZADO - editableItems:', editableItems);
  }, [processedData, showAddressEditor, editableItems]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null); // ✅ LIMPAR ERRO ANTERIOR
    setProcessedData(null);

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch('/api/carteiro/process-ect-list', {
        method: 'POST',
        body: formData,
      });

      const data: ProcessedECTList = await response.json();

      if (data.success) {
        console.log('✅ Dados recebidos com sucesso:', data);
        console.log('✅ Items:', data.items);
        console.log('✅ Total items:', data.totalItems);
        console.log('✅ Cidade:', data.city);
        console.log('✅ Estado:', data.state);
        console.log('✅ Tipo de data.items:', typeof data.items);
        console.log('✅ Array?', Array.isArray(data.items));
        console.log('✅ Length:', data.items?.length);
        
        setProcessedData(data);
        setEditableItems([...data.items]); // Cópia editável
        setShowAddressEditor(true); // Mostrar editor automaticamente
        
        console.log('✅ Estado atualizado - processedData:', data);
        console.log('✅ Estado atualizado - editableItems:', [...data.items]);
        console.log('✅ Estado atualizado - showAddressEditor:', true);
        
        // ✅ VERIFICAÇÃO ADICIONAL: Aguardar atualização do estado
        setTimeout(() => {
          console.log('🔍 VERIFICAÇÃO POSTERIOR - processedData:', processedData);
          console.log('🔍 VERIFICAÇÃO POSTERIOR - showAddressEditor:', showAddressEditor);
        }, 100);
      } else {
        console.log('❌ Erro na resposta:', data.error);
        setError(data.error || 'Erro ao processar lista ECT');
      }
    } catch (err) {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAddressEdit = (index: number, newAddress: string) => {
    const updatedItems = [...editableItems];
    updatedItems[index] = { ...updatedItems[index], address: newAddress };
    setEditableItems(updatedItems);
  };

  const handleSaveAndGenerateRoute = async () => {
    if (!processedData) return;

    // Atualizar dados processados com endereços editados
    const updatedData = {
      ...processedData,
      items: editableItems
    };

    // Gerar nova URL do Google Maps com endereços corrigidos
    try {
      const response = await fetch('/api/carteiro/generate-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      const routeData = await response.json();
      
      if (routeData.success) {
        setProcessedData({
          ...updatedData,
          googleMapsUrl: routeData.googleMapsUrl
        });
        setShowAddressEditor(false);
      } else {
        setError('Erro ao gerar rota. Tente novamente.');
      }
    } catch (err) {
      setError('Erro ao gerar rota. Tente novamente.');
    }
  };

  const handleDiscardChanges = () => {
    setEditableItems([...processedData!.items]); // Restaurar original
    setShowAddressEditor(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-300">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <img 
              src="/logo-carro-azul-removebg-preview.png" 
              alt="Rota Fácil" 
              className="h-12 w-auto"
            />
            <h1 className="text-2xl font-bold">Versão Profissional para Carteiros</h1>
          </div>
          <button
            onClick={() => router.push('/')}
            className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
          >
            ← Voltar
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20 pb-24">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📸 Upload de Lista ECT
          </h2>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            {!isProcessing && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                📁 Selecionar Imagem da Lista ECT
              </button>
            )}

            {isProcessing && (
              <div className="text-blue-600">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                Processando imagem...
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            ❌ {error}
          </div>
        )}

        {/* Address Editor */}
        {showAddressEditor && editableItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✏️ Editor de Endereços
            </h2>
            <p className="text-gray-600 mb-4">
              Revise e edite os endereços extraídos antes de gerar a rota no Google Maps.
            </p>
            
            <div className="space-y-4">
              {editableItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      Item {item.sequence.toString().padStart(3, '0')} - {item.objectCode}
                    </span>
                    {item.cep && (
                      <span className="text-sm text-gray-500">CEP: {item.cep}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700 min-w-0">
                      Endereço:
                    </label>
                    <input
                      type="text"
                      value={item.address}
                      onChange={(e) => handleAddressEdit(index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite o endereço correto..."
                    />
                  </div>
                  
                  {item.lat && item.lng && (
                    <div className="text-xs text-gray-500 mt-1">
                      Coordenadas: {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveAndGenerateRoute}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                ✅ Salvar e Gerar Rota
              </button>
              <button
                onClick={handleDiscardChanges}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                ❌ Descartar Alterações
              </button>
            </div>
          </div>
        )}

        {/* Results Display */}
        {processedData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🎯 Resultados do Processamento
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-800 mb-2">📊 Estatísticas</h3>
                <p className="text-blue-700">Total de itens: {processedData.totalItems || 0}</p>
                <p className="text-blue-700">Cidade: {processedData.city || 'Não especificada'}</p>
                <p className="text-blue-700">Estado: {processedData.state || 'Não especificado'}</p>
              </div>
              
              {processedData.googleMapsUrl && (
                <div className="bg-green-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-green-800 mb-2">🗺️ Rota Gerada</h3>
                  <a
                    href={processedData.googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors inline-block"
                  >
                    🚀 Abrir no Google Maps
                  </a>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">📍 Endereços Processados</h3>
              {processedData.items && processedData.items.length > 0 ? (
                processedData.items.map((item, index) => (
                  <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">
                        {item.sequence?.toString().padStart(3, '0') || '000'} - {item.objectCode || 'N/A'}
                      </span>
                      {item.cep && (
                        <span className="text-sm text-gray-500">CEP: {item.cep}</span>
                      )}
                    </div>
                    <p className="text-gray-600">{item.address || 'Endereço não disponível'}</p>
                    {item.lat && item.lng && (
                      <p className="text-xs text-gray-500">
                        Coordenadas: {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-center py-4">
                  Nenhum endereço processado ainda.
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <button
                onClick={() => setShowAddressEditor(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                ✏️ Editar Endereços Novamente
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
