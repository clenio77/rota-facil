// Página principal do RotaFácil
import React from 'react';
import StopCard from '../../components/StopCard';

export default function HomePage() {
  // Exemplo de parada
  const stops = [
    { id: 1, photoUrl: '', status: 'uploading', address: '' }
  ];
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Minhas Paradas</h2>
      <div className="space-y-4">
        {stops.map(stop => (
          <StopCard key={stop.id} {...stop} />
        ))}
      </div>
      <div className="fixed bottom-4 right-4">
        <button className="bg-blue-600 text-white rounded-full p-4 shadow-lg">+</button>
      </div>
    </div>
  );
}
