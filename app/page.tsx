'use client'

import React, { useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import StopCard from '../components/StopCard';
import CityIndicator from '../components/CityIndicator';
import { getSupabase } from '../lib/supabaseClient';
import { useGeolocation, UserLocation } from '../hooks/useGeolocation';
import Dashboard from '../components/Dashboard';
import VoiceControl, { useVoiceCommands } from '../components/VoiceControl';
import OfflineStatusIndicator, { useOfflineActions } from '../components/OfflineStatus';
import ProofOfDeliveryModal, { useProofOfDelivery } from '../components/ProofOfDelivery';
import { analytics } from '../lib/analytics';
import { voiceCommands } from '../lib/voiceCommands';
import { offlineManager } from '../lib/offlineManager';
import { proofOfDelivery } from '../lib/proofOfDelivery';
import Footer from '../components/Footer';
// SpeechRecognition types for browsers (ambient declarations)
// Minimal subset to type usage without depending on lib.dom updates
interface MinimalSpeechRecognitionEventResult {
  transcript: string;
}
interface MinimalSpeechRecognitionResult {
  0: MinimalSpeechRecognitionEventResult;
}
interface MinimalSpeechRecognitionEventResults {
  0: MinimalSpeechRecognitionResult;
}
interface MinimalSpeechRecognitionEvent {
  results: MinimalSpeechRecognitionEventResults;
}
type MinimalSpeechRecognitionHandler = (e: MinimalSpeechRecognitionEvent) => void;

interface MinimalSpeechRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: MinimalSpeechRecognitionHandler;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
}
type MinimalSpeechRecognitionConstructor = new () => MinimalSpeechRecognition;
declare global {
  interface Window {
    SpeechRecognition?: MinimalSpeechRecognitionConstructor;
    webkitSpeechRecognition?: MinimalSpeechRecognitionConstructor;
  }
}

const MapDisplay = dynamic(() => import('../components/MapDisplay'), {
  ssr: false,
  loading: () => <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">Carregando mapa...</div>
});

interface Stop {
  id: number;
  photoUrl: string;
  status: 'uploading' | 'processing' | 'confirmed' | 'error' | 'optimized';
  address: string;
  lat?: number;
  lng?: number;
  sequence?: number;
}

interface OptimizedStop extends Stop {
  sequence: number;
}

interface OptimizeResponse {
  success: boolean;
  optimizedStops: OptimizedStop[];
  distance?: number;
  duration?: number;
  geometry?: {
    type: string;
    coordinates: [number, number][];
  };
  error?: string;
}

export default function HomePage() {
  const STORAGE_KEY = 'rotafacil:stops:v1';
  const [stops, setStops] = useState<Stop[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Route summary state
  const [routeDistanceKm, setRouteDistanceKm] = useState<number | undefined>(undefined);
  const [routeDurationMin, setRouteDurationMin] = useState<number | undefined>(undefined);
  const [routeGeometry, setRouteGeometry] = useState<{ type: string; coordinates: [number, number][] } | undefined>(undefined);
  const [routeProvider, setRouteProvider] = useState<string | undefined>(undefined);

  // Voice input state
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const recognitionRef = useRef<MinimalSpeechRecognition | null>(null);
  const [useDeviceOrigin, setUseDeviceOrigin] = useState(false);
  const { position: deviceLocation, isLoading, refresh } = useGeolocation();
  const [deviceOrigin, setDeviceOrigin] = useState<UserLocation | undefined>(undefined);
  const [roundtrip, setRoundtrip] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);

  // 🚀 NOVOS ESTADOS PARA FUNCIONALIDADES AVANÇADAS
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [currentDeliveryIndex, setCurrentDeliveryIndex] = useState(0);
  const [isProofModalOpen, setIsProofModalOpen] = useState(false);
  const [currentProofStop, setCurrentProofStop] = useState<{ id: number; address: string } | null>(null);

  // 🔄 OFFLINE ACTIONS
  const { queueAction, cacheData, getCachedData } = useOfflineActions();

  // 📸 PROOF OF DELIVERY
  const { proofs, loadProofs } = useProofOfDelivery();

  // Sync settings modal with URL hash (#settings)
  React.useEffect(() => {
    const handler = () => {
      setIsSettingsOpen(window.location.hash === '#settings');
    };
    handler();
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);

  // Load stops from localStorage on first render
  React.useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (raw) {
        const parsed = JSON.parse(raw) as Stop[];
        if (Array.isArray(parsed)) {
          setStops(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Persist stops to localStorage on change
  React.useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stops));
      }
    } catch {
      // ignore
    }
  }, [stops]);

  // Função para capturar imagem
  const handleImageCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Criar preview local
    const localUrl = URL.createObjectURL(file);
    const newStop: Stop = {
      id: Date.now(),
      photoUrl: localUrl,
      status: 'uploading',
      address: '',
    };

    setStops(prev => [...prev, newStop]);

    try {
      // VERIFICAR SE SUPABASE ESTÁ CONFIGURADO
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('seu-projeto') || supabaseKey.includes('sua-chave')) {
        console.log('🧪 MODO TESTE: Supabase não configurado, simulando processamento');

        // Simular delay de upload
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Atualizar status para processando
        setStops(prev => prev.map(stop =>
          stop.id === newStop.id
            ? { ...stop, status: 'processing' }
            : stop
        ));

        // Simular delay de processamento
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        // MODO REAL: Upload para Supabase Storage
        console.log('📤 MODO REAL: Fazendo upload para Supabase');
        const fileName = `delivery-${Date.now()}-${file.name}`;
        const supabase = getSupabase();
        const { error: uploadError } = await supabase.storage
          .from('delivery-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('delivery-photos')
          .getPublicUrl(fileName);

        console.log('Upload concluído:', { fileName, publicUrl });

        // Atualizar status para processando
        setStops(prev => prev.map(stop =>
          stop.id === newStop.id
            ? { ...stop, photoUrl: publicUrl, status: 'processing' }
            : stop
        ));
      }

      // VERIFICAR MODO DE OPERAÇÃO
      const isTestMode = !supabaseUrl || !supabaseKey || supabaseUrl.includes('seu-projeto') || supabaseKey.includes('sua-chave');

      if (isTestMode) {
        // MODO TESTE: Simular diferentes cenários de OCR
        const testScenarios = [
          {
            name: 'Endereço de São Paulo (rejeitado)',
            result: {
              success: false,
              error: '❌ TESTE: Endereço rejeitado: "Rua Augusta, 123, São Paulo, SP" não está em Uberlândia, MG. Configure o Supabase para usar OCR real.',
              address: 'Rua Augusta, 123, São Paulo, SP',
              extractedText: 'Rua Augusta, 123\nSão Paulo, SP',
              confidence: 0.8,
              lat: null,
              lng: null
            }
          },
          {
            name: 'Endereço de Uberlândia (aceito)',
            result: {
              success: true,
              address: 'Rua Coronel Antônio Alves, 1234, Uberlândia, MG',
              extractedText: 'Rua Coronel Antônio Alves, 1234\nUberlândia, MG',
              confidence: 0.9,
              lat: -18.9186,
              lng: -48.2772
            }
          }
        ];

        // Alternar entre cenários a cada teste
        const scenarioIndex = stops.length % testScenarios.length;
        const scenario = testScenarios[scenarioIndex];
        const result = scenario.result;

        console.log(`🧪 MODO TESTE: ${scenario.name}`, result);
      } else {
        // MODO REAL: Chamar API de OCR
        console.log('🔍 MODO REAL: Processando OCR');
        const response = await fetch('/api/ocr-process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageUrl: publicUrl,
            userLocation: deviceOrigin || deviceLocation || undefined
          }),
        });

        const result = await response.json();
        console.log('📍 Resultado OCR real:', result);
      }

      if (result.success) {
        setStops(prev => {
          const updatedStops = prev.map(stop =>
            stop.id === newStop.id
              ? {
                  ...stop,
                  status: 'confirmed',
                  address: result.address,
                  lat: result.lat,
                  lng: result.lng
                }
              : stop
          );

          // 📊 INICIAR SESSÃO DE ANALYTICS se for a primeira parada confirmada
          const confirmedCount = updatedStops.filter(s => s.status === 'confirmed').length;
          if (confirmedCount === 1 && !currentSessionId) {
            const sessionId = analytics.startDeliverySession(
              1, // Começar com 1, será atualizado conforme mais paradas são adicionadas
              {
                city: result.address.includes(',') ? result.address.split(',').slice(-2)[0]?.trim() || 'Desconhecida' : 'Desconhecida',
                state: result.address.includes(',') ? result.address.split(',').slice(-1)[0]?.trim() || 'Desconhecido' : 'Desconhecido'
              }
            );
            setCurrentSessionId(sessionId);
            console.log('📊 Sessão de analytics iniciada:', sessionId);
          }

          return updatedStops;
        });
      } else {
        throw new Error(result.error || 'Erro ao processar imagem');
      }
    } catch (error) {
      console.error('Erro no processamento:', error);

      // Mostrar erro específico se for problema de URL blob
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (errorMessage.includes('blob')) {
        alert('❌ Problema no upload da imagem. Por favor, tire uma nova foto.');
        // Remover a parada com problema
        setStops(prev => prev.filter(stop => stop.id !== newStop.id));
      } else {
        setStops(prev => prev.map(stop =>
          stop.id === newStop.id
            ? { ...stop, status: 'error' }
            : stop
        ));
      }
    }

    // Limpar input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remover parada
  const handleRemove = (id: number) => {
    setStops(prev => prev.filter(stop => stop.id !== id));
  };

  // Retentar processamento
  const handleRetry = async (id: number) => {
    const stop = stops.find(s => s.id === id);
    if (!stop) return;

    // Verificar se a URL é blob (problema conhecido)
    if (stop.photoUrl.startsWith('blob:')) {
      console.error('Tentativa de reprocessar URL blob - isso não funcionará');
      alert('Erro: Não é possível reprocessar esta imagem. Por favor, tire uma nova foto.');
      return;
    }

    setStops(prev => prev.map(s =>
      s.id === id ? { ...s, status: 'processing' } : s
    ));

    try {
      const response = await fetch('/api/ocr-process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: stop.photoUrl,
          userLocation: deviceOrigin || deviceLocation || undefined
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStops(prev => prev.map(s => 
          s.id === id 
            ? { 
                ...s, 
                status: 'confirmed', 
                address: result.address,
                lat: result.lat,
                lng: result.lng
              }
            : s
        ));
      } else {
        throw new Error(result.error || 'Erro ao processar imagem');
      }
    } catch (error) {
      console.error('Erro:', error);
      setStops(prev => prev.map(s => 
        s.id === id ? { ...s, status: 'error' } : s
      ));
    }
  };

  // Otimizar rota
  const handleOptimizeRoute = async () => {
    const validStops = stops.filter(s => s.status === 'confirmed' && s.lat && s.lng);
    if (validStops.length < 2) {
      alert('Adicione pelo menos 2 paradas confirmadas para otimizar a rota');
      return;
    }

    setIsOptimizing(true);

    try {
      const response = await fetch('/api/route-optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stops: validStops.map(s => ({ id: s.id, lat: s.lat, lng: s.lng })),
          origin: useDeviceOrigin && deviceOrigin ? deviceOrigin : undefined,
          roundtrip,
        }),
      });

      const result: OptimizeResponse = await response.json();

      if (result.success) {
        // Atualizar paradas com sequência otimizada
        const optimizedStops = stops.map(stop => {
          const optimizedData = result.optimizedStops.find((os) => os.id === stop.id);
          if (optimizedData) {
            return {
              ...stop,
              sequence: optimizedData.sequence,
              status: 'optimized' as const,
            };
          }
          return stop;
        });

        setStops(optimizedStops);
        setShowMap(true);
        setRouteDistanceKm(result.distance);
        setRouteDurationMin(result.duration);
        setRouteGeometry(result.geometry);
        setRouteProvider((result as { provider?: string }).provider);
      } else {
        throw new Error(result.error || 'Erro ao otimizar rota');
      }
    } catch (error) {
      console.error('Erro:', error);
      alert('Erro ao otimizar rota. Tente novamente.');
    } finally {
      setIsOptimizing(false);
    }
  };

  const confirmedStops = stops.filter(s => s.status === 'confirmed' || s.status === 'optimized');
  const optimizedStops = confirmedStops
    .filter(s => typeof s.sequence === 'number')
    .sort((a, b) => (a.sequence || 0) - (b.sequence || 0));

  // 🎤 VOICE COMMANDS HANDLERS
  const voiceCommandHandlers = {
    next_delivery: () => {
      const route = optimizedStops.length > 0 ? optimizedStops : confirmedStops;
      if (currentDeliveryIndex < route.length - 1) {
        setCurrentDeliveryIndex(prev => prev + 1);
        const nextStop = route[currentDeliveryIndex + 1];
        voiceCommands.speak({
          text: `Próxima entrega: ${nextStop.address}`,
          priority: 'high'
        });
      } else {
        voiceCommands.speak({
          text: 'Esta é a última entrega da rota.',
          priority: 'medium'
        });
      }
    },

    previous_delivery: () => {
      if (currentDeliveryIndex > 0) {
        setCurrentDeliveryIndex(prev => prev - 1);
        const route = optimizedStops.length > 0 ? optimizedStops : confirmedStops;
        const prevStop = route[currentDeliveryIndex - 1];
        voiceCommands.speak({
          text: `Entrega anterior: ${prevStop.address}`,
          priority: 'high'
        });
      } else {
        voiceCommands.speak({
          text: 'Esta é a primeira entrega da rota.',
          priority: 'medium'
        });
      }
    },

    show_map: () => {
      setShowMap(true);
      voiceCommands.speak({
        text: 'Mapa exibido.',
        priority: 'medium'
      });
    },

    start_route: () => {
      handleStartRoute();
      voiceCommands.speak({
        text: 'Iniciando navegação no Google Maps.',
        priority: 'high'
      });
    },

    mark_delivered: async () => {
      const route = optimizedStops.length > 0 ? optimizedStops : confirmedStops;
      const currentStop = route[currentDeliveryIndex];
      if (currentStop) {
        // 📸 ABRIR MODAL DE COMPROVAÇÃO
        setCurrentProofStop({
          id: currentStop.id,
          address: currentStop.address
        });
        setIsProofModalOpen(true);

        voiceCommands.speak({
          text: 'Abrindo tela de comprovação de entrega.',
          priority: 'high'
        });
      }
    },

    show_dashboard: () => {
      setIsDashboardOpen(true);
      voiceCommands.speak({
        text: 'Dashboard de estatísticas aberto.',
        priority: 'medium'
      });
    },

    show_help: () => {
      voiceCommands.speak({
        text: 'Comandos disponíveis: próxima entrega, entregue, mostrar mapa, iniciar rota, dashboard, ajuda.',
        priority: 'high'
      });
    },

    stop_speaking: () => {
      voiceCommands.stopSpeaking();
    },

    repeat_last: () => {
      voiceCommands.repeatLast();
    }
  };

  // Configurar handlers de voz
  useVoiceCommands(voiceCommandHandlers);

  // 📸 HANDLER DE COMPROVAÇÃO CAPTURADA
  const handleProofCaptured = async (proof: any) => {
    if (!currentProofStop) return;

    // Marcar parada como entregue
    setStops(prev => prev.map(stop =>
      stop.id === currentProofStop.id
        ? { ...stop, status: 'delivered' as any }
        : stop
    ));

    // 🔄 QUEUE OFFLINE ACTION
    await queueAction('delivery_update', {
      stopId: currentProofStop.id,
      status: 'delivered',
      timestamp: Date.now(),
      address: currentProofStop.address,
      proofId: proof.id
    });

    // 🔄 QUEUE ANALYTICS UPDATE
    await queueAction('analytics_update', {
      sessionId: currentSessionId,
      deliveryCompleted: true,
      timestamp: Date.now()
    });

    console.log('📸 Comprovação capturada:', proof);

    // Avançar para próxima entrega
    const route = optimizedStops.length > 0 ? optimizedStops : confirmedStops;
    if (currentDeliveryIndex < route.length - 1) {
      setTimeout(() => {
        setCurrentDeliveryIndex(prev => prev + 1);
        const nextStop = route[currentDeliveryIndex + 1];
        voiceCommands.speak({
          text: `Comprovação salva. Próxima entrega: ${nextStop.address}`,
          priority: 'medium'
        });
      }, 1000);
    } else {
      voiceCommands.speak({
        text: 'Comprovação salva. Todas as entregas concluídas!',
        priority: 'high'
      });
    }

    // Recarregar lista de comprovações
    loadProofs();
  };

  // Verificar se está em modo de teste
  const isTestMode = typeof window !== 'undefined' && (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('seu-projeto') ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('sua-chave')
  );

  // Voice capture handlers
  const startListening = () => {
    if (typeof window === 'undefined') return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Seu navegador não suporta reconhecimento de voz.');
      return;
    }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      const text = e.results && e.results[0] && e.results[0][0]
        ? e.results[0][0].transcript
        : '';
      setVoiceText(text);
      setIsVoiceDialogOpen(true);
    };
    rec.onerror = () => setIsListening(false);
    rec.onend = () => setIsListening(false);
    recognitionRef.current = rec;
    setIsListening(true);
    rec.start();
  };

  // Start route via Google Maps deep link
  const handleStartRoute = async () => {
    const route = optimizedStops.length > 0 ? optimizedStops : confirmedStops;
    if (route.length < 2) {
      alert('Otimize a rota ou confirme pelo menos 2 paradas.');
      return;
    }

    // 📊 FINALIZAR SESSÃO DE ANALYTICS (simulando entrega completa)
    if (currentSessionId) {
      const totalDistance = routeDistanceKm || 0;
      const completedStops = route.length;
      const routeOptimized = optimizedStops.length > 0;

      analytics.endDeliverySession(
        currentSessionId,
        completedStops,
        totalDistance,
        routeOptimized
      );

      console.log('📊 Sessão de analytics finalizada:', {
        sessionId: currentSessionId,
        completedStops,
        totalDistance,
        routeOptimized
      });

      // Reset session
      setCurrentSessionId(null);
    }

    // 🔄 CACHE ROUTE DATA
    await cacheData('current_route', {
      stops: route,
      startTime: Date.now(),
      totalDistance: routeDistanceKm,
      totalTime: routeDurationMin
    }, 'high', 24); // Cache por 24 horas
    const useOrigin = useDeviceOrigin && deviceOrigin;
    const originStr = useOrigin && deviceOrigin ? `${deviceOrigin.lat},${deviceOrigin.lng}` : `${route[0].lat},${route[0].lng}`;
    const destinationStr = roundtrip && useOrigin && deviceOrigin
      ? `${deviceOrigin.lat},${deviceOrigin.lng}`
      : `${route[route.length - 1].lat},${route[route.length - 1].lng}`;

    // Build waypoints excluding destination (and origin if using device)
    const innerStops = (() => {
      if (useOrigin && deviceOrigin) {
        // when origin is device, include all stops; exclude last if roundtrip=false and destination is last stop
        return route.slice(0, roundtrip ? route.length : route.length - 1);
      }
      // when origin is first stop, waypoints are middle stops
      return route.slice(1, route.length - 1);
    })();
    const waypointsStr = innerStops
      .filter(s => s.lat && s.lng)
      .map(s => `${s.lat},${s.lng}`)
      .join('|');

    const params = new URLSearchParams({
      api: '1',
      origin: originStr,
      destination: destinationStr,
      travelmode: 'driving',
    });
    if (waypointsStr) params.set('waypoints', waypointsStr);
    const url = `https://www.google.com/maps/dir/?${params.toString()}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  };

  // Clear route list
  const handleClearStops = () => {
    if (!confirm('Deseja limpar todas as paradas?')) return;
    setStops([]);
    setShowMap(false);
    setRouteDistanceKm(undefined);
    setRouteDurationMin(undefined);
    setRouteGeometry(undefined);
    setRouteProvider(undefined);
    if (typeof window !== 'undefined') {
      try { window.localStorage.removeItem('rotafacil:stops:v1'); } catch {}
    }
  };

  const stopListening = () => {
    recognitionRef.current?.stop?.();
  };

  // MODO TESTE: Função para testar diferentes cenários
  const _handleTestScenario = (scenarioType: 'rejected' | 'accepted') => {
    const testScenarios = {
      rejected: {
        name: 'Endereço de São Paulo (rejeitado)',
        address: 'Rua Augusta, 123, São Paulo, SP',
        success: false,
        error: '❌ Endereço rejeitado: "Rua Augusta, 123, São Paulo, SP" não está em Uberlândia, MG. Tire uma foto de um endereço local.'
      },
      accepted: {
        name: 'Endereço de Uberlândia (aceito)',
        address: 'Rua Coronel Antônio Alves, 1234, Uberlândia, MG',
        success: true,
        lat: -18.9186,
        lng: -48.2772
      }
    };

    const scenario = testScenarios[scenarioType];
    console.log(`🧪 TESTE: ${scenario.name}`);

    const newStop: Stop = {
      id: Date.now(),
      photoUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZGRkIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkZvdG8gVGVzdGU8L3RleHQ+PC9zdmc+',
      status: 'processing',
      address: '',
    };

    setStops(prev => [...prev, newStop]);

    // Simular processamento
    setTimeout(() => {
      if (scenario.success) {
        setStops(prev => prev.map(stop =>
          stop.id === newStop.id
            ? {
                ...stop,
                status: 'confirmed',
                address: scenario.address,
                lat: scenario.lat,
                lng: scenario.lng
              }
            : stop
        ));
      } else {
        setStops(prev => prev.map(stop =>
          stop.id === newStop.id
            ? { ...stop, status: 'error', address: scenario.error }
            : stop
        ));
      }
    }, 2000);
  };

  const handleConfirmVoiceAddress = async () => {
    let address = voiceText.trim();
    if (!address) { alert('Digite ou dite um endereço.'); return; }

    try {
      // 🎯 FORÇAR BUSCA NA CIDADE ATUAL
      const currentLocation = deviceOrigin || deviceLocation;

      // Se temos localização e o endereço não contém cidade, adicionar automaticamente
      if (currentLocation?.city && !address.toLowerCase().includes(currentLocation.city.toLowerCase())) {
        // Verificar se o endereço já tem formato completo (contém vírgula ou hífen)
        const hasCompleteFormat = address.includes(',') || address.includes('-') ||
                                 address.toLowerCase().includes('rua') ||
                                 address.toLowerCase().includes('av') ||
                                 address.toLowerCase().includes('avenida');

        if (hasCompleteFormat) {
          // Endereço parece completo, adicionar apenas a cidade
          address = `${address}, ${currentLocation.city}`;
        } else {
          // Endereço simples (ex: "centro", "praça da matriz"), adicionar cidade
          address = `${address}, ${currentLocation.city}`;
        }

        // Adicionar estado se disponível
        if (currentLocation.state) {
          address += `, ${currentLocation.state}`;
        }

        console.log('🎯 Endereço expandido para busca local:', address);
      }

      // Geocodificar no servidor com contexto de localização do usuário
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          userLocation: currentLocation,
          forceLocalSearch: true // Flag para priorizar resultados locais
        }),
      });

      const data = await res.json();
      if (!data.success || !data.lat || !data.lng) {
        alert(`Não foi possível encontrar o endereço "${voiceText}" na sua cidade. Tente ser mais específico.`);
        return;
      }

      const newStop: Stop = {
        id: Date.now(),
        photoUrl: '',
        status: 'confirmed',
        address: data.address || address,
        lat: data.lat,
        lng: data.lng,
      };

      setStops(prev => [...prev, newStop]);
      setIsVoiceDialogOpen(false);
      setVoiceText('');

      // Feedback de sucesso
      console.log('✅ Endereço adicionado:', data.address);

    } catch (err) {
      console.error('Erro ao geocodificar:', err);
      alert('Erro ao confirmar o endereço. Verifique sua conexão.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Modo de Teste */}
      {isTestMode && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                🧪 Modo de Teste Ativo
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Supabase não configurado. O sistema está simulando OCR e filtros de cidade.</p>
                <p className="mt-1">
                  <strong>Para ativar o modo real:</strong> Configure as variáveis no arquivo <code>.env.local</code> e reinicie o servidor.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header Section */}
      <div id="stops-section" className="bg-white rounded-xl shadow-custom p-6 scroll-mt-24">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Minhas Paradas</h2>
            <p className="text-gray-600">Use foto (OCR) ou voz para adicionar endereços</p>

            {/* Indicador de Filtro de Localização */}
            {(deviceOrigin || deviceLocation) && (
              <div className="mt-2 inline-flex items-center space-x-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm">
                <span>📍</span>
                <span>
                  Filtro ativo: {(deviceOrigin || deviceLocation)?.city || 'Localizando...'}, {(deviceOrigin || deviceLocation)?.state || ''}
                </span>
              </div>
            )}
            {isLoading && !deviceLocation && (
              <div className="mt-2 inline-flex items-center space-x-2 bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm">
                <span>🔄</span>
                <span>Detectando sua localização...</span>
              </div>
            )}
            <div className="mt-4 space-y-3">
              <div>
                <Link
                  href="/carteiro"
                  className="inline-flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-medium hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="text-xl">📮</span>
                  <span>Versão Profissional para Carteiros</span>
                  <span className="text-lg">→</span>
                </Link>
                <div className="mt-2 text-sm text-gray-500">
                  ✨ OCR avançado • Listas ECT • Cache inteligente
                </div>
              </div>

              <div>
                <Link
                  href="/gpx-optimizer"
                  className="inline-flex items-center space-x-3 bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-3 rounded-xl font-medium hover:from-green-700 hover:to-blue-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
                >
                  <span className="text-xl">🚀</span>
                  <div className="flex flex-col items-start">
                    <span>GPX Optimizer - Otimize suas Rotas</span>
                    <span className="text-xs opacity-75">Com filtro de localização inteligente</span>
                  </div>
                  <span className="text-lg">→</span>
                </Link>
                <div className="mt-2 text-sm text-gray-500">
                  🎯 Algoritmos avançados • Filtro de proximidade • Economia de combustível
                </div>
              </div>
            </div>
          </div>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 w-full sm:w-auto mt-3 sm:mt-0">
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-blue-600">{stops.length}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-green-600">{confirmedStops.length}</div>
              <div className="text-xs text-gray-500">Confirmadas</div>
            </div>
            <div className="text-center bg-gray-50 rounded-lg py-2 px-3">
              <div className="text-xl font-bold text-orange-600">
                {stops.filter(s => s.status === 'processing' || s.status === 'uploading').length}
              </div>
              <div className="text-xs text-gray-500">Processando</div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Adicionar Parada
          </button>
          <button
            onMouseDown={startListening}
            onMouseUp={stopListening}
            onTouchStart={startListening}
            onTouchEnd={stopListening}
            className="btn-secondary w-full flex items-center justify-center gap-2"
            aria-pressed={isListening}
            title="Segure para falar o endereço"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14a3 3 0 003-3V7a3 3 0 10-6 0v4a3 3 0 003 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-14 0M12 18v3m-4 0h8" />
            </svg>
            {isListening ? 'Gravando...' : 'Falar endereço'}
          </button>
          
          {confirmedStops.length >= 2 && (
            <button
              onClick={handleOptimizeRoute}
              disabled={isOptimizing}
              className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 sm:col-span-2"
            >
              {isOptimizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Otimizando...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Otimizar Rota
                </>
              )}
            </button>
          )}
          {/* City Indicator */}
          <div className="sm:col-span-2">
            <CityIndicator
              currentLocation={deviceLocation}
              onLocationChange={(location) => {
                setDeviceOrigin(location);
                if (useDeviceOrigin) {
                  setDeviceOrigin(location);
                }
              }}
              className="mb-3"
            />
          </div>

          {/* Settings toggles */}
          <div className="sm:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={useDeviceOrigin}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseDeviceOrigin(checked);
                  if (checked && deviceLocation) {
                    setDeviceOrigin(deviceLocation);
                  } else if (checked && !deviceLocation && !isLoading) {
                    refresh();
                  }
                }}
              />
              <span className="text-sm text-gray-700">Usar minha localização como ponto de partida</span>
              {deviceOrigin && useDeviceOrigin && (
                <span className="ml-auto text-xs text-gray-500">
                  {deviceOrigin.city ? `${deviceOrigin.city} - ${deviceOrigin.state}` : `${deviceOrigin.lat.toFixed(4)}, ${deviceOrigin.lng.toFixed(4)}`}
                </span>
              )}
            </label>

            <label className="flex items-center gap-2 bg-gray-50 rounded-lg p-3">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={roundtrip}
                onChange={(e) => setRoundtrip(e.target.checked)}
              />
              <span className="text-sm text-gray-700">Retornar ao ponto de partida</span>
            </label>
          </div>
        </div>
      </div>

      {/* Content Grid: List + Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Stops List */}
        <div className="space-y-4 order-2 lg:order-1">
          {/* Route summary card (if available) visible on mobile as well */}
          {showMap && (routeDistanceKm || routeDurationMin) && (
            <div className="bg-white rounded-xl shadow-custom p-4 flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Distância</div>
                <div className="text-lg font-semibold">{routeDistanceKm?.toFixed(1)} km</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Duração</div>
                <div className="text-lg font-semibold">{routeDurationMin?.toFixed(0)} min</div>
              </div>
              {routeProvider && (
                <span className="badge badge-info">{routeProvider}</span>
              )}
            </div>
          )}

          <div className="space-y-4">
        {stops.length === 0 ? (
          <div className="bg-white rounded-xl shadow-custom p-12 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma parada adicionada</h3>
            <p className="text-gray-500 mb-4">Tire uma foto do pacote para começar</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-primary inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Tirar Foto
            </button>
          </div>
        ) : (
          stops
            .sort((a, b) => (a.sequence || 999) - (b.sequence || 999))
            .map(stop => (
              <StopCard
                key={stop.id}
                {...stop}
                onRemove={handleRemove}
                onRetry={handleRetry}
              />
            ))
        )}
          </div>
        </div>

        {/* Map Display - sticky on large screens */}
        <div id="route-section" className="order-1 lg:order-2 scroll-mt-24">
          {showMap && confirmedStops.length > 0 && (
            <div className="bg-white rounded-xl shadow-custom p-4 lg:p-6 lg:sticky lg:top-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Rota Otimizada</h3>
                <div className="flex items-center gap-2">
                  <button onClick={handleStartRoute} className="btn-primary px-3 py-1.5">Iniciar rota</button>
                  <button onClick={() => setIsMapFullscreen(true)} className="btn-secondary px-3 py-1.5">Tela cheia</button>
                </div>
              </div>
              <div className="h-96 lg:h-[600px]">
                <MapDisplay stops={confirmedStops} routeGeometry={routeGeometry} origin={useDeviceOrigin ? deviceOrigin : undefined} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Settings anchor to trigger modal in client (handled by hashchange) */}
      <div id="settings" className="hidden" />

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImageCapture}
        className="hidden"
      />

      {/* Voice confirmation dialog */}
      {isVoiceDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-custom p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-3">Confirmar endereço</h3>
            <p className="text-sm text-gray-600 mb-3">Revise o endereço reconhecido, ajuste se necessário e confirme.</p>
            {(deviceOrigin?.city || deviceLocation?.city) && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-blue-700 font-medium">
                    🎯 Buscando em: {deviceOrigin?.city || deviceLocation?.city}
                  </span>
                </div>
                <p className="text-xs text-blue-600 mt-1">
                  Diga apenas o nome da rua ou local (ex: "Centro", "Rua Principal, 123")
                </p>
              </div>
            )}
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[96px]"
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              placeholder={`Ex.: "Rua Principal, 123" ou "Centro" ou "Praça da Matriz"${
                (deviceOrigin?.city || deviceLocation?.city)
                  ? `\n(Buscará em ${deviceOrigin?.city || deviceLocation?.city})`
                  : ''
              }`}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setIsVoiceDialogOpen(false); setVoiceText(''); }}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmVoiceAddress}
                className="btn-primary px-4 py-2"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-custom p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">Ajustes</h3>
              <button onClick={() => { history.replaceState(null, '', ' '); setIsSettingsOpen(false); }} aria-label="Fechar">
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={useDeviceOrigin}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setUseDeviceOrigin(checked);
                    if (checked && navigator?.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => setDeviceOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                        () => alert('Não foi possível obter sua localização.'),
                        { enableHighAccuracy: true, timeout: 8000 }
                      );
                    }
                  }}
                />
                <span className="text-sm text-gray-700">Usar minha localização como ponto de partida</span>
              </label>

              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  checked={roundtrip}
                  onChange={(e) => setRoundtrip(e.target.checked)}
                />
                <span className="text-sm text-gray-700">Retornar ao ponto de partida</span>
              </label>

              <div className="text-xs text-gray-500">
                Trânsito em tempo real usa Mapbox quando configurado. Sem custo adicional dentro do limite grátis.
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button className="btn-primary" onClick={() => { history.replaceState(null, '', ' '); setIsSettingsOpen(false); }}>Fechar</button>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Map Overlay */}
      {isMapFullscreen && (
        <div className="fixed inset-0 z-[60] bg-black">
          <div className="absolute inset-0">
            <MapDisplay stops={confirmedStops} routeGeometry={routeGeometry} origin={useDeviceOrigin ? deviceOrigin : undefined} />
          </div>
          <div className="absolute top-4 right-4 flex gap-2">
            <button onClick={handleStartRoute} className="btn-primary px-3 py-1.5">Iniciar rota</button>
            <button onClick={() => setIsMapFullscreen(false)} className="btn-secondary px-3 py-1.5">Sair da tela cheia</button>
          </div>
        </div>
      )}

      {/* 📱 MOBILE BOTTOM NAVIGATION */}
      <nav className="mobile-nav">
        <button className="mobile-nav-item" onClick={() => setIsDashboardOpen(true)}>
          <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="mobile-nav-label">Dashboard</span>
        </button>

        <button className="mobile-nav-item" onClick={() => fileInputRef.current?.click()}>
          <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="mobile-nav-label">Foto</span>
        </button>

        <VoiceControl onCommand={(command) => {
          const handler = voiceCommandHandlers[command as keyof typeof voiceCommandHandlers];
          if (handler) handler();
        }} />

        {stops.length > 0 && (
          <button className="mobile-nav-item" onClick={handleOptimizeRoute} disabled={isOptimizing}>
            <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="mobile-nav-label">Otimizar</span>
          </button>
        )}
      </nav>

      {/* 📊 DASHBOARD MODAL */}
      <Dashboard
        isOpen={isDashboardOpen}
        onClose={() => setIsDashboardOpen(false)}
      />

      {/* 🔄 OFFLINE STATUS INDICATOR */}
      <OfflineStatusIndicator />

      {/* 📸 PROOF OF DELIVERY MODAL */}
      {currentProofStop && (
        <ProofOfDeliveryModal
          stopId={currentProofStop.id}
          address={currentProofStop.address}
          isOpen={isProofModalOpen}
          onClose={() => {
            setIsProofModalOpen(false);
            setCurrentProofStop(null);
          }}
          onProofCaptured={handleProofCaptured}
        />
      )}

      {/* Clear list floating action */}
      {stops.length > 0 && (
        <button onClick={handleClearStops} className="fixed bottom-24 right-4 z-40 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-2xl min-h-[56px] min-w-[56px] flex items-center justify-center touch-manipulation focus:outline-none focus:ring-4 focus:ring-red-300" title="Limpar lista">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      {/* 🏢 FOOTER PROFISSIONAL */}
      <Footer className="mt-16" />
    </div>
  );
}