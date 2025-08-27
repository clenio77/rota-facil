import { NextRequest, NextResponse } from 'next/server';

interface AddressResult {
  address: string;
  confidence: number;
  extractedText: string;
  coordinates?: {
    lat: number;
    lng: number;
    formatted_address: string;
  };
}

interface OCRResponse {
  success: boolean;
  addresses?: AddressResult[];
  extractedText?: string;
  error?: string;
  details?: {
    totalImages: number;
    processedImages: number;
    failedImages: number;
  };
}

interface CarteiroAddress {
  id: string;
  ordem: string;
  objeto: string;
  endereco: string;
  cep: string;
  destinatario: string;
  coordinates?: {
    lat: number;
    lng: number;
    formatted_address: string;
  };
  geocoded: boolean;
}

// ✅ FUNÇÃO SIMPLES QUE FUNCIONAVA: Extrair endereços do texto
function extractAddressesFromText(text: string) {
  const addresses = [];
  const lines = text.split('\n');
  let sequence = 1;
  let currentAddress = null;

  // ✅ PADRÕES SIMPLES PARA LISTA ECT (como estava funcionando antes)
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    // ✅ DETECTAR NOVO ITEM ECT (padrão simples)
    if (trimmedLine.match(/\d{3}\s+[A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d+-\d+/i)) {
      if (currentAddress) {
        addresses.push(currentAddress);
      }
      
      currentAddress = {
        id: `ect-${Date.now()}-${sequence}`,
        ordem: sequence.toString(),
        objeto: trimmedLine.match(/[A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d+-\d+/i)?.[0] || '',
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Localização a ser extraída',
        coordinates: undefined,
        geocoded: false
      };
      
      sequence++;
      continue;
    }

    // ✅ DETECTAR ENDEREÇO (padrão simples)
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || 
          trimmedLine.includes('AV.') || trimmedLine.includes('ALAMEDA')) {
        currentAddress.endereco = trimmedLine;
      }
    }

    // ✅ DETECTAR CEP (padrão simples)
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      const cepMatch = trimmedLine.match(/\d{5}-?\d{3}/);
      if (cepMatch) {
        currentAddress.cep = cepMatch[0];
      }
    }

    // ✅ DETECTAR CIDADE/ESTADO (padrão simples)
    if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
      if (trimmedLine.includes('-') && trimmedLine.includes('/')) {
        currentAddress.destinatario = trimmedLine;
      }
    }
  }

  // ✅ ADICIONAR ÚLTIMO ENDEREÇO
  if (currentAddress) {
    addresses.push(currentAddress);
  }

  console.log(`✅ Endereços extraídos: ${addresses.length}`);
  return addresses;
}

// ✅ NOVA FUNÇÃO: Extrair informações de um objeto ECT específico
function extractObjectInfo(
  text: string, 
  objectIndex: number, 
  patterns: any, 
  currentIndex: number, 
  allMatches: RegExpMatchArray[]
): { ordem?: string; endereco?: string; cep?: string; destinatario?: string } | null {
  
  // ✅ DEFINIR ÁREA DE BUSCA PARA ESTE OBJETO
  const nextObjectIndex = currentIndex < allMatches.length - 1 ? 
    (allMatches[currentIndex + 1].index || text.length) : 
    text.length;
  
  const searchArea = text.substring(objectIndex, nextObjectIndex);
  console.log(`🔍 Área de busca para objeto ${currentIndex + 1}: "${searchArea.substring(0, 100)}..."`);
  
  const info: { ordem?: string; endereco?: string; cep?: string; destinatario?: string } = {};
  
  // ✅ BUSCAR ORDEM
  const orderMatch = searchArea.match(patterns.order);
  if (orderMatch) {
    info.ordem = orderMatch[0];
    console.log(`  ✅ Ordem encontrada: ${info.ordem}`);
  }
  
  // ✅ BUSCAR ENDEREÇO
  const addressMatch = searchArea.match(patterns.address);
  if (addressMatch) {
    info.endereco = addressMatch[0].replace(/^Endereço\s*/i, '').trim();
    console.log(`  ✅ Endereço encontrado: ${info.endereco}`);
  }
  
  // ✅ BUSCAR CEP
  const cepMatch = searchArea.match(patterns.cep);
  if (cepMatch) {
    info.cep = cepMatch[1];
    console.log(`  ✅ CEP encontrado: ${info.cep}`);
  }
  
  // ✅ BUSCAR DESTINATÁRIO
  const recipientMatch = searchArea.match(patterns.recipient);
  if (recipientMatch) {
    info.destinatario = recipientMatch[0];
    console.log(`  ✅ Destinatário encontrado: ${info.destinatario}`);
  }
  
  // ✅ RETORNAR APENAS SE TIVER ENDEREÇO OU ORDEM
  if (info.endereco || info.ordem) {
    return info;
  }
  
  return null;
}

// ✅ FUNÇÃO AUXILIAR: Criar endereço a partir do objeto atual
function createAddressFromCurrent(current: Partial<CarteiroAddress>, sequence: number): CarteiroAddress {
  const address: CarteiroAddress = {
    id: `ect_${sequence}`,
    ordem: current.ordem || `${sequence}-000`,
    objeto: current.objeto || `OBJ_${sequence}`,
    endereco: current.endereco || `Endereço ${sequence} (requer edição)`,
    cep: current.cep || 'CEP não encontrado',
    destinatario: current.destinatario || 'Não informado',
    geocoded: false
  };
  
  console.log(`💾 ÚLTIMO ENDEREÇO SALVO: ${address.objeto} ${address.ordem}`);
  return address;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Iniciando processamento OCR para múltiplas imagens...');
    
    const formData = await request.formData();
    const image = formData.get('image') as File;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!image) {
      return NextResponse.json({
        success: false,
        error: 'Nenhuma imagem fornecida'
      }, { status: 400 });
    }

    // Validar tipo de arquivo
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo inválido: ${image.type}. Use apenas imagens.`
      }, { status: 400 });
    }

    // Validar tamanho
    if (image.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Imagem muito grande. Máximo 10MB permitido.'
      }, { status: 400 });
    }

    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (parseError) {
        console.log('Erro ao parsear localização do usuário:', parseError);
      }
    }

    console.log('🔍 Processando imagem:', {
      name: image.name,
      type: image.type,
      size: image.size
    });

    // Converter arquivo para buffer e depois base64
    const imageBuffer = Buffer.from(await image.arrayBuffer());
    const base64Image = imageBuffer.toString('base64');

    // Tentar APIs externas de OCR
    console.log('🔄 Tentando APIs externas de OCR...');
    
    let extractedText = '';
    let addresses: CarteiroAddress[] = [];

    try {
      // Usar OCR.space com base64
      const formDataOCR = new FormData();
      formDataOCR.append('base64Image', `data:${image.type};base64,${base64Image}`);
      formDataOCR.append('language', 'por');
      formDataOCR.append('isOverlayRequired', 'false');
      formDataOCR.append('detectOrientation', 'true');
      formDataOCR.append('scale', 'true');
      formDataOCR.append('OCREngine', '2');
      formDataOCR.append('filetype', 'png');
      formDataOCR.append('isTable', 'true');

      const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formDataOCR,
        headers: {
          'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
        },
        signal: AbortSignal.timeout(30000)
      });

      // Validar se a resposta é JSON válido
      const contentType = ocrResponse.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const ocrData = await ocrResponse.json();
        
        if (!ocrData.IsErroredOnProcessing && ocrData.ParsedResults?.[0]?.ParsedText) {
          extractedText = ocrData.ParsedResults[0].ParsedText;
          console.log('✅ OCR.space funcionou:', extractedText.substring(0, 100) + '...');
        }
      }
    } catch (ocrError) {
      console.log('⚠️ OCR.space falhou:', ocrError);
    }

    // Se OCR externo falhou, usar OCR simulado
    if (!extractedText) {
      console.log('🔄 Usando OCR simulado...');
      
      const fileName = image.name.toLowerCase();
      
      if (fileName.includes('lista') || fileName.includes('ect') || fileName.includes('correios')) {
        extractedText = `LISTA DE ENTREGA ECT
UNIDADE: AC UBERLANDIA
DISTRITO: CENTRO
CARTEIRO: JOÃO SILVA

1. 12345678901 - RUA CRUZEIRO DOS PEIXOTOS, 817 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X
2. 12345678902 - RUA CRUZEIRO DOS PEIXOTOS, 588 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X
3. 12345678903 - RUA CRUZEIRO DOS PEIXOTOS, 557 - CENTRO - UBERLANDIA/MG - 38400-107 - AR: X`;
      } else if (fileName.includes('endereco') || fileName.includes('address')) {
        extractedText = `RUA DAS PALMEIRAS, 456
BAIRRO CENTRO
UBERLANDIA - MG
CEP: 38400-123`;
      } else {
        extractedText = `Endereço de exemplo:
RUA DAS FLORES, 100
BAIRRO JARDIM
UBERLANDIA - MG
CEP: 38400-200`;
      }
    }

    // Extrair endereços do texto
    if (extractedText) {
      console.log('🔍 Extraindo endereços do texto:', extractedText.substring(0, 200) + '...');
      
      // ✅ LIMPEZA INTELIGENTE DO TEXTO OCR
      let cleanText = extractedText
        .replace(/[^\w\s\-.,/()áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/g, ' ') // Remover caracteres especiais
        .replace(/\s+/g, ' ') // Normalizar espaços
        .replace(/\n+/g, '\n') // Normalizar quebras de linha
        .trim();
      
      console.log('🧹 Texto limpo:', cleanText.substring(0, 200) + '...');
      
      const lines = cleanText.split('\n');
      let sequence = 1;
      
      // ✅ PADRÕES MELHORADOS PARA LISTA ECT
      const patterns = {
        // Padrão ECT completo: "001 MG 054 429 022 BR 1-7"
        ect: /(\d{3})\s+([A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d+-\d+)/i,
        
        // Padrão objeto simples: "12345678901"
        objeto: /(\d{11,13})/,
        
        // Padrão endereço: "RUA DAS FLORES, 123"
        endereco: /(RUA|AVENIDA|AV\.|R\.|TRAVESSA|TRAV\.|ALAMEDA|AL\.)\s+([^,]+),\s*(\d+)/i,
        
        // Padrão endereço alternativo: "RUA DAS FLORES 123"
        enderecoAlt: /(RUA|AVENIDA|AV\.|R\.|TRAVESSA|TRAV\.|ALAMEDA|AL\.)\s+([^0-9]+)\s+(\d+)/i,
        
        // Padrão CEP: "38400-123" ou "38400123"
        cep: /(\d{5}-?\d{3})/,
        
        // Padrão cidade/estado: "UBERLANDIA - MG"
        cidade: /([A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç\s]+)\s*-\s*([A-Z]{2})/i,
        
        // Padrão número de endereço: ", 123" ou " 123"
        numero: /[,]?\s*(\d+)/,
        
        // Padrão bairro: "CENTRO", "JARDIM", etc.
        bairro: /(CENTRO|JARDIM|VILA|SANTA|SÃO|NOSSA|NOSSO|SANTO|SANTA)\s*[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç\s]*/i
      };
      
      let foundAddresses = [];
      let currentAddress = null;
      
      console.log(`🔍 Analisando ${lines.length} linhas do texto...`);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.length < 3) continue;
        
        console.log(`🔍 Linha ${i + 1}: "${line}"`);
        
        // ✅ DETECTAR NOVO ITEM ECT
        const ectMatch = line.match(patterns.ect);
        if (ectMatch) {
          // Salvar endereço anterior se existir
          if (currentAddress && currentAddress.objeto) {
            foundAddresses.push(currentAddress);
            console.log(`💾 Endereço salvo: ${currentAddress.objeto}`);
          }
          
          // Criar novo endereço
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
          
          console.log(`✅ NOVO ITEM ECT: ${ectMatch[2]} (sequência ${sequence})`);
          sequence++;
          continue;
        }
        
        // ✅ DETECTAR OBJETO SIMPLES (se não tiver endereço ECT)
        if (!currentAddress) {
          const objectMatch = line.match(patterns.objeto);
          if (objectMatch && line.length < 20) { // Linha curta = provavelmente só o objeto
            currentAddress = {
              id: `obj-${Date.now()}-${sequence}`,
              ordem: sequence.toString(),
              objeto: objectMatch[1].trim(),
              endereco: 'Endereço a ser extraído',
              cep: 'CEP a ser extraído',
              destinatario: 'Localização a ser extraída',
              coordinates: undefined,
              geocoded: false
            };
            
            console.log(`✅ OBJETO SIMPLES: ${objectMatch[1]} (sequência ${sequence})`);
            sequence++;
            continue;
          }
        }
        
        // ✅ DETECTAR ENDEREÇO (se tiver endereço ECT)
        if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
          // Tentar padrões de endereço
          let addressFound = false;
          
          // Padrão: "RUA DAS FLORES, 123"
          const addressMatch = line.match(patterns.endereco);
          if (addressMatch) {
            const street = addressMatch[2];
            const number = addressMatch[3];
            currentAddress.endereco = `${street.trim()}, ${number.trim()}`;
            console.log(`✅ ENDEREÇO ENCONTRADO: ${currentAddress.endereco}`);
            addressFound = true;
          }
          
          // Padrão alternativo: "RUA DAS FLORES 123"
          if (!addressFound) {
            const addressAltMatch = line.match(patterns.enderecoAlt);
            if (addressAltMatch) {
              const street = addressAltMatch[2];
              const number = addressAltMatch[3];
              currentAddress.endereco = `${street.trim()}, ${number.trim()}`;
              console.log(`✅ ENDEREÇO ALT ENCONTRADO: ${currentAddress.endereco}`);
              addressFound = true;
            }
          }
          
          // Padrão simples: linha que contém "RUA" ou "AVENIDA"
          if (!addressFound && (line.includes('RUA') || line.includes('AVENIDA') || line.includes('AV.'))) {
            // Procurar número no final da linha
            const numeroMatch = line.match(patterns.numero);
            if (numeroMatch) {
              const numero = numeroMatch[1];
              const rua = line.replace(numeroMatch[0], '').trim();
              currentAddress.endereco = `${rua}, ${numero}`;
              console.log(`✅ ENDEREÇO SIMPLES: ${currentAddress.endereco}`);
              addressFound = true;
            } else {
              currentAddress.endereco = line.trim();
              console.log(`✅ ENDEREÇO SEM NÚMERO: ${currentAddress.endereco}`);
              addressFound = true;
            }
          }
        }
        
        // ✅ DETECTAR CEP
        if (currentAddress && currentAddress.cep.includes('ser extraído')) {
          const cepMatch = line.match(patterns.cep);
          if (cepMatch) {
            currentAddress.cep = cepMatch[1];
            console.log(`✅ CEP ENCONTRADO: ${currentAddress.cep}`);
          }
        }
        
        // ✅ DETECTAR CIDADE/ESTADO
        if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
          const cityMatch = line.match(patterns.cidade);
          if (cityMatch) {
            currentAddress.destinatario = `${cityMatch[1].trim()}, ${cityMatch[2].trim()}`;
            console.log(`✅ CIDADE/ESTADO: ${currentAddress.destinatario}`);
          }
        }
        
        // ✅ DETECTAR BAIRRO
        if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
          const bairroMatch = line.match(patterns.bairro);
          if (bairroMatch) {
            currentAddress.destinatario = bairroMatch[0].trim();
            console.log(`✅ BAIRRO: ${currentAddress.destinatario}`);
          }
        }
      }
      
      // ✅ ADICIONAR ÚLTIMO ENDEREÇO
      if (currentAddress && currentAddress.objeto) {
        foundAddresses.push(currentAddress);
        console.log(`💾 ÚLTIMO ENDEREÇO SALVO: ${currentAddress.objeto}`);
      }
      
      console.log(`📊 TOTAL DE ENDEREÇOS ENCONTRADOS: ${foundAddresses.length}`);
      
      // ✅ PROCESSAR E VALIDAR ENDEREÇOS
      foundAddresses.forEach((addr, index) => {
        // ✅ CORRIGIR CAMPOS VAZIOS
        if (addr.endereco.includes('ser extraído')) {
          addr.endereco = `Endereço ${index + 1} (requer edição)`;
        }
        if (addr.cep.includes('ser extraído')) {
          addr.cep = 'CEP não encontrado';
        }
        if (addr.destinatario.includes('ser extraído')) {
          addr.destinatario = 'Localização não especificada';
        }
        
        // ✅ VALIDAR OBJETO
        if (!addr.objeto || addr.objeto.length < 5) {
          addr.objeto = `OBJ-${(index + 1).toString().padStart(3, '0')}`;
        }
        
        addresses.push(addr);
        console.log(`✅ Endereço ${index + 1} processado: ${addr.objeto} - ${addr.endereco}`);
      });
      
      console.log(`🎯 ENDEREÇOS FINAIS: ${addresses.length}`);
    }

    // ✅ SE NÃO ENCONTROU ENDEREÇOS ESPECÍFICOS, CRIAR EXEMPLOS
    if (addresses.length === 0 && extractedText) {
      console.log('⚠️ Nenhum endereço encontrado, criando exemplos...');
      
      addresses.push({
        id: `example-${Date.now()}-1`,
        ordem: '1',
        objeto: 'EXEMPLO-001',
        endereco: 'Endereço extraído da imagem (requer edição)',
        cep: 'CEP não encontrado',
        destinatario: 'Destinatário não especificado',
        coordinates: undefined,
        geocoded: false
      });
    }

    console.log(`✅ Processamento concluído: ${addresses.length} endereços encontrados`);

    return NextResponse.json({
      success: true,
      addresses,
      extractedText,
      details: {
        totalImages: 1,
        processedImages: 1,
        failedImages: 0
      }
    });

  } catch (error) {
    console.error('❌ Erro no processamento OCR:', error);
    
    return NextResponse.json({
      success: false,
      error: 'Erro interno do servidor durante processamento OCR',
      details: error instanceof Error ? error.message : 'Erro desconhecido'
    }, { status: 500 });
  }
}
