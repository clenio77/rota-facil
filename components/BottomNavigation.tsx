'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('stops');
  const [isMounted, setIsMounted] = useState(false);

  // ✅ CORREÇÃO CRÍTICA: Evitar hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // ✅ DETERMINAR TAB ATIVA baseado na rota atual
  useEffect(() => {
    if (!isMounted) return;

    if (pathname === '/') {
      // Na página principal, verificar hash para determinar tab ativa
      const hash = window.location.hash;
      if (hash === '#route-section') {
        setActiveTab('routes');
      } else if (hash === '#stops-section') {
        setActiveTab('stops');
      } else {
        setActiveTab('stops'); // Padrão
      }
    } else if (pathname === '/carteiro') {
      setActiveTab('carteiro');
    } else if (pathname === '/dashboard') {
      setActiveTab('dashboard');
    }
  }, [pathname, isMounted]);

  // ✅ LISTENER para mudanças de hash na página principal
  useEffect(() => {
    if (!isMounted || pathname !== '/') return;

    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#route-section') {
        setActiveTab('routes');
      } else if (hash === '#stops-section') {
        setActiveTab('stops');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [pathname, isMounted]);

  const handleTabClick = (tab: string, href: string) => {
    if (href === '#stops-section') {
      // Se estamos na página principal, scroll para seção
      if (pathname === '/') {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Se estamos em outra página, navegar para página principal
        router.push('/');
      }
    } else if (href === '#route-section') {
      // Se estamos na página principal, scroll para seção de rotas
      if (pathname === '/') {
        const element = document.querySelector(href);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' });
        }
      } else {
        // Se estamos em outra página, navegar para otimizador GPX
        router.push('/gpx-optimizer');
      }
    } else {
      // Navegação normal para outras páginas
      router.push(href);
    }
  };

  // ✅ CORREÇÃO CRÍTICA: Não renderizar até o client estar montado
  if (!isMounted) {
    return null; // Evita hydration mismatch
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center py-2">
        {/* Tab Paradas */}
        <button
          onClick={() => handleTabClick('stops', '#stops-section')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            activeTab === 'stops'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Paradas e Endereços"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Paradas</span>
        </button>

        {/* Tab Foto */}
        <button
          onClick={() => handleTabClick('photo', '/photo')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            activeTab === 'photo'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Captura de Fotos"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Foto</span>
        </button>

        {/* Tab Carteiro */}
        <button
          onClick={() => handleTabClick('carteiro', '/carteiro')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            activeTab === 'carteiro'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Versão Profissional para Carteiros"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Carteiro</span>
        </button>

        {/* Tab Dashboard */}
        <button
          onClick={() => handleTabClick('dashboard', '/dashboard')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            activeTab === 'dashboard'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Dashboard e Visualização de Rotas"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <span className="text-xs mt-1 font-medium">Dashboard</span>
        </button>

        {/* Tab Rotas */}
        <button
          onClick={() => handleTabClick('routes', '#route-section')}
          className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
            activeTab === 'routes'
              ? 'bg-blue-600 text-white shadow-lg scale-105'
              : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
          }`}
          title="Otimização de Rotas"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <span className="text-xs mt-1 font-medium">Rotas</span>
        </button>
      </div>
    </nav>
  );
}
