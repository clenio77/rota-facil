'use client'

import React from 'react';
import Image from 'next/image';

interface FooterProps {
  className?: string;
}

export default function Footer({ className = '' }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={`bg-gradient-to-r from-slate-50 to-slate-100 border-t border-slate-200 py-8 px-4 ${className}`}>
      <div className="max-w-6xl mx-auto">
        {/* Main Footer Content */}
        <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
          
          {/* Logo Section */}
          <div className="flex flex-col items-center lg:items-start">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 relative">
                <svg viewBox="0 0 800 800" className="w-full h-full">
                  <defs>
                    <linearGradient id="brainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" style={{stopColor:'#00bcd4', stopOpacity:1}} />
                      <stop offset="50%" style={{stopColor:'#2196f3', stopOpacity:1}} />
                      <stop offset="100%" style={{stopColor:'#9c27b0', stopOpacity:1}} />
                    </linearGradient>
                  </defs>
                  
                  {/* Simplified brain network for small size */}
                  <g fill="url(#brainGradient)" stroke="url(#brainGradient)" strokeWidth="8">
                    <path d="M200 300 C200 200, 300 150, 400 150 C500 150, 600 200, 600 300 C600 350, 580 400, 550 450 C520 500, 480 520, 450 530 C420 540, 380 540, 350 530 C320 520, 280 500, 250 450 C220 400, 200 350, 200 300 Z" fill="none" strokeWidth="12"/>
                    
                    <circle cx="300" cy="250" r="15" fill="currentColor"/>
                    <circle cx="400" cy="220" r="18" fill="currentColor"/>
                    <circle cx="500" cy="250" r="15" fill="currentColor"/>
                    <circle cx="350" cy="320" r="16" fill="currentColor"/>
                    <circle cx="450" cy="320" r="16" fill="currentColor"/>
                    <circle cx="400" cy="380" r="14" fill="currentColor"/>
                    
                    <line x1="300" y1="250" x2="400" y2="220" strokeWidth="6" opacity="0.8"/>
                    <line x1="400" y1="220" x2="500" y2="250" strokeWidth="6" opacity="0.8"/>
                    <line x1="350" y1="320" x2="450" y2="320" strokeWidth="6" opacity="0.8"/>
                    <line x1="400" y1="220" x2="400" y2="380" strokeWidth="6" opacity="0.8"/>
                  </g>
                </svg>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold text-slate-800 leading-tight">CLENIO</div>
                <div className="text-sm text-slate-600 leading-tight">CONSULTORY <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-xs font-bold ml-1">AI</span></div>
              </div>
            </div>
            <div className="text-xs text-slate-500 text-center lg:text-left">
              INNOVATING SOLUTIONS WITH INTELLIGENCE
            </div>
          </div>

          {/* App Info */}
          <div className="text-center lg:text-right">
            <div className="text-lg font-semibold text-slate-800 mb-1">
              Rota Fácil
            </div>
            <div className="text-sm text-slate-600 mb-2">
              Sistema Inteligente para Carteiros
            </div>
            <div className="flex flex-wrap justify-center lg:justify-end gap-2 text-xs">
              <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">📱 Mobile-First</span>
              <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-full">🎤 Voice Control</span>
              <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded-full">🔄 Offline Ready</span>
              <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-full">📊 Analytics</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-300 my-6"></div>

        {/* Bottom Section */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-slate-600">
          <div className="flex items-center gap-4">
            <span>© {currentYear} Clenio Consultory AI</span>
            <span className="hidden md:inline">•</span>
            <span className="text-xs">Todos os direitos reservados</span>
          </div>
          
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Sistema Ativo
            </span>
            <span>•</span>
            <span>Versão 2.0</span>
            <span>•</span>
            <span className="text-blue-600 hover:text-blue-800 cursor-pointer">
              Suporte Técnico
            </span>
          </div>
        </div>

        {/* Powered by AI Badge */}
        <div className="mt-4 text-center">
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-full px-4 py-2 text-xs">
            <div className="w-4 h-4 relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full animate-pulse"></div>
              <div className="absolute inset-0.5 bg-white rounded-full flex items-center justify-center">
                <span className="text-[8px] font-bold bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">AI</span>
              </div>
            </div>
            <span className="text-slate-700 font-medium">Powered by Artificial Intelligence</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Hook para usar o footer em qualquer lugar
export function useFooter() {
  return {
    company: 'Clenio Consultory AI',
    year: new Date().getFullYear(),
    version: '2.0',
    features: ['Mobile-First', 'Voice Control', 'Offline Ready', 'Analytics']
  };
}
