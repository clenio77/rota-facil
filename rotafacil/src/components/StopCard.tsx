import Image from 'next/image';

type StopProps = {
  photoUrl: string;
  status: string;
  address: string;
};

export default function StopCard({ photoUrl, status, address }: StopProps) {
  return (
    <div className="bg-white rounded shadow p-4 flex items-center space-x-4">
      {photoUrl ? (
        <Image src={photoUrl} alt="Foto da parada" width={64} height={64} className="rounded object-cover" />
      ) : (
        <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center text-gray-400">Foto</div>
      )}
      <div>
        <div className="font-bold">{status}</div>
        <div className="text-sm text-gray-600">{address || 'Endereço não identificado'}</div>
      </div>
    </div>
  );
}
