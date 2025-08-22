import { NextRequest, NextResponse } from 'next/server';
import { processFileSimple } from '@/lib/simpleExtractor';

export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Iniciando extração simples...');
    
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo enviado'
      }, { status: 400 });
    }
    
    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (e) {
        console.warn('Erro ao parsear userLocation:', e);
      }
    }
    
    console.log(`📁 Processando arquivo: ${file.name} (${file.type})`);
    
    // Processar arquivo
    const result = await processFileSimple(file, userLocation);
    
    console.log(`✅ Processamento concluído: ${result.summary.geocoded}/${result.summary.total} geocodificados`);
    
    return NextResponse.json({
      success: true,
      data: result,
      message: `${result.summary.geocoded} de ${result.summary.total} endereços geocodificados com sucesso`
    });
    
  } catch (error: any) {
    console.error('❌ Erro na extração simples:', error);
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Erro interno do servidor'
    }, { status: 500 });
  }
}
