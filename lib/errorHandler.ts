// Sistema de Tratamento de Erros Robusto para RotaFácil
// Implementa fallbacks, retry automático e tratamento inteligente de erros

import { logger, LogCategory } from './logger';

export interface ErrorContext {
  operation: string;
  userId?: string;
  sessionId?: string;
  retryCount?: number;
  maxRetries?: number;
  timeout?: number;
  fallbackStrategy?: 'retry' | 'fallback' | 'fail' | 'degrade';
}

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitter: boolean;
}

export interface FallbackStrategy {
  name: string;
  priority: number;
  handler: () => Promise<any>;
  condition?: () => boolean;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private retryConfig: RetryConfig;
  private fallbackStrategies: Map<string, FallbackStrategy[]>;

  private constructor() {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      jitter: true,
    };
    this.fallbackStrategies = new Map();
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  // Configuração de retry
  public setRetryConfig(config: Partial<RetryConfig>): void {
    this.retryConfig = { ...this.retryConfig, ...config };
  }

  // Adicionar estratégia de fallback
  public addFallbackStrategy(operation: string, strategy: FallbackStrategy): void {
    if (!this.fallbackStrategies.has(operation)) {
      this.fallbackStrategies.set(operation, []);
    }
    this.fallbackStrategies.get(operation)!.push(strategy);
    // Ordenar por prioridade
    this.fallbackStrategies.get(operation)!.sort((a, b) => a.priority - b.priority);
  }

  // Tratamento de erro com retry e fallback
  public async handleWithRetry<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    try {
      // Tentativa principal
      return await operation();
    } catch (error) {
      lastError = error as Error;
      logger.error(LogCategory.ERROR, `Erro na operação: ${context.operation}`, {
        error: error.message,
        context,
      });

      // Tentar retry se configurado
      if (context.fallbackStrategy === 'retry' || context.fallbackStrategy === 'degrade') {
        try {
          return await this.retryOperation(operation, context);
        } catch (retryError) {
          lastError = retryError as Error;
          logger.error(LogCategory.ERROR, `Retry falhou para: ${context.operation}`, {
            error: retryError.message,
            context,
          });
        }
      }

      // Tentar fallback se disponível
      if (context.fallbackStrategy === 'fallback' || context.fallbackStrategy === 'degrade') {
        try {
          return await this.executeFallback(context.operation, context);
        } catch (fallbackError) {
          lastError = fallbackError as Error;
          logger.error(LogCategory.ERROR, `Fallback falhou para: ${context.operation}`, {
            error: fallbackError.message,
            context,
          });
        }
      }

      // Se tudo falhou, registrar e re-lançar erro
      const duration = Date.now() - startTime;
      logger.fatal(LogCategory.ERROR, `Operação falhou completamente: ${context.operation}`, {
        error: lastError.message,
        duration,
        context,
      });

      throw new Error(`Operação falhou após todas as tentativas: ${context.operation}. Erro: ${lastError.message}`);
    }
  }

  // Retry com backoff exponencial
  private async retryOperation<T>(
    operation: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    const maxRetries = context.maxRetries || this.retryConfig.maxRetries;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Calcular delay com backoff exponencial
        const delay = this.calculateDelay(attempt);
        
        if (attempt > 1) {
          logger.info(LogCategory.ERROR, `Tentativa ${attempt}/${maxRetries} para: ${context.operation}`, {
            delay,
            context,
          });
          
          await this.sleep(delay);
        }

        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          throw lastError;
        }

        // Verificar se é um erro que não deve ser retry
        if (this.isNonRetryableError(error)) {
          throw lastError;
        }

        logger.warn(LogCategory.ERROR, `Tentativa ${attempt} falhou para: ${context.operation}`, {
          error: error.message,
          attempt,
          context,
        });
      }
    }

    throw lastError!;
  }

  // Executar estratégia de fallback
  private async executeFallback(operation: string, context: ErrorContext): Promise<any> {
    const strategies = this.fallbackStrategies.get(operation) || [];
    
    for (const strategy of strategies) {
      if (strategy.condition && !strategy.condition()) {
        continue;
      }

      try {
        logger.info(LogCategory.ERROR, `Executando fallback: ${strategy.name} para: ${operation}`, {
          strategy: strategy.name,
          context,
        });

        return await strategy.handler();
      } catch (error) {
        logger.warn(LogCategory.ERROR, `Fallback falhou: ${strategy.name} para: ${operation}`, {
          error: error.message,
          strategy: strategy.name,
          context,
        });
      }
    }

    throw new Error(`Nenhum fallback disponível para: ${operation}`);
  }

  // Calcular delay com backoff exponencial
  private calculateDelay(attempt: number): number {
    const delay = Math.min(
      this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt - 1),
      this.retryConfig.maxDelay
    );

    if (this.retryConfig.jitter) {
      // Adicionar jitter para evitar thundering herd
      return delay * (0.5 + Math.random() * 0.5);
    }

    return delay;
  }

  // Verificar se erro não deve ser retry
  private isNonRetryableError(error: any): boolean {
    const nonRetryableStatuses = [400, 401, 403, 404, 422];
    const nonRetryableMessages = [
      'invalid input',
      'unauthorized',
      'forbidden',
      'not found',
      'validation failed',
    ];

    // Verificar status HTTP
    if (error.status && nonRetryableStatuses.includes(error.status)) {
      return true;
    }

    // Verificar mensagens de erro
    const errorMessage = error.message?.toLowerCase() || '';
    return nonRetryableMessages.some(msg => errorMessage.includes(msg));
  }

  // Sleep utility
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Tratamento específico para APIs
  public async handleAPIError<T>(
    apiCall: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.handleWithRetry(apiCall, {
      ...context,
      fallbackStrategy: 'degrade',
      maxRetries: 2,
    });
  }

  // Tratamento específico para OCR
  public async handleOCRError<T>(
    ocrCall: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.handleWithRetry(ocrCall, {
      ...context,
      fallbackStrategy: 'fallback',
      maxRetries: 1,
    });
  }

  // Tratamento específico para geocodificação
  public async handleGeocodingError<T>(
    geocodingCall: () => Promise<T>,
    context: ErrorContext
  ): Promise<T> {
    return this.handleWithRetry(geocodingCall, {
      ...context,
      fallbackStrategy: 'fallback',
      maxRetries: 2,
    });
  }
}

// Instância singleton
export const errorHandler = ErrorHandler.getInstance();

// Helpers para uso rápido
export const handleWithRetry = <T>(
  operation: () => Promise<T>,
  context: ErrorContext
): Promise<T> => errorHandler.handleWithRetry(operation, context);

export const handleAPIError = <T>(
  apiCall: () => Promise<T>,
  context: ErrorContext
): Promise<T> => errorHandler.handleAPIError(apiCall, context);

export const handleOCRError = <T>(
  ocrCall: () => Promise<T>,
  context: ErrorContext
): Promise<T> => errorHandler.handleOCRError(ocrCall, context);

export const handleGeocodingError = <T>(
  geocodingCall: () => Promise<T>,
  context: ErrorContext
): Promise<T> => errorHandler.handleGeocodingError(geocodingCall, context);
