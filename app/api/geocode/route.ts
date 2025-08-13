import { NextRequest, NextResponse } from 'next/server';

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number; address?: string } | null> {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        address + ', Brasil'
      )}&limit=1&addressdetails=1&extratags=1`,
      {
        headers: {
          'User-Agent': 'RotaFacil/1.0',
          'Accept-Language': 'pt-BR,pt;q=0.9',
        },
      }
    );

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        address: data[0].display_name,
      };
    }
  } catch (error) {
    console.error('Erro ao geocodificar (geocode API):', error);
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const { address } = await request.json();
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ success: false, error: 'Endereço inválido' }, { status: 400 });
    }

    const result = await geocodeAddress(address);
    if (!result) {
      return NextResponse.json({ success: false, error: 'Não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Erro no endpoint /api/geocode:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}
