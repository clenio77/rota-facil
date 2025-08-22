'use client';

import React, { useState, useRef } from 'react';

interface SimpleAddress {
  original: string;
  geocoded?: {
    lat: number;
    lng: number;
    display_name: string;
    confidence: number;
    provider: string;
  };
  error?: string;
}

interface SimpleUploadProps {
  onAddressesLoaded: (addresses: SimpleAddress[]) => void;
  userLocation?: { lat: number; lng: number; city?: string; state?: string };
}

export default function SimpleUpload({ onAddressesLoaded, userLocation }: SimpleUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de arquivo
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setError('Tipo de arquivo não suportado. Use imagem (JPG, PNG) ou PDF.');
      return;
    }

    // Validar tamanho (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo 10MB.');
      return;
    }

    await processFile(file);
  };

  const processFile = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProgress('Iniciando processamento...');

    try {
      console.log('📁 Processando arquivo:', file.name, file.type, file.size);
      const formData = new FormData();
      formData.append('file', file);
      
      if (userLocation) {
        formData.append('userLocation', JSON.stringify(userLocation));
      }

      setProgress('Extraindo texto...');

      const response = await fetch('/api/ultra-simple-extract', {
        method: 'POST',
        body: formData,
      });

      // Debug: verificar se a resposta é válida
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Erro HTTP:', response.status, errorText);
        throw new Error(`Erro do servidor (${response.status}): ${errorText.substring(0, 200)}`);
      }

      const responseText = await response.text();
      console.log('Resposta da API:', responseText.substring(0, 500));

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Erro ao parsear JSON:', parseError);
        console.error('Resposta recebida:', responseText);
        throw new Error(`Resposta inválida do servidor. Recebido: ${responseText.substring(0, 100)}...`);
      }

      if (!data.success) {
        throw new Error(data.error || 'Erro no processamento');
      }

      setProgress('Processamento concluído!');
      setResult(data.data);

      // Chamar callback com os endereços processados
      onAddressesLoaded(data.data.addresses);

    } catch (error: any) {
      console.error('Erro no processamento:', error);
      setError(error.message || 'Erro desconhecido');
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const resetUpload = () => {
    setError(null);
    setResult(null);
    setProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-lg font-semibold mb-4">📄 Extração Simples de Endereços</h3>
      
      {/* Upload Area */}
      <div className="mb-4">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          disabled={isProcessing}
          className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
        />
        <p className="text-xs text-gray-500 mt-1">
          Suporte: Imagens (JPG, PNG) e PDF • Máximo 10MB
        </p>
      </div>

      {/* Progress */}
      {isProcessing && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            <span className="text-sm text-blue-700">{progress}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">❌ {error}</p>
          <button
            onClick={resetUpload}
            className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Result Summary */}
      {result && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-semibold text-green-800 mb-2">✅ Processamento Concluído</h4>
          <div className="text-sm text-green-700 space-y-1">
            <p>📍 <strong>{result.summary.total}</strong> endereços encontrados</p>
            <p>🌍 <strong>{result.summary.geocoded}</strong> geocodificados com sucesso</p>
            {result.summary.failed > 0 && (
              <p>❌ <strong>{result.summary.failed}</strong> falharam na geocodificação</p>
            )}
          </div>
          
          {/* Lista de endereços */}
          <div className="mt-3 max-h-40 overflow-y-auto">
            <p className="text-xs font-semibold text-green-800 mb-1">Endereços processados:</p>
            {result.addresses.map((addr: SimpleAddress, index: number) => (
              <div key={index} className="text-xs text-green-600 mb-1 p-1 bg-white rounded">
                <span className={addr.geocoded ? 'text-green-600' : 'text-red-600'}>
                  {addr.geocoded ? '✅' : '❌'}
                </span>
                <span className="ml-1">{addr.original}</span>
                {addr.geocoded && (
                  <span className="ml-2 text-gray-500">
                    ({addr.geocoded.provider}, conf: {(addr.geocoded.confidence * 100).toFixed(0)}%)
                  </span>
                )}
              </div>
            ))}
          </div>
          
          <button
            onClick={resetUpload}
            className="mt-3 text-xs text-green-600 hover:text-green-800 underline"
          >
            Processar outro arquivo
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="text-xs text-gray-500 space-y-1">
        <p><strong>⚠️ Sistema em desenvolvimento:</strong></p>
        <p>• A extração de imagens/PDF ainda está sendo ajustada</p>
        <p>• Por enquanto, use o botão "Falar endereço" para adicionar paradas</p>
        <p>• Ou digite endereços manualmente no campo de busca</p>
        <p>• Em breve a extração automática estará funcionando</p>
      </div>
    </div>
  );
}
