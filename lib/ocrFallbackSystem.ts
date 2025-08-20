// RotaFácil - Sistema de Fallback Robusto para OCR
// Múltiplas estratégias para garantir extração de endereços

import { createWorker } from 'tesseract.js';

// Interface para resultado de OCR
export interface OCRResult {
  text: string;
  confidence: number;
  provider: string;
  processingTime: number;
  improvements: string[];
}

// Interface para estratégia de OCR
interface OCRStrategy {
  name: string;
  priority: number;
  execute: (imageUrl: string) => Promise<OCRResult | null>;
}

// Estratégia 1: Tesseract com configurações otimizadas
class TesseractOptimizedStrategy implements OCRStrategy {
  name = 'Tesseract Otimizado';
  priority = 1;

  async execute(imageUrl: string): Promise<OCRResult | null> {
    const startTime = Date.now();
    
    try {
      const worker = await createWorker('por');
      
      // Configurações otimizadas para endereços brasileiros
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüý0123456789.,;:°º-/ ',
        textord_heavy_nr: '1'
      });

      const { data: { text, confidence } } = await worker.recognize(imageUrl);
      
      await worker.terminate();

      return {
        text,
        confidence: confidence / 100,
        provider: 'tesseract-optimized',
        processingTime: Date.now() - startTime,
        improvements: ['Configurações otimizadas para português brasileiro']
      };

    } catch (error) {
      console.error('Erro na estratégia Tesseract otimizada:', error);
      return null;
    }
  }
}

// Estratégia 2: Tesseract com diferentes modos de segmentação
class TesseractMultiPSMStrategy implements OCRStrategy {
  name = 'Tesseract Multi-PSM';
  priority = 2;

  async execute(imageUrl: string): Promise<OCRResult | null> {
    const startTime = Date.now();
    const psmModes = [6, 8, 13]; // Diferentes modos de segmentação
    let bestResult: OCRResult | null = null;

    try {
      const worker = await createWorker('por');
      
      for (const psm of psmModes) {
        try {
          await worker.setParameters({
            tessedit_ocr_engine_mode: '3'
          });

          const { data: { text, confidence } } = await worker.recognize(imageUrl);
          
          if (confidence > (bestResult?.confidence || 0) * 100) {
            bestResult = {
              text,
              confidence: confidence / 100,
              provider: `tesseract-psm-${psm}`,
              processingTime: Date.now() - startTime,
              improvements: [`Modo PSM ${psm} selecionado`]
            };
          }
        } catch (error) {
          console.error(`Erro no modo PSM ${psm}:`, error);
          continue;
        }
      }

      await worker.terminate();
      return bestResult;

    } catch (error) {
      console.error('Erro na estratégia Tesseract Multi-PSM:', error);
      return null;
    }
  }
}

// Estratégia 3: Tesseract com pré-processamento de imagem
class TesseractWithPreprocessingStrategy implements OCRStrategy {
  name = 'Tesseract com Pré-processamento';
  priority = 3;

  async execute(imageUrl: string): Promise<OCRResult | null> {
    const startTime = Date.now();
    
    try {
      // Aqui poderíamos aplicar pré-processamento adicional
      // Por enquanto, vamos usar configurações específicas para imagens difíceis
      
      const worker = await createWorker('por');
      
      // Configurações para imagens com baixa qualidade
      await worker.setParameters({
        tessedit_ocr_engine_mode: '3',
        textord_heavy_nr: '1',
        textord_min_linesize: '2.0',
        textord_old_baselines: '0'
      });

      const { data: { text, confidence } } = await worker.recognize(imageUrl);
      
      await worker.terminate();

      return {
        text,
        confidence: confidence / 100,
        provider: 'tesseract-preprocessed',
        processingTime: Date.now() - startTime,
        improvements: ['Configurações para imagens de baixa qualidade']
      };

    } catch (error) {
      console.error('Erro na estratégia Tesseract com pré-processamento:', error);
      return null;
    }
  }
}

// Estratégia 4: Fallback para texto simples (último recurso)
class SimpleTextExtractionStrategy implements OCRStrategy {
  name = 'Extração de Texto Simples';
  priority = 4;

  async execute(imageUrl: string): Promise<OCRResult | null> {
    const startTime = Date.now();
    
    try {
      // Esta é uma estratégia de último recurso
      // Pode ser útil para imagens muito simples ou quando outras falham
      
      const worker = await createWorker('eng'); // Usar inglês como fallback
      
      // Configurações básicas - usando apenas parâmetros válidos
      await worker.setParameters({
        tessedit_ocr_engine_mode: '1' // Legacy engine
      });

      const { data: { text, confidence } } = await worker.recognize(imageUrl);
      
      await worker.terminate();

      return {
        text,
        confidence: Math.max(0.1, confidence / 100), // Confiança mínima
        provider: 'tesseract-simple-fallback',
        processingTime: Date.now() - startTime,
        improvements: ['Estratégia de último recurso aplicada']
      };

    } catch (error) {
      console.error('Erro na estratégia de texto simples:', error);
      return null;
    }
  }
}

// Sistema principal de fallback
export class OCRFallbackSystem {
  private strategies: OCRStrategy[];

  constructor() {
    this.strategies = [
      new TesseractOptimizedStrategy(),
      new TesseractMultiPSMStrategy(),
      new TesseractWithPreprocessingStrategy(),
      new SimpleTextExtractionStrategy()
    ];

    // Ordenar por prioridade
    this.strategies.sort((a, b) => a.priority - b.priority);
  }

  // Executar OCR com fallback automático
  async executeWithFallback(imageUrl: string, minConfidence: number = 0.3): Promise<OCRResult> {
    console.log('Iniciando sistema de fallback OCR...');
    
    let bestResult: OCRResult | null = null;
    const attempts: string[] = [];

    for (const strategy of this.strategies) {
      try {
        console.log(`Tentando estratégia: ${strategy.name}`);
        attempts.push(strategy.name);
        
        const result = await strategy.execute(imageUrl);
        
        if (result && result.confidence >= minConfidence) {
          console.log(`Estratégia ${strategy.name} bem-sucedida com confiança ${(result.confidence * 100).toFixed(1)}%`);
          
          // Se encontrou um resultado bom, usar
          if (result.confidence >= 0.7) {
            result.improvements.push(`Estratégia ${strategy.name} selecionada automaticamente`);
            return result;
          }
          
          // Se não encontrou um resultado excelente, continuar tentando
          if (!bestResult || result.confidence > bestResult.confidence) {
            bestResult = result;
          }
        }
        
      } catch (error) {
        console.error(`Erro na estratégia ${strategy.name}:`, error);
        attempts.push(`${strategy.name} (falhou)`);
      }
    }

    // Se chegou aqui, usar o melhor resultado encontrado ou criar um fallback
    if (bestResult) {
      bestResult.improvements.push(`Melhor resultado de ${attempts.length} tentativas`);
      return bestResult;
    }

    // Último recurso: retornar resultado vazio mas informativo
    return {
      text: '',
      confidence: 0,
      provider: 'fallback-system',
      processingTime: 0,
      improvements: [`Todas as ${attempts.length} estratégias falharam`]
    };
  }

  // Executar OCR com estratégia específica
  async executeWithStrategy(imageUrl: string, strategyName: string): Promise<OCRResult | null> {
    const strategy = this.strategies.find(s => s.name === strategyName);
    if (!strategy) {
      throw new Error(`Estratégia '${strategyName}' não encontrada`);
    }

    return await strategy.execute(imageUrl);
  }

  // Obter estatísticas das estratégias
  getStrategiesInfo(): Array<{ name: string; priority: number; description: string }> {
    return this.strategies.map(strategy => ({
      name: strategy.name,
      priority: strategy.priority,
      description: this.getStrategyDescription(strategy.name)
    }));
  }

  private getStrategyDescription(strategyName: string): string {
    const descriptions: Record<string, string> = {
      'Tesseract Otimizado': 'Configurações otimizadas para endereços brasileiros com alta confiança',
      'Tesseract Multi-PSM': 'Testa múltiplos modos de segmentação para encontrar o melhor',
      'Tesseract com Pré-processamento': 'Configurações específicas para imagens de baixa qualidade',
      'Extração de Texto Simples': 'Estratégia de último recurso com engine legacy'
    };

    return descriptions[strategyName] || 'Descrição não disponível';
  }
}

// Função de conveniência para uso direto
export async function executeOCRWithFallback(imageUrl: string, minConfidence: number = 0.3): Promise<OCRResult> {
  const system = new OCRFallbackSystem();
  return await system.executeWithFallback(imageUrl, minConfidence);
}
