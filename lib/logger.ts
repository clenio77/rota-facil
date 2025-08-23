// Sistema de Logging Estruturado para RotaFácil
// Implementa logs organizados por nível, categoria e contexto

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

export enum LogCategory {
  SYSTEM = 'SYSTEM',
  OCR = 'OCR',
  GEOCODING = 'GEOCODING',
  ROUTE_OPTIMIZATION = 'ROUTE_OPTIMIZATION',
  USER_ACTION = 'USER_ACTION',
  API = 'API',
  PERFORMANCE = 'PERFORMANCE',
  ERROR = 'ERROR',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  context?: Record<string, any>;
  userId?: string;
  sessionId?: string;
  performance?: {
    duration?: number;
    memory?: number;
    cpu?: number;
  };
}

class Logger {
  private static instance: Logger;
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableRemote: boolean;
  private remoteEndpoint?: string;

  private constructor() {
    this.logLevel = process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG;
    this.enableConsole = true;
    this.enableRemote = process.env.NODE_ENV === 'production';
    this.remoteEndpoint = process.env.NEXT_PUBLIC_LOG_ENDPOINT;
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private formatMessage(entry: LogEntry): string {
    const timestamp = new Date(entry.timestamp).toISOString();
    const level = LogLevel[entry.level];
    const category = entry.category;
    const context = entry.context ? ` | ${JSON.stringify(entry.context)}` : '';
    const performance = entry.performance ? ` | ⚡ ${entry.performance.duration}ms` : '';
    
    return `[${timestamp}] ${level} | ${category} | ${entry.message}${context}${performance}`;
  }

  private async sendToRemote(entry: LogEntry): Promise<void> {
    if (!this.enableRemote || !this.remoteEndpoint) return;

    try {
      await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (error) {
      // Fallback para console se falhar
      console.error('Failed to send log to remote:', error);
    }
  }

  private log(level: LogLevel, category: LogCategory, message: string, context?: Record<string, any>): void {
    if (level < this.logLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      context,
      sessionId: this.getSessionId(),
    };

    // Console logging
    if (this.enableConsole) {
      const formattedMessage = this.formatMessage(entry);
      switch (level) {
        case LogLevel.DEBUG:
          console.debug(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
        case LogLevel.FATAL:
          console.error(formattedMessage);
          break;
      }
    }

    // Remote logging (async)
    this.sendToRemote(entry);
  }

  private getSessionId(): string {
    if (typeof window !== 'undefined') {
      let sessionId = sessionStorage.getItem('rotafacil_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('rotafacil_session_id', sessionId);
      }
      return sessionId;
    }
    return 'server_session';
  }

  // Métodos públicos para logging
  public debug(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.DEBUG, category, message, context);
  }

  public info(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, category, message, context);
  }

  public warn(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.WARN, category, message, context);
  }

  public error(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.ERROR, category, message, context);
  }

  public fatal(category: LogCategory, message: string, context?: Record<string, any>): void {
    this.log(LogLevel.FATAL, category, message, context);
  }

  // Métodos específicos para categorias comuns
  public ocr(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.OCR, message, context);
  }

  public geocoding(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.GEOCODING, message, context);
  }

  public routeOptimization(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.ROUTE_OPTIMIZATION, message, context);
  }

  public userAction(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.USER_ACTION, message, context);
  }

  public api(message: string, context?: Record<string, any>): void {
    this.info(LogCategory.API, message, context);
  }

  public performance(message: string, duration: number, context?: Record<string, any>): void {
    this.log(LogLevel.INFO, LogCategory.PERFORMANCE, message, {
      ...context,
      performance: { duration },
    });
  }

  // Configuração dinâmica
  public setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  public setConsoleLogging(enabled: boolean): void {
    this.enableConsole = enabled;
  }

  public setRemoteLogging(enabled: boolean, endpoint?: string): void {
    this.enableRemote = enabled;
    if (endpoint) this.remoteEndpoint = endpoint;
  }
}

// Instância singleton
export const logger = Logger.getInstance();

// Helpers para uso rápido
export const logOCR = (message: string, context?: Record<string, any>) => logger.ocr(message, context);
export const logGeocoding = (message: string, context?: Record<string, any>) => logger.geocoding(message, context);
export const logRouteOptimization = (message: string, context?: Record<string, any>) => logger.routeOptimization(message, context);
export const logUserAction = (message: string, context?: Record<string, any>) => logger.userAction(message, context);
export const logAPI = (message: string, context?: Record<string, any>) => logger.api(message, context);
export const logPerformance = (message: string, duration: number, context?: Record<string, any>) => logger.performance(message, duration, context);
