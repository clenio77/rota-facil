import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink } from 'fs/promises';
import path from 'path';

const { processCarteiroPDF, generateMapData } = require('../../../../utils/pdfExtractor');

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('pdf') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo PDF foi enviado'
      }, { status: 400 });
    }
    
    // Validar tipo de arquivo
    if (file.type !== 'application/pdf') {
      return NextResponse.json({
        success: false,
        error: 'Apenas arquivos PDF são aceitos'
      }, { status: 400 });
    }
    
    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo muito grande. Máximo 10MB permitido.'
      }, { status: 400 });
    }
    
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (error) {
        console.warn('Erro ao parsear userLocation:', error);
      }
    }
    
    // Salvar arquivo temporariamente
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    const tempDir = path.join(process.cwd(), 'temp');
    const tempFilePath = path.join(tempDir, `carteiro-${Date.now()}.pdf`);
    
    try {
      // Criar diretório temp se não existir
      await writeFile(tempFilePath, buffer);
      
      console.log(`📄 Processando PDF: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);
      
      // Processar PDF
      const result = await processCarteiroPDF(tempFilePath, userLocation);
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: result.error || 'Erro ao processar PDF'
        }, { status: 500 });
      }
      
      // Gerar dados para o mapa
      const mapData = generateMapData(result.addresses);
      
      console.log(`✅ PDF processado: ${result.geocoded}/${result.total} endereços geocodificados`);
      
      return NextResponse.json({
        success: true,
        data: {
          ...result,
          mapData,
          fileName: file.name,
          fileSize: file.size,
          processedAt: new Date().toISOString()
        }
      });
      
    } finally {
      // Limpar arquivo temporário
      try {
        await unlink(tempFilePath);
      } catch (error) {
        console.warn('Erro ao remover arquivo temporário:', error);
      }
    }
    
  } catch (error) {
    console.error('Erro no processamento do PDF:', error);
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// Configuração para aceitar uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
