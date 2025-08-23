import { NextRequest, NextResponse } from 'next/server';

interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
}

// ✅ FUNÇÃO PARA EXTRAIR ENDEREÇOS DO TEXTO OCR
function extractAddressesFromText(text: string): string[] {
  if (!text) return [];
  
  const addresses: string[] = [];
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  for (const line of lines) {
    // ✅ PADRÃO 1: Endereço com rua, número, cidade, estado
    const addressPattern1 = /(Rua|Avenida|Av|Travessa|Praça)\s+([^,]+),\s*(\d+)[^,]*,\s*([^,]+),\s*([A-Z]{2})/i;
    const match1 = line.match(addressPattern1);
    if (match1) {
      const address = `${match1[1]} ${match1[2]}, ${match1[3]}, ${match1[4]}, ${match1[5]}`;
      if (!addresses.includes(address)) {
        addresses.push(address);
      }
      continue;
    }
    
    // ✅ PADRÃO 2: Endereço com rua, número, CEP
    const addressPattern2 = /(Rua|Avenida|Av|Travessa|Praça)\s+([^,]+),\s*(\d+)[^,]*\s*CEP:\s*(\d{5}-?\d{3})/i;
    const match2 = line.match(addressPattern2);
    if (match2) {
      const address = `${match2[1]} ${match2[2]}, ${match2[3]}, Uberlândia, MG`;
      if (!addresses.includes(address)) {
        addresses.push(address);
      }
      continue;
    }
    
    // ✅ PADRÃO 3: Endereço simples com rua e número
    const addressPattern3 = /(Rua|Avenida|Av|Travessa|Praça)\s+([^,]+),\s*(\d+)/i;
    const match3 = line.match(addressPattern3);
    if (match3) {
      const address = `${match3[1]} ${match3[2]}, ${match3[3]}, Uberlândia, MG`;
      if (!addresses.includes(address)) {
        addresses.push(address);
      }
      continue;
    }
    
    // ✅ PADRÃO 4: Linha que contém "Endereço:" seguida de endereço
    if (line.includes('Endereço:') && line.length > 10) {
      const addressPart = line.replace('Endereço:', '').trim();
      if (addressPart.length > 10) {
        // Tentar extrair endereço da parte após "Endereço:"
        const cleanAddress = cleanAddressText(addressPart);
        if (cleanAddress && !addresses.includes(cleanAddress)) {
          addresses.push(cleanAddress);
        }
      }
    }
  }
  
  return addresses;
}

// ✅ FUNÇÃO PARA LIMPAR TEXTO DE ENDEREÇO
function cleanAddressText(text: string): string {
  if (!text) return '';
  
  let cleanText = text;
  
  // ✅ CORREÇÃO CRÍTICA: Interpretar faixas de numeração
  cleanText = cleanText.replace(/até\s+(\d+)\/(\d+)/gi, '$1');
  cleanText = cleanText.replace(/at\s+(\d+)\s+(\d+)/gi, '$1');
  cleanText = cleanText.replace(/(\d+)\/(\d+)/gi, '$1');
  cleanText = cleanText.replace(/(\d+)\s+(\d+)/gi, '$1');
  
  // ✅ CORREÇÃO CRÍTICA: Remover hífens desnecessários
  cleanText = cleanText.replace(/^(Rua|Avenida|Travessa|Praça)\s+([^-]+)\s*-\s*(\d+)/gi, '$1 $2, $3');
  
  // ✅ CORREÇÃO CRÍTICA: Remover texto "Doc.Identidade" e similares
  cleanText = cleanText.replace(/Doc\.Identidade[^,]*/gi, '');
  cleanText = cleanText.replace(/Nome\s+legível[^,]*/gi, '');
  cleanText = cleanText.replace(/motivo\s+de\s+não\s+entrega[^,]*/gi, '');
  
  // ✅ REMOVER: CEP e informações extras
  cleanText = cleanText.replace(/CEP:\s*\d{5}-?\d{3}/gi, '');
  
  // ✅ REMOVER: Caracteres especiais e lixo
  cleanText = cleanText.replace(/[^\w\s\-,\.]/g, ' ');
  
  // ✅ LIMPAR: Múltiplos espaços
  cleanText = cleanText.replace(/\s+/g, ' ').trim();
  
  // ✅ VALIDAR: Endereço deve ter pelo menos 10 caracteres
  if (cleanText.length < 10) {
    return '';
  }
  
  // ✅ CORREÇÃO FINAL: Garantir que o endereço termine com cidade e estado
  if (!cleanText.includes('Uberlândia') && !cleanText.includes('MG')) {
    cleanText += ', Uberlândia, MG';
  }
  
  return cleanText;
}

// API Externa de OCR (sem Tesseract.js)
async function tryOCRSpace(imageUrl: string): Promise<OCRResult | null> {
  try {
    // ✅ CORREÇÃO CRÍTICA: Usar mesma lógica da aba Carteiro
    const formData = new FormData();
    formData.append('url', imageUrl);
    formData.append('language', 'por');
    formData.append('isOverlayRequired', 'false');
    formData.append('OCREngine', '2'); // ✅ MESMO ENGINE
    formData.append('filetype', 'png'); // ✅ MESMO FILETYPE
    formData.append('isTable', 'true'); // ✅ MESMO IS_TABLE
    
    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      body: formData,
      headers: {
        'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld' // Chave gratuita
      }
    });
    
    const data = await response.json();
    
    // ✅ CORREÇÃO CRÍTICA: Mesma validação da aba Carteiro
    if (data.IsErroredOnProcessing) {
      console.log('❌ OCR.space retornou erro:', data.ErrorMessage);
      return null;
    }
    
    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      console.log('❌ OCR.space não retornou resultados');
      return null;
    }
    
    const text = data.ParsedResults[0]?.ParsedText || '';
    
    if (!text.trim()) {
      console.log('❌ OCR.space retornou texto vazio');
      return null;
    }
    
    console.log('✅ OCR.space funcionou com sucesso!');
    console.log('Texto extraído via OCR:', text.substring(0, 100) + '...');
    
    return {
      text: text,
      confidence: 0.8, // OCR.space não retorna confiança
      provider: 'ocr.space'
    };
  } catch (error) {
    console.error('❌ OCR.space falhou:', error);
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
    
    // ✅ CORREÇÃO CRÍTICA: Usar mesma lógica da aba Carteiro
    let ocrResult: OCRResult | null = null;
    
    // ✅ TENTAR OCR.SPACE PRIMEIRO (que funciona na aba Carteiro)
    try {
      console.log('Tentando OCR.space...');
      ocrResult = await tryOCRSpace(imageUrl);
      if (ocrResult && ocrResult.text.trim()) {
        console.log('✅ OCR.space funcionou!');
      }
    } catch (error) {
      console.log('❌ OCR.space falhou:', error);
    }
    
    // ✅ SE OCR.SPACE FALHOU, TENTAR ALTERNATIVAS
    if (!ocrResult || !ocrResult.text.trim()) {
      try {
        console.log('Tentando OCR API alternativa...');
        ocrResult = await tryOCRAPI(imageUrl);
        if (ocrResult && ocrResult.text.trim()) {
          console.log('✅ OCR API alternativa funcionou!');
        }
      } catch (error) {
        console.log('❌ OCR API alternativa falhou:', error);
      }
    }
    
    // ✅ SE AINDA FALHOU, TENTAR GOOGLE CLOUD VISION
    if (!ocrResult || !ocrResult.text.trim()) {
      try {
        console.log('Tentando Google Cloud Vision...');
        ocrResult = await tryCloudVision(imageUrl);
        if (ocrResult && ocrResult.text.trim()) {
          console.log('✅ Google Cloud Vision funcionou!');
        }
      } catch (error) {
        console.log('❌ Google Cloud Vision falhou:', error);
      }
    }

    // ❌ REMOVER: OCR simulado que quebra a funcionalidade
    // ❌ REMOVER: Dados fake que não resolvem o problema real
    if (!ocrResult || !ocrResult.text.trim()) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair texto da imagem. Tente uma imagem mais clara ou use a aba Carteiro para listas ECT.',
        extractedText: '',
        suggestions: [
          'Verifique se a imagem está nítida e bem iluminada',
          'Certifique-se de que o texto está legível',
          'Use a aba Carteiro para listas ECT completas',
          'Use o modo manual se necessário'
        ]
      });
    }

    console.log('OCR externo bem-sucedido:', {
      provider: ocrResult.provider,
      confidence: ocrResult.confidence,
      textLength: ocrResult.text.length
    });

    // ✅ CORREÇÃO CRÍTICA: Extrair endereços do texto OCR
    const extractedAddresses = extractAddressesFromText(ocrResult.text);
    
    if (extractedAddresses.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Não foi possível extrair endereços válidos do texto da imagem.',
        extractedText: ocrResult.text,
        suggestions: [
          'Verifique se a imagem contém endereços legíveis',
          'Tente uma imagem mais clara',
          'Use o modo manual se necessário'
        ]
      });
    }

    // ✅ RETORNAR PRIMEIRO ENDEREÇO EXTRAÍDO
    const primaryAddress = extractedAddresses[0];
    
    console.log('✅ Endereços extraídos:', extractedAddresses);
    console.log('✅ Endereço principal:', primaryAddress);

    console.log('Processamento concluído com sucesso para carteiro (FALLBACK)');

    return NextResponse.json({
      success: true,
      message: 'Endereço extraído com sucesso!',
      address: primaryAddress, // ✅ ENDEREÇO EXTRAÍDO
      allAddresses: extractedAddresses, // ✅ TODOS OS ENDEREÇOS
      extractedText: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      extractionConfidence: 0.8,
      extractionMethod: `ocr-${ocrResult.provider}`,
      suggestions: [
        'Endereço extraído via OCR',
        'Use o botão "Adicionar às Paradas" para incluir na rota',
        'Verifique se o endereço está correto'
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
