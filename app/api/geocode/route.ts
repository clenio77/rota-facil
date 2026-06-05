import { NextRequest, NextResponse } from 'next/server';
import { geocodeAndCache, UserLocationContext } from '../../../lib/geocodingService';

export async function POST(request: NextRequest) {
  try {
    const { address, userLocation, forceLocalSearch } = await request.json();

    if (!address || typeof address !== 'string' || address.trim().length < 3) {
      return NextResponse.json({
        success: false,
        error: 'Endereço inválido ou muito curto'
      }, { status: 400 });
    }

    // Se forceLocalSearch for false, não envie city/state para provedores rígidos
    const relaxedUserLocation: UserLocationContext | undefined = !forceLocalSearch && userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : userLocation;

    const result = await geocodeAndCache(address, relaxedUserLocation);

    if (!result) {
      if (userLocation?.city) {
        console.log(`Geocodificação falhou para "${address}" - FILTRADO por não estar em ${userLocation.city}`);
      }

      return NextResponse.json({
        success: false,
        error: userLocation?.city
          ? `Endereço não encontrado em ${userLocation.city}. Tente ser mais específico (ex: "Rua Principal, 123" ou "Centro").`
          : 'Endereço não encontrado ou fora do Brasil',
        attempted_address: address,
        user_city: userLocation?.city || null,
        user_state: userLocation?.state || null,
        filter_active: !!userLocation?.city,
        suggestion: userLocation?.city
          ? `Tente: "${address}, ${userLocation.city}" ou seja mais específico com o nome da rua.`
          : null
      }, { status: 404 });
    }

    console.log(`Geocodificação bem-sucedida: ${result.provider} (confiança: ${result.confidence})`);

    return NextResponse.json({
      success: true,
      lat: result.lat,
      lng: result.lng,
      address: result.formatted_address || result.address,
      confidence: result.confidence,
      provider: result.provider,
      original_address: address,
      debug_info: {
        provider_used: result.provider,
        confidence: result.confidence,
        user_city: userLocation?.city || 'N/A',
        user_state: userLocation?.state || 'N/A',
        final_address: address,
        force_local_search: forceLocalSearch,
        viacep_attempted: !!userLocation?.city && !!userLocation?.state
      }
    });

  } catch (error) {
    console.error('Erro no endpoint /api/geocode:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}