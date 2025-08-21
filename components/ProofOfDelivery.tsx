'use client';

import React, { useState } from 'react';
import { proofOfDelivery, DeliveryProof } from '../lib/proofOfDelivery';

interface ProofOfDeliveryProps {
  stopId: number;
  address: string;
  isOpen: boolean;
  onClose: () => void;
  onProofCaptured: (proof: DeliveryProof) => void;
}

export default function ProofOfDeliveryModal({
  stopId,
  address,
  isOpen,
  onClose,
  onProofCaptured
}: ProofOfDeliveryProps) {
  const [deliveryType, setDeliveryType] = useState<DeliveryProof['deliveryType']>('successful');
  const [includePhoto, setIncludePhoto] = useState(true);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [notes, setNotes] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  if (!isOpen) return null;

  const handleCaptureProof = async () => {
    setIsCapturing(true);
    
    try {
      const proof = await proofOfDelivery.captureProof(
        stopId,
        address,
        deliveryType,
        {
          includePhoto,
          includeSignature,
          notes: notes.trim() || undefined
        }
      );

      onProofCaptured(proof);
      onClose();
      
      // Reset form
      setDeliveryType('successful');
      setIncludePhoto(true);
      setIncludeSignature(false);
      setNotes('');
      
    } catch (error) {
      console.error('Erro ao capturar comprovação:', error);
      alert('Erro ao capturar comprovação: ' + (error as Error).message);
    } finally {
      setIsCapturing(false);
    }
  };

  const deliveryTypeOptions = [
    { value: 'successful', label: '✅ Entrega Realizada', color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
    { value: 'attempted', label: '⏰ Tentativa de Entrega', color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
    { value: 'refused', label: '❌ Entrega Recusada', color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
    { value: 'not_found', label: '🔍 Endereço Não Encontrado', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">📸 Comprovação de Entrega</h2>
              <p className="text-green-100">Registrar evidência da entrega</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-full transition-colors"
              disabled={isCapturing}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-6">
          {/* Address */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">📍 Endereço da Entrega</h3>
            <p className="text-blue-800 text-sm">{address}</p>
          </div>

          {/* Delivery Type */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">📋 Status da Entrega</h3>
            <div className="space-y-2">
              {deliveryTypeOptions.map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                    deliveryType === option.value
                      ? `${option.bg} border-current ${option.color}`
                      : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="deliveryType"
                    value={option.value}
                    checked={deliveryType === option.value}
                    onChange={(e) => setDeliveryType(e.target.value as DeliveryProof['deliveryType'])}
                    className="sr-only"
                  />
                  <span className={`font-medium ${deliveryType === option.value ? option.color : 'text-gray-700'}`}>
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Evidence Options */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">📸 Evidências</h3>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={includePhoto}
                  onChange={(e) => setIncludePhoto(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">📷 Foto de Comprovação</div>
                  <div className="text-sm text-gray-600">Capturar foto do local/pacote entregue</div>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={includeSignature}
                  onChange={(e) => setIncludeSignature(e.target.checked)}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />
                <div>
                  <div className="font-medium text-gray-900">✍️ Assinatura Digital</div>
                  <div className="text-sm text-gray-600">Coletar assinatura do destinatário</div>
                </div>
              </label>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block font-semibold text-gray-900 mb-2">📝 Observações (Opcional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Adicione observações sobre a entrega..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              maxLength={500}
            />
            <div className="text-xs text-gray-500 mt-1">
              {notes.length}/500 caracteres
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-gradient-to-r from-blue-50 to-green-50 rounded-xl p-4 border border-blue-200">
            <h4 className="font-semibold text-blue-900 mb-2">ℹ️ Informações Coletadas</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 📍 Localização GPS precisa</li>
              <li>• 🕐 Data e hora exatas</li>
              <li>• 📱 Informações do dispositivo</li>
              {includePhoto && <li>• 📸 Foto comprimida e otimizada</li>}
              {includeSignature && <li>• ✍️ Assinatura digital do destinatário</li>}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isCapturing}
              className="btn-secondary flex-1"
            >
              Cancelar
            </button>
            <button
              onClick={handleCaptureProof}
              disabled={isCapturing}
              className="btn-primary flex-1 flex items-center justify-center gap-2"
            >
              {isCapturing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Capturando...
                </>
              ) : (
                <>
                  📸 Capturar Comprovação
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook para usar comprovação de entrega
export function useProofOfDelivery() {
  const [proofs, setProofs] = useState<DeliveryProof[]>([]);

  const loadProofs = () => {
    setProofs(proofOfDelivery.getAllProofs());
  };

  const getProofsByStop = (stopId: number) => {
    return proofOfDelivery.getProofsByStop(stopId);
  };

  const exportProofs = () => {
    return proofOfDelivery.exportProofs();
  };

  React.useEffect(() => {
    loadProofs();
  }, []);

  return {
    proofs,
    loadProofs,
    getProofsByStop,
    exportProofs
  };
}
