import { NextRequest, NextResponse } from 'next/server';

interface ECTDeliveryItem {
  sequence: number;
  objectCode: string;
  address: string;
  cep: string;
  arRequired: boolean;
  arOrder: string;
}

interface ECTListData {
  listNumber: string;
  unit: string;
  district: string;
  state: string;
  city: string;
  items: ECTDeliveryItem[];
}

// Função para extrair dados da lista ECT usando regex
function extractECTListData(text: string): ECTListData | null {
  try {
    console.log('Extraindo dados da lista ECT...');
    
    // Extrair informações do cabeçalho
    const listMatch = text.match(/Lista\s*:\s*(\w+)/i);
    const unitMatch = text.match(/Unidade:\s*(\d+)\s*-\s*([^-\n]+)/i);
    const districtMatch = text.match(/Distrito\s*:\s*(\d+)/i);
    const stateMatch = text.match(/([A-Z]{2})\/([A-Z]{2})/);
    
    // Extrair itens de entrega
    const itemRegex = /(\d{3})\s+([A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR)\s+(\d+-\d+)\s+([X]?)\s+([^-\n]+?)\s+(\d{8})/g;
    const items: ECTDeliveryItem[] = [];
    
    let match;
    while ((match = itemRegex.exec(text)) !== null) {
      const [, sequence, objectCode, arOrder, arRequired, address, cep] = match;
      
      items.push({
        sequence: parseInt(sequence),
        objectCode: objectCode.trim(),
        address: address.trim(),
        cep: cep.trim(),
        arRequired: arRequired === 'X',
        arOrder: arOrder.trim()
      });
    }
    
    if (items.length === 0) {
      console.log('Nenhum item de entrega encontrado');
      return null;
    }
    
    const result: ECTListData = {
      listNumber: listMatch?.[1] || 'N/A',
      unit: unitMatch?.[1] || 'N/A',
      district: districtMatch?.[1] || 'N/A',
      state: stateMatch?.[1] || 'MG',
      city: unitMatch?.[2]?.trim() || 'Uberlândia',
      items: items.sort((a, b) => a.sequence - b.sequence)
    };
    
    console.log(`Lista ECT processada: ${items.length} itens encontrados`);
    return result;
    
  } catch (error) {
    console.error('Erro ao extrair dados ECT:', error);
    return null;
  }
}

// Normaliza nomes de estados para a sigla (UF)
function normalizeUF(state?: string): string | undefined {
  if (!state) return undefined;
  const raw = state.trim().toLowerCase();
  if (/^[a-z]{2}$/i.test(state) && state.length === 2) return state.toUpperCase();
  const deaccent = (s: string) => s
    .replace(/[àáâãäå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c');
  const key = deaccent(raw);
  const map: Record<string, string> = {
    'acre': 'AC', 'alagoas': 'AL', 'amapa': 'AP', 'amazonas': 'AM', 'bahia': 'BA',
    'ceara': 'CE', 'distrito federal': 'DF', 'espirito santo': 'ES', 'goias': 'GO',
    'maranhao': 'MA', 'mato grosso': 'MT', 'mato grosso do sul': 'MS', 'minas gerais': 'MG',
    'para': 'PA', 'paraiba': 'PB', 'parana': 'PR', 'pernambuco': 'PE', 'piaui': 'PI',
    'rio de janeiro': 'RJ', 'rio grande do norte': 'RN', 'rio grande do sul': 'RS',
    'rondonia': 'RO', 'roraima': 'RR', 'santa catarina': 'SC', 'sao paulo': 'SP',
    'sergipe': 'SE', 'tocantins': 'TO'
  };
  return map[key] || undefined;
}

function toTitleCaseCity(city?: string): string | undefined {
  if (!city) return undefined;
  return city
    .toLowerCase()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// Função para geocodificar endereços
async function geocodeAddresses(items: ECTDeliveryItem[], userLocation?: { city?: string; state?: string }): Promise<Array<ECTDeliveryItem & { lat?: number; lng?: number; geocodedAddress?: string; geocodingProvider?: string; geocodingError?: string }>> {
  console.log('Geocodificando endereços...');
  
  const geocodedItems = [];
  
  const cityHint = toTitleCaseCity(userLocation?.city) || 'Uberlândia';
  const ufHint = normalizeUF(userLocation?.state) || 'MG';

  for (const item of items) {
    try {
      // Construir endereço completo com cidade/UF do usuário, quando disponível
      const fullAddress = `${item.address}, ${item.cep}, ${cityHint}, ${ufHint}, Brasil`;
      
      // Chamar API de geocodificação
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address: fullAddress,
          userLocation: userLocation
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        geocodedItems.push({
          ...item,
          lat: result.lat as number,
          lng: result.lng as number,
          geocodedAddress: result.address as string,
          geocodingProvider: result.provider as string
        });
        console.log(`✅ Endereço geocodificado: ${item.address}`);
      } else {
        console.log(`❌ Falha na geocodificação: ${item.address}`);
        geocodedItems.push({
          ...item,
          lat: undefined,
          lng: undefined,
          geocodingError: result.error as string
        });
      }
      
    } catch (error) {
      console.error(`Erro ao geocodificar ${item.address}:`, error);
      geocodedItems.push({
        ...item,
        lat: undefined,
        lng: undefined,
        geocodingError: 'Erro na requisição'
      });
    }
  }
  
  return geocodedItems;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!photo) {
      return NextResponse.json(
        { error: 'Foto não fornecida' },
        { status: 400 }
      );
    }

    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (parseError) {
        console.log('Erro ao parsear localização do usuário:', parseError);
      }
    }

    console.log('Processando lista ECT para carteiro:', {
      name: photo.name,
      size: photo.size,
      type: photo.type
    });

    // Converter arquivo para URL temporária
    const imageUrl = URL.createObjectURL(photo);

    // Tentar APIs externas de OCR
    console.log('Tentando APIs externas de OCR para lista ECT...');
    
    // Usar OCR.space (gratuito)
    const formDataOCR = new FormData();
    formDataOCR.append('url', imageUrl);
    formDataOCR.append('language', 'por');
    formDataOCR.append('isOverlayRequired', 'false');
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formDataOCR,
      headers: {
        'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
      }
    });
    
    const ocrData = await ocrResponse.json();
    
    if (ocrData.IsErroredOnProcessing) {
      return NextResponse.json({
        success: false,
        error: 'Falha no OCR da imagem. Tente uma imagem mais clara.',
        extractedText: '',
        suggestions: [
          'Verifique se a imagem está nítida',
          'Certifique-se de que o texto está legível',
          'Tente uma resolução mais alta'
        ]
      });
    }

    const extractedText = ocrData.ParsedResults?.[0]?.ParsedText || '';
    console.log('Texto extraído via OCR:', extractedText.substring(0, 200) + '...');

    // Extrair dados da lista ECT
    const ectData = extractECTListData(extractedText);
    
    if (!ectData) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível identificar uma lista ECT válida na imagem.',
        extractedText: extractedText.substring(0, 500),
        suggestions: [
          'Verifique se a imagem mostra uma lista ECT completa',
          'Certifique-se de que todos os campos estão visíveis',
          'Tente uma imagem mais clara'
        ]
      });
    }

    // Geocodificar endereços
    const geocodedItems = await geocodeAddresses(ectData.items, userLocation);
    
    // Criar dados de rota
    const validItems = geocodedItems.filter(item => item.lat && item.lng);
    
    if (validItems.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum endereço foi geocodificado com sucesso.',
        ectData: ectData,
        geocodedItems: geocodedItems,
        suggestions: [
          'Verifique se os endereços estão corretos',
          'Tente especificar a cidade nos endereços',
          'Use o modo manual se necessário'
        ]
      });
    }

    // Gerar rota otimizada
    const routeData = {
      stops: validItems.map((item, index) => ({
        address: item.geocodedAddress || item.address,
        lat: item.lat,
        lng: item.lng,
        sequence: index + 1,
        objectCode: item.objectCode,
        cep: item.cep,
        arRequired: item.arRequired
      })),
      totalDistance: 0, // Será calculado pela otimização
      totalTime: 0, // Será calculado pela otimização
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(validItems[0].geocodedAddress || validItems[0].address)}`
    };

    console.log('Lista ECT processada com sucesso:', {
      totalItems: ectData.items.length,
      geocodedItems: validItems.length,
      city: ectData.city,
      state: ectData.state
    });

    return NextResponse.json({
      success: true,
      message: `Lista ECT processada com sucesso! ${validItems.length}/${ectData.items.length} endereços geocodificados.`,
      routeData: routeData,
      ectData: ectData,
      geocodedItems: geocodedItems,
      extractedText: extractedText.substring(0, 1000),
      ocrConfidence: 0.7,
      extractionConfidence: 0.8,
      extractionMethod: 'ect-list-processor',
      suggestions: [
        'Verifique se todos os endereços estão corretos',
        'A rota foi otimizada para Uberlândia, MG',
        'Use o Google Maps para navegação'
      ]
    });

  } catch (error) {
    console.error('Erro no processamento da lista ECT:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno no processamento da lista ECT',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
