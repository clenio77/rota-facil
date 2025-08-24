import { Metadata } from 'next';
import Link from 'next/link';
import GPXOptimizer from '../../components/GPXOptimizer';

export const metadata: Metadata = {
  title: 'GPX Optimizer - RotaFácil',
  description: 'Otimize suas rotas GPX com algoritmos avançados e filtro de localização inteligente para economizar tempo e combustível',
  keywords: 'GPX, otimização, rotas, GPS, navegação, economia combustível, localização',
};

export default function GPXOptimizerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Profissional */}
      <nav className="bg-white shadow-lg border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo e Título */}
            <div className="flex items-center">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
                  <span className="text-white text-xl font-bold">R</span>
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  RotaFácil
                </span>
              </Link>
              <div className="ml-4 flex items-center">
                <span className="text-gray-300">•</span>
                <div className="ml-4 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🗺️</span>
                  </div>
                  <span className="text-gray-700 font-medium">GPX Optimizer</span>
                </div>
              </div>
            </div>

            {/* Menu de Navegação */}
            <div className="flex items-center space-x-2">
              <Link
                href="/carteiro"
                className="group flex items-center space-x-2 bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 text-blue-700 px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-105"
              >
                <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs">📮</span>
                </div>
                <span>Carteiros</span>
                <span className="text-blue-400 group-hover:translate-x-1 transition-transform duration-200">→</span>
              </Link>

              <Link
                href="/"
                className="group flex items-center space-x-2 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 text-gray-700 px-4 py-2 rounded-xl font-medium transition-all duration-300 shadow-sm hover:shadow-md transform hover:scale-105"
              >
                <div className="w-6 h-6 bg-gray-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-xs">🏠</span>
                </div>
                <span>Início</span>
                <span className="text-gray-400 group-hover:translate-x-1 transition-transform duration-200">→</span>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Breadcrumb */}
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <nav className="flex items-center space-x-2 text-sm">
            <Link href="/" className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              Início
            </Link>
            <span className="text-gray-400">•</span>
            <span className="text-gray-600 font-medium">GPX Optimizer</span>
          </nav>
        </div>
      </div>

      {/* Header da Página */}
      <div className="bg-gradient-to-br from-green-50 via-blue-50 to-purple-50 border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl mb-4 shadow-lg">
              <span className="text-3xl">🗺️</span>
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent mb-4">
              GPX Optimizer
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto leading-relaxed">
              Otimize suas rotas GPX com algoritmos avançados e filtro de localização inteligente
            </p>

            {/* Badges de Recursos */}
            <div className="flex flex-wrap justify-center gap-3 mt-6">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                ✅ Otimização Inteligente
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                📍 Filtro por Localização
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                ⚡ Algoritmos Avançados
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800">
                💾 Exportação GPX
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - CORRIGIDO: Padding adequado para mobile */}
      <main className="py-8 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <GPXOptimizer />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Sobre o GPX Optimizer</h3>
              <p className="text-gray-600 text-sm">
                Ferramenta avançada para otimização de rotas GPX usando algoritmos de última geração.
                Economize tempo, combustível e melhore a eficiência das suas entregas com filtro de localização inteligente.
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Algoritmos Suportados</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Nearest Neighbor (Rápido)</li>
                <li>• 2-opt Improvement (Qualidade)</li>
                <li>• Algoritmo Genético (Avançado)</li>
                <li>• Seleção Automática (Recomendado)</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Funcionalidades</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• Filtro de localização automático</li>
                <li>• Suporte completo a GPX</li>
                <li>• Métricas de economia</li>
                <li>• Interface intuitiva</li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-500 text-sm">
                © 2025 RotaFácil. Desenvolvido com ❤️ para otimizar suas rotas.
              </p>
              <div className="flex space-x-6 mt-4 md:mt-0">
                <Link href="/" className="text-gray-500 hover:text-blue-600 text-sm font-medium transition-colors">
                  🏠 Início
                </Link>
                <Link href="/carteiro" className="text-gray-500 hover:text-blue-600 text-sm font-medium transition-colors">
                  📮 Carteiros
                </Link>
                <span className="text-blue-600 text-sm font-medium">
                  🗺️ GPX Optimizer
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
