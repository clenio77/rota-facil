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
      
    } catch (ocrError: unknown) {
      const errorMessage = ocrError instanceof Error ? ocrError.message : 'Erro desconhecido';
      console.log('⚠️ Processamento completo falhou:', errorMessage);
      
      // ✅ SEGUNDA TENTATIVA: PROCESSAMENTO EM PARTES
      if (errorMessage.includes('maximum page limit')) {
        console.log('🔄 Tentando processamento em partes...');
        
        try {
          allAddresses = await processPDFInParts(base64Data);
          console.log(`✅ Processamento em partes bem-sucedido: ${allAddresses.length} endereços`);
        } catch (partsError: unknown) {
          const partsErrorMessage = partsError instanceof Error ? partsError.message : 'Erro desconhecido';
          console.error('❌ Processamento em partes também falhou:', partsErrorMessage);
          throw new Error(`Falha no processamento do PDF: ${partsErrorMessage}`);
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
  
  // ✅ REMOVER COMPLETAMENTE O PARÂMETRO 'pages' INVÁLIDO
  // O OCR.space processará automaticamente as primeiras páginas

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
    // ✅ VERIFICAR SE É APENAS AVISO DE LIMITE DE PÁGINAS
    if (ocrData.ErrorMessage.includes('maximum page limit')) {
      console.log('⚠️ Limite de páginas atingido, mas texto foi extraído das primeiras páginas');
      return extractedText; // ✅ RETORNAR O TEXTO DISPONÍVEL
    } else {
      throw new Error(`OCR.space retornou erro: ${ocrData.ErrorMessage}`);
    }
  }

  return extractedText;
}

// ✅ NOVA FUNÇÃO: Processar PDF em partes
async function processPDFInParts(base64Data: string) {
  console.log('🔄 Iniciando processamento em partes...');
  
  let allAddresses = [];
  
  try {
    // ✅ PROCESSAR PDF COMPLETO (OCR.space retornará as primeiras 3 páginas)
    console.log('📄 Processando PDF completo (OCR.space retornará primeiras 3 páginas)...');
    
    const pageText = await processPDFWithOCR(base64Data, 'parts');
    
    if (!pageText || pageText.trim().length === 0) {
      console.log('⚠️ PDF não retornou texto, tentando abordagem alternativa...');
      throw new Error('PDF não retornou texto');
    }
    
    console.log(`✅ PDF processado: ${pageText.length} caracteres extraídos`);
    console.log('📝 Primeiras 200 caracteres:', pageText.substring(0, 200) + '...');
    
    // ✅ EXTRAIR ENDEREÇOS DO TEXTO DAS PRIMEIRAS 3 PÁGINAS
    const pageAddresses = extractAddressesFromText(pageText);
    console.log(`✅ Endereços extraídos das primeiras 3 páginas: ${pageAddresses.length}`);
    
    // ✅ ADICIONAR ENDEREÇOS À LISTA TOTAL
    allAddresses.push(...pageAddresses);
    
    // ✅ SE HÁ POUCOS ENDEREÇOS, TENTAR PROCESSAR MAIS PÁGINAS
    if (pageAddresses.length < 5) {
      console.log('⚠️ Poucos endereços encontrados, tentando processar mais páginas...');
      
      // ✅ TENTAR PROCESSAR COM DIFERENTES CONFIGURAÇÕES
      try {
        const additionalText = await processPDFWithAlternativeSettings(base64Data);
        if (additionalText && additionalText.length > pageText.length) {
          console.log('✅ Texto adicional extraído com configurações alternativas');
          
          const additionalAddresses = extractAddressesFromText(additionalText);
          console.log(`✅ Endereços adicionais encontrados: ${additionalAddresses.length}`);
          
          // ✅ COMBINAR ENDEREÇOS, REMOVENDO DUPLICATAS
          const combinedAddresses = [...allAddresses, ...additionalAddresses];
          const uniqueAddresses = combinedAddresses.filter((addr, index, self) => 
            index === self.findIndex(a => a.objeto === addr.objeto)
          );
          
          console.log(`✅ Total de endereços únicos: ${uniqueAddresses.length}`);
          return uniqueAddresses;
        }
      } catch (altError: unknown) {
        const altErrorMessage = altError instanceof Error ? altError.message : 'Erro desconhecido';
        console.log('⚠️ Configurações alternativas falharam:', altErrorMessage);
      }
    }
    
  } catch (pageError: unknown) {
    const pageErrorMessage = pageError instanceof Error ? pageError.message : 'Erro desconhecido';
    console.log(`⚠️ Erro ao processar PDF:`, pageErrorMessage);
    
    // ✅ SE FOR LIMITE DE PÁGINAS, TENTAR EXTRAIR TEXTO PARCIAL
    if (pageErrorMessage.includes('maximum page limit')) {
      console.log('🔄 Limite de páginas atingido, tentando extrair texto parcial...');
      
      try {
        // ✅ TENTAR EXTRAIR TEXTO PARCIAL COM CONFIGURAÇÕES MÍNIMAS
        const partialText = await extractPartialTextFromPDF(base64Data);
        if (partialText) {
          console.log(`✅ Texto parcial extraído: ${partialText.length} caracteres`);
          console.log('📝 Primeiras 200 caracteres do texto parcial:', partialText.substring(0, 200) + '...');
          
          const partialAddresses = extractAddressesFromText(partialText);
          console.log(`✅ Endereços extraídos do texto parcial: ${partialAddresses.length}`);
          allAddresses.push(...partialAddresses);
        } else {
          console.log('⚠️ Nenhum texto parcial foi extraído');
        }
      } catch (partialError: unknown) {
        const partialErrorMessage = partialError instanceof Error ? partialError.message : 'Erro desconhecido';
        console.log('⚠️ Extração parcial falhou:', partialErrorMessage);
      }
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

// ✅ NOVA FUNÇÃO: Processar PDF com configurações alternativas
async function processPDFWithAlternativeSettings(base64Data: string) {
  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
  formData.append('language', 'por');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '1'); // ✅ MUDAR PARA ENGINE 1
  formData.append('filetype', 'pdf');
  formData.append('isTable', 'false'); // ✅ DESABILITAR TABELA
  
  const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
    headers: {
      'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
    },
    signal: AbortSignal.timeout(90000) // 90 segundos
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

  return extractedText;
}

// ✅ NOVA FUNÇÃO: Extrair texto parcial do PDF
async function extractPartialTextFromPDF(base64Data: string) {
  try {
    // ✅ TENTAR COM CONFIGURAÇÕES MÍNIMAS
    const formData = new FormData();
    formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
    formData.append('language', 'por');
    formData.append('OCREngine', '1');
    formData.append('filetype', 'pdf');
    
    const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      headers: {
        'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
      },
      signal: AbortSignal.timeout(30000) // 30 segundos
    });

    if (ocrResponse.ok) {
      const ocrData = await ocrResponse.json();
      if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
        return ocrData.ParsedResults[0].ParsedText;
      }
    }
     } catch (error: unknown) {
     const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
     console.log('⚠️ Extração parcial falhou:', errorMessage);
   }
  
  return null;
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
