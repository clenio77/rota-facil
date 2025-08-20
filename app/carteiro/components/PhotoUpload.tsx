'use client'

import React, { useState, useRef } from 'react';

import { UserLocation } from '../../../hooks/useGeolocation';
import AddressValidation from './AddressValidation';

interface ExtractedAddress {
  id: string;
  originalText: string;
  address: string;
  cep?: string;
  confidence?: number;
}

interface PhotoUploadProps {
  onProcessingStart: () => void;
  onProcessingComplete: (data: unknown) => void;
  onError: (error: string) => void;
  userLocation?: UserLocation | null;
}

export default function PhotoUpload({ onProcessingStart, onProcessingComplete, onError, userLocation }: PhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadMode, setUploadMode] = useState<'photo' | 'file'>('photo');
  const [showValidation, setShowValidation] = useState(false);
  const [extractedAddresses, setExtractedAddresses] = useState<ExtractedAddress[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList, mode: 'photo' | 'file') => {
    const fileArray = Array.from(files);
    
    if (mode === 'photo') {
      // Validar imagens
      const invalidFiles = fileArray.filter(file => !file.type.startsWith('image/'));
      if (invalidFiles.length > 0) {
        onError('Por favor, selecione apenas arquivos de imagem (JPG, PNG, GIF)');
        return;
      }
    } else {
      // Validar arquivos de dados
      const validExtensions = ['.xls', '.xlsx', '.gpx', '.kml', '.xml', '.csv'];
      const invalidFiles = fileArray.filter(file => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        return !validExtensions.includes(extension);
      });
      if (invalidFiles.length > 0) {
        onError('Por favor, selecione apenas arquivos válidos: XLS, XLSX, GPX, KML, XML, CSV');
        return;
      }
    }

    // Validar tamanho (máximo 10MB por arquivo)
    const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      onError('Arquivo muito grande. Máximo 10MB permitido por arquivo.');
      return;
    }

    setSelectedFiles(fileArray);
    
    // Criar preview apenas para imagens
    if (mode === 'photo' && fileArray.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(fileArray[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files, uploadMode);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handlePhotoInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files, 'photo');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files, 'file');
    }
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) return;

    try {
      onProcessingStart();

      const userLocationPayload = userLocation
        ? JSON.stringify({
            lat: userLocation.lat,
            lng: userLocation.lng,
            city: userLocation.city,
            state: userLocation.state,
          })
        : undefined;

      if (uploadMode === 'photo') {
        // 1) Tenta ECT primeiro com a primeira foto
        try {
          const ectForm = new FormData();
          ectForm.append('uploadType', uploadMode);
          if (userLocationPayload) ectForm.append('userLocation', userLocationPayload);
          ectForm.append('photo', selectedFiles[0]);

          const ectResponse = await fetch('/api/carteiro/process-ect-list', {
            method: 'POST',
            body: ectForm,
          });

          if (ectResponse.ok) {
            const ectResult = await ectResponse.json();
            if (ectResult.success && ectResult.ectData) {
              console.log('✅ Lista ECT detectada automaticamente!');
              onProcessingComplete(ectResult);
              return;
            }
          }
        } catch (error) {
          console.log('Tentando como foto comum...', error);
        }

        // 2) Fallback: OCR genérico para a primeira foto
        const fbForm = new FormData();
        fbForm.append('uploadType', uploadMode);
        if (userLocationPayload) fbForm.append('userLocation', userLocationPayload);
        fbForm.append('photo', selectedFiles[0]);

        const response = await fetch('/api/carteiro/process-photo-fallback', {
          method: 'POST',
          body: fbForm,
        });

        if (!response.ok) {
          throw new Error('Erro no processamento da foto');
        }

        const result = await response.json();
        if (result.success) {
          onProcessingComplete(result);
        } else {
          onError(result.error || 'Erro desconhecido no processamento');
        }
        return;
      }

      // 3) Arquivos (XLS, GPX, etc.)
      const filesForm = new FormData();
      filesForm.append('uploadType', uploadMode);
      if (userLocationPayload) filesForm.append('userLocation', userLocationPayload);
      selectedFiles.forEach((file) => filesForm.append('files', file));

      const response = await fetch('/api/carteiro/process-files', {
        method: 'POST',
        body: filesForm,
      });

      if (!response.ok) {
        throw new Error('Erro no processamento dos arquivos');
      }

      const result = await response.json();
      if (result.success) {
        onProcessingComplete(result);
      } else {
        onError(result.error || 'Erro desconhecido no processamento');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro no processamento');
    }
  };

  const handleValidatedAddresses = async (validatedAddresses: ExtractedAddress[]) => {
    setIsValidating(true);

    try {
      // Geocodificar endereços validados
      const geocodedAddresses: Array<{
        address: string;
        lat: number;
        lng: number;
        sequence: number;
        originalText: string;
        cep?: string;
        confidence?: number;
      }> = [];

      for (const addr of validatedAddresses) {
        try {
          const response = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              address: addr.address,
              userLocation: userLocation || undefined
            }),
          });

          const result = await response.json();

          if (result.success && result.lat && result.lng) {
            geocodedAddresses.push({
              address: result.address || addr.address,
              lat: result.lat,
              lng: result.lng,
              sequence: geocodedAddresses.length + 1,
              originalText: addr.originalText,
              cep: addr.cep,
              confidence: addr.confidence
            });
          }
        } catch (error) {
          console.error(`Erro ao geocodificar ${addr.address}:`, error);
        }
      }

      // Gerar dados de rota
      const routeData = {
        stops: geocodedAddresses,
        totalDistance: 0,
        totalTime: 0,
        googleMapsUrl: generateGoogleMapsUrl(geocodedAddresses)
      };

      setShowValidation(false);
      onProcessingComplete({ routeData });

    } catch (validationError) {
      console.error('Erro ao processar endereços validados:', validationError);
      onError('Erro ao processar endereços validados');
    } finally {
      setIsValidating(false);
    }
  };

  const generateGoogleMapsUrl = (addresses: Array<{lat: number; lng: number}>) => {
    if (addresses.length === 0) return '';

    const origin = `${addresses[0].lat},${addresses[0].lng}`;
    const destination = `${addresses[addresses.length - 1].lat},${addresses[addresses.length - 1].lng}`;
    const waypoints = addresses.slice(1, -1).map(addr => `${addr.lat},${addr.lng}`).join('|');

    const params = new URLSearchParams({
      api: '1',
      origin,
      destination,
      travelmode: 'driving'
    });

    if (waypoints) {
      params.set('waypoints', waypoints);
    }

    return `https://www.google.com/maps/dir/?${params.toString()}`;
  };

  const resetSelection = () => {
    setSelectedFiles([]);
    setPreview(null);
    setShowValidation(false);
    setExtractedAddresses([]);
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Modo de Upload */}
      <div className="bg-white rounded-lg border p-4">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Escolha o tipo de upload:</h3>
        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setUploadMode('photo')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              uploadMode === 'photo'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📸</div>
            <div className="font-medium">Fotos da Lista</div>
            <div className="text-sm opacity-75">Tire fotos da tela do Correios</div>
          </button>
          
          <button
            onClick={() => setUploadMode('file')}
            className={`p-4 rounded-lg border-2 transition-colors ${
              uploadMode === 'file'
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-300'
            }`}
          >
            <div className="text-2xl mb-2">📁</div>
            <div className="font-medium">Arquivos de Dados</div>
            <div className="text-sm opacity-75">XLS, GPX, KML, XML, CSV</div>
          </button>
        </div>
      </div>

      {/* Área de Upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : selectedFiles.length > 0
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {selectedFiles.length === 0 ? (
          <div>
            <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              <span className="text-4xl">📸</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Arraste e solte sua foto aqui
            </h3>
            <p className="text-gray-500 mb-4">
              ou clique para selecionar um arquivo
            </p>
            <button
              onClick={() => uploadMode === 'photo' ? photoInputRef.current?.click() : fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Selecionar {uploadMode === 'photo' ? 'Foto(s)' : 'Arquivo(s)'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoInputChange}
              className="hidden"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept=".xls,.xlsx,.gpx,.kml,.xml,.csv"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        ) : (
          <div>
            <div className="mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              <span className="text-4xl">✅</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Foto selecionada!
            </h3>
            <p className="text-gray-500 mb-4">
              {selectedFiles.length} {uploadMode === 'photo' ? 'foto(s)' : 'arquivo(s)'} selecionado(s)
              {selectedFiles.length === 1 && ` - ${selectedFiles[0].name} (${(selectedFiles[0].size / 1024 / 1024).toFixed(2)} MB)`}
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleProcessFiles}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                🚀 Processar {uploadMode === 'photo' ? 'Foto(s)' : 'Arquivo(s)'}
              </button>
              <button
                onClick={resetSelection}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors"
              >
                🔄 Trocar Foto
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Preview da Imagem */}
      {preview && (
        <div className="text-center">
          <h4 className="text-lg font-medium text-gray-900 mb-4">Preview da Imagem</h4>
          <div className="inline-block border-2 border-gray-200 rounded-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={preview}
              alt="Preview"
              className="max-w-full max-h-96 object-contain"
            />
          </div>
        </div>
      )}

      {/* Instruções */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <span className="text-yellow-400">💡</span>
          </div>
          <div className="ml-3">
            <h4 className="text-sm font-medium text-yellow-800">
              Dicas para carteiros
            </h4>
            <div className="mt-2 text-sm text-yellow-700">
              {uploadMode === 'photo' ? (
                <div>
                  <p className="font-medium mb-2">📸 Modo Foto:</p>
                  <p>Tire fotos da tela do sistema Correios.
                  Nossa IA detecta automaticamente listas ECT.</p>
                  <p className="mt-2 text-xs opacity-75">💡 Você pode selecionar múltiplas fotos de uma vez!</p>
                  <p className="mt-2 text-xs opacity-75">🎯 <strong>Listas ECT são detectadas automaticamente!</strong></p>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-2">📁 Modo Arquivo:</p>
                  <p>Faça upload dos arquivos exportados do sistema Correios: XLS, GPX, KML, XML ou CSV.</p>
                  <p className="mt-2 text-xs opacity-75">💡 Você pode selecionar múltiplos arquivos de uma vez!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Validação de Endereços */}
      {showValidation && (
        <AddressValidation
          extractedAddresses={extractedAddresses}
          onConfirm={handleValidatedAddresses}
          onCancel={() => setShowValidation(false)}
          isProcessing={isValidating}
        />
      )}
    </div>
  );
}