import { NextRequest, NextResponse } from 'next/server';

interface OCRResponse {
  success: boolean;
  address?: string;
  extractedText?: string;
  confidence?: number;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const userLocationStr = formData.get('userLocation') as string;

    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma imagem fornecida'
      }, { status: 400 });
    }

    console.log('🔍 Processando imagem para extração de endereço:', image.name);

    // ✅ NOVO: Implementar OCR real usando Tesseract.js ou API externa
    // Por enquanto, simulando OCR com validação básica
    
    // Validar tipo de arquivo
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo deve ser uma imagem'
      }, { status: 400 });
    }

    // ✅ NOVO: Simular processamento OCR
    // Em produção, aqui seria usado Tesseract.js ou API de OCR
    
    // Simular delay de processamento
    await new Promise(resolve => setTimeout(resolve, 2000));

    // ✅ NOVO: Extrair texto simulado baseado no nome do arquivo
    // Em produção, isso seria o resultado real do OCR
    let extractedText = '';
    let address = '';
    let confidence = 0.8;

    // Simular diferentes cenários de OCR
    if (image.name.toLowerCase().includes('uberlandia')) {
      extractedText = 'Rua Cruzeiro dos Peixotos, 123\nUberlândia, MG\nCEP: 38400-000';
      address = 'Rua Cruzeiro dos Peixotos, 123, Uberlândia, MG';
      confidence = 0.9;
    } else if (image.name.toLowerCase().includes('centro')) {
      extractedText = 'Rua Coronel Antônio Alves, 456\nCentro, Uberlândia, MG\nCEP: 38400-100';
      address = 'Rua Coronel Antônio Alves, 456, Centro, Uberlândia, MG';
      confidence = 0.85;
    } else if (image.name.toLowerCase().includes('teste')) {
      extractedText = 'Avenida Rondon Pacheco, 789\nTibery, Uberlândia, MG\nCEP: 38405-142';
      address = 'Avenida Rondon Pacheco, 789, Tibery, Uberlândia, MG';
      confidence = 0.88;
    } else {
      // Padrão genérico
      extractedText = 'Rua das Flores, 100\nBairro Jardim, Uberlândia, MG\nCEP: 38400-200';
      address = 'Rua das Flores, 100, Bairro Jardim, Uberlândia, MG';
      confidence = 0.75;
    }

    // ✅ NOVO: Validar se o endereço está na cidade do usuário
    if (userLocationStr) {
      try {
        const userLocation = JSON.parse(userLocationStr);
        const userCity = userLocation.city;
        
        if (userCity && !address.toLowerCase().includes(userCity.toLowerCase())) {
          return NextResponse.json({
            success: false,
            error: `Endereço extraído não está em ${userCity}. A imagem deve conter um endereço local.`
          }, { status: 400 });
        }
      } catch (parseError) {
        console.warn('Erro ao parsear localização do usuário:', parseError);
      }
    }

    console.log('✅ Endereço extraído com sucesso:', address);

    return NextResponse.json({
      success: true,
      address,
      extractedText,
      confidence,
      imageName: image.name,
      imageSize: image.size
    });

  } catch (error) {
    console.error('❌ Erro no processamento OCR:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }, { status: 500 });
  }
}