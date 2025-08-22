'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useDebounce } from '../hooks/useDebounce';

interface AddressSearchProps {
  onAddressSelect: (address: AddressResult) => void;
  placeholder?: string;
  userLocation?: { lat: number; lng: number; city?: string; state?: string };
  className?: string;
}

interface AddressResult {
  id: string;
  display_name: string;
  lat: number;
  lng: number;
  address: {
    house_number?: string;
    road?: string;
    neighbourhood?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
  type: string;
  importance: number;
  distance?: number;
}

export default function AddressSearch({
  onAddressSelect,
  placeholder = "Digite ou fale seu endereço...",
  userLocation,
  className = ""
}: AddressSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Estados para reconhecimento de voz
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Debounce da query para evitar muitas requisições
  const debouncedQuery = useDebounce(query, 300);

  // Buscar endereços quando a query mudar - BUSCA INSTANTÂNEA!
  useEffect(() => {
    if (debouncedQuery.length >= 1) { // 🚀 MUDANÇA: busca desde o 1º caractere!
      searchAddresses(debouncedQuery);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, userLocation]);

  const searchAddresses = async (searchQuery: string) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/address-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          userLocation,
          limit: 8
        })
      });

      const data = await response.json();
      
      if (data.success && data.results) {
        setResults(data.results);
        setIsOpen(true);
        setSelectedIndex(-1);
      } else {
        setResults([]);
        setIsOpen(false);
      }
    } catch (error) {
      console.error('Erro na busca de endereços:', error);
      setResults([]);
      setIsOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  // Inicializar reconhecimento de voz
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setSpeechSupported(true);
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        recognitionRef.current.lang = 'pt-BR';

        recognitionRef.current.onstart = () => {
          setIsListening(true);
          console.log('🎤 Reconhecimento de voz iniciado');
        };

        recognitionRef.current.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          console.log('🎤 Texto reconhecido:', transcript);
          setQuery(transcript);
          setIsListening(false);
        };

        recognitionRef.current.onerror = (event: any) => {
          console.error('🎤 Erro no reconhecimento:', event.error);
          setIsListening(false);
        };

        recognitionRef.current.onend = () => {
          setIsListening(false);
          console.log('🎤 Reconhecimento de voz finalizado');
        };
      }
    }
  }, []);

  const startListening = () => {
    if (recognitionRef.current && speechSupported) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Erro ao iniciar reconhecimento:', error);
        setIsListening(false);
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleResultClick = (result: AddressResult) => {
    setQuery(result.display_name);
    setIsOpen(false);
    onAddressSelect(result);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleResultClick(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const formatAddress = (result: AddressResult) => {
    const addr = result.address;
    const parts = [];
    
    if (addr.house_number && addr.road) {
      parts.push(`${addr.road}, ${addr.house_number}`);
    } else if (addr.road) {
      parts.push(addr.road);
    }
    
    if (addr.neighbourhood) parts.push(addr.neighbourhood);
    if (addr.city) parts.push(addr.city);
    if (addr.state) parts.push(addr.state);
    
    return parts.join(' - ');
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'house':
      case 'building':
        return '🏠';
      case 'road':
      case 'street':
        return '🛣️';
      case 'city':
      case 'town':
        return '🏙️';
      case 'neighbourhood':
        return '🏘️';
      default:
        return '📍';
    }
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input de busca */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.length >= 1 && setIsOpen(true)} // 🚀 Mostrar resultados desde o 1º caractere
          placeholder={isListening ? "🎤 Fale agora..." : placeholder}
          className={`w-full px-4 py-3 pl-12 pr-16 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent ${
            isListening
              ? 'border-red-300 focus:ring-red-500 bg-red-50'
              : 'border-gray-300 focus:ring-blue-500'
          }`}
        />
        
        {/* Ícone de busca */}
        <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        
        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        {/* Botões do lado direito */}
        {!isLoading && (
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
            {/* Botão de microfone - sempre visível quando suportado */}
            {speechSupported && (
              <button
                onClick={isListening ? stopListening : startListening}
                className={`p-1 rounded-full transition-colors ${
                  isListening
                    ? 'text-red-500 bg-red-50 hover:bg-red-100'
                    : 'text-gray-400 hover:text-blue-500 hover:bg-blue-50'
                }`}
                title={isListening ? 'Parar gravação' : 'Falar endereço'}
              >
                {isListening ? (
                  <svg className="w-5 h-5 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                )}
              </button>
            )}

            {/* Botão limpar - só aparece quando há texto */}
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setIsOpen(false);
                  inputRef.current?.focus();
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                title="Limpar busca"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Resultados da busca */}
      {isOpen && results.length > 0 && (
        <div 
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto"
        >
          {results.map((result, index) => (
            <div
              key={result.id || index}
              onClick={() => handleResultClick(result)}
              className={`px-4 py-3 cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-gray-50 ${
                index === selectedIndex ? 'bg-blue-50 border-blue-200' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-lg mt-0.5">{getResultIcon(result.type)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">
                    {formatAddress(result)}
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {result.display_name}
                  </div>
                  {result.distance && (
                    <div className="text-xs text-blue-600 mt-1">
                      📍 {result.distance.toFixed(1)}km de distância
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Mensagem quando não há resultados */}
      {isOpen && !isLoading && query.length >= 1 && results.length === 0 && ( // 🚀 Desde o 1º caractere
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Nenhum endereço encontrado</p>
            <p className="text-xs text-gray-400 mt-1">Tente ser mais específico</p>
          </div>
        </div>
      )}
    </div>
  );
}
