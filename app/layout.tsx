import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Rota Fácil Moura - Sistema Inteligente para Carteiros',
  description: 'Sistema PWA para otimização inteligente de rotas de entrega com reconhecimento de endereços por OCR e comando de voz',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/rota-facil-icon.svg', type: 'image/svg+xml' }
    ],
    apple: [
      { url: '/rota-facil-icon.svg', type: 'image/svg+xml' }
    ],
    shortcut: '/favicon.svg'
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
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/rota-facil-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/rota-facil-icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Rota Fácil Moura" />
        <meta name="theme-color" content="#4CAF50" />
      </head>
      <body className={`${inter.className} bg-gray-50 text-gray-900`}>
        <div className="min-h-screen flex flex-col">
          {/* Header Fixo - Sempre Visível */}
          <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-green-600 to-orange-500 text-white shadow-lg">
            <div className="container mx-auto px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 relative">
                    <Image
                      src="/rota-facil-icon.svg"
                      alt="Rota Fácil Logo"
                      width={40}
                      height={40}
                      className="w-full h-full object-contain filter brightness-0 invert"
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

          {/* Main Content com Padding para Header e Navegação Fixos */}
          <main className="flex-1 container mx-auto px-4 py-6 pt-20 pb-24">
            {children}
          </main>

          {/* Bottom Navigation Fixo - Sempre Visível com Funcionalidades Completas */}
          <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 px-4 py-2 shadow-lg">
            <div className="container mx-auto">
              <div className="flex justify-around items-center">
                <a href="#stops-section" className="flex flex-col items-center py-2 px-3 text-blue-600 hover:text-blue-800 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <span className="text-xs mt-1">Paradas</span>
                </a>
                <a href="#route-section" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-gray-800 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  <span className="text-xs mt-1">Rotas</span>
                </a>
                <a href="/carteiro" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-gray-800 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs mt-1">Carteiro</span>
                </a>
                <a href="#settings" className="flex flex-col items-center py-2 px-3 text-gray-600 hover:text-gray-800 transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-xs mt-1">Ajustes</span>
                </a>
              </div>
            </div>
          </nav>
        </div>
      </body>
    </html>
  )
}