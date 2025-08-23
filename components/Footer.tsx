'use client'

import React from 'react';
import Image from 'next/image';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 py-8 px-4 pb-20 md:pb-8 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Content */}
        <div className="space-y-8">

          {/* App Logo Section - Centralizada e Maior */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-4 mb-3">
                              <div className="w-20 h-20 relative">
                  <img
                    src="/logo-carro-azul-removebg-preview.png"
                    alt="Rota Fácil Logo"
                    width={80}
                    height={80}
                    className="w-full h-full object-contain"
                  />
                </div>
              <div className="text-left">
                <div className="text-2xl font-bold text-slate-800 leading-tight">ROTA FÁCIL</div>
                <div className="text-lg text-slate-600 leading-tight">MOURA <span className="bg-green-500 text-white px-2 py-1 rounded text-sm font-bold ml-2">PRO</span></div>
              </div>
            </div>
            <div className="text-sm text-slate-500 font-medium">
              SISTEMA INTELIGENTE PARA CARTEIROS
            </div>
          </div>

          {/* Developer Section - Destaque Maior */}
          <div className="bg-white border-2 border-blue-300 rounded-2xl p-6 text-center shadow-lg">
            <div className="flex items-center justify-center gap-4 mb-4">
              <div className="w-20 h-20 relative">
                <img
                  src="/logo-clenio-photoaidcom-cropped.jpeg"
                  alt="Clenio Consultory AI Logo"
                  width={80}
                  height={80}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="text-left">
                <div className="text-xl font-bold text-slate-800 leading-tight">CLENIO</div>
                <div className="text-lg text-slate-600 leading-tight">CONSULTORY <span className="bg-blue-500 text-white px-2 py-1 rounded text-sm font-bold ml-2">AI</span></div>
              </div>
            </div>
            <div className="text-sm text-slate-600 font-medium mb-4">
              INNOVATING SOLUTIONS WITH INTELLIGENCE
            </div>
            <div className="flex flex-wrap justify-center gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full font-medium">📱 Mobile</span>
              <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full font-medium">🎤 Voice</span>
              <span className="bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-medium">🔄 Offline</span>
              <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full font-medium">📊 Analytics</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-300 my-6"></div>

        {/* Bottom Section */}
        <div className="text-center space-y-4">
          <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
            <span className="flex items-center gap-1 bg-green-50 px-3 py-1.5 rounded-full border border-green-200">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="font-medium text-green-700">Sistema Ativo</span>
            </span>
            <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full font-medium border border-blue-200">Versão 2.0</span>
            <a href="/carteiro" className="bg-orange-50 text-orange-700 hover:text-orange-800 cursor-pointer font-medium underline px-3 py-1.5 rounded-full border border-orange-200 transition-colors">
              🚚 Versão Profissional para Carteiros
            </a>
            <span className="text-blue-600 hover:text-blue-800 cursor-pointer font-medium underline bg-blue-50 px-3 py-1.5 rounded-full border border-blue-200">
              Suporte Técnico
            </span>
          </div>

          <div className="text-sm text-slate-600 space-y-1">
            <div className="font-medium">© {currentYear} Rota Fácil Moura - Todos os direitos reservados</div>
            <div className="text-xs text-slate-500">
              Desenvolvido com ❤️ por <span className="font-semibold text-blue-600">Clenio Consultory AI</span>
            </div>
          </div>
        </div>

        {/* Powered by AI Badge */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-full px-3 py-2 text-xs shadow-sm">
            <div className="w-5 h-5 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0.5 bg-white rounded-full flex items-center justify-center">
                <span className="text-[10px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">AI</span>
              </div>
            </div>
            <span className="text-slate-700 font-medium">
              <span className="hidden sm:inline">Powered by Artificial Intelligence</span>
              <span className="sm:hidden">Powered by AI</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Hook para usar o footer em qualquer lugar
export function useFooter() {
  return {
    app: 'Rota Fácil Moura',
    developer: 'Clenio Consultory AI',
    year: 2025, // Valor fixo para evitar problemas de hidratação
    version: '2.0',
    features: ['Mobile', 'Voice', 'Offline', 'Analytics']
  };
}
