'use client';

import React, { useState, useEffect } from 'react';

interface CarteiroAddress {
  id?: string;
  ordem: string;
  objeto: string;
  endereco: string;
  cep: string;
  destinatario?: string;
  coordinates?: {
    lat: number;
    lng: number;
    display_name: string;
    confidence: number;
  };
  geocoded: boolean;
}

interface AddressEditorProps {
  addresses: CarteiroAddress[];
  onSave: (addresses: CarteiroAddress[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function AddressEditor({ addresses, onSave, onCancel, isOpen }: AddressEditorProps) {
  const [editableAddresses, setEditableAddresses] = useState<CarteiroAddress[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'ordem' | 'objeto' | 'endereco'>('ordem');

  useEffect(() => {
    if (isOpen && addresses.length > 0) {
      setEditableAddresses([...addresses]);
    }
  }, [isOpen, addresses]);

  const handleAddressChange = (index: number, field: keyof CarteiroAddress, value: string) => {
    const updated = [...editableAddresses];
    updated[index] = { ...updated[index], [field]: value };
    setEditableAddresses(updated);
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const updated = [...editableAddresses];
    const [movedItem] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, movedItem);
    
    // Atualizar ordens
    updated.forEach((addr, index) => {
      addr.ordem = (index + 1).toString();
    });
    
    setEditableAddresses(updated);
  };

  const handleDelete = (index: number) => {
    if (confirm('Deseja remover este endereço?')) {
      const updated = editableAddresses.filter((_, i) => i !== index);
      
      // Atualizar ordens
      updated.forEach((addr, i) => {
        addr.ordem = (i + 1).toString();
      });
      
      setEditableAddresses(updated);
    }
  };

  const filteredAddresses = editableAddresses.filter(addr =>
    addr.objeto.toLowerCase().includes(searchTerm.toLowerCase()) ||
    addr.endereco.toLowerCase().includes(searchTerm.toLowerCase()) ||
    addr.cep.includes(searchTerm)
  );

  const sortedAddresses = [...filteredAddresses].sort((a, b) => {
    switch (sortBy) {
      case 'ordem':
        return parseInt(a.ordem) - parseInt(b.ordem);
      case 'objeto':
        return a.objeto.localeCompare(b.objeto);
      case 'endereco':
        return a.endereco.localeCompare(b.endereco);
      default:
        return 0;
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            ✏️ Editor de Endereços ({editableAddresses.length} endereços)
          </h2>
          <button
            onClick={onCancel}
            className="text-white hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Controls */}
        <div className="p-4 border-b border-gray-200 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-64">
              <input
                type="text"
                placeholder="🔍 Buscar por objeto, endereço ou CEP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">Ordenar por:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'ordem' | 'objeto' | 'endereco')}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="ordem">Ordem</option>
                <option value="objeto">Objeto</option>
                <option value="endereco">Endereço</option>
              </select>
            </div>

            {/* Stats */}
            <div className="text-sm text-gray-600">
              📊 {filteredAddresses.length} de {editableAddresses.length} endereços
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💡 <strong>Dicas:</strong> Edite os endereços conforme necessário. 
              Use a busca para encontrar endereços específicos. 
              Reordene arrastando as linhas. Clique em "Salvar" quando terminar.
            </p>
          </div>
        </div>

        {/* Addresses List */}
        <div className="overflow-y-auto max-h-[60vh]">
          <table className="w-full">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ordem
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Objeto
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Endereço
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CEP
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Destinatário
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAddresses.map((address, index) => (
                <tr key={address.id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={address.ordem}
                      onChange={(e) => handleAddressChange(index, 'ordem', e.target.value)}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={address.objeto}
                      onChange={(e) => handleAddressChange(index, 'objeto', e.target.value)}
                      className="w-32 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={address.endereco}
                      onChange={(e) => handleAddressChange(index, 'endereco', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <input
                      type="text"
                      value={address.cep}
                      onChange={(e) => handleAddressChange(index, 'cep', e.target.value)}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={address.destinatario || ''}
                      onChange={(e) => handleAddressChange(index, 'destinatario', e.target.value)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleDelete(index)}
                        className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
                        title="Remover endereço"
                      >
                        🗑️
                      </button>
                      <div className="text-xs text-gray-400">
                        {address.geocoded ? '📍' : '❌'}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            💾 Clique em "Salvar" para aplicar as alterações e gerar a rota otimizada
          </div>
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ❌ Cancelar
            </button>
            <button
              onClick={() => onSave(editableAddresses)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              💾 Salvar e Gerar Rota
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
