// Sistema de Otimização de Imagens para OCR
// Redimensiona, comprime e otimiza imagens grandes para melhor performance

export interface ImageOptimizationResult {
  optimizedFile: File;
  originalSize: number;
  optimizedSize: number;
  compressionRatio: number;
  dimensions: {
    original: { width: number; height: number };
    optimized: { width: number; height: number };
  };
  optimizations: string[];
}

export interface OptimizationOptions {
  maxWidth: number;
  maxHeight: number;
  quality: number;
  maxFileSize: number; // em bytes
  format: 'jpeg' | 'png' | 'webp';
  maintainAspectRatio: boolean;
}

export class ImageOptimizer {
  // Configurações padrão otimizadas para OCR
  private static readonly DEFAULT_OPTIONS: OptimizationOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.85,
    maxFileSize: 2 * 1024 * 1024, // 2MB
    format: 'jpeg',
    maintainAspectRatio: true
  };

  // Configurações específicas para OCR
  private static readonly OCR_OPTIONS: OptimizationOptions = {
    maxWidth: 1600,
    maxHeight: 1200,
    quality: 0.90,
    maxFileSize: 1.5 * 1024 * 1024, // 1.5MB
    format: 'jpeg',
    maintainAspectRatio: true
  };

  /**
   * Otimiza uma imagem para processamento OCR
   */
  static async optimizeForOCR(file: File): Promise<ImageOptimizationResult> {
    return this.optimizeImage(file, this.OCR_OPTIONS);
  }

  /**
   * Otimiza uma imagem com configurações personalizadas
   */
  static async optimizeImage(
    file: File, 
    options: Partial<OptimizationOptions> = {}
  ): Promise<ImageOptimizationResult> {
    const opts = { ...this.DEFAULT_OPTIONS, ...options };
    const optimizations: string[] = [];

    // Verificar se é uma imagem válida
    if (!file.type.startsWith('image/')) {
      throw new Error('Arquivo não é uma imagem válida');
    }

    // Se o arquivo já está dentro do limite, fazer otimização mínima
    if (file.size <= opts.maxFileSize) {
      optimizations.push('Arquivo já dentro do limite de tamanho');
      return this.minimalOptimization(file, opts, optimizations);
    }

    try {
      // Carregar imagem
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Não foi possível criar contexto do canvas');

      const img = await this.loadImage(file);
      const originalDimensions = { width: img.width, height: img.height };

      // Calcular novas dimensões
      const newDimensions = this.calculateOptimalDimensions(
        img.width, 
        img.height, 
        opts.maxWidth, 
        opts.maxHeight,
        opts.maintainAspectRatio
      );

      // Configurar canvas
      canvas.width = newDimensions.width;
      canvas.height = newDimensions.height;

      // Aplicar filtros para melhorar OCR
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Desenhar imagem redimensionada
      ctx.drawImage(img, 0, 0, newDimensions.width, newDimensions.height);

      // Aplicar melhorias para OCR
      this.applyOCREnhancements(ctx, canvas);
      optimizations.push('Melhorias para OCR aplicadas');

      // Converter para blob com qualidade otimizada
      const blob = await this.canvasToOptimizedBlob(canvas, opts);
      
      // Se ainda está muito grande, reduzir qualidade progressivamente
      let finalBlob = blob;
      let currentQuality = opts.quality;
      
      while (finalBlob.size > opts.maxFileSize && currentQuality > 0.3) {
        currentQuality -= 0.1;
        finalBlob = await this.canvasToOptimizedBlob(canvas, { ...opts, quality: currentQuality });
        optimizations.push(`Qualidade reduzida para ${Math.round(currentQuality * 100)}%`);
      }

      // Criar arquivo otimizado
      const optimizedFile = new File(
        [finalBlob], 
        this.generateOptimizedFileName(file.name, opts.format),
        { type: `image/${opts.format}` }
      );

      optimizations.push(`Redimensionado de ${originalDimensions.width}x${originalDimensions.height} para ${newDimensions.width}x${newDimensions.height}`);
      optimizations.push(`Tamanho reduzido de ${this.formatFileSize(file.size)} para ${this.formatFileSize(optimizedFile.size)}`);

      return {
        optimizedFile,
        originalSize: file.size,
        optimizedSize: optimizedFile.size,
        compressionRatio: file.size / optimizedFile.size,
        dimensions: {
          original: originalDimensions,
          optimized: newDimensions
        },
        optimizations
      };

    } catch (error) {
      console.error('Erro na otimização da imagem:', error);
      // Fallback: retornar arquivo original com aviso
      return this.minimalOptimization(file, opts, ['Erro na otimização - usando arquivo original']);
    }
  }

  /**
   * Otimização mínima para arquivos que já estão em bom tamanho
   */
  private static async minimalOptimization(
    file: File, 
    opts: OptimizationOptions, 
    optimizations: string[]
  ): Promise<ImageOptimizationResult> {
    try {
      const img = await this.loadImage(file);
      
      return {
        optimizedFile: file,
        originalSize: file.size,
        optimizedSize: file.size,
        compressionRatio: 1,
        dimensions: {
          original: { width: img.width, height: img.height },
          optimized: { width: img.width, height: img.height }
        },
        optimizations
      };
    } catch {
      // Se não conseguir carregar a imagem, retornar dados básicos
      return {
        optimizedFile: file,
        originalSize: file.size,
        optimizedSize: file.size,
        compressionRatio: 1,
        dimensions: {
          original: { width: 0, height: 0 },
          optimized: { width: 0, height: 0 }
        },
        optimizations: [...optimizations, 'Não foi possível analisar dimensões']
      };
    }
  }

  /**
   * Carrega imagem de um arquivo
   */
  private static loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Calcula dimensões ótimas mantendo proporção
   */
  private static calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number,
    maintainAspectRatio: boolean
  ): { width: number; height: number } {
    if (!maintainAspectRatio) {
      return { width: maxWidth, height: maxHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    
    let newWidth = originalWidth;
    let newHeight = originalHeight;

    // Reduzir se necessário
    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      newHeight = newWidth / aspectRatio;
    }

    if (newHeight > maxHeight) {
      newHeight = maxHeight;
      newWidth = newHeight * aspectRatio;
    }

    return {
      width: Math.round(newWidth),
      height: Math.round(newHeight)
    };
  }

  /**
   * Aplica melhorias específicas para OCR
   */
  private static applyOCREnhancements(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
    // Obter dados da imagem
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Aplicar filtros para melhorar contraste e nitidez
    for (let i = 0; i < data.length; i += 4) {
      // Converter para escala de cinza ponderada
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      
      // Aumentar contraste
      const contrast = 1.2;
      const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
      const enhancedGray = factor * (gray - 128) + 128;
      
      // Aplicar threshold suave para melhorar texto
      const threshold = enhancedGray > 128 ? Math.min(255, enhancedGray * 1.1) : Math.max(0, enhancedGray * 0.9);
      
      data[i] = threshold;     // R
      data[i + 1] = threshold; // G
      data[i + 2] = threshold; // B
      // Alpha permanece o mesmo
    }

    // Aplicar dados modificados
    ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Converte canvas para blob otimizado
   */
  private static canvasToOptimizedBlob(
    canvas: HTMLCanvasElement, 
    opts: OptimizationOptions
  ): Promise<Blob> {
    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob!),
        `image/${opts.format}`,
        opts.quality
      );
    });
  }

  /**
   * Gera nome de arquivo otimizado
   */
  private static generateOptimizedFileName(originalName: string, format: string): string {
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    return `${nameWithoutExt}_optimized.${format}`;
  }

  /**
   * Formata tamanho de arquivo para exibição
   */
  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Verifica se uma imagem precisa de otimização
   */
  static needsOptimization(file: File, maxSize: number = 2 * 1024 * 1024): boolean {
    return file.size > maxSize;
  }

  /**
   * Estima o tempo de processamento baseado no tamanho do arquivo
   */
  static estimateProcessingTime(fileSize: number): number {
    // Estimativa em segundos baseada no tamanho
    if (fileSize < 1024 * 1024) return 1; // < 1MB: 1s
    if (fileSize < 5 * 1024 * 1024) return 3; // < 5MB: 3s
    if (fileSize < 10 * 1024 * 1024) return 5; // < 10MB: 5s
    return 8; // > 10MB: 8s
  }
}
