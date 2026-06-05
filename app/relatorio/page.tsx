'use client';

import React, { useEffect, useState } from 'react';

interface ReportItem {
  id?: string;
  sequence: number;
  objectCode: string;
  address: string;
  cep?: string;
  status?: 'confirmed' | 'pending' | 'optimized' | 'delivered' | 'failed';
  completed?: boolean;
  signature?: string;
  receiverName?: string;
  receiverDoc?: string;
}

interface ReportData {
  items: ReportItem[];
  userLocation?: { lat: number; lng: number } | null;
  stats: {
    estimatedTime: number;
    estimatedDistance: string;
    estimatedCost: number;
    totalItems: number;
  };
  city?: string;
  state?: string;
  date: string;
}

export default function RelatorioPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('rotafacil:active_report_data');
        if (raw) {
          const parsed = JSON.parse(raw) as ReportData;
          setData(parsed);
        }
      } catch (e) {
        console.error('Falha ao ler dados de relatório do localStorage', e);
      }
    }
  }, []);

  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      window.close();
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-sm text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-850 mb-2">Relatório Indisponível</h2>
          <p className="text-gray-500 text-sm mb-6">
            Não encontramos dados de rota ativa para gerar o relatório. Otimize uma rota primeiro.
          </p>
          <button
            onClick={handleClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-lg transition-colors"
          >
            Fechar Janela
          </button>
        </div>
      </div>
    );
  }

  const { items, stats, city, state, date } = data;

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8 flex flex-col items-center">
      {/* 🖨️ Estilos CSS dedicados para impressão */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .print-card {
            border: none !important;
            box-shadow: none !important;
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
          }
          table {
            page-break-inside: auto;
          }
          tr {
            page-break-inside: avoid;
            page-break-after: auto;
          }
          thead {
            display: table-header-group;
          }
        }
      `}</style>

      {/* 🚀 Barra de Ações (Ocultada na Impressão) */}
      <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-xl p-4 shadow-sm flex items-center justify-between gap-4 mb-6 no-print">
        <div className="flex items-center gap-2">
          <span className="text-2xl">📋</span>
          <div>
            <h2 className="font-bold text-gray-800 text-sm">Visualização do Relatório</h2>
            <p className="text-xs text-gray-500">Salve como PDF ou envie direto para a impressora</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm py-2 px-5 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <span>🖨️</span> Imprimir / PDF
          </button>
          <button
            onClick={handleClose}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold text-sm py-2 px-4 rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>

      {/* 📝 Folha do Relatório */}
      <div className="w-full max-w-4xl bg-white border border-gray-200 rounded-2xl p-6 sm:p-10 shadow-lg print-card flex flex-col justify-between" style={{ minHeight: '297mm' }}>
        <div>
          {/* Cabeçalho do Relatório */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-2 border-gray-900 pb-6 mb-6 gap-4">
            <div className="flex items-center gap-3">
              <img
                src="/logo-carro-azul-removebg-preview.png"
                alt="Logo"
                className="h-10 w-auto"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-2xl font-black text-gray-950 tracking-tight">ROTAFÁCIL MOURA PRO</h1>
                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Relatório Consolidado de Rota</p>
              </div>
            </div>
            <div className="text-right sm:text-right w-full sm:w-auto">
              <div className="text-xs text-gray-500 font-semibold">Emitido em:</div>
              <div className="font-bold text-gray-950 text-sm">{date}</div>
            </div>
          </div>

          {/* Cartões de Estatísticas no PDF */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Total Paradas</div>
              <div className="text-lg font-black text-gray-900">{stats.totalItems}</div>
            </div>
            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Distância Total</div>
              <div className="text-lg font-black text-gray-900">{stats.estimatedDistance} km</div>
            </div>
            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Tempo Estimado</div>
              <div className="text-lg font-black text-gray-900">{stats.estimatedTime} min</div>
            </div>
            <div className="border border-gray-300 rounded-xl p-3 bg-gray-50">
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Custo Combustível</div>
              <div className="text-lg font-black text-gray-900">R$ {stats.estimatedCost.toFixed(2)}</div>
            </div>
          </div>

          {/* Localidade */}
          <div className="mb-6 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg p-3">
            📍 <strong>Região de Atuação:</strong> {city || 'Não especificada'} - {state || 'Não especificado'}
          </div>

          {/* Tabela de Entregas */}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-gray-300 text-xs text-left">
              <thead>
                <tr className="bg-gray-100 border-b border-gray-300">
                  <th className="p-3 font-bold text-gray-800 border-r border-gray-300 w-12 text-center">Seq.</th>
                  <th className="p-3 font-bold text-gray-800 border-r border-gray-300 w-28 text-center">Objeto/Código</th>
                  <th className="p-3 font-bold text-gray-800 border-r border-gray-300">Endereço de Entrega</th>
                  <th className="p-3 font-bold text-gray-800 border-r border-gray-300 w-24 text-center">Status</th>
                  <th className="p-3 font-bold text-gray-800 w-28 text-center">Assinatura</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isCompleted = item.completed || item.status === 'delivered';
                  const isFailed = item.status === 'failed';
                  return (
                    <tr key={item.id || index} className="border-b border-gray-300 hover:bg-gray-50">
                      <td className="p-2.5 font-bold text-center border-r border-gray-300 bg-gray-50">{item.sequence}</td>
                      <td className="p-2.5 font-mono border-r border-gray-300 font-semibold text-center">{item.objectCode || 'N/A'}</td>
                      <td className="p-2.5 border-r border-gray-300 font-medium text-gray-850 leading-tight">{item.address}</td>
                      <td className="p-2.5 border-r border-gray-300 text-center font-bold">
                        <span className={`px-2 py-0.5 rounded text-[10px] uppercase border ${
                          isCompleted ? 'bg-green-100 text-green-800 border-green-300' :
                          isFailed ? 'bg-red-100 text-red-800 border-red-300' :
                          'bg-yellow-100 text-yellow-800 border-yellow-300'
                        }`}>
                          {isCompleted ? 'Entregue' : isFailed ? 'Falhou' : 'Pendente'}
                        </span>
                      </td>
                      <td className="p-2.5 text-center border-r border-gray-300">
                        {item.signature ? (
                          <div className="flex flex-col items-center justify-center gap-1">
                            <img 
                              src={item.signature} 
                              alt="Assinatura" 
                              className="max-h-10 max-w-[120px] object-contain border border-gray-200 rounded bg-white p-0.5" 
                            />
                            {item.receiverName && (
                              <span className="text-[9px] text-gray-700 font-bold block leading-none">
                                {item.receiverName}
                              </span>
                            )}
                            {item.receiverDoc && (
                              <span className="text-[8px] text-gray-500 block leading-none">
                                Doc: {item.receiverDoc}
                              </span>
                            )}
                          </div>
                        ) : isCompleted ? (
                          <span className="text-green-700 font-bold text-[10px]">Entregue (Sem Assinatura)</span>
                        ) : isFailed ? (
                          <span className="text-red-650 font-bold text-[10px]">Não Entregue</span>
                        ) : (
                          <span className="text-gray-400 font-mono tracking-widest text-[9px]">_________________</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rodapé do Relatório */}
        <div className="border-t border-gray-300 pt-6 mt-12 flex justify-between items-end text-[10px] text-gray-500">
          <div>
            <p><strong>RotaFácil Moura PRO v3.0</strong></p>
            <p>Sistema inteligente de otimização e controle logístico.</p>
          </div>
          <div className="text-center w-48">
            <div className="border-t border-gray-400 pt-1">
              Assinatura do Operador
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
