import { Metadata } from 'next';
import GPXOptimizer from '../../components/GPXOptimizer';

export const metadata: Metadata = {
  title: 'GPX Optimizer - RotaFácil',
  description: 'Otimize suas rotas GPX com algoritmos avançados e filtro de localização inteligente para economizar tempo e combustível',
  keywords: 'GPX, otimização, rotas, GPS, navegação, economia combustível, localização',
};

export default function GPXOptimizerPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <a href="/" className="text-xl font-bold text-blue-600">
                RotaFácil
              </a>
              <span className="ml-2 text-gray-400">|</span>
              <span className="ml-2 text-gray-600">GPX Optimizer</span>
            </div>
            <div className="flex items-center space-x-4">
              <a 
                href="/carteiro" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Carteiro
              </a>
              <a 
                href="/" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Início
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="py-8">
        <GPXOptimizer />
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
                <a href="/privacy" className="text-gray-500 hover:text-gray-900 text-sm">
                  Privacidade
                </a>
                <a href="/terms" className="text-gray-500 hover:text-gray-900 text-sm">
                  Termos
                </a>
                <a href="/support" className="text-gray-500 hover:text-gray-900 text-sm">
                  Suporte
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
