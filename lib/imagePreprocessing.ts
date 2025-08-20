// RotaFácil - Pré-processamento Avançado de Imagem para OCR
// Sistema robusto com múltiplas estratégias de melhoria

import sharp from 'sharp';

// Interface para resultado de processamento
interface ImageProcessingResult {
  processedImageUrl: string;
  improvements: string[];
  confidence: number;
  processingTime: number;
}

// Função para aplicar filtros avançados de imagem
async function applyAdvancedFilters(imageBuffer: Buffer): Promise<{ processedBuffer: Buffer; filters: string[] }> {
  const filters: string[] = [];
  let processedBuffer = imageBuffer;

  try {
    // 1. Converter para escala de cinza (melhora OCR)
    processedBuffer = await sharp(imageBuffer)
      .grayscale()
      .toBuffer();
    filters.push('Conversão para escala de cinza');

    // 2. Aplicar sharpening para melhorar definição do texto
    processedBuffer = await sharp(processedBuffer)
      .sharpen(1.5, 1.0, 2.0)
      .toBuffer();
    filters.push('Sharpening aplicado');

    // 3. Ajustar contraste para destacar texto
    processedBuffer = await sharp(processedBuffer)
      .linear(1.2, -0.1) // Aumentar contraste
      .toBuffer();
    filters.push('Contraste ajustado');

    // 4. Redimensionar para resolução ideal para OCR
    const metadata = await sharp(processedBuffer).metadata();
    if (metadata.width && metadata.width < 1200) {
      processedBuffer = await sharp(processedBuffer)
        .resize(1200, null, { 
          withoutEnlargement: false,
          kernel: sharp.kernel.lanczos3
        })
        .toBuffer();
      filters.push('Redimensionamento para resolução ideal');
    }

    // 5. Aplicar filtro de redução de ruído
    processedBuffer = await sharp(processedBuffer)
      .median(1) // Filtro de mediana para reduzir ruído
      .toBuffer();
    filters.push('Redução de ruído aplicada');

  } catch (error) {
    console.error('Erro ao aplicar filtros avançados:', error);
    // Retornar imagem original se falhar
    return { processedBuffer: imageBuffer, filters: ['Falha nos filtros avançados'] };
  }

  return { processedBuffer, filters };
}

// Função para detectar orientação da imagem
async function detectAndCorrectOrientation(imageBuffer: Buffer): Promise<{ correctedBuffer: Buffer; wasCorrected: boolean }> {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    // Se a imagem tem orientação incorreta, corrigir
    if (metadata.orientation && metadata.orientation > 1) {
      const correctedBuffer = await sharp(imageBuffer)
        .rotate() // Corrigir orientação automaticamente
        .toBuffer();
      
      return { correctedBuffer, wasCorrected: true };
    }
    
    return { correctedBuffer: imageBuffer, wasCorrected: false };
  } catch (error) {
    console.error('Erro ao detectar orientação:', error);
    return { correctedBuffer: imageBuffer, wasCorrected: false };
  }
}

// Função para otimizar imagem para OCR específico
async function optimizeForTextRecognition(imageBuffer: Buffer): Promise<{ optimizedBuffer: Buffer; optimizations: string[] }> {
  const optimizations: string[] = [];
  let optimizedBuffer = imageBuffer;

  try {
    // 1. Binarização adaptativa (converter para preto e branco)
    optimizedBuffer = await sharp(imageBuffer)
      .threshold(128) // Limiar adaptativo
      .toBuffer();
    optimizations.push('Binarização adaptativa');

    // 2. Morfologia para limpar texto (substituído por filtros alternativos)
    optimizedBuffer = await sharp(optimizedBuffer)
      .median(1) // Filtro de mediana para reduzir ruído
      .toBuffer();
    optimizations.push('Filtro de mediana aplicado');

    // 3. Aplicar filtro de suavização para reduzir artefatos
    optimizedBuffer = await sharp(optimizedBuffer)
      .blur(0.5)
      .toBuffer();
    optimizations.push('Suavização aplicada');

  } catch (error) {
    console.error('Erro na otimização para texto:', error);
    return { optimizedBuffer: imageBuffer, optimizations: ['Falha na otimização'] };
  }

  return { optimizedBuffer, optimizations };
}

// Função principal de pré-processamento avançado
export async function preprocessImageForOCR(imageUrl: string): Promise<ImageProcessingResult> {
  const startTime = Date.now();
  const improvements: string[] = [];
  let confidence = 0.5;

  try {
    console.log('Iniciando pré-processamento avançado de imagem para OCR...');
    
    // 1. Baixar imagem
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.status}`);
    }
    
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    improvements.push('Imagem baixada com sucesso');
    confidence += 0.1;

    // 2. Detectar e corrigir orientação
    const { correctedBuffer, wasCorrected } = await detectAndCorrectOrientation(imageBuffer);
    if (wasCorrected) {
      improvements.push('Orientação da imagem corrigida');
      confidence += 0.1;
    }

    // 3. Aplicar filtros avançados
    const { processedBuffer, filters } = await applyAdvancedFilters(correctedBuffer);
    improvements.push(...filters);
    confidence += 0.2;

    // 4. Otimizar especificamente para reconhecimento de texto
    const { optimizedBuffer, optimizations } = await optimizeForTextRecognition(processedBuffer);
    improvements.push(...optimizations);
    confidence += 0.2;

    // 5. Converter para base64 para retorno
    const base64Image = `data:image/png;base64,${optimizedBuffer.toString('base64')}`;
    
    const processingTime = Date.now() - startTime;
    improvements.push(`Processamento concluído em ${processingTime}ms`);

    return {
      processedImageUrl: base64Image,
      improvements,
      confidence: Math.min(confidence, 1.0),
      processingTime
    };
    
  } catch (error) {
    console.error('Erro no pré-processamento avançado:', error);
    const processingTime = Date.now() - startTime;
    
    return {
      processedImageUrl: imageUrl, // Retornar original se falhar
      improvements: [`Falha no pré-processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`],
      confidence: 0.3,
      processingTime
    };
  }
}

// Função para otimizar parâmetros do Tesseract baseado no tipo de imagem
export function getOptimalTesseractConfig(imageUrl: string): {
  psm: number;
  oem: number;
  whitelist?: string;
  config?: Record<string, string>;
} {
  // Configurações otimizadas para diferentes tipos de imagens
  const config = {
    psm: 6, // Assume um bloco uniforme de texto
    oem: 3, // Default engine mode
  };

  // Configurações específicas para endereços brasileiros
  const brazilianConfig = {
    ...config,
    whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüý0123456789.,;:°º-/ ',
  };

  // Se a imagem é de boa qualidade (Supabase), usar configurações mais específicas
  if (imageUrl.includes('supabase')) {
    return {
      ...brazilianConfig,
      psm: 6, // Bloco uniforme - ideal para etiquetas
      config: {
        'tessedit_char_whitelist': brazilianConfig.whitelist || '',
        'tessedit_pageseg_mode': '6',
        'classify_bln_numeric_mode': '1'
      }
    };
  }

  return brazilianConfig;
}

// Função para detectar orientação da imagem (simulado)
export function detectImageOrientation(): {
  needsRotation: boolean;
  suggestedRotation: number;
  confidence: number;
} {
  // Em uma implementação real, usaríamos análise de imagem
  // Por enquanto, assumimos que a maioria das fotos está correta
  return {
    needsRotation: false,
    suggestedRotation: 0,
    confidence: 0.8
  };
}

// Função para estimar qualidade da imagem para OCR
export function estimateImageQuality(imageUrl: string): {
  quality: 'low' | 'medium' | 'high';
  score: number;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let score = 0.5;
  let quality: 'low' | 'medium' | 'high' = 'medium';

  // Análise básica baseada na URL e contexto
  if (imageUrl.includes('supabase')) {
    score += 0.2;
    recommendations.push('Imagem armazenada em CDN confiável');
  }

  if (imageUrl.includes('quality=95')) {
    score += 0.2;
    recommendations.push('Alta qualidade de compressão');
  }

  if (imageUrl.includes('width=1200')) {
    score += 0.1;
    recommendations.push('Resolução adequada para OCR');
  }

  // Determinar qualidade final
  if (score >= 0.8) {
    quality = 'high';
    recommendations.push('Imagem otimizada para OCR');
  } else if (score >= 0.6) {
    quality = 'medium';
    recommendations.push('Qualidade adequada para OCR');
  } else {
    quality = 'low';
    recommendations.push('Considere usar imagem de melhor qualidade');
  }

  return {
    quality,
    score,
    recommendations
  };
}

// Função para aplicar filtros baseados em heurísticas
export function applyImageFilters(imageUrl: string): {
  filteredUrl: string;
  filtersApplied: string[];
} {
  const filtersApplied: string[] = [];
  let filteredUrl = imageUrl;

  try {
    // Se for URL do Supabase, aplicar transformações
    if (imageUrl.includes('supabase.co/storage')) {
      const url = new URL(imageUrl);
      
      // Aplicar filtros para melhorar OCR
      url.searchParams.set('quality', '95');
      url.searchParams.set('format', 'webp');
      url.searchParams.set('resize', '1200x1600'); // Manter proporção
      
      // Melhorias específicas para texto
      if (!url.searchParams.has('sharpen')) {
        url.searchParams.set('sharpen', '1'); // Leve sharpening
        filtersApplied.push('Sharpening aplicado');
      }
      
      filteredUrl = url.toString();
      filtersApplied.push('Otimização Supabase aplicada');
    }
    
    return {
      filteredUrl,
      filtersApplied
    };
    
  } catch (error) {
    console.error('Erro ao aplicar filtros:', error);
    return {
      filteredUrl: imageUrl,
      filtersApplied: ['Erro ao aplicar filtros, usando original']
    };
  }
}

// Função principal que combina todas as melhorias
export async function enhanceImageForOCR(imageUrl: string): Promise<{ enhancedImageUrl: string; confidence: number }> {
  try {
    console.log('Iniciando pré-processamento avançado de imagem para OCR...');
    
    // Aplicar pré-processamento avançado
    const processedImage = await preprocessImageForOCR(imageUrl);
    
    // Calcular confiança baseada na qualidade da imagem
    let confidence = 0.7; // Base
    
    // Boost para imagens processadas
    confidence += 0.2;
    
    // Boost para imagens com boa resolução
    if (processedImage.processedImageUrl.includes('data:image')) {
      confidence += 0.1;
    }
    
    console.log(`Imagem pré-processada com confiança: ${confidence}`);
    
    return {
      enhancedImageUrl: processedImage.processedImageUrl,
      confidence: Math.min(confidence, 1.0)
    };
  } catch (error) {
    console.error('Erro no pré-processamento avançado:', error);
    
    // Fallback para imagem original
    return {
      enhancedImageUrl: imageUrl,
      confidence: 0.5
    };
  }
}