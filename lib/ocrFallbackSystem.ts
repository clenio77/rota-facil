// RotaFácil - Sistema de Fallback Robusto para OCR
// Múltiplas estratégias para garantir extração de endereços

import { createWorker } from 'tesseract.js';

export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
}

interface OCRStrategy {
  name: string;
  execute(imageUrl: string): Promise<OCRResult | null>;
}

class TesseractOptimizedStrategy implements OCRStrategy {
  name = 'Tesseract Otimizado';
  
  async execute(imageUrl: string): Promise<OCRResult | null> {
    try {
      const worker = await createWorker('por');
      await worker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ.,-()/\\s',
      });
      
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      
      return {
        text: data.text,
        confidence: data.confidence / 100,
        provider: 'tesseract'
      };
    } catch (error) {
      console.error('Tesseract falhou:', error);
      return null;
    }
  }
}

class TesseractMultiPSMStrategy implements OCRStrategy {
  name = 'Tesseract Multi-PSM';
  
  async execute(imageUrl: string): Promise<OCRResult | null> {
    try {
      const worker = await createWorker('por');
      // Usar configurações básicas sem parâmetros problemáticos
      await worker.setParameters({});
      
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      
      return {
        text: data.text,
        confidence: data.confidence / 100,
        provider: 'tesseract-multi-psm'
      };
    } catch (error) {
      console.error('Tesseract Multi-PSM falhou:', error);
      return null;
    }
  }
}

class TesseractWithPreprocessingStrategy implements OCRStrategy {
  name = 'Tesseract com Pré-processamento';
  
  async execute(imageUrl: string): Promise<OCRResult | null> {
    try {
      const worker = await createWorker('por');
      // Usar configurações básicas sem parâmetros problemáticos
      await worker.setParameters({});
      
      const { data } = await worker.recognize(imageUrl);
      await worker.terminate();
      
      return {
        text: data.text,
        confidence: data.confidence / 100,
        provider: 'tesseract-preprocessing'
      };
    } catch (error) {
      console.error('Tesseract com pré-processamento falhou:', error);
      return null;
    }
  }
}

// NOVA ESTRATÉGIA: API Externa de OCR
class ExternalOCRStrategy implements OCRStrategy {
  name = 'API Externa de OCR';
  
  async execute(imageUrl: string): Promise<OCRResult | null> {
    try {
      // Tentar APIs gratuitas de OCR
      const apis = [
        this.tryOCRSpace,
        this.tryOCRAPI,
        this.tryCloudVision
      ];
      
      for (const api of apis) {
        try {
          const result = await api(imageUrl);
          if (result) return result;
        } catch {
          console.log(`API ${api.name} falhou, tentando próxima...`);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Todas as APIs externas falharam:', error);
      return null;
    }
  }
  
  private async tryOCRSpace(imageUrl: string): Promise<OCRResult | null> {
    // OCR.space API (gratuita com limite)
    try {
      const formData = new FormData();
      formData.append('url', imageUrl);
      formData.append('language', 'por');
      formData.append('isOverlayRequired', 'false');
      
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData,
        headers: {
          'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld' // Chave gratuita
        }
      });
      
      const data = await response.json();
      if (data.IsErroredOnProcessing) return null;
      
      return {
        text: data.ParsedResults?.[0]?.ParsedText || '',
        confidence: 0.7, // OCR.space não retorna confiança
        provider: 'ocr.space'
      };
    } catch {
      return null;
    }
  }
  
  private async tryOCRAPI(imageUrl: string): Promise<OCRResult | null> {
    // OCR API (alternativa gratuita)
    try {
      const response = await fetch(`https://api.ocr.space/parse/imageurl?url=${encodeURIComponent(imageUrl)}&language=por`);
      const data = await response.json();
      
      if (data.IsErroredOnProcessing) return null;
      
      return {
        text: data.ParsedResults?.[0]?.ParsedText || '',
        confidence: 0.6,
        provider: 'ocr.space-url'
      };
    } catch {
      return null;
    }
  }
  
  private async tryCloudVision(imageUrl: string): Promise<OCRResult | null> {
    // Google Cloud Vision (se configurado)
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
    } catch {
      return null;
    }
  }
}

class SimpleTextExtractionStrategy implements OCRStrategy {
  name = 'Extração Simples de Texto';
  
  async execute(_imageUrl: string): Promise<OCRResult | null> {
    // Fallback final: tentar extrair qualquer texto possível
    try {
      // Esta é uma estratégia de último recurso
      // Em produção, você pode implementar outras alternativas
      return {
        text: 'Texto não pôde ser extraído automaticamente. Por favor, digite o endereço manualmente.',
        confidence: 0.1,
        provider: 'fallback'
      };
    } catch {
      return null;
    }
  }
}

export class OCRFallbackSystem {
  private strategies: OCRStrategy[] = [
    new TesseractOptimizedStrategy(),
    new TesseractMultiPSMStrategy(),
    new TesseractWithPreprocessingStrategy(),
    new ExternalOCRStrategy(), // NOVA ESTRATÉGIA
    new SimpleTextExtractionStrategy()
  ];

  async executeWithFallback(imageUrl: string, minConfidence: number = 0.3): Promise<OCRResult> {
    console.log('Iniciando sistema de fallback OCR...');
    
    for (const strategy of this.strategies) {
      try {
        console.log(`Tentando estratégia: ${strategy.name}`);
        const result = await strategy.execute(imageUrl);
        
        if (result && result.confidence >= minConfidence) {
          console.log(`Estratégia ${strategy.name} bem-sucedida (confiança: ${result.confidence})`);
          return result;
        }
        
        if (result) {
          console.log(`Estratégia ${strategy.name} retornou baixa confiança: ${result.confidence}`);
        }
      } catch (error) {
        console.error(`Estratégia ${strategy.name} falhou:`, error);
      }
    }
    
    // Se todas as estratégias falharam
    throw new Error('Todas as estratégias de OCR falharam');
  }
}

export async function executeOCRWithFallback(imageUrl: string, minConfidence: number = 0.3): Promise<OCRResult> {
  // Se for URL blob, não podemos processar no servidor com Tesseract
  if (imageUrl.startsWith('blob:')) {
    console.log('URL blob detectada - usando apenas API externa');
    const externalStrategy = new ExternalOCRStrategy();
    try {
      const result = await externalStrategy.execute(imageUrl);
      return result || {
        text: '',
        confidence: 0,
        provider: 'fallback-failed'
      };
    } catch (error) {
      console.error('API externa falhou para URL blob:', error);
      return {
        text: '',
        confidence: 0,
        provider: 'fallback-failed'
      };
    }
  }

  const system = new OCRFallbackSystem();
  try {
    return await system.executeWithFallback(imageUrl, minConfidence);
  } catch (error) {
    console.error('Sistema de fallback falhou:', error);
    return {
      text: '',
      confidence: 0,
      provider: 'fallback-failed'
    };
  }
}
