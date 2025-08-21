/**
 * 🎤 VOICE COMMANDS SYSTEM - Sistema de Comandos de Voz para Carteiros
 * Hands-free operation para uso durante entregas
 */

export interface VoiceCommand {
  patterns: string[];
  action: string;
  description: string;
  category: 'navigation' | 'delivery' | 'system';
  requiresConfirmation?: boolean;
}

export interface VoiceResponse {
  text: string;
  priority: 'low' | 'medium' | 'high';
  interrupt?: boolean; // Interrompe outras falas
}

export class VoiceCommandSystem {
  private recognition: SpeechRecognition | null = null;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private isEnabled = false;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  
  // Callbacks para ações
  private onCommand: ((command: string, params?: any) => void) | null = null;
  private onListeningChange: ((listening: boolean) => void) | null = null;
  private onError: ((error: string) => void) | null = null;

  // 🎤 COMANDOS DISPONÍVEIS
  private commands: VoiceCommand[] = [
    // NAVEGAÇÃO
    {
      patterns: ['próxima entrega', 'próxima parada', 'próximo endereço', 'continuar'],
      action: 'next_delivery',
      description: 'Ir para próxima entrega',
      category: 'navigation'
    },
    {
      patterns: ['entrega anterior', 'parada anterior', 'voltar'],
      action: 'previous_delivery',
      description: 'Voltar para entrega anterior',
      category: 'navigation'
    },
    {
      patterns: ['mostrar mapa', 'abrir mapa', 'ver rota'],
      action: 'show_map',
      description: 'Exibir mapa da rota',
      category: 'navigation'
    },
    {
      patterns: ['iniciar rota', 'começar entrega', 'navegar'],
      action: 'start_route',
      description: 'Iniciar navegação no Google Maps',
      category: 'navigation'
    },

    // CONTROLE DE ENTREGAS
    {
      patterns: ['entregue', 'entrega realizada', 'concluído', 'feito'],
      action: 'mark_delivered',
      description: 'Marcar entrega como realizada',
      category: 'delivery',
      requiresConfirmation: true
    },
    {
      patterns: ['problema', 'erro', 'não encontrei', 'endereço errado'],
      action: 'report_problem',
      description: 'Reportar problema na entrega',
      category: 'delivery'
    },
    {
      patterns: ['pular entrega', 'pular parada', 'deixar para depois'],
      action: 'skip_delivery',
      description: 'Pular entrega atual',
      category: 'delivery',
      requiresConfirmation: true
    },
    {
      patterns: ['pausar', 'parar', 'intervalo'],
      action: 'pause_route',
      description: 'Pausar rota para intervalo',
      category: 'delivery'
    },

    // SISTEMA
    {
      patterns: ['ajuda', 'comandos', 'o que posso falar'],
      action: 'show_help',
      description: 'Mostrar comandos disponíveis',
      category: 'system'
    },
    {
      patterns: ['estatísticas', 'dashboard', 'métricas'],
      action: 'show_dashboard',
      description: 'Abrir dashboard de estatísticas',
      category: 'system'
    },
    {
      patterns: ['silenciar', 'calar', 'parar de falar'],
      action: 'stop_speaking',
      description: 'Parar síntese de voz',
      category: 'system'
    },
    {
      patterns: ['repetir', 'falar novamente', 'não entendi'],
      action: 'repeat_last',
      description: 'Repetir última informação',
      category: 'system'
    }
  ];

  private lastResponse: VoiceResponse | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synthesis = window.speechSynthesis;
      this.initializeRecognition();
    }
  }

  /**
   * 🎤 Inicializar reconhecimento de voz
   */
  private initializeRecognition(): void {
    if (typeof window === 'undefined' || (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))) {
      console.warn('🎤 Speech Recognition não suportado neste navegador');
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.recognition = new SpeechRecognition();

    // Configurações otimizadas para ambiente de trânsito
    this.recognition.continuous = true;
    this.recognition.interimResults = false;
    this.recognition.lang = 'pt-BR';
    this.recognition.maxAlternatives = 3; // Múltiplas alternativas para melhor precisão

    // Event listeners
    this.recognition.onstart = () => {
      this.isListening = true;
      this.onListeningChange?.(true);
      console.log('🎤 Escutando comandos de voz...');
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onListeningChange?.(false);
      
      // Reiniciar automaticamente se ainda estiver habilitado
      if (this.isEnabled) {
        setTimeout(() => this.startListening(), 1000);
      }
    };

    this.recognition.onresult = (event) => {
      const results = Array.from(event.results);
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const transcript = lastResult[0].transcript.toLowerCase().trim();
        console.log('🎤 Comando detectado:', transcript);
        this.processCommand(transcript);
      }
    };

    this.recognition.onerror = (event) => {
      console.error('🎤 Erro no reconhecimento:', event.error);
      
      // Tratamento específico de erros
      switch (event.error) {
        case 'no-speech':
          // Ignorar - normal em ambiente ruidoso
          break;
        case 'audio-capture':
          this.onError?.('Microfone não disponível');
          break;
        case 'not-allowed':
          this.onError?.('Permissão de microfone negada');
          break;
        default:
          this.onError?.(`Erro de reconhecimento: ${event.error}`);
      }
    };
  }

  /**
   * 🎤 Processar comando de voz
   */
  private processCommand(transcript: string): void {
    const normalizedTranscript = this.normalizeText(transcript);
    
    // Buscar comando correspondente
    const matchedCommand = this.findMatchingCommand(normalizedTranscript);
    
    if (matchedCommand) {
      console.log('✅ Comando reconhecido:', matchedCommand.action);
      
      if (matchedCommand.requiresConfirmation) {
        this.requestConfirmation(matchedCommand, transcript);
      } else {
        this.executeCommand(matchedCommand.action);
      }
    } else {
      console.log('❌ Comando não reconhecido:', transcript);
      this.speak({
        text: 'Comando não reconhecido. Diga "ajuda" para ver os comandos disponíveis.',
        priority: 'medium'
      });
    }
  }

  /**
   * 🔍 Encontrar comando correspondente
   */
  private findMatchingCommand(transcript: string): VoiceCommand | null {
    for (const command of this.commands) {
      for (const pattern of command.patterns) {
        if (this.matchesPattern(transcript, pattern)) {
          return command;
        }
      }
    }
    return null;
  }

  /**
   * 🎯 Verificar se texto corresponde ao padrão
   */
  private matchesPattern(text: string, pattern: string): boolean {
    const normalizedText = this.normalizeText(text);
    const normalizedPattern = this.normalizeText(pattern);
    
    // Correspondência exata
    if (normalizedText === normalizedPattern) return true;
    
    // Correspondência parcial (contém todas as palavras-chave)
    const patternWords = normalizedPattern.split(' ');
    const textWords = normalizedText.split(' ');
    
    return patternWords.every(word => 
      textWords.some(textWord => 
        textWord.includes(word) || word.includes(textWord)
      )
    );
  }

  /**
   * 🧹 Normalizar texto para comparação
   */
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^\w\s]/g, '') // Remove pontuação
      .trim();
  }

  /**
   * ❓ Solicitar confirmação para comandos críticos
   */
  private requestConfirmation(command: VoiceCommand, originalTranscript: string): void {
    this.speak({
      text: `Confirma: ${command.description}? Diga "sim" ou "não".`,
      priority: 'high',
      interrupt: true
    });

    // Aguardar confirmação por 5 segundos
    const confirmationTimeout = setTimeout(() => {
      this.speak({
        text: 'Comando cancelado por timeout.',
        priority: 'medium'
      });
    }, 5000);

    // Listener temporário para confirmação
    const confirmationListener = (event: any) => {
      const results = Array.from(event.results);
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const response = lastResult[0].transcript.toLowerCase().trim();
        clearTimeout(confirmationTimeout);
        
        if (response.includes('sim') || response.includes('confirmo')) {
          this.executeCommand(command.action);
          this.speak({
            text: 'Comando executado.',
            priority: 'medium'
          });
        } else {
          this.speak({
            text: 'Comando cancelado.',
            priority: 'medium'
          });
        }
        
        // Remover listener temporário
        this.recognition?.removeEventListener('result', confirmationListener);
      }
    };

    this.recognition?.addEventListener('result', confirmationListener);
  }

  /**
   * ⚡ Executar comando
   */
  private executeCommand(action: string): void {
    this.onCommand?.(action);
  }

  /**
   * 🔊 Síntese de voz
   */
  speak(response: VoiceResponse): void {
    // Interromper fala atual se necessário
    if (response.interrupt && this.currentUtterance) {
      this.synthesis.cancel();
    }

    // Aguardar síntese estar pronta
    if (this.synthesis.speaking) {
      setTimeout(() => this.speak(response), 100);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(response.text);
    
    // Configurações otimizadas para ambiente ruidoso
    utterance.lang = 'pt-BR';
    utterance.rate = 0.9; // Falar um pouco mais devagar
    utterance.pitch = 1.1; // Tom ligeiramente mais alto
    utterance.volume = 1.0; // Volume máximo

    // Priorizar voz feminina (geralmente mais clara)
    const voices = this.synthesis.getVoices();
    const portugueseVoice = voices.find(voice => 
      voice.lang.startsWith('pt') && voice.name.toLowerCase().includes('female')
    ) || voices.find(voice => voice.lang.startsWith('pt'));
    
    if (portugueseVoice) {
      utterance.voice = portugueseVoice;
    }

    utterance.onstart = () => {
      this.currentUtterance = utterance;
    };

    utterance.onend = () => {
      this.currentUtterance = null;
    };

    this.synthesis.speak(utterance);
    this.lastResponse = response;
  }

  /**
   * 🎤 Iniciar escuta
   */
  startListening(): void {
    if (!this.recognition) {
      this.onError?.('Reconhecimento de voz não disponível');
      return;
    }

    if (this.isListening) return;

    try {
      this.isEnabled = true;
      this.recognition.start();
    } catch (error) {
      console.error('Erro ao iniciar reconhecimento:', error);
      this.onError?.('Erro ao iniciar reconhecimento de voz');
    }
  }

  /**
   * 🛑 Parar escuta
   */
  stopListening(): void {
    this.isEnabled = false;
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }

  /**
   * 🔇 Parar síntese de voz
   */
  stopSpeaking(): void {
    this.synthesis.cancel();
    this.currentUtterance = null;
  }

  /**
   * 📋 Obter comandos disponíveis
   */
  getAvailableCommands(): VoiceCommand[] {
    return this.commands;
  }

  /**
   * 🔄 Repetir última resposta
   */
  repeatLast(): void {
    if (this.lastResponse) {
      this.speak(this.lastResponse);
    } else {
      this.speak({
        text: 'Nenhuma informação para repetir.',
        priority: 'medium'
      });
    }
  }

  /**
   * 📞 Configurar callbacks
   */
  setCallbacks(callbacks: {
    onCommand?: (command: string, params?: any) => void;
    onListeningChange?: (listening: boolean) => void;
    onError?: (error: string) => void;
  }): void {
    this.onCommand = callbacks.onCommand || null;
    this.onListeningChange = callbacks.onListeningChange || null;
    this.onError = callbacks.onError || null;
  }

  /**
   * 🧹 Cleanup
   */
  destroy(): void {
    this.stopListening();
    this.stopSpeaking();
    this.recognition = null;
  }
}

// Instância singleton
export const voiceCommands = new VoiceCommandSystem();
