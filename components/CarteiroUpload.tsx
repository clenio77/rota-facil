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

// ✅ NOVA INTERFACE: Imagem processada
interface ProcessedImage {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedText?: string;
  addresses?: CarteiroAddress[];
  error?: string;
}

export default function CarteiroUpload({ onAddressesLoaded, userLocation }: CarteiroUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ success?: boolean; data?: unknown } | null>(null);
  
  // ✅ NOVO: Estado para múltiplas imagens
  const [processedImages, setProcessedImages] = useState<ProcessedImage[]>([]);
  const [showImageList, setShowImageList] = useState(false);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const multipleFileInputRef = useRef<HTMLInputElement>(null);

  // ✅ NOVA FUNÇÃO: Processar múltiplas imagens
  const handleMultipleImages = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    console.log(`📸 Processando ${files.length} imagens...`);

    // Validar arquivos
    const validFiles = files.filter(file => {
      const supportedExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'];
      const fileExtension = file.name.toLowerCase().split('.').pop();
      return fileExtension && supportedExtensions.includes(fileExtension);
    });

    if (validFiles.length !== files.length) {
      alert(`❌ ${files.length - validFiles.length} arquivo(s) não suportado(s). Use: JPG, PNG, GIF, BMP, WEBP`);
    }

    if (validFiles.length === 0) return;

    // Criar objetos de imagem processada
    const newImages: ProcessedImage[] = validFiles.map((file, index) => ({
      id: `img-${Date.now()}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'pending'
    }));

    setProcessedImages(prev => [...prev, ...newImages]);
    setShowImageList(true);
    setError(null);

    console.log(`✅ ${validFiles.length} imagens adicionadas para processamento`);
  };

  // ✅ NOVA FUNÇÃO: Processar imagem individual
  const processImage = async (image: ProcessedImage) => {
    if (image.status === 'processing') return;

    setProcessedImages(prev => prev.map(img =>
      img.id === image.id ? { ...img, status: 'processing' } : img
    ));

    try {
      const formData = new FormData();
      formData.append('image', image.file);
      
      if (userLocation) {
        formData.append('userLocation', JSON.stringify(userLocation));
      }

      console.log(`🔍 Processando imagem: ${image.file.name}`);

      const response = await fetch('/api/ocr/extract-addresses', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Erro na API: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Falha na extração');
      }

      setProcessedImages(prev => prev.map(img =>
        img.id === image.id ? {
          ...img,
          status: 'completed',
          extractedText: data.extractedText,
          addresses: data.addresses || []
        } : img
      ));

      console.log(`✅ Imagem processada: ${image.file.name} - ${data.addresses?.length || 0} endereços encontrados`);

    } catch (error) {
      console.error(`❌ Erro ao processar imagem ${image.file.name}:`, error);
      
      setProcessedImages(prev => prev.map(img =>
        img.id === image.id ? {
          ...img,
          status: 'error',
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        } : img
      ));
    }
  };

  // ✅ NOVA FUNÇÃO: Processar todas as imagens
  const processAllImages = async () => {
    const pendingImages = processedImages.filter(img => img.status === 'pending');
    
    if (pendingImages.length === 0) {
      alert('✅ Todas as imagens já foram processadas!');
      return;
    }

    setIsProcessingBatch(true);
    setUploadProgress(`Processando ${pendingImages.length} imagens...`);

    try {
      // Processar imagens em paralelo (máximo 3 simultâneas)
      const batchSize = 3;
      for (let i = 0; i < pendingImages.length; i += batchSize) {
        const batch = pendingImages.slice(i, i + batchSize);
        
        await Promise.all(batch.map(image => processImage(image)));
        
        setUploadProgress(`Processadas ${Math.min(i + batchSize, pendingImages.length)} de ${pendingImages.length} imagens...`);
        
        // Pequena pausa entre lotes para não sobrecarregar a API
        if (i + batchSize < pendingImages.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      setUploadProgress('✅ Todas as imagens processadas!');
      
      // Mostrar resumo
      const completedImages = processedImages.filter(img => img.status === 'completed');
      const totalAddresses = completedImages.reduce((sum, img) => sum + (img.addresses?.length || 0), 0);
      
      alert(`✅ Processamento concluído!\n\n📸 Imagens processadas: ${completedImages.length}\n📍 Total de endereços: ${totalAddresses}`);

    } catch (error) {
      console.error('❌ Erro no processamento em lote:', error);
      setError('Erro no processamento em lote. Verifique as imagens com erro.');
    } finally {
      setIsProcessingBatch(false);
      setTimeout(() => setUploadProgress(''), 3000);
    }
  };

  // ✅ NOVA FUNÇÃO: Gerar lista final
  const generateFinalList = () => {
    const completedImages = processedImages.filter(img => img.status === 'completed');
    
    if (completedImages.length === 0) {
      alert('❌ Nenhuma imagem foi processada com sucesso.');
      return;
    }

    // Consolidar todos os endereços
    const allAddresses: CarteiroAddress[] = [];
    let sequence = 1;

    completedImages.forEach(image => {
      console.log(`🔍 Processando imagem ${image.file.name}:`, image);
      
      if (image.addresses) {
        console.log(`📍 Endereços da imagem ${image.file.name}:`, image.addresses);
        
        image.addresses.forEach((address, index) => {
          console.log(`🔍 Endereço ${index + 1} da imagem ${image.file.name}:`, address);
          
                  // ✅ CONVERTER AddressResult para CarteiroAddress
        const carteiroAddress: CarteiroAddress = {
          id: `addr-${Date.now()}-${sequence}`,
          ordem: sequence.toString(),
          objeto: address.extractedText || `Endereço ${sequence}`,
          endereco: address.address,
          cep: address.extractedText.match(/CEP:\s*(\d{8})/)?.[1] || 'CEP não encontrado',
          destinatario: 'Endereço extraído da imagem',
          coordinates: address.coordinates,
          geocoded: !!address.coordinates
        };
          
          console.log(`✅ CarteiroAddress criado:`, carteiroAddress);
          
          allAddresses.push(carteiroAddress);
          sequence++;
        });
      } else {
        console.log(`⚠️ Imagem ${image.file.name} não tem endereços:`, image);
      }
    });

    if (allAddresses.length === 0) {
      alert('❌ Nenhum endereço foi extraído das imagens.');
      return;
    }

    console.log(`📋 Lista final gerada com ${allAddresses.length} endereços`);

    // ✅ NOVO: Criar dados do mapa
    const mapData: MapData = {
      center: userLocation ? { lat: userLocation.lat, lng: userLocation.lng } : { lat: -18.9186, lng: -48.2772 },
      zoom: 12,
      points: allAddresses.map((addr, index) => ({
        id: addr.id || `point-${index}`,
        position: addr.coordinates ? { lat: addr.coordinates.lat, lng: addr.coordinates.lng } : { lat: 0, lng: 0 },
        title: addr.endereco,
        description: `Objeto: ${addr.objeto} | CEP: ${addr.cep}`,
        type: 'delivery',
        order: index + 1,
        trackingCode: addr.objeto,
        confidence: addr.coordinates?.confidence || 0
      })),
      bounds: null
    };

    // Notificar componente pai
    onAddressesLoaded(allAddresses, mapData);
    
    // Limpar imagens processadas
    setProcessedImages([]);
    setShowImageList(false);
    
    alert(`✅ Lista final gerada com sucesso!\n\n📍 ${allAddresses.length} endereços\n🗺️ Mapa configurado\n\nAgora você pode otimizar a rota e iniciar no Google Maps.`);
  };

  // ✅ NOVA FUNÇÃO: Remover imagem
  const removeImage = (imageId: string) => {
    setProcessedImages(prev => {
      const image = prev.find(img => img.id === imageId);
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
      return prev.filter(img => img.id !== imageId);
    });
  };

  // ✅ NOVA FUNÇÃO: Limpar todas as imagens
  const clearAllImages = () => {
    if (!confirm('Deseja remover todas as imagens?')) return;
    
    processedImages.forEach(image => {
      URL.revokeObjectURL(image.previewUrl);
    });
    
    setProcessedImages([]);
    setShowImageList(false);
    setError(null);
  };

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

      setResult(data);
      setUploadProgress('Concluído!');

      // Notificar componente pai
      onAddressesLoaded(data.addresses, data.mapData);

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
          Faça upload de arquivos com endereços ou processe múltiplas imagens para gerar pontos no mapa
        </p>
        <div className="mt-2 text-xs text-gray-500">
          <strong>Formatos suportados:</strong> PDF, XLS, XLSX, CSV, KML, GPX, XML, JSON
        </div>
      </div>

      {/* ✅ NOVO: Seletor de modo */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setShowImageList(false)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            !showImageList 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📄 Arquivo Único
        </button>
        <button
          onClick={() => setShowImageList(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            showImageList 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📸 Múltiplas Imagens
        </button>
      </div>

      {!showImageList ? (
        // ✅ MODO ARQUIVO ÚNICO (existente)
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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-primary px-6 py-2"
              >
                Selecionar Arquivo
              </button>
            </div>
          )}
        </div>
      ) : (
        // ✅ NOVO MODO: MÚLTIPLAS IMAGENS
        <div className="space-y-4">
          {/* Área de upload de múltiplas imagens */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            <input
              ref={multipleFileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleMultipleImages}
              className="hidden"
            />
            
            <div className="text-4xl mb-3">📸</div>
            <p className="text-lg font-medium text-gray-700 mb-2">
              Processe múltiplas imagens de listas
            </p>
            <p className="text-sm text-gray-500 mb-4">
              Selecione várias imagens para extrair endereços em lote
            </p>
            
            <button
              onClick={() => multipleFileInputRef.current?.click()}
              className="btn-primary px-6 py-2"
            >
              Selecionar Imagens
            </button>
          </div>

          {/* Lista de imagens processadas */}
          {processedImages.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-lg font-medium text-gray-900">
                  📸 Imagens ({processedImages.length})
                </h4>
                <div className="flex gap-2">
                  <button
                    onClick={processAllImages}
                    disabled={isProcessingBatch || processedImages.every(img => img.status !== 'pending')}
                    className="btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {isProcessingBatch ? 'Processando...' : 'Processar Todas'}
                  </button>
                  <button
                    onClick={clearAllImages}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    Limpar Tudo
                  </button>
                </div>
              </div>

              {/* Progresso */}
              {isProcessingBatch && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-blue-700">{uploadProgress}</span>
                  </div>
                </div>
              )}

              {/* Grid de imagens */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedImages.map((image) => (
                  <div key={image.id} className="border border-gray-200 rounded-lg p-3">
                    {/* Preview da imagem */}
                    <div className="relative mb-3">
                      <img
                        src={image.previewUrl}
                        alt={image.file.name}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      
                      {/* Status badge */}
                      <div className={`absolute top-2 right-2 px-2 py-1 rounded-full text-xs font-medium ${
                        image.status === 'pending' ? 'bg-gray-500 text-white' :
                        image.status === 'processing' ? 'bg-blue-500 text-white' :
                        image.status === 'completed' ? 'bg-green-500 text-white' :
                        'bg-red-500 text-white'
                      }`}>
                        {image.status === 'pending' ? '⏳' :
                         image.status === 'processing' ? '🔄' :
                         image.status === 'completed' ? '✅' : '❌'}
                      </div>
                    </div>

                    {/* Informações da imagem */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-900 truncate" title={image.file.name}>
                        {image.file.name}
                      </p>
                      
                      <p className="text-xs text-gray-500">
                        {(image.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>

                      {/* Status específico */}
                      {image.status === 'completed' && image.addresses && (
                        <div className="text-xs text-green-600">
                          ✅ {image.addresses.length} endereço(s) extraído(s)
                        </div>
                      )}
                      
                      {image.status === 'error' && image.error && (
                        <div className="text-xs text-red-600">
                          ❌ {image.error}
                        </div>
                      )}

                      {/* Ações */}
                      <div className="flex gap-2">
                        {image.status === 'pending' && (
                          <button
                            onClick={() => processImage(image)}
                            className="btn-primary px-3 py-1 text-xs"
                          >
                            Processar
                          </button>
                        )}
                        
                        {image.status === 'completed' && (
                          <button
                            onClick={() => {
                              if (image.addresses) {
                                alert(`📋 Endereços extraídos:\n\n${image.addresses.map(addr => 
                                  `📍 ${addr.endereco}\n📦 ${addr.objeto}\n📮 ${addr.cep}`
                                ).join('\n\n')}`);
                              }
                            }}
                            className="btn-secondary px-3 py-1 text-xs"
                          >
                            Ver Endereços
                          </button>
                        )}
                        
                        <button
                          onClick={() => removeImage(image.id)}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Botão para gerar lista final */}
              {processedImages.some(img => img.status === 'completed') && (
                <div className="text-center pt-4 border-t border-gray-200">
                  <button
                    onClick={generateFinalList}
                    className="btn-primary px-8 py-3 text-lg"
                  >
                    🚀 Gerar Lista Final e Otimizar Rota
                  </button>
                  <p className="text-sm text-gray-500 mt-2">
                    Consolida todos os endereços extraídos e prepara para otimização
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Resultado do processamento */}
      {result && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
          <h4 className="font-medium text-green-800 mb-2">✅ Processamento concluído!</h4>
          <p className="text-sm text-green-700">
            {result.addresses?.length || 0} endereços carregados com sucesso.
          </p>
        </div>
      )}

      {/* Erro */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <h4 className="font-medium text-red-800 mb-2">❌ Erro no processamento</h4>
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}
    </div>
  );
}
