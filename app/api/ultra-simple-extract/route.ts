import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🚀 API ultra-simple-extract chamada');
  
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo enviado'
      }, { status: 400 });
    }
    
    console.log(`📁 Arquivo recebido: ${file.name} (${file.type}, ${file.size} bytes)`);
    
    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
        console.log('📍 Localização do usuário:', userLocation);
      } catch (e) {
        console.warn('Erro ao parsear userLocation:', e);
      }
    }
    
    // Por enquanto, retornar erro explicativo
    return NextResponse.json({
      success: false,
      error: 'Sistema de extração em desenvolvimento. Dependências do OCR ainda não estão funcionando no servidor.',
      suggestion: 'Por enquanto, adicione endereços manualmente usando o botão "Falar endereço" ou digite diretamente.',
      debug: {
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        userLocation: userLocation?.city || 'N/A'
      }
    }, { status: 501 }); // 501 = Not Implemented
    
  } catch (error: any) {
    console.error('❌ Erro na extração ultra-simples:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno: ' + (error.message || 'Desconhecido'),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
