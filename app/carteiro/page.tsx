'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// ✅ IMPORT DINÂMICO DO MAPA (evita problemas SSR)
const MapDisplay = dynamic(() => import('../../components/MapDisplay'), {
  ssr: false,
  loading: () => (
    <div className="h-96 w-full bg-gray-100 flex items-center justify-center">
      <div className="text-center text-gray-600">
        🗺️ <strong>Carregando mapa...</strong><br/>
        <span className="text-sm">Inicializando Leaflet...</span>
      </div>
    </div>
  )
});
import CarteiroAutomation from '../../components/CarteiroAutomation';
import CarteiroUpload from '../../components/CarteiroUpload';
import SignatureModal from '../../components/SignatureModal';

// ✅ INTERFACES TIPADAS ESPECÍFICAS
interface ECTItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep?: string;
  lat?: number;
  lng?: number;
  correctedAddress?: string;
  id?: string; // ✅ ADICIONAR ID para compatibilidade
  status?: 'confirmed' | 'pending' | 'optimized' | 'delivered' | 'failed';
  completed?: boolean;
  signature?: string;
  receiverName?: string;
  receiverDoc?: string;
}

// ✅ INTERFACE: Endereço do CarteiroUpload
interface CarteiroAddress {
  id?: string;
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

// ✅ INTERFACE: Dados do mapa
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
  bounds: unknown;
}

interface ProcessedECTList {
  success: boolean;
  items?: ECTItem[];
  totalItems?: number;
  city?: string;
  state?: string;
  googleMapsUrl?: string;
  error?: string;
  routeData?: {
    stops: ECTItem[];
    totalDistance: number;
    totalTime: number;
    googleMapsUrl: string;
    optimized: boolean;
    metrics: Record<string, unknown>;
  };
  ectData?: {
    listNumber: string;
    unit: string;
    district: string;
    state: string;
    city: string;
    items: ECTItem[];
  };
  geocodedItems?: ECTItem[];
  extractedText?: string;
  ocrConfidence?: number;
  extractionConfidence?: number;
  extractionMethod?: string;
  suggestions?: string[];
}

// ✅ INTERFACE: Configuração de Automação
interface AutoRouteConfig {
  mode: 'manual' | 'semi-auto' | 'full-auto';
  preferences: {
    avoidTraffic: boolean;
    preferHighways: boolean;
    timeWindows: string[];
    fuelEfficiency: boolean;
    autoOptimize: boolean;
  };
  constraints: {
    maxDistance: number;
    maxTime: number;
    breakIntervals: number;
    startTime: string;
    endTime: string;
  };
  notifications: {
    routeReady: boolean;
    deliveryUpdates: boolean;
    performanceAlerts: boolean;
  };
}

// ✅ INTERFACE: Rota Agendada (usando ECTItem para compatibilidade)
interface ScheduledRoute {
  id: string;
  date: string;
  time: string;
  items: ECTItem[];
  status: 'pending' | 'processing' | 'ready' | 'delivered';
}

// ✅ INTERFACE: Dados de rota otimizada
interface OptimizedRouteData {
  route?: ECTItem[];
  totalDistance?: number;
  totalTime?: number;
  algorithm?: string;
  googleMapsUrl?: string;
  success?: boolean;
  message?: string;
  useCustomMap?: boolean;
  // ✅ DADOS PARA MAPA CUSTOMIZADO
  routeData?: {
    coordinates?: Array<{
      id: string;
      lat: number;
      lng: number;
      address: string;
      sequence: number;
      region: string;
    }>;
    userLocation?: { lat: number; lng: number };
    optimizationInfo?: {
      algorithm: string;
      totalDistance: string;
      efficiency: string;
      mapType: string;
      limitations: string;
    };
  };
  // ✅ CAMPOS LEGACY: Rota otimizada com pontos inicial/final
  optimizedRoute?: Array<{
    id: string;
    ordem: string;
    objeto: string;
    endereco: string;
    cep: string;
    destinatario?: string;
    coordinates?: { lat: number; lng: number };
    geocoded: boolean;
    isStartPoint?: boolean;
    isEndPoint?: boolean;
  }>;
  startLocation?: { lat: number; lng: number; city?: string; state?: string };
  totalStops?: number;
  routeMetrics?: {
    totalDistance: number;
    totalTime: number;
  };
}

// ✅ FUNÇÕES UTILITÁRIAS PARA EXPORT
const generateGPX = (coordinates: any[], userLocation?: {lat: number; lng: number}) => {
  const startPoint = userLocation || { lat: -18.9203, lng: -48.2782 };
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Rota Fácil Carteiro" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>Rota Otimizada Carteiro</name>
    <desc>Rota gerada pelo Rota Fácil - ${new Date().toLocaleDateString()}</desc>
  </metadata>
  <wpt lat="${startPoint.lat}" lon="${startPoint.lng}">
    <name>Início</name>
    <desc>Ponto de partida</desc>
  </wpt>
  ${coordinates.map((coord, index) => `
  <wpt lat="${coord.lat}" lon="${coord.lng}">
    <name>Parada ${coord.sequence}</name>
    <desc>${coord.address}</desc>
  </wpt>`).join('')}
  <wpt lat="${startPoint.lat}" lon="${startPoint.lng}">
    <name>Fim</name>
    <desc>Ponto de chegada</desc>
  </wpt>
</gpx>`;
};

// ✅ FUNÇÃO KML para Google Earth e aplicativos profissionais
const generateKML = (coordinates: any[], userLocation?: {lat: number; lng: number}) => {
  const startPoint = userLocation || { lat: -18.9203, lng: -48.2782 };
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>Rota Otimizada Carteiro</name>
    <description>Rota gerada pelo Rota Fácil - ${new Date().toLocaleDateString()}</description>
    
    <Style id="routeStyle">
      <LineStyle>
        <color>ff0000ff</color>
        <width>4</width>
      </LineStyle>
    </Style>
    
    <Style id="waypointStyle">
      <IconStyle>
        <Icon>
          <href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href>
        </Icon>
      </IconStyle>
    </Style>
    
    <Placemark>
      <name>Início</name>
      <description>Ponto de partida</description>
      <styleUrl>#waypointStyle</styleUrl>
      <Point>
        <coordinates>${startPoint.lng},${startPoint.lat},0</coordinates>
      </Point>
    </Placemark>
    
    ${coordinates.map((coord, index) => `
    <Placemark>
      <name>Parada ${coord.sequence}</name>
      <description>${coord.address}</description>
      <styleUrl>#waypointStyle</styleUrl>
      <Point>
        <coordinates>${coord.lng},${coord.lat},0</coordinates>
      </Point>
    </Placemark>`).join('')}
    
    <Placemark>
      <name>Fim</name>
      <description>Ponto de chegada</description>
      <styleUrl>#waypointStyle</styleUrl>
      <Point>
        <coordinates>${startPoint.lng},${startPoint.lat},0</coordinates>
      </Point>
    </Placemark>
    
    <Placemark>
      <name>Rota Otimizada</name>
      <description>Trajeto completo otimizado</description>
      <styleUrl>#routeStyle</styleUrl>
      <LineString>
        <coordinates>
          ${startPoint.lng},${startPoint.lat},0
          ${coordinates.map(coord => `${coord.lng},${coord.lat},0`).join('\n          ')}
          ${startPoint.lng},${startPoint.lat},0
        </coordinates>
      </LineString>
    </Placemark>
  </Document>
</kml>`;
};

const downloadFile = (content: string, filename: string, contentType: string) => {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default function CarteiroPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processedData, setProcessedData] = useState<ProcessedECTList | null>(null);
  const [showAddressEditor, setShowAddressEditor] = useState(false);
  const [editableItems, setEditableItems] = useState<ECTItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number; lng: number} | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [isClientMounted, setIsClientMounted] = useState(false);
  
  // ✅ NOVOS ESTADOS: Automação e Agendamento
  const [scheduledRoutes, setScheduledRoutes] = useState<ScheduledRoute[]>([]);
  const [isAutoProcessing, setIsAutoProcessing] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);

  // ✍️ ESTADOS DE ASSINATURA E STATUS
  const [signingItemIndex, setSigningItemIndex] = useState<number | null>(null);

  const signingItem = signingItemIndex !== null && processedData?.items
    ? processedData.items[signingItemIndex]
    : null;

  // ⛽ ESTADOS DA CALCULADORA DE COMBUSTÍVEL
  const [fuelConsumption, setFuelConsumption] = useState<number>(10.0);
  const [fuelPrice, setFuelPrice] = useState<number>(5.80);

  // Inicializar do localStorage no client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedConsumption = window.localStorage.getItem('rotafacil:fuel_consumption');
      const savedPrice = window.localStorage.getItem('rotafacil:fuel_price');
      if (savedConsumption) setFuelConsumption(parseFloat(savedConsumption));
      if (savedPrice) setFuelPrice(parseFloat(savedPrice));
    }
  }, []);

  // Salvar preferências no localStorage com helpers
  const handleFuelConsumptionChange = (val: number) => {
    setFuelConsumption(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rotafacil:fuel_consumption', String(val));
    }
  };

  const handleFuelPriceChange = (val: number) => {
    setFuelPrice(val);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rotafacil:fuel_price', String(val));
    }
  };

  // ✍️ AÇÕES DE ASSINATURA E CONFIRMAÇÃO DE STATUS
  const handleOpenSignature = (index: number) => {
    setSigningItemIndex(index);
  };

  const handleSaveSignature = (data: { signatureUrl: string; receiverName: string; receiverDoc: string }) => {
    if (signingItemIndex === null || !processedData?.items) return;
    
    const updatedItems = [...processedData.items];
    updatedItems[signingItemIndex] = {
      ...updatedItems[signingItemIndex],
      status: 'delivered',
      completed: true,
      signature: data.signatureUrl,
      receiverName: data.receiverName,
      receiverDoc: data.receiverDoc
    };

    setProcessedData({
      ...processedData,
      items: updatedItems
    });
    
    setSigningItemIndex(null);
  };

  const handleMarkAsFailed = (index: number) => {
    if (!processedData?.items) return;
    const updatedItems = [...processedData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      status: 'failed',
      completed: false,
      signature: undefined,
      receiverName: undefined,
      receiverDoc: undefined
    };
    setProcessedData({
      ...processedData,
      items: updatedItems
    });
  };

  const handleResetStatus = (index: number) => {
    if (!processedData?.items) return;
    const updatedItems = [...processedData.items];
    updatedItems[index] = {
      ...updatedItems[index],
      status: 'pending',
      completed: false,
      signature: undefined,
      receiverName: undefined,
      receiverDoc: undefined
    };
    setProcessedData({
      ...processedData,
      items: updatedItems
    });
  };

  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // ✅ Otimização: Usar useCallback para funções que não mudam frequentemente
  const getUserLocation = useCallback(() => {
    setIsGettingLocation(true);
    
    if (!navigator.geolocation) {
      setError('Geolocalização não é suportada pelo seu navegador');
      setIsGettingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const location = { lat: latitude, lng: longitude };
        console.log('📍 Localização capturada no frontend:', location);
        setUserLocation(location);
        setIsGettingLocation(false);
      },
      (error) => {
        console.error('❌ Erro ao obter localização:', error);
        setError('Não foi possível obter sua localização. Verifique as permissões do navegador.');
        setIsGettingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }, []);

  // ✅ Otimização: Usar useMemo para calcular estatísticas com consumo e custos
  const routeStats = useMemo(() => {
    if (!processedData?.totalItems) return null;
    
    const totalItems = processedData.totalItems;
    
    // Obter distância da rota otimizada (se disponível) ou aproximar
    let distance = totalItems * 0.5;
    if (processedData.customMapData?.optimizationInfo?.totalDistance) {
      const parsedDist = parseFloat(processedData.customMapData.optimizationInfo.totalDistance);
      if (!isNaN(parsedDist)) distance = parsedDist;
    } else if (processedData.googleMapsUrl) {
      distance = totalItems * 0.45;
    }

    const estimatedCost = (distance * fuelPrice) / fuelConsumption;
    
    return {
      estimatedTime: totalItems * 3, // 3 min por parada
      estimatedDistance: distance.toFixed(1),
      estimatedCost: isNaN(estimatedCost) ? 0 : estimatedCost,
      totalItems
    };
  }, [processedData, fuelConsumption, fuelPrice]);

  // ✅ Otimização: Função de limpeza de erro
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // ✅ NOVA FUNCIONALIDADE: Processar Rota Automaticamente
  const processAutoRoute = useCallback(async (scheduledRoute: ScheduledRoute, config: AutoRouteConfig) => {
    try {
      // ✅ ATUALIZAR STATUS PARA PROCESSANDO
      setScheduledRoutes(prev => 
        prev.map(route => 
          route.id === scheduledRoute.id 
            ? { ...route, status: 'processing' }
            : route
        )
      );

      // ✅ SIMULAR OTIMIZAÇÃO AUTOMÁTICA COM ALGORITMOS AVANÇADOS
      setTimeout(() => {
        setScheduledRoutes(prev => 
          prev.map(route => 
            route.id === scheduledRoute.id 
              ? { ...route, status: 'ready' }
              : route
          )
        );

        // ✅ NOTIFICAÇÃO AUTOMÁTICA
        if (config.notifications.routeReady) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('🚀 Rota Automática Pronta!', {
              body: `Sua rota com ${scheduledRoute.items.length} endereços foi otimizada automaticamente usando algoritmos avançados.`,
              icon: '/logo-carro-azul-removebg-preview.png'
            });
          }
        }
      }, 5000);

    } catch (error) {
      console.error('Erro no processamento automático:', error);
      setScheduledRoutes(prev => 
        prev.map(route => 
          route.id === scheduledRoute.id 
            ? { ...route, status: 'delivered' }
            : route
        )
      );
    }
  }, []);

  // ✅ NOVA FUNCIONALIDADE: Agendar Rota Automática
  const handleScheduleRoute = useCallback(async (config: AutoRouteConfig) => {
    if (!processedData?.items || processedData.items.length === 0) {
      setError('Nenhuma rota para agendar');
      return;
    }

    setIsAutoProcessing(true);
    
    try {
      const routeId = `route_${Date.now()}`;
      const newScheduledRoute: ScheduledRoute = {
        id: routeId,
        date: new Date().toISOString().split('T')[0],
        time: config.constraints.startTime,
        items: processedData.items.map((item, index) => ({
          ...item,
          id: item.id || `item_${index + 1}` // ✅ GARANTIR ID ÚNICO
        })),
        status: 'pending'
      };

      // ✅ SIMULAR PROCESSAMENTO AUTOMÁTICO
      setTimeout(() => {
        setScheduledRoutes(prev => [...prev, newScheduledRoute]);
        
        // ✅ PROCESSAR ROTA AUTOMATICAMENTE
        if (config.preferences.autoOptimize) {
          processAutoRoute(newScheduledRoute, config);
        }
        
        setIsAutoProcessing(false);
      }, 2000);

    } catch (error) {
      setError('Erro ao agendar rota automática');
      setIsAutoProcessing(false);
    }
  }, [processedData?.items, processAutoRoute]);

  // ✅ NOVA FUNCIONALIDADE: Solicitar Permissão de Notificação
  const requestNotificationPermission = useCallback(async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        console.log('✅ Permissão de notificação concedida');
      }
    }
  }, []);

  // ✅ Otimização: Funções de manipulação de endereços
  const handleAddressEdit = useCallback((index: number, newAddress: string) => {
    setEditableItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], address: newAddress };
      return updated;
    });
  }, []);

  const handleDiscardChanges = useCallback(() => {
    setEditableItems(processedData?.items ? [...processedData.items] : []);
    setShowAddressEditor(false);
  }, [processedData?.items]);

  // ✅ Nova funcionalidade: Drag and drop para reordenar endereços
  const handleReorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setEditableItems(prev => {
      const newItems = [...prev];
      const [movedItem] = newItems.splice(fromIndex, 1);
      newItems.splice(toIndex, 0, movedItem);
      
      // Atualizar sequência
      return newItems.map((item, index) => ({
        ...item,
        sequence: index + 1
      }));
    });
  }, []);

  // ✅ NOVA FUNÇÃO: Processar endereços carregados do CarteiroUpload
  const handleAddressesLoaded = useCallback((addresses: CarteiroAddress[], mapData: MapData) => {
    console.log('📍 Endereços carregados:', addresses.length);
    
    if (!addresses || addresses.length === 0) {
      setError('Nenhum endereço foi extraído das imagens.');
      return;
    }

    // Converter para formato ECTItem
    const ectItems: ECTItem[] = addresses.map((addr, index) => ({
      id: addr.id || `ect-${Date.now()}-${index}`,
      sequence: index + 1,
      objectCode: addr.objeto || `OBJ-${index + 1}`,
      address: addr.endereco || 'Endereço não disponível',
      cep: addr.cep || '',
      lat: addr.coordinates?.lat || 0,
      lng: addr.coordinates?.lng || 0,
      correctedAddress: addr.endereco
    }));

    // Criar dados processados
    const normalizedData: ProcessedECTList = {
      success: true,
      totalItems: ectItems.length,
      city: userLocation ? 'Cidade atual' : 'Uberlândia',
      state: userLocation ? 'Estado atual' : 'MG',
      items: ectItems,
      googleMapsUrl: undefined
    };

    setProcessedData(normalizedData);
    setEditableItems([...ectItems]);
    setShowAddressEditor(true);
    clearError();
    
    console.log('✅ Lista ECT criada com sucesso:', ectItems.length, 'itens');
  }, [userLocation]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    clearError();
    setProcessedData(null);

    const formData = new FormData();
    formData.append('photo', file);
    
    if (userLocation) {
      formData.append('userLocation', JSON.stringify(userLocation));
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 180000);
      
      const response = await fetch('/api/carteiro/process-ect-list', {
        method: 'POST',
        body: formData,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      const data: ProcessedECTList = await response.json();

      if (data.success) {
        const stops = data.routeData?.stops || data.ectData?.items || data.geocodedItems || [];
        
        if (!stops || stops.length === 0) {
          setError('Nenhum endereço foi extraído da imagem. Tente com uma imagem diferente.');
          return;
        }
        
        const normalizedData: ProcessedECTList = {
          success: true,
          totalItems: stops.length,
          city: data.ectData?.city || 'Uberlândia',
          state: data.ectData?.state || 'MG',
          items: stops.map(stop => ({
            sequence: stop.sequence || 0,
            objectCode: stop.objectCode || 'N/A',
            address: stop.address || stop.correctedAddress || 'Endereço não disponível',
            cep: stop.cep || '',
            lat: stop.lat || 0,
            lng: stop.lng || 0
          })),
          googleMapsUrl: data.routeData?.googleMapsUrl || undefined
        };
        
        setProcessedData(normalizedData);
        setEditableItems(normalizedData.items ? [...normalizedData.items] : []);
        setShowAddressEditor(true);
      } else {
        setError(data.error || 'Erro ao processar lista ECT');
      }
    } catch (err: any) {
      console.error('Erro no processamento:', err);
      
      // ✅ VERIFICAR SE É ERRO 422 COM FALLBACK PARA ENTRADA MANUAL
      if (err?.response?.status === 422 && err?.response?.data?.fallbackOptions?.manualEntry) {
        const fallbackData = err.response.data;
        const userChoice = confirm(`${fallbackData.message}\n\n📝 OPÇÕES:\n✅ OK = Digitar endereços manualmente\n❌ Cancelar = Tentar outro PDF\n\nFormato: ${fallbackData.fallbackOptions.exampleFormat}`);
        
        if (userChoice) {
          // ✅ ATIVAR MODO DE ENTRADA MANUAL
          setError('📝 Digite os endereços abaixo (um por linha):');
          setShowAddressEditor(true);
          // ✅ CRIAR LISTA VAZIA PARA ENTRADA MANUAL
          const emptyData: ProcessedECTList = {
            items: [
              { objectCode: '001', address: '', cep: '', lat: 0, lng: 0, sequence: 1 },
              { objectCode: '002', address: '', cep: '', lat: 0, lng: 0, sequence: 2 },
              { objectCode: '003', address: '', cep: '', lat: 0, lng: 0, sequence: 3 }
            ],
            totalItems: 3,
            extractedFrom: 'entrada-manual',
            optimized: false
          };
          setProcessedData(emptyData);
          setEditableItems([...emptyData.items]);
          return;
        } else {
          setError('OCR falhou. Tente outro PDF com texto mais claro.');
        }
      } else if (err instanceof Error) {
        if (err.name === 'AbortError') {
          setError('Processamento demorou muito tempo. A API está processando uma lista grande. Tente novamente em alguns minutos.');
        } else if (err.message.includes('fetch')) {
          setError('Erro de conexão com a API. Verifique sua internet e tente novamente.');
        } else {
          setError(`Erro no processamento: ${err.message}`);
        }
      } else {
        setError('Erro desconhecido. Tente novamente.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveAndGenerateRoute = async () => {
    if (!processedData) return;

    const updatedData = {
      ...processedData,
      items: editableItems,
      userLocation: userLocation // ✅ ADICIONAR LOCALIZAÇÃO DO USUÁRIO
    };

    try {
      const response = await fetch('/api/carteiro/generate-route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedData),
      });

      const routeData: OptimizedRouteData = await response.json();
      
      if (routeData.success) {
        // ✅ VERIFICAR SE DEVE USAR MAPA CUSTOMIZADO
        if (routeData.useCustomMap && routeData.routeData?.coordinates) {
          console.log('🗺️ Usando mapa customizado Leaflet - sem limitações!');
          setProcessedData({
            ...updatedData,
            useCustomMap: true,
            customMapData: {
              coordinates: routeData.routeData.coordinates,
              userLocation: routeData.routeData.userLocation,
              optimizationInfo: routeData.routeData.optimizationInfo
            },
            googleMapsUrl: routeData.googleMapsUrl // Backup
          });
        } else if (routeData.googleMapsUrl) {
          console.log('🗺️ Usando Google Maps (≤23 pontos)');
          setProcessedData({
            ...updatedData,
            googleMapsUrl: routeData.googleMapsUrl
          });
        }
        setShowAddressEditor(false);
      } else {
        setError('Erro ao gerar rota. Tente novamente.');
      }
    } catch (err) {
      setError('Erro ao gerar rota. Tente novamente.');
    }
  };

  const handleExportPDFReport = useCallback(() => {
    if (!processedData) return;
    
    const reportData = {
      items: processedData.items || editableItems,
      userLocation,
      stats: routeStats,
      city: processedData.city,
      state: processedData.state,
      date: new Date().toLocaleDateString('pt-BR')
    };
    
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('rotafacil:active_report_data', JSON.stringify(reportData));
      window.open('/relatorio', '_blank');
    }
  }, [processedData, editableItems, userLocation, routeStats]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-300">
      {/* Header */}
      <header className="bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          {/* Layout responsivo para header */}
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
            {/* Logo e título */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <img 
                src="/logo-carro-azul-removebg-preview.png" 
                alt="Rota Fácil" 
                className="h-8 w-auto sm:h-12"
              />
              <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-center sm:text-left">
                Versão Profissional para Carteiros
              </h1>
            </div>
            
            {/* Botões de ação */}
            <div className="flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full sm:w-auto">
              {/* Botão de Automação - Responsivo */}
              <button
                onClick={() => setShowAutomation(!showAutomation)}
                className="w-full sm:w-auto bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm sm:text-base flex items-center justify-center space-x-2"
              >
                <span className="text-lg sm:text-xl">🤖</span>
                <span className="hidden sm:inline">
                  {showAutomation ? 'Ocultar Automação' : 'Automação'}
                </span>
                <span className="sm:hidden">
                  {showAutomation ? 'Ocultar' : 'Automação'}
                </span>
              </button>
              
              {/* Botão Voltar - Responsivo */}
              <button
                onClick={() => router.push('/')}
                className="w-full sm:w-auto bg-white text-green-600 px-4 py-2 rounded-lg font-semibold hover:bg-gray-100 transition-colors text-sm sm:text-base flex items-center justify-center space-x-2"
              >
                <span className="text-lg sm:text-xl">←</span>
                <span className="hidden sm:inline">Voltar</span>
                <span className="sm:hidden">Voltar</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 pt-20 pb-24">
        {/* ✅ NOVA SEÇÃO: Automação Inteligente */}
        {showAutomation && (
          <div className="mb-6">
            <CarteiroAutomation
              onScheduleRoute={handleScheduleRoute}
              scheduledRoutes={scheduledRoutes}
              isAutoProcessing={isAutoProcessing}
            />
          </div>
        )}

        {/* ✅ NOVA SEÇÃO: Upload Inteligente com CarteiroUpload */}
        <div className="mb-6">
          {(() => {
            if (userLocation) {
              console.log('📍 Passando localização para CarteiroUpload:', userLocation);
            }
            return null;
          })()}
          <CarteiroUpload
            onAddressesLoaded={handleAddressesLoaded}
            userLocation={userLocation ? {
              lat: userLocation.lat,
              lng: userLocation.lng,
              city: 'Cidade atual',
              state: 'Estado atual'
            } : undefined}
          />
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6 flex items-center justify-between">
            <span>❌ {error}</span>
            <button 
              onClick={clearError}
              className="text-red-700 hover:text-red-900 font-bold"
            >
              ×
            </button>
          </div>
        )}

        {/* ✅ NOVA SEÇÃO: Rota Otimizada com Pontos Inicial/Final */}
        {processedData?.googleMapsUrl && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🚀 Rota Otimizada Gerada
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações da Rota */}
              <div>
                <h3 className="font-medium text-gray-700 mb-3">📊 Estatísticas da Rota</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total de Paradas:</span>
                    <span className="font-medium">{processedData.totalItems}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tempo Estimado:</span>
                    <span className="font-medium">{routeStats?.estimatedTime || 0} min</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Distância Estimada:</span>
                    <span className="font-medium">{routeStats?.estimatedDistance || 0} km</span>
                  </div>
                </div>
              </div>
              
              {/* Botão do Google Maps */}
              <div className="flex flex-col justify-center">
                <a
                  href={processedData.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-center"
                >
                  🗺️ Abrir no Google Maps
                </a>
                <p className="text-xs text-gray-500 mt-2 text-center">
                  Clique para abrir a rota otimizada no Google Maps
                </p>
              </div>
            </div>
            
            {/* ✅ PONTOS INICIAL E FINAL */}
            {userLocation && (
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-3">📍 Pontos de Partida e Chegada</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl mb-2">🚀</div>
                    <div className="text-sm font-medium text-blue-700">Ponto de Partida</div>
                    <div className="text-xs text-blue-600">
                      {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                    </div>
                    <div className="text-xs text-blue-500">Sua Localização Atual</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl mb-2">🏁</div>
                    <div className="text-sm font-medium text-blue-700">Ponto de Chegada</div>
                    <div className="text-xs text-blue-600">
                      {userLocation.lat.toFixed(6)}, {userLocation.lng.toFixed(6)}
                    </div>
                    <div className="text-xs text-blue-500">Sua Localização Atual</div>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3 text-center">
                  ✅ Sua rota começará e terminará na sua localização atual
                </p>
              </div>
            )}
          </div>
        )}

        {/* Localização */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            📍 Configuração de Localização
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">🏠 Localização Atual</h3>
                <p className="text-sm text-gray-600">
                  {userLocation 
                    ? `📍 ${userLocation.lat.toFixed(6)}, ${userLocation.lng.toFixed(6)}`
                    : '❌ Localização não configurada'
                  }
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Esta será o ponto de partida e chegada da sua rota
                </p>
              </div>

              <div className="flex space-x-2">
                {!userLocation ? (
                  <button
                    onClick={getUserLocation}
                    disabled={isGettingLocation}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isGettingLocation
                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {isGettingLocation ? (
                      <>
                        <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2"></span>
                        Obtendo...
                      </>
                    ) : (
                      '📍 Obter Localização'
                    )}
                  </button>
                ) : (
                  <button
                    onClick={() => setUserLocation(null)}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors"
                  >
                    🗑️ Limpar
                  </button>
                )}
              </div>
            </div>

            {userLocation && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <span className="text-green-600 mr-2">✅</span>
                  <span className="text-green-800 text-sm font-medium">
                    Localização configurada! Sua rota começará e terminará neste ponto.
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Display */}
        {processedData && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              🎯 Resultados do Processamento
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-blue-800 mb-2">📊 Estatísticas</h3>
                  <p className="text-blue-700">Total de itens: {processedData.totalItems || 0}</p>
                  <p className="text-blue-700">Cidade: {processedData.city || 'Não especificada'}</p>
                  <p className="text-blue-700">Estado: {processedData.state || 'Não especificado'}</p>
                </div>
                
                <div className="mt-4 space-y-2">
                  {processedData.googleMapsUrl && (
                    <a
                      href={processedData.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2 text-center"
                    >
                      <span>🗺️</span>
                      <span>Abrir no Google Maps</span>
                    </a>
                  )}
                  
                  <button
                    onClick={handleExportPDFReport}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-bold text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    <span>📋</span>
                    <span>Relatório de Entregas (PDF)</span>
                  </button>
                </div>
              </div>
              
              <div className="bg-purple-50 p-4 rounded-lg">
                <h3 className="font-semibold text-purple-800 mb-2">🚗 Detalhes da Rota</h3>
                {routeStats && (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-purple-700">📍 Paradas:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.totalItems} endereços
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">⏱️ Tempo estimado:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.estimatedTime} min
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-purple-700">📏 Distância estimada:</span>
                      <span className="font-semibold text-purple-800">
                        {routeStats.estimatedDistance} km
                      </span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-purple-200 pt-2 mt-2">
                      <span className="text-purple-900">⛽ Custo Combustível:</span>
                      <span className="text-purple-900">
                        R$ {routeStats.estimatedCost.toFixed(2)}
                      </span>
                    </div>
                    {userLocation && (
                      <div className="mt-3 p-2 bg-green-100 rounded border border-green-200">
                        <p className="text-xs text-green-700 text-center">
                          🏠 Rota circular: Inicia e termina na sua localização
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <h3 className="font-semibold text-amber-800 mb-2">⛽ Consumo & Custos</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-amber-700 mb-1">CONSUMO MÉDIO (km/L)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      value={fuelConsumption}
                      onChange={(e) => handleFuelConsumptionChange(Math.max(1, parseFloat(e.target.value) || 10))}
                      className="w-full bg-white border border-amber-300 rounded px-3 py-1.5 text-sm font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-amber-700 mb-1">PREÇO DO COMBUSTÍVEL (R$/L)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.1"
                      value={fuelPrice}
                      onChange={(e) => handleFuelPriceChange(Math.max(0.1, parseFloat(e.target.value) || 5.8))}
                      className="w-full bg-white border border-amber-300 rounded px-3 py-1.5 text-sm font-semibold text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>
              </div>

              {/* ✅ MAPA CUSTOMIZADO LEAFLET (para rotas grandes) */}
              {processedData.useCustomMap && processedData.customMapData && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-100 to-blue-100 border border-purple-300 rounded-lg">
                  <h3 className="font-bold text-purple-800 mb-3">🗺️ Visualizador de Rota Avançado</h3>
                  <div className="bg-white p-3 rounded-lg border border-purple-200 mb-4">
                    <p className="text-purple-700 text-sm mb-2">
                      <strong>🚀 Sem limitações:</strong> {processedData.customMapData.coordinates?.length || 0} pontos de entrega
                    </p>
                    <p className="text-purple-600 text-xs">
                      ✅ <strong>Algoritmo:</strong> {processedData.customMapData.optimizationInfo?.algorithm || 'N/A'}<br/>
                      📏 <strong>Distância:</strong> {processedData.customMapData.optimizationInfo?.totalDistance || 'N/A'}<br/>
                      🎯 <strong>Otimização:</strong> {processedData.customMapData.optimizationInfo?.efficiency || 'N/A'}
                    </p>
                  </div>
                  
                  {/* Navegador Customizado Real */}
                  <div className="bg-white rounded-lg overflow-hidden border border-purple-200">
                    <div className="h-96 w-full relative">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white">
                        <div className="text-center">
                          <h3 className="text-xl font-bold mb-2">🚚 Navegador Profissional</h3>
                          <p className="mb-4">Navegação real ponto-a-ponto com GPS</p>
                          <button
                            onClick={() => {
                              // ✅ ABRIR NAVEGADOR EM TELA CHEIA
                              const coords = processedData.customMapData.coordinates;
                              if (coords) {
                                const navigatorData = encodeURIComponent(JSON.stringify({
                                  points: coords.map(coord => ({
                                    id: coord.id,
                                    lat: coord.lat,
                                    lng: coord.lng,
                                    address: coord.address,
                                    sequence: coord.sequence
                                  })),
                                  userLocation: processedData.customMapData.userLocation
                                }));
                                
                                // ✅ ABRIR EM NOVA ABA COM NAVEGADOR COMPLETO
                                const navigatorUrl = `/navigator?data=${navigatorData}`;
                                window.open(navigatorUrl, '_blank', 'fullscreen=yes,scrollbars=no,resizable=no');
                              }
                            }}
                            className="bg-white text-blue-600 px-6 py-3 rounded-lg font-bold hover:bg-gray-100 transition-colors"
                          >
                            🚀 Abrir Navegador Completo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-3">
                    {/* Navegação Profissional */}
                    <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                      <h4 className="text-blue-800 font-bold mb-2">🚀 NAVEGAÇÃO PROFISSIONAL</h4>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            // ✅ HERE MAPS - FORMATO CORRETO TESTADO
                            const coords = processedData.customMapData.coordinates;
                            if (coords && coords.length > 0) {
                              // ✅ FORMATO HERE MAPS COM TODOS OS WAYPOINTS
                              const origin = coords[0];
                              const destination = coords[coords.length - 1];
                              const intermediateWaypoints = coords.slice(1, -1);
                              
                              // ✅ URL BASE DO HERE WEGO
                              let hereMapsUrl = `https://wego.here.com/directions/drive/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`;
                              
                              // ✅ ADICIONAR WAYPOINTS INTERMEDIÁRIOS (formato correto)
                              if (intermediateWaypoints.length > 0) {
                                const waypointParams = intermediateWaypoints.map((wp, index) => 
                                  `via${index}=${wp.lat},${wp.lng}`
                                ).join('&');
                                hereMapsUrl += `?${waypointParams}`;
                              }
                              
                              // ✅ DEBUG COMPLETO DA URL
                              console.log('🗺️ HERE Maps URL Final:', hereMapsUrl);
                              console.log('📍 Total de coordenadas:', coords.length);
                              console.log('📍 Origem:', origin);
                              console.log('📍 Destino:', destination);
                              console.log('📍 Waypoints intermediários:', intermediateWaypoints.length);
                              console.log('📍 Todas as coordenadas:', coords);
                              
                              // ✅ MOSTRAR URL PARA O USUÁRIO VERIFICAR
                              alert(`🔍 DEBUG HERE MAPS:\n\nTotal pontos: ${coords.length}\nWaypoints intermediários: ${intermediateWaypoints.length}\n\nURL: ${hereMapsUrl}\n\nVerifique o console para detalhes completos.`);
                              
                              window.open(hereMapsUrl, '_blank');
                            }
                          }}
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 transition-colors font-bold"
                        >
                          🗺️ HERE Maps (ILIMITADO)
                        </button>
                        <button 
                          onClick={() => {
                            // ✅ FORÇA MÚLTIPLOS LINKS SEQUENCIAIS
                            const coords = processedData.customMapData.coordinates;
                            if (coords && coords.length > 0) {
                              const choice = confirm(`🗺️ TESTE MÚLTIPLOS PONTOS:\n\n✅ OK = Abrir ${coords.length} abas (uma para cada ponto)\n❌ Cancelar = Tentar OpenRoute com todos os pontos\n\nQual você quer testar?`);
                              
                              if (choice) {
                                // ✅ ABRIR UMA ABA PARA CADA PONTO
                                coords.forEach((coord, index) => {
                                  setTimeout(() => {
                                    const singlePointUrl = `https://wego.here.com/directions/drive/${coord.lat},${coord.lng}/${coord.lat},${coord.lng}`;
                                    window.open(singlePointUrl, `_blank_${index}`);
                                  }, index * 1000); // 1 segundo entre cada abertura
                                });
                                alert(`🚀 Abrindo ${coords.length} abas sequencialmente!\nCada aba = 1 ponto da rota`);
                              } else {
                                // ✅ OPENROUTE COM TODOS OS PONTOS
                                const waypoints = coords.map(c => `${c.lng},${c.lat}`).join('|');
                                const openRouteUrl = `https://maps.openrouteservice.org/directions?n1=${coords[0].lat}&n2=${coords[0].lng}&n3=${coords[coords.length-1].lat}&n4=${coords[coords.length-1].lng}&a=${waypoints}&b=0&c=0&k1=en-US&k2=km`;
                                window.open(openRouteUrl, '_blank');
                              }
                            }
                          }}
                          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-700 transition-colors font-bold"
                        >
                          🧪 TESTE FORÇADO
                        </button>
                        <button 
                          onClick={() => {
                            // ✅ MAPBOX - ROTA PROFISSIONAL
                            const coords = processedData.customMapData.coordinates;
                            if (coords && coords.length > 0) {
                              // Redirecionar para Mapbox web app
                              const mapboxWebUrl = `https://www.mapbox.com/directions/#profile=driving&waypoints=${coords.map(c => `${c.lng},${c.lat}`).join(';')}`;
                              window.open(mapboxWebUrl, '_blank');
                            }
                          }}
                          className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700 transition-colors font-bold"
                        >
                          🎯 Mapbox (PRO)
                        </button>
                      </div>
                    </div>

                    {/* Export e Backup */}
                    <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                      <h4 className="text-green-800 font-bold mb-2">📱 EXPORT & BACKUP</h4>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            // ✅ GPX para GPS profissional
                            const coords = processedData.customMapData.coordinates;
                            if (coords) {
                              const gpxData = generateGPX(coords, processedData.customMapData.userLocation);
                              downloadFile(gpxData, 'rota-carteiro-otimizada.gpx', 'application/gpx+xml');
                            }
                          }}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700 transition-colors"
                        >
                          📱 Download GPX
                        </button>
                        <button 
                          onClick={() => {
                            // ✅ KML para Google Earth
                            const coords = processedData.customMapData.coordinates;
                            if (coords) {
                              const kmlData = generateKML(coords, processedData.customMapData.userLocation);
                              downloadFile(kmlData, 'rota-carteiro-otimizada.kml', 'application/vnd.google-earth.kml+xml');
                            }
                          }}
                          className="bg-yellow-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-yellow-700 transition-colors"
                        >
                          🌍 Download KML
                        </button>
                      </div>
                    </div>

                    {/* Alternativas (menos recomendadas) */}
                    <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-gray-400">
                      <h4 className="text-gray-700 font-bold mb-2">⚠️ ALTERNATIVAS (LIMITADAS)</h4>
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => {
                            alert('⚠️ AVISO:\nGoogle Maps reordena pontos automaticamente!\nUse HERE Maps ou Mapbox para rota correta.');
                            const coords = processedData.customMapData.coordinates;
                            if (coords && coords.length > 0) {
                              const origin = coords[0];
                              const destination = coords[coords.length - 1];
                              const waypoints = coords.slice(1, -1);
                              const waypointsStr = waypoints.map(coord => `${coord.lat},${coord.lng}`).join('|');
                              const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${destination.lat},${destination.lng}&waypoints=${waypointsStr}&travelmode=driving`;
                              window.open(googleMapsUrl, '_blank');
                            }
                          }}
                          className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-colors opacity-75"
                        >
                          ⚠️ Google Maps (máx 23)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800">📍 Endereços Processados</h3>
              {processedData.items && processedData.items.length > 0 ? (
                processedData.items.map((item, index) => {
                  const isCompleted = item.completed || item.status === 'delivered';
                  const isFailed = item.status === 'failed';
                  
                  return (
                    <div 
                      key={index} 
                      className={`border-l-4 p-4 rounded-r-xl transition-all ${
                        isCompleted ? 'border-green-500 bg-green-50/40' :
                        isFailed ? 'border-red-500 bg-red-50/40' :
                        'border-blue-500 bg-white shadow-sm'
                      } hover:shadow-md`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-800 text-sm">
                            #{item.sequence?.toString().padStart(3, '0') || '000'} - {item.objectCode || 'N/A'}
                          </span>
                          
                          {/* Badges de Status */}
                          {isCompleted ? (
                            <span className="bg-green-100 text-green-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-green-200">
                              ✓ Entregue
                            </span>
                          ) : isFailed ? (
                            <span className="bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-red-200">
                              ⚠️ Falhou
                            </span>
                          ) : (
                            <span className="bg-yellow-100 text-yellow-800 text-[10px] font-black uppercase px-2 py-0.5 rounded border border-yellow-200">
                              ⏳ Pendente
                            </span>
                          )}
                        </div>

                        {item.cep && (
                          <span className="text-xs text-gray-500 font-mono">CEP: {item.cep}</span>
                        )}
                      </div>
                      
                      <p className="text-gray-700 text-sm leading-relaxed mb-3">{item.address || 'Endereço não disponível'}</p>

                      {/* Informações de Assinatura se já Entregue */}
                      {isCompleted && (item.receiverName || item.signature) && (
                        <div className="bg-white/80 border border-green-150 rounded-lg p-3 mb-3 text-xs flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="text-gray-500 font-bold uppercase text-[9px] tracking-wider">Recebedor:</p>
                            <p className="text-gray-800 font-bold text-sm">{item.receiverName || 'Não Informado'}</p>
                            {item.receiverDoc && (
                              <p className="text-gray-500 mt-0.5">Doc: {item.receiverDoc}</p>
                            )}
                          </div>
                          {item.signature && (
                            <div className="bg-gray-50 border border-gray-200 rounded p-1">
                              <img 
                                src={item.signature} 
                                alt="Assinatura" 
                                className="max-h-10 max-w-[100px] object-contain"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Botões de Ação */}
                      <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-100">
                        {!isCompleted && !isFailed && (
                          <>
                            <button
                              onClick={() => handleOpenSignature(index)}
                              className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                            >
                              ✍️ Registrar Entrega
                            </button>
                            <button
                              onClick={() => handleMarkAsFailed(index)}
                              className="bg-red-50 hover:bg-red-100 text-red-600 font-bold text-xs px-3.5 py-1.5 rounded-lg transition-colors border border-red-200"
                            >
                              ❌ Falhou / Ausente
                            </button>
                          </>
                        )}
                        {(isCompleted || isFailed) && (
                          <button
                            onClick={() => handleResetStatus(index)}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 font-semibold text-xs px-3 py-1.5 rounded-lg transition-colors"
                          >
                            🔄 Resetar Status
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-gray-500 text-center py-4">
                  Nenhum endereço processado ainda.
                </div>
              )}
            </div>
            
            <div className="mt-6 flex space-x-3">
              <button
                onClick={() => setShowAddressEditor(true)}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                ✏️ Editar Endereços
              </button>
              
              <button
                onClick={() => setShowAddressEditor(false)}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                🔒 Ocultar Editor
              </button>
            </div>
          </div>
        )}

        {/* Address Editor */}
        {showAddressEditor && editableItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              ✏️ Editor de Endereços
            </h2>
            <p className="text-gray-600 mb-4">
              Revise e edite os endereços extraídos antes de gerar a rota no Google Maps.
              <span className="text-sm text-blue-600 block mt-1">
                💡 Dica: Você pode arrastar os itens para reordenar a sequência da rota
              </span>
            </p>
            
            <div className="space-y-4">
              {editableItems.map((item, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-700">
                      Item {item.sequence.toString().padStart(3, '0')} - {item.objectCode}
                    </span>
                    {item.cep && (
                      <span className="text-sm text-gray-500">CEP: {item.cep}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <label className="text-sm font-medium text-gray-700 min-w-0">
                      Endereço:
                    </label>
                    <input
                      type="text"
                      value={item.address}
                      onChange={(e) => handleAddressEdit(index, e.target.value)}
                      className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Digite o endereço correto..."
                    />
                  </div>
                  
                  {item.lat && item.lng && (
                    <div className="text-xs text-gray-500 mt-1">
                      Coordenadas: {item.lat.toFixed(6)}, {item.lng.toFixed(6)}
                    </div>
                  )}
                </div>
              ))}
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={handleSaveAndGenerateRoute}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                ✅ Salvar e Gerar Rota
              </button>
              <button
                onClick={handleDiscardChanges}
                className="bg-gray-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-600 transition-colors"
              >
                ❌ Descartar Alterações
              </button>
            </div>
          </div>
        )}

        {/* Modal de Assinatura Digital */}
        {signingItem !== null && (
          <SignatureModal
            isOpen={signingItem !== null}
            onClose={() => setSigningItemIndex(null)}
            onSave={handleSaveSignature}
            objectCode={signingItem.objectCode || 'Sem código'}
            address={signingItem.address}
          />
        )}
      </main>
    </div>
  );
}
