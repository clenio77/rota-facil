'use client';

import React, { useState, useRef } from 'react';

interface CarteiroAddress {
  ordem: string;
  objeto: string;
  endereco: string;
  cep: string;
  destinatario?: string;
  coordinates?: {
    lat: number;
    lng: number;
    display_name: string;
    confidence: number;
  };
  geocoded: boolean;
}

interface MapData {
  center: { lat: number; lng: number };
  zoom: number;
  points: Array<{
    id: string;
    position: { lat: number; lng: number };
    title: string;
    description: string;
    type: string;
    order: number;
    trackingCode: string;
    confidence: number;
  }>;
  bounds: any;
}

interface CarteiroUploadProps {
  onAddressesLoaded: (addresses: CarteiroAddress[], mapData: MapData) => void;
  userLocation?: { lat: number; lng: number; city?: string; state?: string };
}

export default function CarteiroUpload({ onAddressesLoaded, userLocation }: CarteiroUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validações - Priorizar extensão sobre MIME type
    const supportedExtensions = ['pdf', 'xls', 'xlsx', 'csv', 'kml', 'gpx', 'xml', 'json'];
    const fileExtension = file.name.toLowerCase().split('.').pop();

    console.log('🔍 Arquivo selecionado:', {
      name: file.name,
      type: file.type,
      extension: fileExtension,
      size: file.size,
      isSupported: supportedExtensions.includes(fileExtension || '')
    });

    if (!fileExtension || !supportedExtensions.includes(fileExtension)) {
      console.error('❌ Extensão não suportada:', fileExtension);
      setError(`Formato não suportado: ${fileExtension}. Use: PDF, XLS, XLSX, CSV, KML, GPX, XML ou JSON`);
      return;
    }

    console.log('✅ Arquivo validado com sucesso');

    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB permitido.');
      return;
    }

    await uploadAndProcess(file);
  };

  const uploadAndProcess = async (file: File) => {
    setIsUploading(true);
    setError(null);
    setResult(null);
    setUploadProgress('Enviando arquivo...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      
      if (userLocation) {
        formData.append('userLocation', JSON.stringify(userLocation));
      }

      setUploadProgress('Processando arquivo...');

      console.log('Enviando arquivo para API:', file.name);

      const response = await fetch('/api/carteiro/process-pdf', {
        method: 'POST',
        body: formData
      });

      console.log('Resposta da API:', response.status, response.statusText);

      const data = await response.json();
      console.log('Dados retornados:', data);

      if (!data.success) {
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      setResult(data.data);
      setUploadProgress('Concluído!');

      // Notificar componente pai
      onAddressesLoaded(data.data.addresses, data.data.mapData);

    } catch (error) {
      console.error('Erro no upload:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsUploading(false);
      setTimeout(() => setUploadProgress(''), 3000);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files[0];

    if (file) {
      const supportedExtensions = ['pdf', 'xls', 'xlsx', 'csv', 'kml', 'gpx', 'xml', 'json'];
      const fileExtension = file.name.toLowerCase().split('.').pop();

      console.log('Arquivo arrastado:', {
        name: file.name,
        type: file.type,
        extension: fileExtension,
        size: file.size
      });

      if (supportedExtensions.includes(fileExtension || '')) {
        uploadAndProcess(file);
      } else {
        setError('Formato não suportado. Use: PDF, XLS, XLSX, CSV, KML, GPX, XML ou JSON');
      }
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          📋 Lista de Carteiro
        </h3>
        <p className="text-sm text-gray-600">
          Faça upload de arquivos com endereços para gerar pontos no mapa
        </p>
        <div className="mt-2 text-xs text-gray-500">
          <strong>Formatos suportados:</strong> PDF, XLS, XLSX, CSV, KML, GPX, XML, JSON
        </div>
      </div>

      {/* Área de Upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isUploading
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          disabled={isUploading}
        />

        {isUploading ? (
          <div className="space-y-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-blue-600 font-medium">{uploadProgress}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-4xl">📄</div>
            <div>
              <p className="text-lg font-medium text-gray-700 mb-1">
                Arraste o arquivo aqui ou clique para selecionar
              </p>
              <p className="text-sm text-gray-500">
                Máximo 10MB • PDF, XLS, CSV, KML, XML, JSON
              </p>
            </div>
            <div className="space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Selecionar Arquivo
              </button>

              <button
                onClick={async () => {
                  // Teste direto com o PDF existente
                  const response = await fetch('/302.pdf');
                  const blob = await response.blob();
                  const file = new File([blob], '302.pdf', { type: 'application/pdf' });
                  await uploadAndProcess(file);
                }}
                className="px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
              >
                Testar PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Erro */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center space-x-2">
            <span className="text-red-500">⚠️</span>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center space-x-2 mb-3">
            <span className="text-green-500">✅</span>
            <h4 className="font-medium text-green-800">Processamento Concluído</h4>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total de endereços:</span>
              <span className="ml-2 font-medium">{result.total}</span>
            </div>
            <div>
              <span className="text-gray-600">Geocodificados:</span>
              <span className="ml-2 font-medium text-green-600">{result.geocoded}</span>
            </div>
          </div>

          {result.geocoded < result.total && (
            <div className="mt-2 text-xs text-amber-600">
              ⚠️ Alguns endereços não puderam ser geocodificados
            </div>
          )}
        </div>
      )}

      {/* Lista de Endereços */}
      {result && result.addresses && (
        <div className="mt-4">
          <h4 className="font-medium text-gray-900 mb-3">
            Endereços Encontrados ({result.addresses.length})
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {result.addresses.map((address: CarteiroAddress, index: number) => (
              <div
                key={index}
                className={`p-3 rounded-lg border text-sm ${
                  address.geocoded
                    ? 'bg-green-50 border-green-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {address.ordem}. {address.endereco}
                    </div>
                    <div className="text-gray-600">
                      CEP: {address.cep} • {address.objeto}
                    </div>
                    {address.coordinates && (
                      <div className="text-xs text-gray-500 mt-1">
                        📍 {address.coordinates.lat.toFixed(6)}, {address.coordinates.lng.toFixed(6)}
                        {address.coordinates.confidence && (
                          <span className="ml-2">
                            Confiança: {(address.coordinates.confidence * 100).toFixed(0)}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="ml-2">
                    {address.geocoded ? (
                      <span className="text-green-500">✅</span>
                    ) : (
                      <span className="text-red-500">❌</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
