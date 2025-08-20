import { NextRequest, NextResponse } from 'next/server';

// Interface removida pois não estava sendo usada

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];
    const userLocationStr = formData.get('userLocation') as string;
    const uploadType = formData.get('uploadType') as string;
    
    if (!files || files.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo fornecido'
      }, { status: 400 });
    }

    // Parse da localização do usuário
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
      } catch (error) {
        console.log('Erro ao parsear localização do usuário:', error);
      }
    }

    console.log('Processando arquivos para carteiro:', {
      fileCount: files.length,
      uploadType,
      userLocation: userLocation?.city || 'não detectada'
    });

    const processedData: Array<{ fileName: string; fileType: string; data: unknown }> = [];
    const errors: string[] = [];

    // Processar cada arquivo baseado no tipo
    for (const file of files) {
      try {
        const fileExtension = file.name.split('.').pop()?.toLowerCase();
        console.log(`Processando arquivo: ${file.name} (${fileExtension})`);

        let fileData: unknown = null;

        switch (fileExtension) {
          case 'gpx':
            fileData = await processGPXFile(file);
            break;
          case 'xls':
          case 'xlsx':
            fileData = await processExcelFile(file);
            break;
          case 'kml':
            fileData = await processKMLFile(file);
            break;
          case 'xml':
            fileData = await processXMLFile(file);
            break;
          case 'csv':
            fileData = await processCSVFile(file);
            break;
          default:
            errors.push(`Formato não suportado: ${fileExtension}`);
            continue;
        }

        if (fileData) {
          processedData.push({
            fileName: file.name,
            fileType: fileExtension,
            data: fileData
          });
          console.log(`✅ Arquivo ${file.name} processado com sucesso`);
        }

      } catch (error) {
        const errorMsg = `Erro ao processar ${file.name}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    if (processedData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo foi processado com sucesso',
        errors,
        suggestions: [
          'Verifique se os arquivos estão em formatos válidos',
          'Certifique-se de que os arquivos não estão corrompidos',
          'Tente arquivos menores se houver problemas de tamanho'
        ]
      });
    }

    // Combinar dados de todos os arquivos
    const combinedData = combineFileData(processedData);

    // Geocodificar endereços se necessário
    let geocodedAddresses: Array<{ originalAddress: string; geocodedAddress?: string; lat?: number; lng?: number; provider?: string; error?: string }> = [];
    if (combinedData.addresses && combinedData.addresses.length > 0) {
      console.log('Geocodificando endereços extraídos...');
      geocodedAddresses = await geocodeAddresses(combinedData.addresses, userLocation);
    }

    const finalData = {
      ...combinedData,
      geocodedAddresses
    };

    // Gerar dados de rota
    const routeData = generateRouteData(finalData);

    console.log('Processamento de arquivos concluído:', {
      totalFiles: files.length,
      processedFiles: processedData.length,
      errors: errors.length,
      addressesFound: finalData.addresses?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: `${processedData.length}/${files.length} arquivo(s) processado(s) com sucesso!`,
      routeData,
      processedFiles: processedData,
      errors: errors.length > 0 ? errors : undefined,
      extractedData: combinedData,
      suggestions: [
        'Verifique se todos os endereços foram geocodificados corretamente',
        'Use o Google Maps para navegação entre paradas',
        'Confirme a sequência das paradas antes de iniciar a rota'
      ]
    });

  } catch (error) {
    console.error('Erro no processamento de arquivos:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno no processamento dos arquivos',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// Processar arquivo GPX
async function processGPXFile(file: File): Promise<{type: string; waypoints: Array<{lat: number; lng: number; name: string}>; totalPoints: number}> {
  try {
    const text = await file.text();

    const waypoints: Array<{ lat: number; lng: number; name: string }> = [];

    // 1) Waypoints (<wpt ...>) com nome opcional
    const wptRegex = /<wpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/wpt>/gi;
    let match: RegExpExecArray | null;
    while ((match = wptRegex.exec(text)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const inner = match[3] || '';
      const nameMatch = inner.match(/<name>([\s\S]*?)<\/name>/i);
      const name = nameMatch ? nameMatch[1].trim() : `Waypoint ${waypoints.length + 1}`;
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng, name });
      }
    }

    // 2) Pontos de rota (<rtept ...>)
    const rteptRegex = /<rtept[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/rtept>/gi;
    while ((match = rteptRegex.exec(text)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const inner = match[3] || '';
      const nameMatch = inner.match(/<name>([\s\S]*?)<\/name>/i);
      const name = nameMatch ? nameMatch[1].trim() : `Rota ${waypoints.length + 1}`;
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng, name });
      }
    }

    // 3) Pontos de trilha (<trkpt ...>) — muitos GPX usam isso em vez de <wpt>
    const trkptRegex = /<trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["'][^>]*>([\s\S]*?)<\/trkpt>/gi;
    let trkIndex = 1;
    while ((match = trkptRegex.exec(text)) !== null) {
      const lat = parseFloat(match[1]);
      const lng = parseFloat(match[2]);
      const name = `Trilha ${trkIndex++}`;
      if (!isNaN(lat) && !isNaN(lng)) {
        waypoints.push({ lat, lng, name });
      }
    }

    return {
      type: 'gpx',
      waypoints,
      totalPoints: waypoints.length
    };
  } catch (error) {
    throw new Error(`Erro ao processar GPX: ${error instanceof Error ? error.message : 'Formato inválido'}`);
  }
}

// Processar arquivo Excel
async function processExcelFile(_file: File): Promise<{type: string; message: string; addresses: string[]}> {
  try {
    // Para arquivos Excel, vamos simular extração de dados
    // Em produção, você pode usar bibliotecas como 'xlsx'
    return {
      type: 'excel',
      message: 'Arquivo Excel detectado - processamento simulado',
      addresses: [
        'Endereço extraído do Excel - 1',
        'Endereço extraído do Excel - 2'
      ]
    };
  } catch (error) {
    throw new Error(`Erro ao processar Excel: ${error instanceof Error ? error.message : 'Formato inválido'}`);
  }
}

// Processar arquivo KML
async function processKMLFile(file: File): Promise<{type: string; placemarks: Array<{name: string; lng: number; lat: number}>; totalPoints: number}> {
  try {
    const text = await file.text();
    
    // Extrair placemarks do KML
    const placemarkRegex = /<Placemark>[\s\S]*?<name>([^<]+)<\/name>[\s\S]*?<coordinates>([^<]+)<\/coordinates>/g;
    const placemarks: Array<{name: string; lng: number; lat: number}> = [];
    
    let match;
    while ((match = placemarkRegex.exec(text)) !== null) {
      const coords = match[2].trim().split(',').map(Number);
      if (coords.length >= 2) {
        placemarks.push({
          name: match[1].trim(),
          lng: coords[0],
          lat: coords[1]
        });
      }
    }

    return {
      type: 'kml',
      placemarks,
      totalPoints: placemarks.length
    };
  } catch (error) {
    throw new Error(`Erro ao processar KML: ${error instanceof Error ? error.message : 'Formato inválido'}`);
  }
}

// Processar arquivo XML
async function processXMLFile(file: File): Promise<{type: string; addresses: string[]; totalAddresses: number}> {
  try {
    const text = await file.text();
    
    // Extrair dados básicos do XML
    const addressRegex = /<address>([^<]+)<\/address>/g;
    const addresses: string[] = [];
    
    let match;
    while ((match = addressRegex.exec(text)) !== null) {
      addresses.push(match[1].trim());
    }

    return {
      type: 'xml',
      addresses,
      totalAddresses: addresses.length
    };
  } catch (error) {
    throw new Error(`Erro ao processar XML: ${error instanceof Error ? error.message : 'Formato inválido'}`);
  }
}

// Processar arquivo CSV
async function processCSVFile(file: File): Promise<{type: string; headers: string[]; data: Array<Record<string, string>>; totalRows: number}> {
  try {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    // Assumir que a primeira linha é cabeçalho
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return row;
    });

    return {
      type: 'csv',
      headers,
      data,
      totalRows: data.length
    };
  } catch (error) {
    throw new Error(`Erro ao processar CSV: ${error instanceof Error ? error.message : 'Formato inválido'}`);
  }
}

// Combinar dados de múltiplos arquivos
function combineFileData(processedFiles: Array<{ fileName: string; fileType: string; data: unknown }>): { totalFiles: number; fileTypes: string[]; addresses: string[]; coordinates: Array<{ lat: number; lng: number; name?: string }> } {
      const combined: { totalFiles: number; fileTypes: string[]; addresses: string[]; coordinates: Array<{ lat: number; lng: number; name?: string }> } = {
    totalFiles: processedFiles.length,
    fileTypes: processedFiles.map(f => f.fileType),
    addresses: [],
    coordinates: []
  };

      for (const file of processedFiles) {
      const data = file.data as { addresses?: string[]; waypoints?: Array<{ lat: number; lng: number; name?: string }>; placemarks?: Array<{ lat: number; lng: number; name?: string }> };
      
      if (data.addresses) {
        combined.addresses.push(...data.addresses);
      }
      if (data.waypoints) {
        combined.coordinates.push(...data.waypoints);
      }
      if (data.placemarks) {
        combined.coordinates.push(...data.placemarks);
      }
    }

  return combined;
}

// Geocodificar endereços
async function geocodeAddresses(addresses: string[], userLocation?: { city?: string; state?: string }): Promise<Array<{ originalAddress: string; geocodedAddress?: string; lat?: number; lng?: number; provider?: string; error?: string }>> {
  const geocoded: Array<{ originalAddress: string; geocodedAddress?: string; lat?: number; lng?: number; provider?: string; error?: string }> = [];
  
  for (const address of addresses) {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/geocode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          address,
          userLocation
        }),
      });
      
      const result = await response.json();
      
      if (result.success) {
        geocoded.push({
          originalAddress: address,
          geocodedAddress: result.address,
          lat: result.lat,
          lng: result.lng,
          provider: result.provider
        });
      } else {
        geocoded.push({
          originalAddress: address,
          error: result.error
        });
      }
    } catch (geocodeError) {
      console.error('Erro na geocodificação:', geocodeError);
      geocoded.push({
        originalAddress: address,
        error: 'Erro na requisição'
      });
    }
  }
  
  return geocoded;
}

// Gerar dados de rota
function generateRouteData(combinedData: { totalFiles: number; fileTypes: string[]; addresses: string[]; coordinates: Array<{ lat: number; lng: number; name?: string }>; geocodedAddresses?: Array<{ originalAddress: string; geocodedAddress?: string; lat?: number; lng?: number; provider?: string; error?: string }> }): { stops: Array<{ address?: string; lat: number; lng: number; sequence: number }>; totalDistance: number; totalTime: number; googleMapsUrl: string } {
  const validStops: Array<{ address?: string; lat: number; lng: number; sequence: number }> = [];

  // Adicionar coordenadas dos arquivos
  if (combinedData.coordinates) {
    validStops.push(...combinedData.coordinates.map((coord, index) => ({
      address: coord.name,
      lat: coord.lat,
      lng: coord.lng,
      sequence: index + 1
    })));
  }

  // Adicionar endereços geocodificados
  if (combinedData.geocodedAddresses) {
    const validAddresses = combinedData.geocodedAddresses?.filter((a) => a.lat && a.lng) || [];
    validStops.push(...validAddresses.map((a, index: number) => ({
      address: a.geocodedAddress,
      lat: a.lat!,
      lng: a.lng!,
      sequence: validStops.length + index + 1
    })));
  }

  return {
    stops: validStops,
    totalDistance: 0,
    totalTime: 0,
    googleMapsUrl: validStops.length > 0 
      ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(validStops[0].address || `${validStops[0].lat},${validStops[0].lng}`)}`
      : 'https://www.google.com/maps'
  };
}
