import { NextRequest, NextResponse } from 'next/server';
import { executeOCRWithFallback } from '../../../../lib/ocrFallbackSystem';
import { extractAddressIntelligently } from '../../../../lib/smartAddressExtractor';
import { enhanceECTImageForOCR } from '../../../../lib/imagePreprocessing';
import { parseECTAddresses, isECTList } from '../../../../lib/ectParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const photo = formData.get('photo') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (error) {
        console.log('Erro ao parsear localização do usuário:', error);
      }
    }
    
    if (!photo) {
      return NextResponse.json(
        { error: 'Foto não fornecida' },
        { status: 400 }
      );
    }
    
    // Validar tipo de arquivo
    if (!photo.type.startsWith('image/')) {
      return NextResponse.json(
        { error: 'Arquivo deve ser uma imagem' },
        { status: 400 }
      );
    }
    
    // Validar tamanho (máximo 10MB)
    if (photo.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 10MB permitido.' },
        { status: 400 }
      );
    }

    console.log('Processando foto para carteiro:', {
      name: photo.name,
      size: photo.size,
      type: photo.type
    });

    // Converter foto para buffer
    const arrayBuffer = await photo.arrayBuffer();
    const imageBuffer = Buffer.from(arrayBuffer);

    console.log('Iniciando processamento inteligente da imagem...');

    // 1. Pré-processar imagem para melhor OCR (especialmente para listas ECT)
    let processedImageUrl: string;
    try {
      console.log('Aplicando pré-processamento ECT...');
      const enhancedBuffer = await enhanceECTImageForOCR(imageBuffer);
      const base64Enhanced = enhancedBuffer.toString('base64');
      processedImageUrl = `data:image/png;base64,${base64Enhanced}`;
      console.log('Pré-processamento concluído com sucesso');
    } catch (preprocessError) {
      console.log('Pré-processamento falhou, usando imagem original:', preprocessError);
      const base64 = imageBuffer.toString('base64');
      processedImageUrl = `data:${photo.type};base64,${base64}`;
    }

    // 2. Executar OCR com sistema de fallback na imagem processada
    console.log('Executando OCR na imagem otimizada...');
    const ocrResult = await executeOCRWithFallback(processedImageUrl, 0.2);
    
    if (!ocrResult.text || ocrResult.confidence < 0.2) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair texto da imagem com nenhuma API externa. Tente uma imagem mais clara ou digite os endereços manualmente.',
        ocrConfidence: ocrResult.confidence,
        suggestions: [
          'Tire a foto com boa iluminação',
          'Mantenha a câmera estável',
          'Certifique-se que o texto está legível',
          'Evite reflexos e sombras'
        ]
      });
    }

    console.log('OCR concluído:', {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length,
      provider: ocrResult.provider
    });

    // 3. Detectar se é uma lista ECT e usar parser especializado
    console.log('Verificando se é lista ECT...');
    const isECT = isECTList(ocrResult.text);

    let extractionResult;
    if (isECT) {
      console.log('Lista ECT detectada! Usando parser especializado...');
      const ectAddresses = parseECTAddresses(ocrResult.text);

      if (ectAddresses.length > 0) {
        // Usar o primeiro endereço com maior confiança para geocodificação
        const bestAddress = ectAddresses.reduce((best, current) =>
          current.confidence > best.confidence ? current : best
        );

        extractionResult = {
          address: bestAddress.address,
          confidence: bestAddress.confidence,
          method: 'ECT Parser',
          allAddresses: ectAddresses,
          isECTList: true
        };
      } else {
        extractionResult = {
          address: null,
          confidence: 0,
          method: 'ECT Parser Failed',
          suggestions: ['Lista ECT detectada mas nenhum endereço válido encontrado']
        };
      }
    } else {
      console.log('Não é lista ECT, usando extração inteligente padrão...');
      extractionResult = await extractAddressIntelligently(ocrResult.text);
    }
    
    // Usar limiar de confiança mais baixo para listas ECT
    const confidenceThreshold = extractionResult.isECTList ? 0.3 : 0.4;

    if (!extractionResult.address || extractionResult.confidence < confidenceThreshold) {
      return NextResponse.json({
        success: false,
        error: extractionResult.isECTList
          ? 'Lista ECT detectada, mas não foi possível extrair endereços válidos automaticamente. Você pode digitar os endereços manualmente.'
          : 'Não foi possível identificar endereços válidos na imagem.',
        extractedText: ocrResult.text,
        extractionConfidence: extractionResult.confidence,
        isECTList: extractionResult.isECTList,
        allAddresses: extractionResult.allAddresses,
        suggestions: extractionResult.suggestions || [
          'Tire uma foto mais clara',
          'Certifique-se que o texto está bem visível',
          'Tente uma iluminação melhor',
          'Digite os endereços manualmente se necessário'
        ]
      });
    }

    console.log('Endereços extraídos:', {
      address: extractionResult.address,
      confidence: extractionResult.confidence,
      method: extractionResult.method
    });

    // 3. Geocodificar endereço com filtro de localização
    console.log('Geocodificando endereço com filtro de localização...');
    const geocodeResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        address: extractionResult.address,
        userLocation: userLocation
      }),
    });

    const geocodeResult = await geocodeResponse.json();

    if (!geocodeResult.success || !geocodeResult.lat || !geocodeResult.lng) {
      return NextResponse.json({
        success: false,
        error: 'Endereço extraído mas não foi possível geocodificar. Verifique se está na sua cidade.',
        extractedAddress: extractionResult.address,
        extractedText: ocrResult.text,
        extractionConfidence: extractionResult.confidence,
        suggestions: extractionResult.suggestions
      });
    }

    // 4. Criar dados de rota com coordenadas reais
    const routeData = {
      stops: [
        {
          address: geocodeResult.address || extractionResult.address,
          lat: geocodeResult.lat,
          lng: geocodeResult.lng,
          sequence: 1
        }
      ],
      totalDistance: 0,
      totalTime: 0,
      googleMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(geocodeResult.address || extractionResult.address)}`
    };

    console.log('Geocodificação concluída:', {
      originalAddress: extractionResult.address,
      geocodedAddress: geocodeResult.address,
      coordinates: { lat: geocodeResult.lat, lng: geocodeResult.lng },
      provider: geocodeResult.provider
    });

    console.log('Processamento concluído com sucesso para carteiro');

    return NextResponse.json({
      success: true,
      message: 'Lista processada com sucesso!',
      routeData: routeData,
      extractedText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      extractionConfidence: extractionResult.confidence,
      extractionMethod: extractionResult.method,
      suggestions: extractionResult.suggestions,
      debug: {
        originalExtracted: extractionResult.address,
        processingSteps: extractionResult.debug.processingSteps,
        candidates: extractionResult.debug.candidates
      }
    });

  } catch (error) {
    console.error('Erro no processamento de foto para carteiro:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno no processamento da foto',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
