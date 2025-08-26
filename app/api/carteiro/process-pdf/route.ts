import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

const { processCarteiroFile, generateMapData, detectFileType } = require('../../../../utils/pdfExtractor');

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
          error: result.error || 'Erro ao processar arquivo'
        }, { status: 500 });
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
async function processCarteiroFileFromBuffer(base64Data: string, fileName: string, userLocation: any) {
  try {
    console.log('🔍 Processando PDF diretamente do buffer...');
    
    // ✅ TENTAR PROCESSAMENTO COMPLETO PRIMEIRO
    let extractedText = '';
    let allAddresses = [];
    
    try {
      // ✅ PRIMEIRA TENTATIVA: PDF completo
      extractedText = await processPDFWithOCR(base64Data, 'complete');
      console.log('✅ PDF processado completamente:', extractedText.substring(0, 200) + '...');
      
      // ✅ EXTRAIR ENDEREÇOS DO TEXTO COMPLETO
      allAddresses = extractAddressesFromText(extractedText);
      console.log(`✅ Endereços extraídos do PDF completo: ${allAddresses.length}`);
      
    } catch (ocrError) {
      console.log('⚠️ Processamento completo falhou:', ocrError.message);
      
      // ✅ SEGUNDA TENTATIVA: PROCESSAMENTO EM PARTES
      if (ocrError.message.includes('maximum page limit')) {
        console.log('🔄 Tentando processamento em partes...');
        
        try {
          allAddresses = await processPDFInParts(base64Data);
          console.log(`✅ Processamento em partes bem-sucedido: ${allAddresses.length} endereços`);
        } catch (partsError) {
          console.error('❌ Processamento em partes também falhou:', partsError);
          throw new Error(`Falha no processamento do PDF: ${partsError.message}`);
        }
      } else {
        throw ocrError;
      }
    }
    
    if (allAddresses.length === 0) {
      throw new Error('Nenhum endereço foi extraído do PDF');
    }
    
    console.log(`✅ PDF processado com sucesso: ${allAddresses.length} endereços encontrados`);

    return {
      success: true,
      total: allAddresses.length,
      geocoded: 0, // Será geocodificado depois
      addresses: allAddresses,
      fileType: 'pdf',
      metadata: {
        extractedAt: new Date().toISOString(),
        fileName,
        ocrEngine: 'OCR.space',
        textLength: extractedText.length,
        processingMethod: extractedText ? 'complete' : 'parts'
      }
    };

  } catch (error) {
    console.error('❌ Erro no processamento do PDF:', error);
    throw error;
  }
}

// ✅ NOVA FUNÇÃO: Processar PDF com OCR
async function processPDFWithOCR(base64Data: string, method: 'complete' | 'parts' = 'complete') {
  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
  formData.append('language', 'por');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('filetype', 'pdf');
  formData.append('isTable', 'true');
  
  // ✅ CONFIGURAÇÕES ESPECÍFICAS PARA MÉTODO
  if (method === 'parts') {
    formData.append('pages', '1-3'); // Limitar a 3 páginas por vez
  }

  const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
    headers: {
      'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
    },
    signal: AbortSignal.timeout(60000) // 60 segundos
  });

  if (!ocrResponse.ok) {
    throw new Error(`OCR.space falhou: ${ocrResponse.status}`);
  }

  const ocrData = await ocrResponse.json();
  
  if (ocrData.IsErroredOnProcessing) {
    throw new Error(`OCR.space retornou erro: ${ocrData.ErrorMessage}`);
  }

  let extractedText = '';
  if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
    extractedText = ocrData.ParsedResults[0].ParsedText;
  }

  if (!extractedText) {
    throw new Error('Nenhum texto foi extraído do PDF');
  }

  return extractedText;
}

// ✅ NOVA FUNÇÃO: Processar PDF em partes
async function processPDFInParts(base64Data: string) {
  console.log('🔄 Iniciando processamento em partes...');
  
  let allAddresses = [];
  let currentPage = 1;
  let maxPages = 10; // Limite máximo de páginas para evitar loop infinito
  
  while (currentPage <= maxPages) {
    try {
      console.log(`📄 Processando página ${currentPage}...`);
      
      // ✅ PROCESSAR PÁGINA ATUAL
      const pageText = await processPDFWithOCR(base64Data, 'parts');
      
      if (!pageText || pageText.trim().length === 0) {
        console.log(`⚠️ Página ${currentPage} vazia, parando...`);
        break;
      }
      
      // ✅ EXTRAIR ENDEREÇOS DA PÁGINA
      const pageAddresses = extractAddressesFromText(pageText);
      console.log(`✅ Página ${currentPage}: ${pageAddresses.length} endereços encontrados`);
      
      // ✅ ADICIONAR ENDEREÇOS À LISTA TOTAL
      allAddresses.push(...pageAddresses);
      
      // ✅ VERIFICAR SE AINDA HÁ MAIS CONTEÚDO
      if (pageAddresses.length === 0 && pageText.length < 100) {
        console.log(`⚠️ Página ${currentPage} parece ser a última, parando...`);
        break;
      }
      
      currentPage++;
      
      // ✅ PAUSA ENTRE REQUISIÇÕES PARA NÃO SOBRECARREGAR A API
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (pageError) {
      console.log(`⚠️ Erro ao processar página ${currentPage}:`, pageError.message);
      
      // ✅ SE FOR LIMITE DE PÁGINAS, TENTAR PRÓXIMA
      if (pageError.message.includes('maximum page limit')) {
        currentPage++;
        continue;
      }
      
      // ✅ OUTROS ERROS, PARAR PROCESSAMENTO
      console.log('❌ Erro não relacionado ao limite de páginas, parando...');
      break;
    }
  }
  
  console.log(`✅ Processamento em partes concluído: ${allAddresses.length} endereços totais`);
  
  // ✅ REMOVER DUPLICATAS BASEADO NO OBJETO
  const uniqueAddresses = allAddresses.filter((addr, index, self) => 
    index === self.findIndex(a => a.objeto === addr.objeto)
  );
  
  console.log(`✅ Endereços únicos após remoção de duplicatas: ${uniqueAddresses.length}`);
  
  return uniqueAddresses;
}

// ✅ FUNÇÃO AUXILIAR: Extrair endereços do texto
function extractAddressesFromText(text: string) {
  const addresses = [];
  const lines = text.split('\n');
  let sequence = 1;
  let currentAddress = null;

  // ✅ PADRÕES PARA LISTA ECT
  const patterns = {
    ect: /(\d{3})\s+([A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d+-\d+)/i,
    objeto: /(\d{11,13})/,
    endereco: /(RUA|AVENIDA|AV\.|R\.|TRAVESSA|TRAV\.|ALAMEDA|AL\.)\s+([^,]+),\s*(\d+)/i,
    cep: /(\d{5}-?\d{3})/,
    cidade: /([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç\s]+)\s*-\s*([A-Z]{2})/i
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    // ✅ DETECTAR NOVO ITEM ECT
    const ectMatch = trimmedLine.match(patterns.ect);
    if (ectMatch) {
      if (currentAddress) {
        addresses.push(currentAddress);
      }
      
      currentAddress = {
        id: `ect-${Date.now()}-${sequence}`,
        ordem: sequence.toString(),
        objeto: ectMatch[2].trim(),
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Localização a ser extraída',
        coordinates: undefined,
        geocoded: false
      };
      
      sequence++;
      continue;
    }

    // ✅ DETECTAR ENDEREÇO
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || trimmedLine.includes('AV.')) {
        currentAddress.endereco = trimmedLine;
      }
    }

    // ✅ DETECTAR CEP
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      const cepMatch = trimmedLine.match(patterns.cep);
      if (cepMatch) {
        currentAddress.cep = cepMatch[1];
      }
    }

    // ✅ DETECTAR CIDADE/ESTADO
    if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
      const cityMatch = trimmedLine.match(patterns.cidade);
      if (cityMatch) {
        currentAddress.destinatario = `${cityMatch[1].trim()}, ${cityMatch[2].trim()}`;
      }
    }
  }

  // ✅ ADICIONAR ÚLTIMO ENDEREÇO
  if (currentAddress) {
    addresses.push(currentAddress);
  }

  // ✅ VALIDAR ENDEREÇOS
  return addresses.map((addr, index) => {
    if (addr.endereco.includes('ser extraído')) {
      addr.endereco = `Endereço ${index + 1} (requer edição)`;
    }
    if (addr.cep.includes('ser extraído')) {
      addr.cep = 'CEP não encontrado';
    }
    if (addr.destinatario.includes('ser extraído')) {
      addr.destinatario = 'Localização não especificada';
    }
    return addr;
  });
}

// Configuração para aceitar uploads
export const config = {
  api: {
    bodyParser: false,
  },
};
