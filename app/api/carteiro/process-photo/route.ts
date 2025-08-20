import { NextRequest, NextResponse } from 'next/server';
import { executeOCRWithFallback } from '../../../../lib/ocrFallbackSystem';
import { extractAddressIntelligently } from '../../../../lib/smartAddressExtractor';

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

    // Converter foto para base64
    const arrayBuffer = await photo.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const imageUrl = `data:${photo.type};base64,${base64}`;

    // 1. Executar OCR com sistema de fallback
    console.log('Executando OCR...');
    const ocrResult = await executeOCRWithFallback(imageUrl, 0.3);
    
    if (!ocrResult.text || ocrResult.confidence < 0.3) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair texto da imagem. Tente uma foto mais clara.',
        ocrConfidence: ocrResult.confidence
      });
    }

    console.log('OCR concluído:', {
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length
    });

    // 2. Extrair endereços inteligentemente
    console.log('Extraindo endereços...');
    const extractionResult = await extractAddressIntelligently(ocrResult.text);
    
    if (!extractionResult.address || extractionResult.confidence < 0.4) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível identificar endereços válidos na imagem.',
        extractedText: ocrResult.text,
        extractionConfidence: extractionResult.confidence,
        suggestions: extractionResult.suggestions
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
