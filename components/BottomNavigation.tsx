'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function BottomNavigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>('stops');
  const [isMounted, setIsMounted] = useState(false);
  const [currentHash, setCurrentHash] = useState<string>('');

  // ✅ CORREÇÃO CRÍTICA: Evitar hydration mismatch
  useEffect(() => {
    setIsMounted(true);
    // ✅ DEFINIR HASH INICIAL apenas no cliente
    setCurrentHash(window.location.hash);
  }, []);

  // ✅ DETERMINAR TAB ATIVA baseado na rota atual (SEM window.location.hash)
  useEffect(() => {
    if (!isMounted) return;

    // ✅ CORREÇÃO: Lógica mais robusta para determinar aba ativa
    if (pathname === '/') {
      // Página principal - verificar hash
      if (currentHash === '#route-section') {
        setActiveTab('routes');
      } else {
        setActiveTab('stops');
      }
    } else if (pathname === '/carteiro') {
      setActiveTab('carteiro');
    } else if (pathname === '/dashboard') {
      setActiveTab('dashboard');
    } else if (pathname === '/gpx-optimizer') {
      // ✅ CORREÇÃO CRÍTICA: Garantir que aba "Rotas" seja selecionada
      setActiveTab('routes');
    }
  }, [pathname, isMounted, currentHash]);

  // ✅ LISTENER para mudanças de hash na página principal (APENAS NO CLIENTE)
  useEffect(() => {
    if (!isMounted || pathname !== '/') return;

    const handleHashChange = () => {
      const hash = window.location.hash;
      setCurrentHash(hash); // ✅ ATUALIZAR ESTADO LOCAL
      if (hash === '#route-section') {
        setActiveTab('routes');
      } else if (hash === '#stops-section') {
        setActiveTab('stops');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [pathname, isMounted]);

  const handleTabClick = (tabId: string, path: string) => {
    if (tabId === 'stops') {
      // Se estiver na página principal, rolar para seção de paradas
      if (pathname === '/') {
        const stopsSection = document.getElementById('stops-section');
        if (stopsSection) {
          stopsSection.scrollIntoView({ behavior: 'smooth' });
          setCurrentHash('#stops-section'); // ✅ ATUALIZAR ESTADO LOCAL
        }
      } else {
        // Se estiver em outra página, navegar para principal
        router.push('/');
      }
    } else if (tabId === 'routes') {
      // Se estiver na página principal, rolar para seção de rotas
      if (pathname === '/') {
        const routeSection = document.getElementById('route-section');
        if (routeSection) {
          routeSection.scrollIntoView({ behavior: 'smooth' });
          setCurrentHash('#route-section'); // ✅ ATUALIZAR ESTADO LOCAL
        }
      } else {
        // Se estiver em outra página, navegar para otimizador
        router.push('/gpx-optimizer');
      }
    } else {
      // Para outras abas, navegação direta
      router.push(path);
    }
  };

  // ✅ CORREÇÃO CRÍTICA: Não renderizar até o client estar montado
  if (!isMounted) {
    return null; // Evita hydration mismatch
  }

  const tabs = [
    { id: 'stops', label: 'Paradas', icon: '📍', path: '/' },
    { id: 'carteiro', label: 'Carteiro', icon: '📮', path: '/carteiro' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊', path: '/dashboard' },
    { id: 'routes', label: 'Rotas', icon: '🗺️', path: '/gpx-optimizer' }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50 bottom-navigation">
      <div className="flex justify-around items-center py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id, tab.path)}
            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-lg scale-105'
                : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
            }`}
            title={tab.label}
          >
            <span className="text-lg">{tab.icon}</span>
            <span className="text-xs mt-1 font-medium">{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
