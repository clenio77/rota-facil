import { NextRequest, NextResponse } from 'next/server';
import { GPXOptimizer, OptimizationOptions, OptimizationResult } from '../../../lib/gpxOptimizer';
import { GPXParser } from '../../../lib/gpxParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const optionsStr = formData.get('options') as string;
    const userLocationStr = formData.get('userLocation') as string;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo GPX fornecido' },
        { status: 400 }
      );
    }

    // Verificar se é arquivo GPX
    if (!file.name.toLowerCase().endsWith('.gpx')) {
      return NextResponse.json(
        { success: false, error: 'Arquivo deve ter extensão .gpx' },
        { status: 400 }
      );
    }

    // Ler conteúdo do arquivo
    const gpxContent = await file.text();
    
    // Validar GPX
    const validation = GPXParser.validateGPX(gpxContent);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Arquivo GPX inválido',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Parse do arquivo GPX
    let gpxData;
    try {
      gpxData = GPXParser.parseGPX(gpxContent);
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Erro ao processar arquivo GPX',
          details: error instanceof Error ? error.message : 'Erro desconhecido'
        },
        { status: 400 }
      );
    }

    // Parse da localização do usuário
    let userLocation: { lat: number; lng: number; city?: string; state?: string } | undefined;
    try {
      if (userLocationStr) {
        userLocation = JSON.parse(userLocationStr);
      }
    } catch (error) {
      console.log('Localização do usuário não fornecida ou inválida');
    }

    // Extrair todos os waypoints
    const allWaypoints = GPXParser.extractAllWaypoints(gpxData);
    
    if (allWaypoints.length < 2) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'GPX deve conter pelo menos 2 pontos para otimização'
        },
        { status: 400 }
      );
    }

    // Parse das opções de otimização
    let options: OptimizationOptions & { filterByLocation?: boolean; maxDistanceFromUser?: number };
    try {
      options = optionsStr ? JSON.parse(optionsStr) : {
        algorithm: 'auto',
        roundTrip: false,
        maxIterations: 1000,
        preserveOrder: false,
        weightDistance: 1.0,
        weightTime: 0.0,
        filterByLocation: true,
        maxDistanceFromUser: 50
      };
    } catch (error) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Opções de otimização inválidas',
          details: 'JSON malformado nas opções'
        },
        { status: 400 }
      );
    }

    // Filtrar waypoints por proximidade se localização do usuário estiver disponível
    let filteredWaypoints = allWaypoints;
    let filterInfo = { applied: false, originalCount: allWaypoints.length, filteredCount: allWaypoints.length };
    
    if (userLocation && options.filterByLocation !== false) {
      // Calcular distância máxima baseada na configuração ou usar padrão
      const maxDistanceKm = options.maxDistanceFromUser || 50; // 50km por padrão
      
      filteredWaypoints = allWaypoints.filter(waypoint => {
        const distance = GPXOptimizer.calculateDistance(
          { lat: userLocation!.lat, lng: userLocation!.lng, name: 'User Location' },
          waypoint
        );
        return distance <= maxDistanceKm;
      });
      
      filterInfo = {
        applied: true,
        originalCount: allWaypoints.length,
        filteredCount: filteredWaypoints.length
      };
      
      console.log(`Filtro de localização aplicado: ${filterInfo.originalCount} -> ${filterInfo.filteredCount} waypoints (raio: ${maxDistanceKm}km)`);
      
      if (filteredWaypoints.length < 2) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Apenas ${filteredWaypoints.length} pontos encontrados dentro do raio de ${maxDistanceKm}km da sua localização. Aumente o raio ou desative o filtro de localização.`,
            filterInfo
          },
          { status: 400 }
        );
      }
    }

    // Executar otimização
    console.log(`Iniciando otimização de ${filteredWaypoints.length} pontos com algoritmo: ${options.algorithm}`);
    
    const startTime = Date.now();
    const result: OptimizationResult = GPXOptimizer.optimize(filteredWaypoints, options);
    const processingTime = Date.now() - startTime;

    // Gerar GPX otimizado
    const optimizedGPX = GPXParser.exportOptimizedGPX(
      gpxData,
      result.optimizedWaypoints,
      {
        algorithm: result.algorithm,
        originalDistance: result.originalDistance,
        optimizedDistance: result.optimizedDistance,
        distanceSaved: result.distanceSaved,
        percentageImprovement: result.percentageImprovement
      }
    );

    // Preparar resposta
    const response = {
      success: true,
      optimization: {
        originalDistance: Math.round(result.originalDistance * 100) / 100,
        optimizedDistance: Math.round(result.optimizedDistance * 100) / 100,
        distanceSaved: Math.round(result.distanceSaved * 100) / 100,
        percentageImprovement: Math.round(result.percentageImprovement * 10) / 10,
        originalDuration: Math.round(result.originalDuration * 10) / 10,
        optimizedDuration: Math.round(result.optimizedDuration * 10) / 10,
        timeSaved: Math.round(result.timeSaved * 10) / 10,
        algorithm: result.algorithm,
        processingTime: processingTime,
        totalWaypoints: filteredWaypoints.length,
        originalWaypointsCount: allWaypoints.length
      },
      filterInfo,
      originalWaypoints: allWaypoints.map((wp, index) => ({
        id: index,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        sequence: index + 1,
        filtered: filterInfo.applied ? !filteredWaypoints.includes(wp) : false
      })),
      optimizedWaypoints: result.optimizedWaypoints.map((wp, index) => ({
        id: filteredWaypoints.findIndex(original => 
          original.lat === wp.lat && 
          original.lng === wp.lng && 
          original.name === wp.name
        ),
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        sequence: index + 1
      })),
      optimizedGPX: optimizedGPX,
      metadata: {
        originalFileName: file.name,
        optimizedFileName: file.name.replace('.gpx', '_optimized.gpx'),
        processedAt: new Date().toISOString(),
        fileSize: gpxContent.length,
        optimizedFileSize: optimizedGPX.length
      }
    };

    console.log(`Otimização concluída em ${processingTime}ms: ${result.distanceSaved.toFixed(2)}km economizados (${result.percentageImprovement.toFixed(1)}%)`);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Erro no GPX Optimizer:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno no processamento',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para download do GPX otimizado
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gpxData = searchParams.get('data');
    const filename = searchParams.get('filename') || 'optimized_route.gpx';

    if (!gpxData) {
      return NextResponse.json(
        { success: false, error: 'Dados GPX não fornecidos' },
        { status: 400 }
      );
    }

    // Decodificar dados GPX
    const decodedGPX = decodeURIComponent(gpxData);

    // Retornar arquivo para download
    return new NextResponse(decodedGPX, {
      status: 200,
      headers: {
        'Content-Type': 'application/gpx+xml',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': decodedGPX.length.toString()
      }
    });

  } catch (error) {
    console.error('Erro no download do GPX:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro ao gerar download',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Endpoint para análise rápida de GPX (sem otimização)
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Nenhum arquivo GPX fornecido' },
        { status: 400 }
      );
    }

    const gpxContent = await file.text();
    
    // Validar GPX
    const validation = GPXParser.validateGPX(gpxContent);
    if (!validation.isValid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Arquivo GPX inválido',
          details: validation.errors
        },
        { status: 400 }
      );
    }

    // Parse básico
    const gpxData = GPXParser.parseGPX(gpxContent);
    const allWaypoints = GPXParser.extractAllWaypoints(gpxData);
    
    // Calcular estatísticas básicas
    const totalDistance = GPXOptimizer.calculateTotalDistance(allWaypoints);
    const estimatedDuration = totalDistance / 50 * 60; // 50 km/h média

    // Análise de distribuição geográfica
    const lats = allWaypoints.map(wp => wp.lat);
    const lngs = allWaypoints.map(wp => wp.lng);
    
    const bounds = {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs)
    };

    const center = {
      lat: (bounds.north + bounds.south) / 2,
      lng: (bounds.east + bounds.west) / 2
    };

    return NextResponse.json({
      success: true,
      analysis: {
        totalWaypoints: allWaypoints.length,
        totalTracks: gpxData.tracks.length,
        totalRoutes: gpxData.routes.length,
        totalDistance: Math.round(totalDistance * 100) / 100,
        estimatedDuration: Math.round(estimatedDuration * 10) / 10,
        bounds,
        center,
        metadata: gpxData.metadata
      },
      waypoints: allWaypoints.slice(0, 100).map((wp, index) => ({ // Limitar a 100 para preview
        id: index,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name
      }))
    });

  } catch (error) {
    console.error('Erro na análise do GPX:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro na análise do arquivo',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
