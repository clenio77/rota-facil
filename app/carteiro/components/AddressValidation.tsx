'use client'

import React, { useState } from 'react';

interface ExtractedAddress {
  id: string;
  originalText: string;
  address: string;
  cep?: string;
  confidence?: number;
}

interface AddressValidationProps {
  extractedAddresses: ExtractedAddress[];
  onConfirm: (validatedAddresses: ExtractedAddress[]) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export default function AddressValidation({ 
  extractedAddresses, 
  onConfirm, 
  onCancel,
  isProcessing = false 
}: AddressValidationProps) {
  const [addresses, setAddresses] = useState<ExtractedAddress[]>(extractedAddresses);

  const updateAddress = (id: string, field: keyof ExtractedAddress, value: string) => {
    setAddresses(prev => prev.map(addr => 
      addr.id === id ? { ...addr, [field]: value } : addr
    ));
  };

  const removeAddress = (id: string) => {
    setAddresses(prev => prev.filter(addr => addr.id !== id));
  };

  const addNewAddress = () => {
    const newAddress: ExtractedAddress = {
      id: `new-${Date.now()}`,
      originalText: '',
      address: '',
      cep: '',
      confidence: 1.0
    };
    setAddresses(prev => [...prev, newAddress]);
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return 'bg-gray-100 text-gray-600';
    if (confidence >= 0.8) return 'bg-green-100 text-green-700';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const getConfidenceText = (confidence?: number) => {
    if (!confidence) return 'Manual';
    if (confidence >= 0.8) return 'Alta';
    if (confidence >= 0.6) return 'Média';
    return 'Baixa';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-bold">📋 Validar Endereços Extraídos</h3>
              <p className="text-blue-100 mt-1">
                Revise e edite os endereços antes de gerar a rota
              </p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">{addresses.length}</div>
              <div className="text-sm text-blue-100">endereços</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {addresses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📭</span>
              </div>
              <h4 className="text-lg font-medium text-gray-900 mb-2">Nenhum endereço encontrado</h4>
              <p className="text-gray-500 mb-4">Adicione endereços manualmente ou tente uma nova foto</p>
              <button
                onClick={addNewAddress}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Adicionar Endereço
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {addresses.map((addr, index) => (
                <div key={addr.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceColor(addr.confidence)}`}>
                          Confiança: {getConfidenceText(addr.confidence)}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeAddress(addr.id)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remover endereço"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>

                  {addr.originalText && (
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Texto Original (OCR)
                      </label>
                      <div className="bg-gray-100 rounded p-2 text-sm text-gray-600 font-mono">
                        {addr.originalText}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Endereço Completo *
                      </label>
                      <textarea
                        value={addr.address}
                        onChange={(e) => updateAddress(addr.id, 'address', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                        rows={2}
                        placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        CEP
                      </label>
                      <input
                        type="text"
                        value={addr.cep || ''}
                        onChange={(e) => updateAddress(addr.id, 'cep', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {/* Add New Address Button */}
              <button
                onClick={addNewAddress}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
              >
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Adicionar Novo Endereço</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t">
          <div className="text-sm text-gray-500">
            {addresses.filter(a => a.address.trim()).length} de {addresses.length} endereços válidos
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isProcessing}
            >
              Cancelar
            </button>
            <button
              onClick={() => onConfirm(addresses.filter(a => a.address.trim()))}
              disabled={isProcessing || addresses.filter(a => a.address.trim()).length === 0}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processando...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Confirmar e Geocodificar</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
