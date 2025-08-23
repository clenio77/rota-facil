'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function BottomNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')

  useEffect(() => {
    // Detectar a aba ativa baseada na rota atual
    if (pathname === '/') {
      // Na página principal, verificar se estamos na seção de rotas
      const hash = window.location.hash
      if (hash === '#route-section') {
        setActiveTab('rotas')
      } else {
        setActiveTab('home')
      }
    } else if (pathname === '/carteiro') {
      setActiveTab('carteiro')
    } else if (pathname === '/gpx-optimizer') {
      setActiveTab('rotas')
    } else {
      setActiveTab('home')
    }
  }, [pathname])

  // Listener para mudanças no hash da URL
  useEffect(() => {
    const handleHashChange = () => {
      if (pathname === '/') {
        const hash = window.location.hash
        if (hash === '#route-section') {
          setActiveTab('rotas')
        } else if (hash === '#stops-section') {
          setActiveTab('home')
        }
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [pathname])

  const handleTabClick = (tab: string, href: string) => {
    setActiveTab(tab)
    
    if (href === '#stops-section') {
      // Se estamos na página principal, scroll para seção
      if (pathname === '/') {
        const element = document.querySelector(href)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth' })
        }
      } else {
        // Se estamos em outra página, navegar para página principal
        router.push('/')
      }
    } else if (href === '/gpx-optimizer') {
      // Navegar para GPX Optimizer
      router.push(href)
    } else if (href === '/carteiro') {
      // Navegar para página do carteiro
      router.push(href)
    } else if (href.startsWith('#')) {
      // Outras seções na mesma página
      const element = document.querySelector(href)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      // Navegar para nova página
      router.push(href)
    }
  }

  const getTabClasses = (tab: string) => {
    const isActive = activeTab === tab
    return `flex flex-col items-center py-2 px-3 transition-all duration-200 rounded-lg ${
      isActive
        ? 'text-blue-600 bg-blue-50 border border-blue-200'
        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
    }`
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-2 border-blue-300 px-4 py-2 shadow-lg">
      <div className="container mx-auto">
        <div className="flex justify-around items-center">
          {/* Aba Paradas - Página Principal */}
          <button
            onClick={() => handleTabClick('home', '#stops-section')}
            className={getTabClasses('home')}
            title="Paradas - Página Principal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs mt-1 font-medium">Paradas</span>
          </button>

          {/* Aba Rotas - GPX Optimizer ou Seção de Rotas */}
          <button
            onClick={() => {
              if (pathname === '/') {
                // Se estamos na página principal, scroll para seção de rotas
                handleTabClick('rotas', '#route-section')
              } else {
                // Se estamos em outra página, ir para GPX Optimizer
                handleTabClick('rotas', '/gpx-optimizer')
              }
            }}
            className={getTabClasses('rotas')}
            title={pathname === '/' ? "Seção de Rotas" : "Otimização de Rotas GPX"}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span className="text-xs mt-1 font-medium">Rotas</span>
          </button>

          {/* Aba Carteiro - Versão Profissional */}
          <button
            onClick={() => handleTabClick('carteiro', '/carteiro')}
            className={getTabClasses('carteiro')}
            title="Versão Profissional para Carteiros"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs mt-1 font-medium">Carteiro</span>
          </button>

          {/* Aba Dashboard - Visualização de rotas */}
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
        </div>
      </div>
    </nav>
  )
}
