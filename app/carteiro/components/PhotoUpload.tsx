'use client'

import React, { useState, useRef } from 'react';

import { UserLocation } from '../../../hooks/useGeolocation';
import AddressValidation from './AddressValidation';
import { ImageOptimizer, ImageOptimizationResult } from '../../../lib/imageOptimizer';

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
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationResult, setOptimizationResult] = useState<ImageOptimizationResult | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList, mode: 'photo' | 'file') => {
    const fileArray = Array.from(files);

    if (mode === 'photo') {
      // Validar imagens
      const invalidFiles = fileArray.filter(file => !file.type.startsWith('image/'));
      if (invalidFiles.length > 0) {
        onError('Por favor, selecione apenas arquivos de imagem (JPG, PNG, GIF)');
        return;
      }

      // Otimizar imagens grandes
      const optimizedFiles: File[] = [];
      let totalOptimizationResult: ImageOptimizationResult | null = null;

      for (const file of fileArray) {
        if (ImageOptimizer.needsOptimization(file)) {
          setIsOptimizing(true);
          try {
            const result = await ImageOptimizer.optimizeForOCR(file);
            optimizedFiles.push(result.optimizedFile);
            totalOptimizationResult = result; // Guardar resultado da última otimização
            console.log(`Imagem otimizada: ${result.optimizations.join(', ')}`);
          } catch (error) {
            console.error('Erro na otimização:', error);
            optimizedFiles.push(file); // Usar arquivo original se otimização falhar
          }
        } else {
          optimizedFiles.push(file);
        }
      }

      setIsOptimizing(false);
      setOptimizationResult(totalOptimizationResult);
      setSelectedFiles(optimizedFiles);

      // Criar preview para primeira imagem otimizada
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreview(e.target?.result as string);
      };
      reader.readAsDataURL(optimizedFiles[0]);
    } else {
      // Validar arquivos de dados
      const validExtensions = ['.pdf', '.xls', '.xlsx', '.gpx', '.kml', '.xml', '.csv', '.json'];
      const invalidFiles = fileArray.filter(file => {
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        return !validExtensions.includes(extension);
      });
      if (invalidFiles.length > 0) {
        onError('Por favor, selecione apenas arquivos válidos: PDF, XLS, XLSX, GPX, KML, XML, CSV, JSON');
        return;
      }

      // Validar tamanho (máximo 10MB por arquivo para dados)
      const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024);
      if (oversizedFiles.length > 0) {
        onError('Arquivo muito grande. Máximo 10MB permitido por arquivo.');
        return;
      }

      setSelectedFiles(fileArray);
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
    setOptimizationResult(null);
    setIsOptimizing(false);
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
              accept=".pdf,.xls,.xlsx,.gpx,.kml,.xml,.csv,.json"
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
            {/* Informações de Otimização */}
            {optimizationResult && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                <div className="flex items-center mb-2">
                  <span className="mr-2">🚀</span>
                  <span className="font-medium text-blue-800">Imagem Otimizada para OCR</span>
                </div>
                <div className="text-blue-700 space-y-1">
                  <p>📏 Tamanho: {(optimizationResult.originalSize / 1024 / 1024).toFixed(2)} MB → {(optimizationResult.optimizedSize / 1024 / 1024).toFixed(2)} MB</p>
                  <p>📐 Dimensões: {optimizationResult.dimensions.original.width}x{optimizationResult.dimensions.original.height} → {optimizationResult.dimensions.optimized.width}x{optimizationResult.dimensions.optimized.height}</p>
                  <p>💾 Compressão: {optimizationResult.compressionRatio.toFixed(1)}x menor</p>
                  <div className="text-xs opacity-75 mt-2">
                    {optimizationResult.optimizations.map((opt, index) => (
                      <div key={index}>• {opt}</div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Indicador de Otimização */}
            {isOptimizing && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600 mr-2"></div>
                  <span className="font-medium text-yellow-800">Otimizando imagem para melhor OCR...</span>
                </div>
                <p className="text-yellow-700 text-xs mt-1">
                  Redimensionando e aplicando filtros para melhorar a extração de texto
                </p>
              </div>
            )}

            <div className="flex justify-center space-x-3">
              <button
                onClick={handleProcessFiles}
                disabled={isOptimizing}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                🚀 Processar {uploadMode === 'photo' ? 'Foto(s)' : 'Arquivo(s)'}
              </button>
              <button
                onClick={resetSelection}
                disabled={isOptimizing}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                  <p className="mt-2 text-xs opacity-75">🚀 <strong>Fotos grandes são otimizadas automaticamente para melhor OCR!</strong></p>
                </div>
              ) : (
                <div>
                  <p className="font-medium mb-2">📁 Modo Arquivo:</p>
                  <p>Faça upload dos arquivos com endereços: PDF, XLS, GPX, KML, XML, CSV ou JSON.</p>
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