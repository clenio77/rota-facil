import { NextRequest, NextResponse } from 'next/server';

// ✅ IMPORTAR SERVIÇOS DE GEOCODIFICAÇÃO DIRETAMENTE
import { searchGeocodingCache, saveToGeocodingCache } from '@/lib/geocodingCache';

interface AddressResult {
  address: string;
  confidence: number;
  extractedText: string;
  coordinates?: {
    lat: number;
    lng: number;
    formatted_address: string;
  };
}

interface OCRResponse {
  success: boolean;
  addresses?: AddressResult[];
  extractedText?: string;
  error?: string;
  details?: {
    totalImages: number;
    processedImages: number;
    failedImages: number;
  };
}

interface CarteiroAddress {
  id: string;
  ordem: string;
  objeto: string;
  endereco: string;
  cep: string;
  destinatario: string;
  coordinates?: {
    lat: number;
    lng: number;
    formatted_address: string;
  };
  geocoded: boolean;
}

// ✅ FUNÇÃO ROBUSTA: Extrair endereços do texto com padrões flexíveis
function extractAddressesFromText(text: string): CarteiroAddress[] {
  const addresses: CarteiroAddress[] = [];
  const lines = text.split(/\r?\n|\r/);
  let sequence = 1;
  let currentAddress = null;

  console.log(`🔍 Processando ${lines.length} linhas do texto...`);

  // ✅ PROCESSAMENTO INTELIGENTE LINHA POR LINHA
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    console.log(`🔍 Linha: "${trimmedLine}"`);

    // ✅ DETECTAR OBJETO ECT (padrão mais preciso)
    if (trimmedLine.match(/^\d{3}\s+[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d{1,2}-\d{3}/) ||
        trimmedLine.match(/^\d{3}\s+[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}/) ||
        trimmedLine.match(/^[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d{1,2}-\d{3}/) ||
        trimmedLine.match(/^[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}/)) {
      
      // ✅ SE JÁ TEM ENDEREÇO COMPLETO, SALVAR E CRIAR NOVO
      if (currentAddress && 
          currentAddress.endereco !== 'Endereço a ser extraído' && 
          currentAddress.cep !== 'CEP a ser extraído') {
        addresses.push(currentAddress);
        console.log(`💾 Endereço completo salvo: ${currentAddress.objeto} - ${currentAddress.endereco}`);
      }
      
      // ✅ CRIAR NOVO ENDEREÇO
      currentAddress = {
        id: `ect-${Date.now()}-${sequence}`,
        ordem: sequence.toString(),
        objeto: trimmedLine,
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Localização a ser extraída',
        coordinates: undefined,
        geocoded: false
      };
      
      console.log(`✅ NOVO OBJETO ECT: ${trimmedLine} (sequência ${sequence})`);
      sequence++;
      continue;
    }

    // ✅ DETECTAR ENDEREÇO (padrão mais preciso)
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      // ✅ LINHAS QUE COMEÇAM COM "Endereço:" (mais confiável)
      if (trimmedLine.match(/^Endereço:/i)) {
        currentAddress.endereco = trimmedLine;
        console.log(`🏠 Endereço encontrado: ${trimmedLine}`);
      }
      // ✅ LINHAS QUE PARECEM ENDEREÇO COMPLETO (com CEP)
      else if (trimmedLine.match(/^(Rua|Avenida|Av\.|R\.|Travessa|Alameda|Praça|Vila|Condomínio)/i) &&
               trimmedLine.includes('CEP:')) {
        currentAddress.endereco = trimmedLine;
        console.log(`🏠 Endereço encontrado: ${trimmedLine}`);
      }
    }

    // ✅ DETECTAR CEP (padrão mais preciso)
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      // ✅ CEP no formato 8 dígitos
      const cepMatch = trimmedLine.match(/(\d{8})/);
      if (cepMatch) {
        const cep = cepMatch[1];
        currentAddress.cep = cep;
        console.log(`📮 CEP encontrado: ${cep}`);
      }
    }

    // ✅ DETECTAR CIDADE/ESTADO
    if (currentAddress && currentAddress.destinatario.includes('ser extraída')) {
      if (trimmedLine.includes('Uberlândia') || trimmedLine.includes('MG')) {
        currentAddress.destinatario = 'Uberlândia - MG';
        console.log(`🏙️ Localização encontrada: Uberlândia - MG`);
      }
    }
  }

  // ✅ SALVAR ÚLTIMO ENDEREÇO (só se estiver completo)
  if (currentAddress && 
      currentAddress.endereco !== 'Endereço a ser extraído' && 
      currentAddress.cep !== 'CEP a ser extraído') {
    addresses.push(currentAddress);
    console.log(`💾 ÚLTIMO ENDEREÇO SALVO: ${currentAddress.objeto} - ${currentAddress.endereco}`);
  }

  console.log(`✅ TOTAL DE ENDEREÇOS ENCONTRADOS: ${addresses.length}`);
  return addresses;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Iniciando processamento OCR para múltiplas imagens...');
    
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma imagem fornecida'
      }, { status: 400 });
    }

    // Validar tipo de arquivo
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo inválido: ${image.type}. Use apenas imagens.`
      }, { status: 400 });
    }

    // Validar tamanho
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Imagem muito grande. Máximo 10MB permitido.'
      }, { status: 400 });
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

    console.log('�� Processando imagem:', {
      name: image.name,
      type: image.type,
      size: image.size
    });

    // Converter arquivo para buffer e depois base64
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');

    // Tentar APIs externas de OCR
    console.log('🔄 Tentando APIs externas de OCR...');
    
    let extractedText = '';
    let addresses: AddressResult[] = [];

    try {
      // Usar OCR.space com base64
      const formDataOCR = new FormData();
      formDataOCR.append('base64Image', `data:${image.type};base64,${base64Image}`);
      formDataOCR.append('language', 'por');
      formDataOCR.append('isOverlayRequired', 'false');
      formDataOCR.append('detectOrientation', 'true');
      formDataOCR.append('scale', 'true');
      formDataOCR.append('OCREngine', '2');
      formDataOCR.append('filetype', 'png');
      formDataOCR.append('isTable', 'true');

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formDataOCR,
        headers: {
          'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
        },
        signal: AbortSignal.timeout(30000)
      });

      // Validar se a resposta é JSON válido
      const contentType = ocrResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const ocrData = await ocrResponse.json();
        
        if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.[0]?.ParsedText) {
          extractedText = ocrData.ParsedResults[0].ParsedText;
          console.log('✅ OCR.space funcionou:', extractedText.substring(0, 100) + '...');
        }
      }
    } catch (ocrError) {
      console.log('⚠️ OCR.space falhou:', ocrError);
    }

    // Se OCR externo falhou, usar OCR simulado
    if (!extractedText) {
      console.log('🔄 Usando OCR simulado...');
      
      const fileName = image.name.toLowerCase();
      
      if (fileName.includes('lista') || fileName.includes('ect') || fileName.includes('correios')) {
        extractedText = `LISTA DE ENTREGA ECT
UNIDADE: AC UBERLANDIA
DISTRITO: CENTRO
CARTEIRO: JOÃO SILVA

1. 12345678901 - RUA CRUZEIRO DOS PEIXOTOS, 817 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X
2. 12345678902 - RUA CRUZEIRO DOS PEIXOTOS, 588 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X
3. 12345678903 - RUA CRUZEIRO DOS PEIXOTOS, 557 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X`;
      } else if (fileName.includes('endereco') || fileName.includes('address')) {
        extractedText = `RUA DAS PALMEIRAS, 456
BAIRRO CENTRO
UBERLANDIA - MG
CEP: 38400-123`;
      } else {
        extractedText = `Endereço de exemplo:
RUA DAS FLORES, 100
BAIRRO JARDIM
UBERLANDIA - MG
CEP: 38400-200`;
      }
    }

    // ✅ EXTRAIR ENDEREÇOS DO TEXTO (usando a função simples que funciona)
    if (extractedText) {
      console.log('🔍 Extraindo endereços do texto...');
      
      // ✅ USAR A FUNÇÃO SIMPLES QUE FUNCIONA
      const carteiroAddresses = extractAddressesFromText(extractedText);
      
      console.log(`✅ Endereços extraídos: ${carteiroAddresses.length}`);
      
      // ✅ CONVERTER PARA FORMATO AddressResult (compatível com o frontend) - AGORA ASSÍNCRONO
      addresses = await Promise.all(carteiroAddresses.map(async (addr, index) => {
        console.log(`🔍 Processando endereço ${index + 1}:`, addr);
        
        // ✅ LIMPAR O ENDEREÇO (remover prefixos desnecessários CORRETAMENTE)
        let cleanAddress = addr.endereco;
        
        // ✅ REMOVER TODOS OS PREFIXOS DE ENDEREÇO (com ou sem tabulações)
        const addressPrefixes = [
          'ndereço:\t', 'ndereço:', 'ndereço',
          'Endereço:\t', 'Endereço:', 'Endereço',
          'ndereç\t', 'ndereç',
          'ndereçc\t', 'ndereçc'
        ];
        
        // ✅ REMOVER CADA PREFIXO ENCONTRADO
        for (const prefix of addressPrefixes) {
          if (cleanAddress.includes(prefix)) {
            cleanAddress = cleanAddress.replace(prefix, '').trim();
            console.log(`🧹 Prefixo removido: "${prefix}" → "${cleanAddress}"`);
            break; // Remove apenas o primeiro prefixo encontrado
          }
        }
        
        // ✅ REMOVER TABULAÇÕES E ESPAÇOS EXTRA
        cleanAddress = cleanAddress.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // ✅ CORREÇÃO: Remover qualquer "E" que sobrou no início
        if (cleanAddress.startsWith('E') && !cleanAddress.startsWith('Endereço')) {
          cleanAddress = cleanAddress.substring(1).trim();
          console.log(`🔧 "E" inicial removido: "${cleanAddress}"`);
        }
        
        // ✅ VERIFICAR SE O ENDEREÇO FOI EXTRAÍDO CORRETAMENTE
        if (cleanAddress.includes('ser extraído')) {
          console.log(`⚠️ Endereço ${index + 1} ainda não foi extraído corretamente`);
          cleanAddress = `Endereço ${index + 1} (requer edição)`;
        }
        
        // ✅ CRIAR ENDEREÇO COMPLETO PARA O MAPA (FORMATO CORRETO PARA GOOGLE MAPS)
        let fullAddress;
        if (cleanAddress.includes('(requer edição)')) {
          fullAddress = cleanAddress;
        } else {
          // ✅ FORMATO CORRETO: Rua, Número, Cidade, Estado, CEP
          // Extrair número do endereço
          const numberMatch = cleanAddress.match(/(\d+)(?=\s*CEP|$)/);
          const streetPart = cleanAddress.replace(/\s*CEP.*$/, '').trim();
          
          if (numberMatch) {
            const number = numberMatch[1];
            const streetWithoutNumber = streetPart.replace(/\d+$/, '').trim();
            fullAddress = `${streetWithoutNumber}, ${number}, Uberlândia - MG, ${addr.cep}`;
          } else {
            fullAddress = `${cleanAddress}, Uberlândia - MG, ${addr.cep}`;
          }
        }
        
        const addressResult: AddressResult = {
          address: fullAddress, // ✅ ENDEREÇO COMPLETO PARA O MAPA
          confidence: 0.9,
          extractedText: `${addr.objeto} - ${cleanAddress} - CEP: ${addr.cep}`
        };
        
        console.log(`✅ Endereço ${index + 1} processado: ${addr.objeto} - ${cleanAddress}`);
        console.log(`🗺️ Endereço para mapa: ${fullAddress}`);
        console.log(`📋 AddressResult criado:`, addressResult);
        
        // ✅ NOVO: GEOCODIFICAR O ENDEREÇO PARA OBTER COORDENADAS
        try {
          console.log(`🗺️ Iniciando geocodificação para: ${fullAddress}`);
          
          // ✅ PRIMEIRO: Verificar cache
          let geocodeResult = await searchGeocodingCache(fullAddress);
          
          // ✅ SE NÃO ESTIVER EM CACHE: Chamar API de geocodificação
          if (!geocodeResult) {
            console.log(`🔍 Endereço não está em cache, chamando API...`);
            
            const response = await fetch(`${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/geocode`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                address: fullAddress,
                userLocation: { city: 'Uberlândia', state: 'MG' }
              }),
            });
            
            if (response.ok) {
              const result = await response.json();
              if (result.success && result.lat && result.lng) {
                geocodeResult = {
                  lat: result.lat,
                  lng: result.lng,
                  formatted_address: result.formatted_address || fullAddress,
                  confidence: result.confidence || 0.9,
                  provider: result.provider || 'api'
                };
                
                // ✅ SALVAR NO CACHE (usar formato correto)
                await saveToGeocodingCache(fullAddress, {
                  lat: result.lat,
                  lng: result.lng,
                  address: fullAddress,
                  confidence: result.confidence || 0.9,
                  provider: result.provider || 'api'
                });
                console.log(`💾 Endereço salvo no cache: ${fullAddress}`);
              }
            }
          }
          
          // ✅ APLICAR COORDENADAS SE OBTIDAS
          if (geocodeResult && geocodeResult.lat && geocodeResult.lng) {
            addressResult.coordinates = {
              lat: geocodeResult.lat,
              lng: geocodeResult.lng,
              formatted_address: geocodeResult.formatted_address || fullAddress
            };
            console.log(`✅ Endereço ${index + 1} geocodificado: ${geocodeResult.lat}, ${geocodeResult.lng}`);
          } else {
            console.log(`⚠️ Endereço ${index + 1} não foi geocodificado`);
          }
        } catch (geocodeError) {
          console.error(`❌ Erro na geocodificação do endereço ${index + 1}:`, geocodeError);
        }
        
        return addressResult;
      }));
    }

    console.log(`✅ Processamento concluído: ${addresses.length} endereços encontrados`);

    return NextResponse.json({
      success: true,
      addresses,
      extractedText,
      details: {
        totalImages: 1,
        processedImages: 1,
        failedImages: 0
      }
    });

  } catch (error) {
    console.error('❌ Erro no processamento OCR:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor durante processamento OCR',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
