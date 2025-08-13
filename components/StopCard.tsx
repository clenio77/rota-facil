'use client'

import React from 'react';
import Image from 'next/image';

type StopStatus = 'uploading' | 'processing' | 'confirmed' | 'error' | 'optimized';

interface StopProps {
  id: number;
  photoUrl: string;
  status: StopStatus;
  address: string;
  sequence?: number;
  onRemove?: (id: number) => void;
  onRetry?: (id: number) => void;
}

const statusConfig = {
  uploading: {
    label: 'Enviando...',
    className: 'badge-info',
    icon: '⏫',
  },
  processing: {
    label: 'Processando...',
    className: 'badge-warning',
    icon: '🔄',
  },
  confirmed: {
    label: 'Confirmado',
    className: 'badge-success',
    icon: '✅',
  },
  error: {
    label: 'Erro',
    className: 'badge-error',
    icon: '❌',
  },
  optimized: {
    label: 'Otimizado',
    className: 'badge-success',
    icon: '📍',
  },
};

export default function StopCard({ 
  id, 
  photoUrl, 
  status, 
  address, 
  sequence,
  onRemove,
  onRetry 
}: StopProps) {
  const config = statusConfig[status];
  
  return (
    <div className="bg-white rounded-xl shadow-custom p-4 card-hover animate-fadeIn">
      <div className="flex items-start space-x-4">
        {/* Sequence Number */}
        {sequence && (
          <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
            {sequence}
          </div>
        )}
        
        {/* Photo */}
        <div className="flex-shrink-0">
          {photoUrl ? (
            <div className="relative w-20 h-20 rounded-lg overflow-hidden">
              <Image
                src={photoUrl}
                alt="Foto da parada"
                fill
                className="object-cover"
                sizes="80px"
              />
              {status === 'uploading' && (
                <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          ) : (
            <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className={`badge ${config.className}`}>
              <span className="mr-1">{config.icon}</span>
              {config.label}
            </span>
            {onRemove && status !== 'uploading' && status !== 'processing' && (
              <button
                onClick={() => onRemove(id)}
                className="text-gray-400 hover:text-red-600 transition-colors"
                aria-label="Remover parada"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
          
          <p className="text-sm text-gray-900 font-medium truncate">
            {address || 'Aguardando endereço...'}
          </p>
          
          {status === 'processing' && (
            <p className="text-xs text-gray-500 mt-1">
              Extraindo endereço da imagem...
            </p>
          )}
          
          {status === 'error' && (
            <div className="mt-2">
              <p className="text-xs text-red-600 mb-1">
                Não foi possível processar a imagem
              </p>
              {onRetry && (
                <button
                  onClick={() => onRetry(id)}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Tentar novamente
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
