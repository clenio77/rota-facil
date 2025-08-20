'use client'

import React, { useState, useEffect } from 'react';

export default function ProcessingStatus() {
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);

  const steps = [
    '📸 Analisando foto...',
    '🤖 Extraindo texto com IA...',
    '📍 Identificando endereços...',
    '🗺️ Geocodificando coordenadas...',
    '🚀 Gerando rota otimizada...',
    '✅ Processamento concluído!'
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);

    const stepInterval = setInterval(() => {
      setCurrentStep(prev => {
        if (prev >= steps.length - 1) {
          clearInterval(stepInterval);
          return steps.length - 1;
        }
        return prev + 1;
      });
    }, 1500);

    return () => {
      clearInterval(interval);
      clearInterval(stepInterval);
    };
  }, []);

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-100 rounded-full mb-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">
            Processando sua lista...
          </h3>
          <p className="text-gray-600">
            Isso pode levar alguns segundos
          </p>
        </div>

        {/* Barra de Progresso */}
        <div className="mb-6">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div 
              className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {progress}% concluído
          </p>
        </div>

        {/* Etapas do Processamento */}
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div
              key={index}
              className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                index <= currentStep
                  ? 'bg-green-50 text-green-800'
                  : 'bg-gray-50 text-gray-500'
              }`}
            >
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-medium ${
                index <= currentStep
                  ? 'bg-green-500 text-white'
                  : 'bg-gray-300 text-gray-600'
              }`}>
                {index < currentStep ? '✓' : index + 1}
              </div>
              <span className="font-medium">{step}</span>
            </div>
          ))}
        </div>

        {/* Informações Adicionais */}
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>💡 Dica:</strong> Enquanto processamos, você pode preparar seu 
            veículo para a rota que será gerada em instantes!
          </p>
        </div>
      </div>
    </div>
  );
}
