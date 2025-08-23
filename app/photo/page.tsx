'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  address?: string;
  lat?: number;
  lng?: number;
  error?: string;
}

export default function PhotoPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const newPhotos: PhotoItem[] = files.map(file => ({
      id: Date.now() + Math.random().toString(36).substr(2, 9),
      file,
      previewUrl: URL.createObjectURL(file),
      status: 'uploading'
    }));

    setPhotos(prev => [...prev, ...newPhotos]);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => {
      const photo = prev.find(p => p.id === id);
      if (photo) {
        URL.revokeObjectURL(photo.previewUrl);
      }
      return prev.filter(p => p.id !== id);
    });
  };

  const processPhoto = async (photo: PhotoItem): Promise<{ address: string; lat: number; lng: number }> => {
    // Simular processamento OCR
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Dados de exemplo - em produção seria OCR real
    const mockAddresses = [
      'Rua das Flores, 123, Uberlândia, MG',
      'Avenida Central, 456, Uberlândia, MG',
      'Travessa do Comércio, 789, Uberlândia, MG',
      'Rua da Paz, 321, Uberlândia, MG',
      'Avenida das Palmeiras, 654, Uberlândia, MG'
    ];
    
    const randomAddress = mockAddresses[Math.floor(Math.random() * mockAddresses.length)];
    const mockLat = -18.9 + (Math.random() - 0.5) * 0.1;
    const mockLng = -48.2 + (Math.random() - 0.5) * 0.1;
    
    return {
      address: randomAddress,
      lat: mockLat,
      lng: mockLng
    };
  };

  const handleProcessAllPhotos = async () => {
    if (photos.length === 0) return;
    
    setIsProcessing(true);
    
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      
      // Atualizar status para processando
      setPhotos(prev => prev.map(p => 
        p.id === photo.id ? { ...p, status: 'processing' } : p
      ));
      
      try {
        const result = await processPhoto(photo);
        
        // Atualizar com resultado
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'completed', ...result } : p
        ));
      } catch (error) {
        // Atualizar com erro
        setPhotos(prev => prev.map(p => 
          p.id === photo.id ? { ...p, status: 'error', error: 'Erro no processamento' } : p
        ));
      }
    }
    
    setIsProcessing(false);
    setShowResults(true);
  };

  const handleAddToStops = () => {
    const completedPhotos = photos.filter(p => p.status === 'completed');
    
    // Em produção, isso seria integrado com o sistema principal
    console.log('Adicionando às paradas:', completedPhotos);
    
    // Redirecionar para página principal com dados
    router.push('/?from=photo&photos=' + encodeURIComponent(JSON.stringify(completedPhotos)));
  };

  const handleClearAll = () => {
    photos.forEach(photo => URL.revokeObjectURL(photo.previewUrl));
    setPhotos([]);
    setShowResults(false);
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
            <div>
              <h1 className="text-2xl font-bold">ROTA FÁCIL</h1>
              <p className="text-sm opacity-90">MOURA PRO</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full"></div>
              <span className="text-sm">Sistema Inteligente</span>
            </div>
            <button
              onClick={() => router.push('/')}
              className="bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
            >
              ← Voltar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20 pb-24">
        {/* Upload Section */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📸 Captura de Fotos para Endereços
          </h2>
          
          <div className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              📁 Selecionar Fotos
            </button>
            
            <p className="text-gray-600 mt-2">
              Selecione uma ou várias fotos de endereços para processar
            </p>
          </div>
        </div>

        {/* Photos Grid */}
        {photos.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800">
                📷 Fotos Selecionadas ({photos.length})
              </h3>
              
              <div className="flex space-x-3">
                {!isProcessing && (
                  <button
                    onClick={handleProcessAllPhotos}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
                  >
                    🔄 Processar Todas
                  </button>
                )}
                
                <button
                  onClick={handleClearAll}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  🗑️ Limpar Tudo
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {photos.map((photo) => (
                <div key={photo.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="relative">
                    <img
                      src={photo.previewUrl}
                      alt="Preview"
                      className="w-full h-32 object-cover rounded-lg mb-3"
                    />
                    
                    <button
                      onClick={() => handleRemovePhoto(photo.id)}
                      className="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {photo.file.name}
                  </div>
                  
                  {/* Status Indicators */}
                  <div className="space-y-2">
                    {photo.status === 'uploading' && (
                      <div className="text-blue-600 text-sm">⏳ Aguardando processamento</div>
                    )}
                    
                    {photo.status === 'processing' && (
                      <div className="text-yellow-600 text-sm">🔄 Processando...</div>
                    )}
                    
                    {photo.status === 'completed' && (
                      <div className="text-green-600 text-sm">
                        ✅ {photo.address}
                      </div>
                    )}
                    
                    {photo.status === 'error' && (
                      <div className="text-red-600 text-sm">❌ {photo.error}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results Section */}
        {showResults && photos.some(p => p.status === 'completed') && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              🎯 Resultados do Processamento
            </h3>
            
            <div className="space-y-3 mb-6">
              {photos.filter(p => p.status === 'completed').map((photo) => (
                <div key={photo.id} className="border-l-4 border-green-500 pl-4 py-2">
                  <div className="flex items-center space-x-3">
                    <img
                      src={photo.previewUrl}
                      alt="Thumbnail"
                      className="w-12 h-12 object-cover rounded"
                    />
                    <div>
                      <p className="font-medium text-gray-800">{photo.address}</p>
                      <p className="text-sm text-gray-600">
                        Coordenadas: {photo.lat?.toFixed(6)}, {photo.lng?.toFixed(6)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleAddToStops}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                📍 Adicionar às Paradas
              </button>
              
              <button
                onClick={() => setShowResults(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                🔒 Ocultar Resultados
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
