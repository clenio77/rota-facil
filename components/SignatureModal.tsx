'use client';

import React, { useRef, useState, useEffect } from 'react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { signatureUrl: string; receiverName: string; receiverDoc: string }) => void;
  objectCode: string;
  address: string;
}

export default function SignatureModal({ isOpen, onClose, onSave, objectCode, address }: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [receiverName, setReceiverName] = useState('');
  const [receiverDoc, setReceiverDoc] = useState('');
  
  const lastX = useRef(0);
  const lastY = useRef(0);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Ajustar tamanho do canvas para o tamanho visível (retina display suporte)
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * 2;
        canvas.height = rect.height * 2;
        ctx.scale(2, 2);
        
        ctx.clearRect(0, 0, rect.width, rect.height);
        ctx.strokeStyle = '#1e3a8a'; // Azul escuro moderno
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    
    // Suporte para touch e mouse via pointer client coordinates
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getCoordinates(e);
    
    lastX.current = x;
    lastY.current = y;
    setIsDrawing(true);
    canvas.setPointerCapture(e.pointerId);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const { x, y } = getCoordinates(e);
    
    ctx.beginPath();
    ctx.moveTo(lastX.current, lastY.current);
    ctx.lineTo(x, y);
    ctx.stroke();
    
    lastX.current = x;
    lastY.current = y;
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (canvas) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (err) {
        // Ignorar erros se o pointer capture já tiver sido liberado
      }
    }
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
    }
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    if (!receiverName.trim()) {
      alert('Por favor, digite o nome de quem está recebendo a entrega.');
      return;
    }

    // Gerar imagem base64
    const signatureUrl = canvas.toDataURL('image/png');
    
    onSave({
      signatureUrl,
      receiverName: receiverName.trim(),
      receiverDoc: receiverDoc.trim()
    });
    
    // Reset formulário
    setReceiverName('');
    setReceiverDoc('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header com gradiente elegante */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 text-white flex justify-between items-center">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-1.5">
              <span>✍️</span> Confirmar Recebimento
            </h3>
            <p className="text-xs text-blue-100 font-medium mt-0.5">Objeto: <span className="font-mono bg-blue-800 px-1.5 py-0.5 rounded text-[10px]">{objectCode}</span></p>
          </div>
          <button 
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/10 rounded-full w-8 h-8 flex items-center justify-center transition-colors text-lg"
          >
            ✕
          </button>
        </div>

        {/* Endereço de entrega detalhado */}
        <div className="bg-blue-50/50 p-4 border-b border-gray-150 text-xs text-blue-800 font-medium">
          📍 <span className="text-gray-500 uppercase tracking-wider font-bold text-[9px] mr-1">Endereço:</span>
          {address}
        </div>

        {/* Formulário */}
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Nome Recebedor *</label>
              <input
                type="text"
                placeholder="Ex: João Silva"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-800 font-medium"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Documento (RG/CPF)</label>
              <input
                type="text"
                placeholder="Ex: 12.345.678"
                value={receiverDoc}
                onChange={(e) => setReceiverDoc(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white text-gray-800 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase text-gray-400 mb-1">Assinatura Digital (Desenhe na tela) *</label>
            <div className="relative border border-gray-300 rounded-xl overflow-hidden bg-gray-50 shadow-inner">
              <canvas
                ref={canvasRef}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                className="w-full block h-40 cursor-crosshair touch-none"
                style={{ touchAction: 'none' }}
              />
              <button
                type="button"
                onClick={handleClear}
                className="absolute bottom-2 right-2 bg-white/95 hover:bg-gray-100 text-gray-700 text-[10px] font-bold px-2.5 py-1 rounded-md border border-gray-200 transition-colors shadow-sm"
              >
                🧹 Limpar
              </button>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="bg-gray-50 px-5 py-4 border-t border-gray-200 flex justify-end gap-2.5">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-semibold rounded-lg text-sm hover:bg-gray-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-750 text-white font-bold rounded-lg text-sm transition-colors shadow-md shadow-blue-500/20"
          >
            ✓ Confirmar Entrega
          </button>
        </div>

      </div>
    </div>
  );
}
