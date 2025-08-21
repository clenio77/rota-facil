'use client';

import React, { useState, useEffect } from 'react';
import { voiceCommands, VoiceCommand } from '../lib/voiceCommands';

interface VoiceControlProps {
  onCommand: (command: string) => void;
  isEnabled?: boolean;
}

export default function VoiceControl({ onCommand, isEnabled = false }: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [isActive, setIsActive] = useState(isEnabled);
  const [showCommands, setShowCommands] = useState(false);
  const [lastCommand, setLastCommand] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    // Configurar callbacks do sistema de voz
    voiceCommands.setCallbacks({
      onCommand: (command) => {
        setLastCommand(command);
        onCommand(command);
      },
      onListeningChange: setIsListening,
      onError: setError
    });

    return () => {
      voiceCommands.destroy();
    };
  }, [onCommand]);

  useEffect(() => {
    if (isActive) {
      voiceCommands.startListening();
    } else {
      voiceCommands.stopListening();
    }
  }, [isActive]);

  const toggleVoiceControl = () => {
    setIsActive(!isActive);
    setError('');
  };

  const commands = voiceCommands.getAvailableCommands();
  const commandsByCategory = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = [];
    acc[cmd.category].push(cmd);
    return acc;
  }, {} as Record<string, VoiceCommand[]>);

  const categoryIcons = {
    navigation: '🧭',
    delivery: '📦',
    system: '⚙️'
  };

  const categoryNames = {
    navigation: 'Navegação',
    delivery: 'Entregas',
    system: 'Sistema'
  };

  return (
    <>
      {/* 🎤 VOICE CONTROL BUTTON */}
      <button
        onClick={toggleVoiceControl}
        className={`mobile-nav-item ${isActive ? 'active' : ''} relative`}
        title={isActive ? 'Desativar comandos de voz' : 'Ativar comandos de voz'}
      >
        {/* Indicador de escuta */}
        {isListening && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
        )}
        
        <svg className="mobile-nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" 
          />
        </svg>
        <span className="mobile-nav-label">
          {isListening ? 'Escutando' : isActive ? 'Voz ON' : 'Voz OFF'}
        </span>
      </button>

      {/* 🎤 VOICE STATUS INDICATOR */}
      {isActive && (
        <div className="fixed top-4 left-4 z-40 bg-white rounded-xl shadow-lg p-3 border-2 border-blue-200">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isListening ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
            <span className="text-sm font-medium text-gray-700">
              {isListening ? '🎤 Escutando...' : '🎤 Pronto'}
            </span>
          </div>
          
          {lastCommand && (
            <div className="mt-1 text-xs text-blue-600">
              Último: {lastCommand}
            </div>
          )}
          
          {error && (
            <div className="mt-1 text-xs text-red-600">
              ⚠️ {error}
            </div>
          )}
          
          <button
            onClick={() => setShowCommands(true)}
            className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            Ver comandos
          </button>
        </div>
      )}

      {/* 📋 COMMANDS HELP MODAL */}
      {showCommands && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">🎤 Comandos de Voz</h2>
                  <p className="text-purple-100">Fale naturalmente</p>
                </div>
                <button
                  onClick={() => setShowCommands(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              <div className="space-y-6">
                {Object.entries(commandsByCategory).map(([category, cmds]) => (
                  <div key={category} className="space-y-3">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <span className="text-2xl">{categoryIcons[category as keyof typeof categoryIcons]}</span>
                      {categoryNames[category as keyof typeof categoryNames]}
                    </h3>
                    
                    <div className="space-y-2">
                      {cmds.map((cmd, index) => (
                        <div key={index} className="bg-gray-50 rounded-xl p-4">
                          <div className="font-semibold text-gray-900 mb-1">
                            {cmd.description}
                            {cmd.requiresConfirmation && (
                              <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">
                                Requer confirmação
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-600">
                            <strong>Diga:</strong> {cmd.patterns.slice(0, 2).map((pattern, i) => (
                              <span key={i} className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded-md mr-1 mb-1">
                                "{pattern}"
                              </span>
                            ))}
                            {cmd.patterns.length > 2 && (
                              <span className="text-gray-500">+{cmd.patterns.length - 2} mais</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Tips */}
              <div className="mt-6 bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
                <h4 className="font-bold text-green-800 mb-2">💡 Dicas para melhor reconhecimento:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• Fale de forma clara e pausada</li>
                  <li>• Aguarde o indicador vermelho antes de falar</li>
                  <li>• Em ambiente ruidoso, fale mais alto</li>
                  <li>• Use as palavras exatas dos comandos</li>
                  <li>• Para comandos críticos, confirme com "sim"</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    voiceCommands.speak({
                      text: 'Sistema de comandos de voz ativo. Diga "ajuda" a qualquer momento para ver os comandos disponíveis.',
                      priority: 'medium'
                    });
                  }}
                  className="btn-secondary flex-1"
                >
                  🔊 Testar Voz
                </button>
                <button
                  onClick={() => setShowCommands(false)}
                  className="btn-primary flex-1"
                >
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Hook para usar comandos de voz
export function useVoiceCommands(handlers: Record<string, () => void>) {
  useEffect(() => {
    const handleCommand = (command: string) => {
      const handler = handlers[command];
      if (handler) {
        handler();
      } else {
        console.warn('Comando não mapeado:', command);
      }
    };

    voiceCommands.setCallbacks({
      onCommand: handleCommand,
      onListeningChange: (listening) => {
        console.log('Voice listening:', listening);
      },
      onError: (error) => {
        console.error('Voice error:', error);
      }
    });

    return () => {
      voiceCommands.destroy();
    };
  }, [handlers]);
}
