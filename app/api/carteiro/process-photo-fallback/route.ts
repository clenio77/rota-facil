import { NextRequest, NextResponse } from 'next/server';

interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
}

// API Externa de OCR (sem Tesseract.js)
async function tryOCRSpace(imageUrl: string): Promise<OCRResult | null> {
  try {
    const formData = new FormData();
    formData.append('url', imageUrl);
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      headers: {
        'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld' // Chave gratuita
      }
    });
    
    const data = await response.json();
    if (data.IsErroredOnProcessing) return null;
    
    return {
      text: data.ParsedResults?.[0]?.ParsedText || '',
      confidence: 0.7, // OCR.space não retorna confiança
      provider: 'ocr.space'
    };
  } catch (error) {
    console.error('OCR.space falhou:', error);
    return null;
  }
}

async function tryOCRAPI(imageUrl: string): Promise<OCRResult | null> {
  try {
    const response = await fetch(`https://api.ocr.space/parse/imageurl?url=${encodeURIComponent(imageUrl)}&language=por`);
    const data = await response.json();
    
    if (data.IsErroredOnProcessing) return null;
    
    return {
      text: data.ParsedResults?.[0]?.ParsedText || '',
      confidence: 0.6,
      provider: 'ocr.space-url'
    };
  } catch (error) {
    console.error('OCR API falhou:', error);
    return null;
  }
}

async function tryCloudVision(imageUrl: string): Promise<OCRResult | null> {
  const apiKey = process.env.GOOGLE_CLOUD_VISION_API_KEY;
  if (!apiKey) return null;
  
  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { source: { imageUri: imageUrl } },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );
    
    const data = await response.json();
    const text = data.responses?.[0]?.textAnnotations?.[0]?.description || '';
    
    if (!text) return null;
    
    return {
      text,
      confidence: 0.9, // Google tem alta confiança
      provider: 'google-cloud-vision'
    };
  } catch (error) {
    console.error('Google Cloud Vision falhou:', error);
    return null;
  }
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
        console.log('Localização do usuário:', userLocation);
      } catch (parseError) {
        console.log('Erro ao parsear localização do usuário:', parseError);
      }
    }

    console.log('Processando foto para carteiro (FALLBACK):', {
      name: photo.name,
      size: photo.size,
      type: photo.type
    });

    // Converter arquivo para URL temporária
    const imageUrl = URL.createObjectURL(photo);

    // Tentar APIs externas de OCR
    console.log('Tentando APIs externas de OCR...');
    
    const apis = [
      () => tryOCRSpace(imageUrl),
      () => tryOCRAPI(imageUrl),
      () => tryCloudVision(imageUrl)
    ];
    
    let ocrResult: OCRResult | null = null;
    
    for (let i = 0; i < apis.length; i++) {
      try {
        console.log(`Tentando API ${i + 1}/${apis.length}...`);
        ocrResult = await apis[i]();
        if (ocrResult && ocrResult.text.trim()) {
          console.log(`API ${i + 1} bem-sucedida: ${ocrResult.provider}`);
          break;
        }
      } catch (ocrError) {
        console.log(`API ${i + 1} falhou, tentando próxima...`, ocrError);
      }
    }

    if (!ocrResult || !ocrResult.text.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair texto da imagem com nenhuma API externa. Tente uma imagem mais clara ou digite o endereço manualmente.',
        extractedText: '',
        ocrConfidence: 0,
        extractionConfidence: 0,
        extractionMethod: 'fallback-apis',
        suggestions: [
          'Verifique se a imagem está nítida e bem iluminada',
          'Certifique-se de que o texto está legível',
          'Tente uma resolução mais alta',
          'Use o modo manual se o OCR continuar falhando'
        ]
      });
    }

    console.log('OCR externo bem-sucedido:', {
      provider: ocrResult.provider,
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length
    });

    // Em vez de coordenadas fixas, apenas retorna o texto para que a UI trate
    // ou usemos uma geocodificação posterior se necessário.
    const mockRouteData = {
      stops: [],
      totalDistance: 0,
      totalTime: 0,
      googleMapsUrl: 'https://www.google.com/maps'
    };

    console.log('Processamento concluído com sucesso para carteiro (FALLBACK)');

    return NextResponse.json({
      success: true,
      message: 'Lista processada com sucesso via API externa!',
      routeData: mockRouteData,
      extractedText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      extractionConfidence: ocrResult.confidence,
      extractionMethod: `fallback-${ocrResult.provider}`,
      suggestions: [
        'Texto extraído via API externa de OCR',
        'Cole o endereço acima no campo de voz da home para geocodificar com a sua localização',
        'Use o modo manual se necessário'
      ]
    });

  } catch (error) {
    console.error('Erro no processamento de foto (FALLBACK):', error);
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
