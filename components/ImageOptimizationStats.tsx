'use client';

import React from 'react';
import { ImageOptimizationResult } from '../lib/imageOptimizer';

interface ImageOptimizationStatsProps {
  result: ImageOptimizationResult;
  className?: string;
}

export default function ImageOptimizationStats({ result, className = '' }: ImageOptimizationStatsProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getCompressionColor = (ratio: number): string => {
    if (ratio >= 3) return 'text-green-600';
    if (ratio >= 2) return 'text-blue-600';
    return 'text-yellow-600';
  };

  const getCompressionIcon = (ratio: number): string => {
    if (ratio >= 3) return '🚀';
    if (ratio >= 2) return '⚡';
    return '📦';
  };

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center mb-3">
        <span className="text-xl mr-2">🎯</span>
        <h3 className="text-lg font-semibold text-blue-800">Otimização de Imagem</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        {/* Tamanho do Arquivo */}
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">📏</div>
          <div className="text-sm text-gray-600">Tamanho</div>
          <div className="font-bold text-gray-800">
            {formatFileSize(result.originalSize)}
          </div>
          <div className="text-xs text-gray-500">→</div>
          <div className="font-bold text-green-600">
            {formatFileSize(result.optimizedSize)}
          </div>
        </div>

        {/* Dimensões */}
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">📐</div>
          <div className="text-sm text-gray-600">Dimensões</div>
          <div className="font-bold text-gray-800 text-xs">
            {result.dimensions.original.width}×{result.dimensions.original.height}
          </div>
          <div className="text-xs text-gray-500">→</div>
          <div className="font-bold text-blue-600 text-xs">
            {result.dimensions.optimized.width}×{result.dimensions.optimized.height}
          </div>
        </div>

        {/* Compressão */}
        <div className="bg-white rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">{getCompressionIcon(result.compressionRatio)}</div>
          <div className="text-sm text-gray-600">Compressão</div>
          <div className={`font-bold text-lg ${getCompressionColor(result.compressionRatio)}`}>
            {result.compressionRatio.toFixed(1)}×
          </div>
          <div className="text-xs text-gray-500">menor</div>
        </div>
      </div>

      {/* Otimizações Aplicadas */}
      <div className="bg-white rounded-lg p-3">
        <h4 className="font-semibold text-gray-800 mb-2 flex items-center">
          <span className="mr-2">⚙️</span>
          Otimizações Aplicadas
        </h4>
        <div className="space-y-1">
          {result.optimizations.map((optimization, index) => (
            <div key={index} className="flex items-start text-sm">
              <span className="text-green-500 mr-2 mt-0.5">✓</span>
              <span className="text-gray-700">{optimization}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Benefícios para OCR */}
      <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-semibold text-green-800 mb-2 flex items-center">
          <span className="mr-2">🎯</span>
          Benefícios para OCR
        </h4>
        <div className="text-sm text-green-700 space-y-1">
          <div className="flex items-center">
            <span className="mr-2">📈</span>
            <span>Melhor contraste e nitidez para reconhecimento de texto</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2">⚡</span>
            <span>Processamento mais rápido com arquivo menor</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2">🎯</span>
            <span>Dimensões otimizadas para máxima precisão do OCR</span>
          </div>
          <div className="flex items-center">
            <span className="mr-2">💾</span>
            <span>Redução de {((1 - result.optimizedSize / result.originalSize) * 100).toFixed(0)}% no uso de memória</span>
          </div>
        </div>
      </div>

      {/* Tempo Estimado de Processamento */}
      <div className="mt-3 text-center">
        <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
          <span className="mr-2">⏱️</span>
          <span>Tempo estimado de OCR: ~{Math.max(1, Math.ceil(result.optimizedSize / (1024 * 1024)))}s</span>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar progresso de otimização
interface OptimizationProgressProps {
  isOptimizing: boolean;
  fileName?: string;
  className?: string;
}

export function OptimizationProgress({ isOptimizing, fileName, className = '' }: OptimizationProgressProps) {
  if (!isOptimizing) return null;

  return (
    <div className={`bg-yellow-50 border border-yellow-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-600 mr-3"></div>
        <div>
          <h3 className="font-semibold text-yellow-800">Otimizando Imagem</h3>
          <p className="text-sm text-yellow-700">
            {fileName ? `Processando ${fileName}...` : 'Aplicando filtros e redimensionando para melhor OCR...'}
          </p>
        </div>
      </div>
      
      <div className="mt-3 space-y-2">
        <div className="flex items-center text-sm text-yellow-700">
          <span className="mr-2">🔄</span>
          <span>Redimensionando para dimensões ótimas</span>
        </div>
        <div className="flex items-center text-sm text-yellow-700">
          <span className="mr-2">🎨</span>
          <span>Aplicando filtros para melhorar contraste</span>
        </div>
        <div className="flex items-center text-sm text-yellow-700">
          <span className="mr-2">📦</span>
          <span>Comprimindo para reduzir tamanho</span>
        </div>
      </div>

      <div className="mt-3 bg-yellow-100 rounded-full h-2">
        <div className="bg-yellow-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }}></div>
      </div>
    </div>
  );
}

// Componente para mostrar comparação antes/depois
interface BeforeAfterComparisonProps {
  result: ImageOptimizationResult;
  className?: string;
}

export function BeforeAfterComparison({ result, className = '' }: BeforeAfterComparisonProps) {
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-lg p-4 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
        Comparação Antes vs. Depois
      </h3>
      
      <div className="grid grid-cols-2 gap-4">
        {/* Antes */}
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <h4 className="font-semibold text-red-800 mb-2">❌ Antes</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Tamanho:</span>
                <div className="font-bold text-red-700">{formatFileSize(result.originalSize)}</div>
              </div>
              <div>
                <span className="text-gray-600">Dimensões:</span>
                <div className="font-bold text-red-700">
                  {result.dimensions.original.width}×{result.dimensions.original.height}
                </div>
              </div>
              <div className="text-xs text-red-600">
                Pode ser lento para processar
              </div>
            </div>
          </div>
        </div>

        {/* Depois */}
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <h4 className="font-semibold text-green-800 mb-2">✅ Depois</h4>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-gray-600">Tamanho:</span>
                <div className="font-bold text-green-700">{formatFileSize(result.optimizedSize)}</div>
              </div>
              <div>
                <span className="text-gray-600">Dimensões:</span>
                <div className="font-bold text-green-700">
                  {result.dimensions.optimized.width}×{result.dimensions.optimized.height}
                </div>
              </div>
              <div className="text-xs text-green-600">
                Otimizado para OCR rápido
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Economia */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
          <span className="mr-2">💾</span>
          <span className="font-semibold">
            {((1 - result.optimizedSize / result.originalSize) * 100).toFixed(0)}% menor
          </span>
          <span className="ml-2">•</span>
          <span className="ml-2">{result.compressionRatio.toFixed(1)}× compressão</span>
        </div>
      </div>
    </div>
  );
}
