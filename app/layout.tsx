import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import BottomNavigation from '@/components/BottomNavigation'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rota Fácil Moura - Sistema Inteligente para Carteiros',
  description: 'Sistema PWA para otimização inteligente de rotas de entrega com reconhecimento de endereços por OCR e comando de voz',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', type: 'image/x-icon' },
      { url: '/favicon-16x16.png', type: 'image/png', sizes: '16x16' },
      { url: '/favicon-32x32.png', type: 'image/png', sizes: '32x32' },
      { url: '/favicon-48x48.png', type: 'image/png', sizes: '48x48' }
    ],
    apple: [
      { url: '/icon-152x152.png', type: 'image/png' },
      { url: '/icon-192x192.png', type: 'image/png' }
    ],
    shortcut: '/favicon.ico'
  },
  keywords: ['rota', 'entrega', 'carteiro', 'otimização', 'OCR', 'voz', 'GPS', 'mobile'],
  authors: [{ name: 'Clenio Consultory AI' }],
  creator: 'Clenio Consultory AI',
  publisher: 'Rota Fácil Moura',
}

export const viewport: Viewport = {
  themeColor: '#3B82F6',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon-32x32.png" type="image/png" />
        <link rel="apple-touch-icon" href="/icon-152x152.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rota Fácil Moura" />
        <meta name="theme-color" content="#4CAF50" />
        {/* ✅ CORREÇÃO: Removida meta tag duplicada do viewport */}
      </head>
      <body className={`${inter.className} bg-gradient-to-br from-blue-100 via-blue-200 to-indigo-300 text-gray-900`} suppressHydrationWarning>
        {/* ✅ CORREÇÃO CRÍTICA: Wrapper para evitar conflitos de extensões */}
        <div id="app-root" suppressHydrationWarning>
          <div className="min-h-screen flex flex-col">
            {/* Header Fixo - Sempre Visível */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
              <div className="container mx-auto px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-16 h-16 relative">
                      <img
                        src="/logo-carro-azul-removebg-preview.png"
                        alt="Rota Fácil Logo"
                        width={64}
                        height={64}
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div>
                      <h1 className="text-xl font-bold leading-tight">ROTA FÁCIL</h1>
                      <p className="text-xs opacity-90 leading-tight">MOURA PRO</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs opacity-90 hidden sm:inline">Sistema Inteligente</span>
                    <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            </header>

            {/* Main Content com Padding para Header e Navegação Fixos - CORRIGIDO */}
            <main className="flex-1 container mx-auto px-4 py-6 pt-20 pb-24 sm:px-6 lg:px-8 main-content">
              {children}
            </main>

            {/* Bottom Navigation Inteligente - Detecta rota atual e marca aba correspondente */}
            <BottomNavigation />
          </div>
        </div>
      </body>
    </html>
  )
}