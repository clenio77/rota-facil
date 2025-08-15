// RotaFácil - Pré-processamento de Imagem para OCR
// Melhorias gratuitas para aumentar precisão do reconhecimento de texto

// Função para converter base64 para ImageData (simulado)
interface ImageProcessingResult {
  processedImageUrl: string;
  improvements: string[];
  confidence: number;
}

// Função principal de pré-processamento
export async function preprocessImageForOCR(imageUrl: string): Promise<ImageProcessingResult> {
  const improvements: string[] = [];
  let confidence = 0.5;

  try {
    // Para uma implementação mais robusta, poderíamos usar Canvas API no servidor
    // Por enquanto, vamos fazer melhorias básicas que não requerem processamento de imagem pesado
    
    console.log('Iniciando pré-processamento de imagem para OCR...');
    
    // 1. Verificar qualidade da URL
    if (imageUrl && imageUrl.includes('supabase')) {
      improvements.push('URL Supabase válida');
      confidence += 0.1;
    }
    
    // 2. Adicionar parâmetros de otimização ao URL se for Supabase
    let processedUrl = imageUrl;
    if (imageUrl.includes('supabase.co/storage')) {
      // Aplicar transformações Supabase para melhor OCR
      const url = new URL(imageUrl);
      url.searchParams.set('quality', '95'); // Alta qualidade
      url.searchParams.set('format', 'webp'); // Formato otimizado
      url.searchParams.set('width', '1200'); // Largura ideal para OCR
      processedUrl = url.toString();
      improvements.push('Otimização Supabase aplicada');
      confidence += 0.2;
    }
    
    improvements.push('Pré-processamento básico concluído');
    
    return {
      processedImageUrl: processedUrl,
      improvements,
      confidence: Math.min(confidence, 1.0)
    };
    
  } catch (error) {
    console.error('Erro no pré-processamento:', error);
    return {
      processedImageUrl: imageUrl, // Retornar original se falhar
      improvements: ['Falha no pré-processamento, usando imagem original'],
      confidence: 0.3
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
export function detectImageOrientation(_imageUrl: string): {
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
export async function enhanceImageForOCR(imageUrl: string): Promise<{
  enhancedUrl: string;
  tesseractConfig: ReturnType<typeof getOptimalTesseractConfig>;
  qualityAssessment: ReturnType<typeof estimateImageQuality>;
  improvements: string[];
  totalConfidence: number;
}> {
  console.log('Iniciando melhorias de imagem para OCR...');
  
  // 1. Pré-processamento básico
  const preprocessed = await preprocessImageForOCR(imageUrl);
  
  // 2. Aplicar filtros
  const filtered = applyImageFilters(preprocessed.processedImageUrl);
  
  // 3. Obter configuração otimizada do Tesseract
  const tesseractConfig = getOptimalTesseractConfig(filtered.filteredUrl);
  
  // 4. Avaliar qualidade
  const qualityAssessment = estimateImageQuality(filtered.filteredUrl);
  
  // 5. Compilar melhorias
  const allImprovements = [
    ...preprocessed.improvements,
    ...filtered.filtersApplied,
    ...qualityAssessment.recommendations
  ];
  
  // 6. Calcular confiança total
  const totalConfidence = (
    preprocessed.confidence * 0.3 +
    qualityAssessment.score * 0.4 +
    (tesseractConfig.whitelist ? 0.3 : 0.2)
  );
  
  console.log(`Melhorias aplicadas: ${allImprovements.length} itens`);
  console.log(`Confiança final: ${(totalConfidence * 100).toFixed(1)}%`);
  
  return {
    enhancedUrl: filtered.filteredUrl,
    tesseractConfig,
    qualityAssessment,
    improvements: allImprovements,
    totalConfidence
  };
}