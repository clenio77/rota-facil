'use client'

import React, { useState, useRef } from 'react';

import { UserLocation } from '../../../hooks/useGeolocation';

interface PhotoUploadProps {
  onProcessingStart: () => void;
  onProcessingComplete: (data: unknown) => void;
  onError: (error: string) => void;
  userLocation?: UserLocation | null;
}

export default function PhotoUpload({ onProcessingStart, onProcessingComplete, onError, userLocation }: PhotoUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    if (!file.type.startsWith('image/')) {
      onError('Por favor, selecione apenas arquivos de imagem (JPG, PNG, GIF)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB
      onError('Arquivo muito grande. Máximo 10MB permitido.');
      return;
    }

    setSelectedFile(file);
    
    // Criar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files[0]);
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

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleProcessPhoto = async () => {
    if (!selectedFile) return;

    try {
      onProcessingStart();
      
      const formData = new FormData();
      formData.append('photo', selectedFile);
      
      // Adicionar localização do usuário se disponível
      if (userLocation) {
        formData.append('userLocation', JSON.stringify({
          lat: userLocation.lat,
          lng: userLocation.lng,
          city: userLocation.city,
          state: userLocation.state
        }));
      }
      
      const response = await fetch('/api/carteiro/process-photo', {
        method: 'POST',
        body: formData,
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
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Erro no processamento');
    }
  };

  const resetSelection = () => {
    setSelectedFile(null);
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Área de Upload */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver
            ? 'border-blue-400 bg-blue-50'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 bg-gray-50 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {!selectedFile ? (
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
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
            >
              Selecionar Foto
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
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
              {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={handleProcessPhoto}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 transition-colors"
              >
                🚀 Processar Foto
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
              Dica para carteiros
            </h4>
            <div className="mt-2 text-sm text-yellow-700">
              <p>
                Tire uma foto da tela do sistema Correios mostrando a lista de entregas. 
                Certifique-se de que todos os endereços estão visíveis e legíveis.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
