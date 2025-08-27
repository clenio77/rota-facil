import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

import { processCarteiroFile, generateMapData, detectFileType } from '../../../../utils/pdfExtractor';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userLocationStr = formData.get('userLocation') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      }, { status: 400 });
    }

    // Detectar e validar tipo de arquivo
    const fileType = detectFileType(file.name);
    const supportedTypes = ['pdf', 'excel', 'csv', 'kml', 'gpx', 'xml', 'json'];

    if (!supportedTypes.includes(fileType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo não suportado. Formatos aceitos: PDF, XLS, XLSX, CSV, KML, GPX, XML, JSON`
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
    
    // ✅ NOVA ABORDAGEM: Processar arquivo em memória
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log(`📄 Processando ${fileType.toUpperCase()}: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

    try {
      // ✅ PROCESSAMENTO DIRETO EM MEMÓRIA
      let result;
      
      if (fileType === 'pdf') {
        // ✅ PARA PDF: Converter para base64 e processar
        const base64Data = buffer.toString('base64');
        result = await processCarteiroFileFromBuffer(base64Data, file.name, userLocation);
      } else {
        // ✅ PARA OUTROS FORMATOS: Criar arquivo temporário apenas se necessário
        const tempDir = path.join(process.cwd(), 'temp');
        const fileExtension = file.name.split('.').pop();
        const tempFilePath = path.join(tempDir, `carteiro-${Date.now()}.${fileExtension}`);
        
        try {
          // Criar diretório temp se não existir
          if (!existsSync(tempDir)) {
            await mkdir(tempDir, { recursive: true });
          }
          
          await writeFile(tempFilePath, buffer);
          
          // Processar arquivo
          result = await processCarteiroFile(tempFilePath, file.name, userLocation);
          
        } finally {
          // Limpar arquivo temporário
          try {
            if (existsSync(tempFilePath)) {
              await unlink(tempFilePath);
            }
          } catch (cleanupError) {
            console.warn('⚠️ Erro ao remover arquivo temporário:', cleanupError);
          }
        }
      }
      
      if (!result.success) {
        return NextResponse.json({
          success: false,
          error: 'Erro ao processar arquivo'
        }, { status: 500 });
      }
      
      // ✅ VALIDAR SE RESULT.ADDRESSES EXISTE ANTES DE GERAR MAPA
      if (!result.addresses || !Array.isArray(result.addresses)) {
        console.error('❌ Erro: result.addresses é undefined ou não é um array');
        console.log('🔍 Result:', result);
        throw new Error('Endereços não foram processados corretamente');
      }
      
      // Gerar dados para o mapa
      const mapData = generateMapData(result.addresses);
      
      console.log(`✅ ${fileType.toUpperCase()} processado: ${result.geocoded}/${result.total} endereços geocodificados`);
      
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
      
    } catch (processingError) {
      console.error('❌ Erro no processamento:', processingError);
      throw processingError;
    }
    
  } catch (error) {
    console.error('❌ Erro no processamento do arquivo:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Sem stack');

    return NextResponse.json({
      success: false,
      error: 'Erro interno no processamento do arquivo',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}

// ✅ NOVA FUNÇÃO: Processar PDF diretamente do buffer
async function processCarteiroFileFromBuffer(base64Data: string, fileName: string, userLocation: unknown) {
  try {
    console.log('🔍 Processando PDF diretamente do buffer...');
    
    // ✅ ABORDAGEM SIMPLES: PROCESSAR PDF COMO IMAGEM INDIVIDUAL
    console.log('🔄 Processando PDF como imagem individual...');
    
    // ✅ TENTAR PROCESSAMENTO SIMPLES COM OCR.space
    const extractedText = await processPDFSimple(base64Data);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }
    
    console.log(`✅ PDF processado: ${extractedText.length} caracteres extraídos`);
    console.log('📝 Primeiras 200 caracteres:', extractedText.substring(0, 200) + '...');
    
    // ✅ EXTRAIR ENDEREÇOS DO TEXTO (usando a mesma função das imagens)
    const addresses = extractAddressesFromText(extractedText);
    console.log(`✅ Endereços extraídos do PDF: ${addresses.length}`);
    
    if (addresses.length === 0) {
      throw new Error('Nenhum endereço foi extraído do PDF');
    }
    
    console.log(`✅ PDF processado com sucesso: ${addresses.length} endereços encontrados`);

    // ✅ NOVO: GEOCODIFICAR ENDEREÇOS
    console.log('🗺️ Iniciando geocodificação dos endereços...');
    let geocodedCount = 0;
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      try {
        // ✅ CONSTRUIR ENDEREÇO COMPLETO PARA GEOCODIFICAÇÃO
        const fullAddress = `${address.endereco}, Uberlândia - MG, ${address.cep}`;
        console.log(`🔍 Geocodificando endereço ${i + 1}: ${fullAddress}`);
        
        // ✅ CHAMAR API DE GEOCODING
        const geocodeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/geocode`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: fullAddress })
        });
        
        if (geocodeResponse.ok) {
          const geocodeData = await geocodeResponse.json();
          if (geocodeData.success && geocodeData.coordinates) {
            address.coordinates = geocodeData.coordinates;
            address.geocoded = true;
            geocodedCount++;
            console.log(`✅ Endereço ${i + 1} geocodificado: ${geocodeData.coordinates.lat}, ${geocodeData.coordinates.lng}`);
          } else {
            console.log(`⚠️ Endereço ${i + 1} não geocodificado: ${geocodeData.error || 'Sem coordenadas'}`);
          }
        } else {
          console.log(`⚠️ Erro na API de geocoding para endereço ${i + 1}: ${geocodeResponse.status}`);
        }
      } catch (geocodeError) {
        console.log(`⚠️ Erro ao geocodificar endereço ${i + 1}:`, geocodeError);
      }
    }
    
    console.log(`✅ Geocodificação concluída: ${geocodedCount}/${addresses.length} endereços geocodificados`);

    return {
      success: true,
      total: addresses.length,
      geocoded: geocodedCount,
      addresses: addresses,
      fileType: 'pdf',
      metadata: {
        extractedAt: new Date().toISOString(),
        fileName,
        ocrEngine: 'OCR.space',
        textLength: extractedText.length,
        processingMethod: 'simple',
        geocodedCount
      }
    };

  } catch (error) {
    console.error('❌ Erro no processamento do PDF:', error);
    throw error;
  }
}

// ✅ NOVA FUNÇÃO: Processar PDF de forma simples
async function processPDFSimple(base64Data: string) {
  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
  formData.append('language', 'por');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('filetype', 'pdf');
  formData.append('isTable', 'true');
  
  console.log('📤 Enviando PDF para OCR.space...');

  const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
    headers: {
      'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
    },
    signal: AbortSignal.timeout(90000) // 90 segundos para PDFs
  });

  if (!ocrResponse.ok) {
    throw new Error(`OCR.space falhou: ${ocrResponse.status}`);
  }

  const ocrData = await ocrResponse.json();
  console.log('📥 Resposta recebida do OCR.space');
  
  // ✅ IMPORTANTE: Mesmo com erro de limite de páginas, o texto pode estar disponível
  let extractedText = '';
  if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
    extractedText = ocrData.ParsedResults[0].ParsedText;
  }

  if (!extractedText) {
    throw new Error('Nenhum texto foi extraído do PDF');
  }

      // ✅ SE HOUVER ERRO MAS TEXTO FOI EXTRAÍDO, RETORNAR O TEXTO
    if (ocrData.IsErroredOnProcessing) {
      console.log(`⚠️ OCR.space retornou aviso: ${ocrData.ErrorMessage}`);
      
      // ✅ IMPORTANTE: SEMPRE RETORNAR O TEXTO SE FOI EXTRAÍDO
      console.log(`✅ Texto disponível: ${extractedText.length} caracteres`);
      return extractedText; // ✅ RETORNAR O TEXTO DISPONÍVEL
    }

  console.log('✅ PDF processado sem erros');
  return extractedText;
}

// ✅ FUNÇÃO AUXILIAR: Extrair endereços do texto (lógica robusta)
function extractAddressesFromText(text: string) {
  const addresses = [];
  const lines = text.split(/\r?\n|\r/);
  let sequence = 1;
  let currentAddress = null;

  console.log(`🔍 Processando ${lines.length} linhas do PDF...`);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    console.log(`🔍 Linha PDF: "${trimmedLine}"`);

    // ✅ DETECTAR QUALQUER OBJETO ECT (padrão mais flexível)
    if (trimmedLine.match(/[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}/) ||
        trimmedLine.match(/[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d{1,2}-\d{3}/) ||
        trimmedLine.includes('MI') || trimmedLine.includes('OY') || 
        trimmedLine.includes('MJ') || trimmedLine.includes('MT') || 
        trimmedLine.includes('TJ') || trimmedLine.includes('BR') ||
        trimmedLine.match(/^\d{3}\s+[A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}/)) {
      
      // ✅ SE JÁ TEM ENDEREÇO COMPLETO, SALVAR E CRIAR NOVO
      if (currentAddress && currentAddress.endereco !== 'Endereço a ser extraído') {
        addresses.push(currentAddress);
        console.log(`💾 Endereço completo salvo: ${currentAddress.objeto} - ${currentAddress.endereco}`);
      }
      
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

    // ✅ DETECTAR ENDEREÇO (padrões mais flexíveis)
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || trimmedLine.includes('AV.') ||
          trimmedLine.includes('Rua') || trimmedLine.includes('Avenida') || trimmedLine.includes('rua') ||
          trimmedLine.includes('avenida') || trimmedLine.includes('Virgílio') || trimmedLine.includes('Botafogo') ||
          trimmedLine.includes('Carioca') || trimmedLine.includes('Municípios') || trimmedLine.includes('Rondon') ||
          trimmedLine.includes('Olegário') || trimmedLine.includes('Machado') || trimmedLine.includes('ndereço')) {
        
        console.log(`🏠 Endereço encontrado no PDF: ${trimmedLine}`);
        currentAddress.endereco = trimmedLine;
      }
    }

    // ✅ DETECTAR CEP (padrões mais flexíveis)
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      const cepMatch = trimmedLine.match(/(\d{8})|(\d{5}-\d{3})/);
      if (cepMatch) {
        const cep = cepMatch[1] || cepMatch[2]?.replace('-', '');
        if (cep) {
          currentAddress.cep = cep;
          console.log(`📮 CEP encontrado: ${cep}`);
        }
      }
    }

    // ✅ DETECTAR CIDADE/ESTADO
    if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
      if (trimmedLine.includes('Uberlândia') || trimmedLine.includes('MG')) {
        currentAddress.destinatario = 'Uberlândia - MG';
        console.log(`🏙️ Localização encontrada: Uberlândia - MG`);
      }
    }
  }

  // ✅ ADICIONAR ÚLTIMO ENDEREÇO
  if (currentAddress) {
    addresses.push(currentAddress);
  }

      // ✅ VALIDAR E LIMPAR ENDEREÇOS (mesma lógica das imagens)
    return addresses.map((addr, index) => {
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
            console.log(`🧹 Prefixo removido do PDF: "${prefix}" → "${cleanAddress}"`);
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
      
      // ✅ SE AINDA TEM "ser extraído", usar fallback
      if (cleanAddress.includes('ser extraído')) {
        cleanAddress = `Endereço ${index + 1} (requer edição)`;
      }
      
      // ✅ VALIDAR CEP
      if (addr.cep.includes('ser extraído')) {
        addr.cep = 'CEP não encontrado';
      }
      
      // ✅ VALIDAR DESTINATÁRIO
      if (addr.destinatario.includes('ser extraído')) {
        addr.destinatario = 'Localização não especificada';
      }
      
      // ✅ ATUALIZAR ENDEREÇO LIMPO
      addr.endereco = cleanAddress;
      
      console.log(`✅ Endereço ${index + 1} limpo: ${addr.objeto} - ${cleanAddress}`);
      return addr;
    });
}

// Configuração para aceitar uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
