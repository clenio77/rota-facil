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
  const [streetQuery, setStreetQuery] = useState('');
  const [numberQuery, setNumberQuery] = useState('');
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchMode, setSearchMode] = useState<'street' | 'number' | 'combined'>('street');

  // Estados para reconhecimento de voz
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const streetInputRef = useRef<HTMLInputElement>(null);
  const numberInputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Debounce da query para evitar muitas requisições
  const debouncedStreetQuery = useDebounce(streetQuery, 300);
  const debouncedNumberQuery = useDebounce(numberQuery, 300);

  // ✅ INICIALIZAR RECONHECIMENTO DE VOZ
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      setSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.interimResults = false;
      recognitionRef.current.maxAlternatives = 1;

      recognitionRef.current.onstart = () => {
        setIsListening(true);
        console.log('🎤 Reconhecimento de voz iniciado');
      };

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        console.log('🎤 Voz capturada:', transcript);
        
        // ✅ PROCESSAR TRANSCRITO E SEPARAR RUA/NÚMERO
        const { street, number } = parseVoiceInput(transcript);
        
        setStreetQuery(street);
        if (number) {
          setNumberQuery(number);
        }
        
        // ✅ BUSCAR AUTOMATICAMENTE
        if (street.length >= 2) {
          const searchQuery = number ? `${street}, ${number}` : street;
          searchAddresses(searchQuery, number ? 'combined' : 'street');
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('❌ Erro no reconhecimento de voz:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
        console.log('🎤 Reconhecimento de voz finalizado');
      };
    } else {
      console.log('⚠️ Reconhecimento de voz não suportado');
    }
  }, []);

  // Buscar endereços quando a query mudar - BUSCA INTELIGENTE!
  useEffect(() => {
    if (debouncedStreetQuery.length >= 2) {
      const searchQuery = numberQuery ? `${debouncedStreetQuery}, ${numberQuery}` : debouncedStreetQuery;
      searchAddresses(searchQuery, numberQuery ? 'combined' : 'street');
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedStreetQuery, debouncedNumberQuery, userLocation]);

  const searchAddresses = async (searchQuery: string, mode: 'street' | 'number' | 'combined') => {
    // ❌ BLOQUEAR BUSCA SEM LOCALIZAÇÃO
    if (!userLocation) {
      console.error('❌ BUSCA BLOQUEADA: Localização obrigatória para buscar endereços');
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔍 Buscando endereços LOCALMENTE:', { searchQuery, userLocation, mode });
      
      const response = await fetch('/api/address-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery,
          userLocation,
          limit: 10,
          searchMode: mode,
          streetOnly: mode === 'street',
          numberOnly: mode === 'number'
        })
      });

      const data = await response.json();
      console.log('📥 Resposta da API:', data);
      
      if (data.success && data.results) {
        // ✅ PRIORIZAR resultados com número quando disponível
        const prioritizedResults = data.results.sort((a: AddressResult, b: AddressResult) => {
          const aHasNumber = a.address.house_number && a.address.house_number === numberQuery;
          const bHasNumber = b.address.house_number && b.address.house_number === numberQuery;
          
          if (aHasNumber && !bHasNumber) return -1;
          if (!aHasNumber && bHasNumber) return 1;
          
          return (b.importance || 0) - (a.importance || 0);
        });

        setResults(prioritizedResults);
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

  // ✅ NOVA FUNÇÃO: Extrair rua e número do texto falado
  const parseVoiceInput = (text: string): { street: string; number: string } => {
    const patterns = [
      /^(.+?)\s*,?\s*(\d+)$/i,           // "Rua ABC, 123"
      /^(.+?)\s+(\d+)$/i,                // "Rua ABC 123"
      /^(\d+)\s+(.+)$/i,                 // "123 Rua ABC"
      /^(.+?)\s+n[°º]?\s*(\d+)$/i,      // "Rua ABC nº 123"
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const [, part1, part2] = match;
        if (/^\d+$/.test(part1)) {
          return { street: part2.trim(), number: part1 };
        } else {
          return { street: part1.trim(), number: part2 };
        }
      }
    }

    // Se não conseguir separar, colocar tudo na rua
    return { street: text.trim(), number: '' };
  };

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

  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStreetQuery(e.target.value);
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNumberQuery(e.target.value);
  };

  const handleResultClick = (result: AddressResult) => {
    const displayAddress = numberQuery 
      ? `${result.address.road || streetQuery}, ${numberQuery}`
      : result.display_name;
    
    setStreetQuery(result.address.road || streetQuery);
    setNumberQuery(result.address.house_number || numberQuery);
    setIsOpen(false);
    
    // Criar resultado com endereço completo
    const completeResult = {
      ...result,
      display_name: displayAddress,
      address: {
        ...result.address,
        house_number: result.address.house_number || numberQuery
      }
    };
    
    onAddressSelect(completeResult);
    console.log('✅ Endereço selecionado:', completeResult);
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
    
    // ✅ PRIORIZAR: Mostrar rua + número primeiro
    if (addr.road) {
      const number = addr.house_number || numberQuery;
      if (number) {
        parts.push(`${addr.road}, ${number}`);
      } else {
        parts.push(addr.road);
      }
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

  const clearSearch = () => {
    setStreetQuery('');
    setNumberQuery('');
    setResults([]);
    setIsOpen(false);
    streetInputRef.current?.focus();
  };

  return (
    <div className={`relative ${className}`}>
      {/* ✅ NOVA INTERFACE: Campos separados para rua e número */}
      <div className="space-y-3">
        {/* Campo da Rua */}
        <div className="relative">
          <input
            ref={streetInputRef}
            type="text"
            value={streetQuery}
            onChange={handleStreetChange}
            onKeyDown={handleKeyDown}
            onFocus={() => streetQuery.length >= 2 && setIsOpen(true)}
            placeholder={userLocation ? "🎤 Digite ou fale o nome da rua" : "⚠️ Ative localização para buscar"}
            className="w-full px-4 py-3 pl-12 pr-16 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent border-gray-300 focus:ring-blue-500"
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
              {/* Botão de microfone */}
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

              {/* Botão limpar */}
              {streetQuery && (
                <button
                  onClick={clearSearch}
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

        {/* Campo do Número */}
        <div className="relative">
          <input
            ref={numberInputRef}
            type="text"
            value={numberQuery}
            onChange={handleNumberChange}
            placeholder="Número (opcional)"
            className="w-full px-4 py-3 pl-12 border rounded-lg focus:outline-none focus:ring-2 focus:border-transparent border-gray-300 focus:ring-blue-500"
          />
          
          {/* Ícone de número */}
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
            <span className="text-gray-400 text-lg">🔢</span>
          </div>
          
          {/* Dica de uso */}
          <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <span className="text-xs text-gray-400">Opcional</span>
          </div>
        </div>
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
                  {/* ✅ NOVO: Indicador de número encontrado */}
                  {result.address.house_number && (
                    <div className="text-xs text-green-600 mt-1">
                      ✅ Número: {result.address.house_number}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* Mensagem quando não há resultados */}
      {isOpen && !isLoading && streetQuery.length >= 2 && results.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4">
          <div className="text-center text-gray-500">
            <svg className="w-8 h-8 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">Nenhum endereço encontrado</p>
            <p className="text-xs text-gray-400 mt-1">
              {numberQuery ? 'Tente ajustar o número ou nome da rua' : 'Tente ser mais específico'}
            </p>
          </div>
        </div>
      )}

      {/* ✅ NOVA: Dicas de uso */}
      <div className="mt-2 text-xs text-gray-500 space-y-1">
        <p>💡 <strong>Dica:</strong> Digite o nome da rua primeiro, depois o número</p>
        <p>🎤 <strong>Voz:</strong> Fale "Rua Principal, 123" para preenchimento automático</p>
        {numberQuery && (
          <p className="text-blue-600">🔍 Buscando por: <strong>{streetQuery}, {numberQuery}</strong></p>
        )}
      </div>
    </div>
  );
}
