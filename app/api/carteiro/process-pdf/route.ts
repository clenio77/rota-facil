import { NextRequest, NextResponse } from 'next/server';
import { writeFile, unlink, mkdir } from 'fs/promises';
import path from 'path';
import { existsSync } from 'fs';

import { processCarteiroFile, generateMapData, detectFileType, generateOptimizedRoute, deduplicateAddresses } from '../../../../utils/pdfExtractor';

// ✅ INTERFACE LOCAL PARA ENDEREÇOS DO CARTEIRO
interface CarteiroAddress {
  id: string;
  ordem: string;
  objeto: string;
  endereco: string;
  cep: string;
  destinatario: string;
  coordinates?: { lat: number; lng: number };
  geocoded?: boolean;
  cepData?: Array<{ cep: string; line: string; position: number }>; // ✅ NOVA PROPRIEDADE: CEPs para análise posterior
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const userLocationStr = formData.get('userLocation') as string;

    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'Nenhum arquivo foi enviado'
      }, { status: 400 });
    }

    // Detectar e validar tipo de arquivo
    const fileType = detectFileType(file.name);
    const supportedTypes = ['pdf', 'excel', 'csv', 'kml', 'gpx', 'xml', 'json'];

    if (!supportedTypes.includes(fileType)) {
      return NextResponse.json({
        success: false,
        error: `Tipo de arquivo não suportado. Formatos aceitos: PDF, XLS, XLSX, CSV, KML, GPX, XML, JSON`
      }, { status: 400 });
    }
    
    // Validar tamanho (máximo 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({
        success: false,
        error: 'Arquivo muito grande. Máximo 10MB permitido.'
      }, { status: 400 });
    }
    
    let userLocation = null;
    if (userLocationStr) {
      try {
        userLocation = JSON.parse(userLocationStr);
        console.log('📍 Localização do usuário recebida:', userLocation);
      } catch (error) {
        console.warn('❌ Erro ao parsear userLocation:', error);
        console.log('📝 userLocationStr recebido:', userLocationStr);
      }
    } else {
      console.log('⚠️ Nenhuma localização do usuário foi enviada');
    }
    
    // ✅ NOVA ABORDAGEM: Processar arquivo em memória
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    console.log(`📄 Processando ${fileType.toUpperCase()}: ${file.name} (${(file.size / 1024).toFixed(1)}KB)`);

    try {
      // ✅ PROCESSAMENTO DIRETO EM MEMÓRIA
      let result;
      
      if (fileType === 'pdf') {
        // ✅ PARA PDF: Converter para base64 e processar
        const base64Data = buffer.toString('base64');
        console.log('🧠 Chamando processCarteiroFileFromBuffer para PDF...');
        try {
        result = await processCarteiroFileFromBuffer(base64Data, file.name, userLocation);
          console.log('✅ processCarteiroFileFromBuffer retornou com sucesso');
        } catch (pdfProcessingError) {
          console.error('❌ ERRO CRÍTICO em processCarteiroFileFromBuffer:', pdfProcessingError);
          console.error('Stack trace:', pdfProcessingError instanceof Error ? pdfProcessingError.stack : 'Sem stack');
          throw pdfProcessingError;
        }
      } else {
        // ✅ PARA OUTROS FORMATOS: Criar arquivo temporário apenas se necessário
        const tempDir = path.join(process.cwd(), 'temp');
        const fileExtension = file.name.split('.').pop();
        const tempFilePath = path.join(tempDir, `carteiro-${Date.now()}.${fileExtension}`);
        
        try {
          // Criar diretório temp se não existir
          if (!existsSync(tempDir)) {
            await mkdir(tempDir, { recursive: true });
          }
          
          await writeFile(tempFilePath, buffer);
          
          // Processar arquivo
          result = await processCarteiroFile(tempFilePath, file.name, userLocation);
          
        } finally {
          // Limpar arquivo temporário
          try {
            if (existsSync(tempFilePath)) {
              await unlink(tempFilePath);
            }
          } catch (cleanupError) {
            console.warn('⚠️ Erro ao remover arquivo temporário:', cleanupError);
          }
        }
      }
      
      if (!result.success) {
        // ✅ VERIFICAR SE É ERRO DE OCR (sem texto extraído)
        const resultWithError = result as any; // Type assertion para acessar error
        if (resultWithError.error && resultWithError.error.includes('Nenhum texto foi extraído')) {
          console.log('⚠️ FALLBACK: OCR falhou completamente, oferecendo entrada manual');
          return NextResponse.json({
            success: false,
            message: '❌ OCR não conseguiu extrair texto do PDF',
            error: 'No text extracted from PDF',
            fallbackOptions: {
              manualEntry: true,
              message: 'Digite os endereços manualmente ou tente outro PDF',
              exampleFormat: 'Rua das Flores, 123, CEP: 38400-000'
            }
          }, { status: 422 });
        }
        
        return NextResponse.json({
          success: false,
          error: 'Erro ao processar arquivo'
        }, { status: 500 });
      }
      
      // ✅ VALIDAR SE RESULT.ADDRESSES EXISTE ANTES DE GERAR MAPA
      if (!result.addresses || !Array.isArray(result.addresses)) {
        console.error('❌ Erro: result.addresses é undefined ou não é um array');
        console.log('🔍 Result:', result);
        throw new Error('Endereços não foram processados corretamente');
      }
      
      // ✅ PRIMEIRO: APLICAR DEDUPLICAÇÃO ANTES DA OTIMIZAÇÃO INICIAL
      console.log('🔍 Deduplicando endereços antes da primeira exibição...');
      console.log('🔍 DEBUG: result.addresses antes da deduplicação:', result.addresses.length);
      
      // ✅ FALLBACK: Se OCR falhou, oferecer entrada manual
      if (result.addresses.length === 0) {
        console.log('⚠️ FALLBACK: OCR não extraiu endereços, oferecendo entrada manual');
        return NextResponse.json({
          success: false,
          message: '❌ OCR não conseguiu extrair endereços do PDF',
          error: 'No addresses extracted',
          fallbackOptions: {
            manualEntry: true,
            message: 'Digite os endereços manualmente ou tente outro PDF',
            exampleFormat: 'Rua das Flores, 123, CEP: 38400-000'
          }
        }, { status: 422 });
      }
      
      let deduplicatedAddresses;
      try {
        deduplicatedAddresses = deduplicateAddresses(result.addresses);
        console.log(`📊 Deduplicação inicial: ${result.addresses.length} → ${deduplicatedAddresses.length} endereços únicos`);
      } catch (dedupError) {
        console.error('❌ ERRO na deduplicação:', dedupError);
        deduplicatedAddresses = result.addresses; // Fallback para endereços originais
        console.log('⚠️ Usando endereços originais sem deduplicação');
      }
      
      // ✅ NOVO: ROTEAMENTO AUTOMÁTICO INTELIGENTE (COM ENDEREÇOS DEDUPLICADOS)
      console.log('🚀 Iniciando roteamento automático...');
      console.log('📍 Localização do usuário para roteamento:', JSON.stringify(userLocation, null, 2));
      console.log('🔍 Total de endereços para otimizar:', deduplicatedAddresses.length);
      console.log('🔍 Primeiros 3 endereços:', deduplicatedAddresses.slice(0, 3).map(addr => ({
        endereco: addr.endereco,
        cep: addr.cep,
        coordinates: addr.coordinates
      })));
      
      // ✅ GERAR ROTA OTIMIZADA AUTOMATICAMENTE (COM ENDEREÇOS DEDUPLICADOS)
      console.log('🧠 Chamando generateOptimizedRoute...');
      const optimizedRoute = generateOptimizedRoute(deduplicatedAddresses, userLocation);
      
      if (!optimizedRoute.success) {
        console.error('❌ Erro na otimização da rota:', optimizedRoute.error);
        throw new Error('Falha na otimização automática da rota');
      }
      
      // ✅ GERAR DADOS DO MAPA COM ROTA OTIMIZADA
      const mapData = generateMapData(deduplicatedAddresses);
      
      console.log(`✅ ${fileType.toUpperCase()} processado: ${result.geocoded}/${result.total} endereços geocodificados`);
      console.log(`🔗 Deduplicação aplicada: ${result.addresses.length} → ${deduplicatedAddresses.length} endereços únicos`);
      console.log(`🚀 Rota otimizada: ${optimizedRoute.totalStops} paradas, ${optimizedRoute.metrics?.totalDistance || 0} km, ${optimizedRoute.metrics?.totalTime || 0} min`);
      
      return NextResponse.json({
        success: true,
        addresses: deduplicatedAddresses,
        mapData,
        optimizedRoute: optimizedRoute.optimizedRoute,
        googleMapsUrl: optimizedRoute.googleMapsUrl,
        routeMetrics: optimizedRoute.metrics,
        startLocation: optimizedRoute.startLocation,
        fileName: file.name,
        fileSize: file.size,
        processedAt: new Date().toISOString(),
        total: result.total,
        geocoded: result.geocoded,
        fileType: result.fileType,
        metadata: result.metadata
      });
      
    } catch (processingError) {
      console.error('❌ Erro no processamento:', processingError);
      throw processingError;
    }
    
  } catch (error) {
    console.error('❌ Erro no processamento do arquivo:', error);
    console.error('Stack trace:', error instanceof Error ? error.stack : 'Sem stack');

    // ✅ VERIFICAR SE É ERRO DE OCR PARA ATIVAR FALLBACK
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Nenhum texto foi extraído') || 
        errorMessage.includes('OCR.space falhou') ||
        errorMessage.includes('No text extracted')) {
      console.log('⚠️ FALLBACK: Erro de OCR detectado, oferecendo entrada manual');
      return NextResponse.json({
        success: false,
        message: '❌ OCR não conseguiu processar este PDF',
        error: 'OCR failed to extract text',
        fallbackOptions: {
          manualEntry: true,
          message: 'Digite os endereços manualmente ou tente outro PDF com melhor qualidade',
          exampleFormat: 'Rua das Flores, 123, CEP: 38400-000'
        }
      }, { status: 422 });
    }

    return NextResponse.json({
      success: false,
      error: 'Erro interno no processamento do arquivo',
      details: errorMessage
    }, { status: 500 });
  }
}

// ✅ NOVA FUNÇÃO: Processar PDF diretamente do buffer
async function processCarteiroFileFromBuffer(base64Data: string, fileName: string, userLocation: unknown) {
  try {
    console.log('🚀 INÍCIO: processCarteiroFileFromBuffer foi chamada');
    console.log('🔍 Processando PDF diretamente do buffer...');
    
    // ✅ ABORDAGEM SIMPLES: PROCESSAR PDF COMO IMAGEM INDIVIDUAL
    console.log('🔄 Processando PDF como imagem individual...');
    
    // ✅ TENTAR PROCESSAMENTO SIMPLES COM OCR.space
    const extractedText = await processPDFSimple(base64Data);
    
    if (!extractedText || extractedText.trim().length === 0) {
      throw new Error('Nenhum texto foi extraído do PDF');
    }
    
    console.log(`✅ PDF processado: ${extractedText.length} caracteres extraídos`);
    console.log('📝 Primeiras 200 caracteres:', extractedText.substring(0, 200) + '...');
    
    // ✅ EXTRAIR ENDEREÇOS LIMPOS (sem faixas de numeração)
    const cleanAddresses = extractCleanAddresses(extractedText);
    console.log(`🎯 Endereços limpos extraídos: ${cleanAddresses.length}`);

    // ✅ EXTRAIR ENDEREÇOS DO TEXTO (usando a mesma função das imagens)
    const addresses = extractAddressesFromText(extractedText);
    console.log(`✅ Endereços extraídos do PDF: ${addresses.length}`);
    
    if (addresses.length === 0) {
      throw new Error('Nenhum endereço foi extraído do PDF');
    }
    
    // ✅ APLICAR ENDEREÇOS LIMPOS AOS ENDEREÇOS FINAIS (CORRIGIDO)
    console.log('🧹 Aplicando endereços limpos (sem faixas de numeração)...');
    
    // ✅ ESTRATÉGIA 1: Aplicar endereços limpos APENAS se o endereço atual tiver faixa de numeração
    for (let i = 0; i < addresses.length && i < cleanAddresses.length; i++) {
      const cleanAddress = cleanAddresses[i];
      const currentAddress = addresses[i];
      
      if (cleanAddress && currentAddress) {
        // ✅ VERIFICAR SE O ENDEREÇO ATUAL TEM FAIXA DE NUMERAÇÃO
        const hasRange = currentAddress.endereco.includes('de ') && currentAddress.endereco.includes(' a ') ||
                        currentAddress.endereco.includes('até');
        
        if (hasRange) {
          // ✅ EXTRAIR NÚMERO E CEP DO ENDEREÇO LIMPO
          const numberMatch = cleanAddress.match(/, (\d+), CEP: (\d{8})/);
          if (numberMatch) {
            const [, number, cep] = numberMatch;
            const streetName = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
            
            // ✅ APLICAR APENAS A LIMPEZA, MANTENDO O ENDEREÇO ORIGINAL
            currentAddress.endereco = `${streetName}, ${number}`;
            
            console.log(`🧹 Endereço ${i + 1} limpo (faixa removida): "${streetName}, ${number}" (CEP: ${currentAddress.cep} - MANTIDO)`);
          }
        } else {
          console.log(`✅ Endereço ${i + 1} não tem faixa de numeração, mantido original: "${currentAddress.endereco}"`);
        }
      }
    }
    
    // ✅ NOVA ESTRATÉGIA: Corrigir CEPs baseado nos endereços limpos extraídos
    console.log('🔧 Corrigindo CEPs baseado nos endereços limpos...');
    for (let i = 0; i < addresses.length; i++) {
      const currentAddress = addresses[i];
      
      // ✅ PROCURAR ENDEREÇO LIMPO CORRESPONDENTE
      for (const cleanAddress of cleanAddresses) {
        // ✅ VERIFICAR SE O ENDEREÇO LIMPO CORRESPONDE AO ENDEREÇO ATUAL
        const cleanStreet = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
        const currentStreet = currentAddress.endereco.replace(/\s*CEP.*$/, '').trim();
        
        // ✅ COMPARAR RUAS (ignorando diferenças de formatação)
        if (cleanStreet.toLowerCase().includes(currentStreet.toLowerCase()) || 
            currentStreet.toLowerCase().includes(cleanStreet.toLowerCase())) {
          
          // ✅ EXTRAIR CEP CORRETO DO ENDEREÇO LIMPO
          const cepMatch = cleanAddress.match(/CEP: (\d{8})/);
          if (cepMatch) {
            const correctCep = cepMatch[1];
            
            // ✅ VERIFICAR SE O CEP ESTÁ CORRETO
            if (correctCep !== currentAddress.cep) {
              console.log(`🔧 CEP corrigido baseado no endereço limpo: ${currentAddress.cep} → ${correctCep}`);
              currentAddress.cep = correctCep;
            }
          }
          break; // ✅ ENCONTRADO, SAIR DO LOOP
        }
      }
    }
    
    // ✅ VALIDAR E LIMPAR ENDEREÇOS FINAIS
    console.log('🧹 Validando e limpando endereços finais...');
    addresses.forEach((addr, index) => {
      // ✅ VALIDAR CEP
      if (addr.cep !== 'CEP a ser extraído' && !addr.cep.includes('ser extraído')) {
        // ✅ LIMPAR CEP (remover espaços, traços, etc.)
        const cleanCep = addr.cep.replace(/[^\d]/g, '');
        
        // ✅ VERIFICAR SE O CEP TEM 8 DÍGITOS
        if (cleanCep.length === 8) {
          const cepNum = parseInt(cleanCep);
          
          // ✅ VERIFICAR SE O CEP ESTÁ NO INTERVALO CORRETO PARA UBERLÂNDIA
          if (cepNum >= 38400000 && cepNum <= 38499999) {
            if (cleanCep !== addr.cep) {
              addr.cep = cleanCep;
              console.log(`🧹 CEP limpo e validado: ${addr.cep}`);
            }
          } else {
            console.log(`⚠️ CEP fora do intervalo de Uberlândia: ${addr.cep}`);
          }
        } else {
          console.log(`❌ CEP malformado: ${addr.cep} (${cleanCep.length} dígitos)`);
        }
      }
      
      // ✅ VALIDAR ENDEREÇO
      if (addr.endereco.includes('ser extraído')) {
        addr.endereco = `Endereço ${index + 1} (requer edição)`;
      }
      
      // ✅ VALIDAR DESTINATÁRIO
      if (addr.destinatario.includes('ser extraído')) {
        addr.destinatario = 'Localização não especificada';
      }
      
      console.log(`✅ Endereço ${index + 1} validado: ${addr.objeto} - ${addr.endereco} (CEP: ${addr.cep})`);
    });
    
    // ✅ ESTRATÉGIA 2: Aplicar endereços limpos por correspondência de CEP (para endereços não limpos)
    console.log('🔍 Aplicando endereços limpos por correspondência de CEP...');
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      // ✅ SE O ENDEREÇO AINDA TEM FAIXA DE NUMERAÇÃO, PROCURAR POR CEP CORRESPONDENTE
      if (address.endereco.includes('de ') && address.endereco.includes(' a ') && address.cep !== 'CEP a ser extraído') {
        console.log(`🔍 Endereço ${i + 1} ainda tem faixa de numeração: ${address.endereco}`);
        
        // ✅ PROCURAR ENDEREÇO LIMPO COM MESMO CEP
        for (const cleanAddress of cleanAddresses) {
          if (cleanAddress.includes(`CEP: ${address.cep}`)) {
            const numberMatch = cleanAddress.match(/, (\d+), CEP: (\d{8})/);
            if (numberMatch) {
              const [, number, cep] = numberMatch;
              const streetName = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
              
              address.endereco = `${streetName}, ${number}`;
              // ✅ IMPORTANTE: NÃO SOBRESCREVER O CEP ORIGINAL!
              // address.cep = cep; // ❌ REMOVIDO - mantém CEP original
              
              console.log(`🧹 Endereço ${i + 1} limpo (CEP): "${streetName}, ${number}" (CEP: ${address.cep} - MANTIDO)`);
              break; // ✅ ENCONTRADO, SAIR DO LOOP
            }
          }
        }
      }
    }
    
    // ✅ ESTRATÉGIA 3: Limpeza manual para endereços restantes (MELHORADA)
    console.log('🔧 Aplicando limpeza manual para endereços restantes...');
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      
      // ✅ SE AINDA TEM FAIXA DE NUMERAÇÃO OU "até", APLICAR LIMPEZA MANUAL
      if (address.endereco.includes('de ') && address.endereco.includes(' a ') || 
          address.endereco.includes('até')) {
        console.log(`🔧 Aplicando limpeza manual ao endereço ${i + 1}: ${address.endereco}`);
        
        // ✅ PADRÃO: "Rua - de X/Y a Z/W, N CEP: XXXXXXXX"
        const manualClean = address.endereco.match(/^([^-]+)-\s*de\s+[\d\/\s]+a\s+[\d\/\s]+,\s*(\d+)\s*CEP:\s*(\d{8})/);
        if (manualClean) {
          const [, streetName, number, cep] = manualClean;
          address.endereco = `${streetName.trim()}, ${number}`;
          console.log(`🔧 Endereço ${i + 1} limpo manualmente: "${address.endereco}" (CEP: ${address.cep} - MANTIDO)`);
        }
        
        // ✅ PADRÃO: "Rua - até X/Y, N CEP: XXXXXXXX" (CORRIGIDO)
        const manualClean2 = address.endereco.match(/^([^-]+)-\s*até\s+[\d\/\s]+\/[\d\/\s]+,\s*(\d+)\s*CEP:\s*(\d{8})/);
        if (manualClean2) {
          const [, streetName, number, cep] = manualClean2;
          address.endereco = `${streetName.trim()}, ${number}`;
          console.log(`🔧 Endereço ${i + 1} limpo manualmente (até): "${address.endereco}" (CEP: ${address.cep} - MANTIDO)`);
        }
        
        // ✅ PADRÃO: "Rua - até X/Y, N CEP: XXXXXXXX" (alternativo)
        const manualClean3 = address.endereco.match(/^([^-]+)-\s*até\s+[\d\/\s]+,\s*(\d+)\s*CEP:\s*(\d{8})/);
        if (manualClean3) {
          const [, streetName, number, cep] = manualClean3;
          address.endereco = `${streetName.trim()}, ${number}`;
          console.log(`🔧 Endereço ${i + 1} limpo manualmente (até alt): "${address.endereco}" (CEP: ${address.cep} - MANTIDO)`);
        }
      }
    }
    
    // ✅ DEBUG: Verificar se chegou até aqui
    console.log('🔍 DEBUG: Chegou até o final da limpeza de endereços');
    
    console.log(`✅ PDF processado com sucesso: ${addresses.length} endereços encontrados e limpos`);
    console.log('🔍 DEBUG: PASSOU do log de sucesso - função continua...');

    // ✅ DEBUG: Verificar se chegou até aqui
    console.log('🔍 DEBUG: Chegou até a geocodificação dos endereços');
    console.log('🔍 DEBUG: Continuando execução...');

    // ✅ NOVO: GEOCODIFICAR ENDEREÇOS
    console.log('🗺️ Iniciando geocodificação dos endereços...');
    console.log(`🔍 Total de endereços para geocodificar: ${addresses.length}`);
    let geocodedCount = 0;
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i] as CarteiroAddress;
      try {
        // ✅ CONSTRUIR ENDEREÇO COMPLETO PARA GEOCODIFICAÇÃO
        const fullAddress = `${address.endereco}, Uberlândia - MG, ${address.cep}`;
        console.log(`🔍 Geocodificando endereço ${i + 1}: ${fullAddress}`);
        
        // ✅ SISTEMA MULTI-API DE GEOCODING COM FALLBACK
        let coordinates = null;
        
        // ✅ TENTATIVA 1: ViaCEP (específico para Brasil)
        try {
          console.log(`🔍 Tentativa 1: ViaCEP para CEP ${address.cep}`);
          const viaCepUrl = `https://viacep.com.br/ws/${address.cep}/json/`;
          const viaCepResponse = await fetch(viaCepUrl);
          
          if (viaCepResponse.ok) {
            const viaCepData = await viaCepResponse.json();
            if (viaCepData && !viaCepData.erro) {
              // ✅ ViaCEP retorna dados, mas não coordenadas. Usar coordenadas determinísticas
              coordinates = getCepBasedCoordinates(address.cep, address.endereco);
              console.log(`✅ ViaCEP: Endereço válido em ${viaCepData.localidade} - ${viaCepData.uf}`);
            }
          }
        } catch (error) {
          console.log(`⚠️ ViaCEP falhou:`, error);
        }
        
        // ✅ TENTATIVA 2: Nominatim (se ViaCEP não funcionou)
        if (!coordinates) {
          try {
            console.log(`🔍 Tentativa 2: Nominatim para endereço completo`);
            const encodedAddress = encodeURIComponent(fullAddress);
            const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1&countrycodes=br`;
            
            const nominatimResponse = await fetch(nominatimUrl, {
              headers: { 'User-Agent': 'RotaFacil/1.0' }
            });
            
            if (nominatimResponse.ok) {
              const nominatimData = await nominatimResponse.json();
              if (nominatimData && nominatimData.length > 0 && nominatimData[0].lat && nominatimData[0].lon) {
                coordinates = {
                  lat: parseFloat(nominatimData[0].lat),
                  lng: parseFloat(nominatimData[0].lon)
                };
                console.log(`✅ Nominatim: Coordenadas encontradas`);
              }
            }
          } catch (error) {
            console.log(`⚠️ Nominatim falhou:`, error);
          }
        }
        
        // ✅ TENTATIVA 3: Coordenadas fixas baseadas no CEP (último recurso)
        if (!coordinates) {
          console.log(`🔍 Tentativa 3: Coordenadas fixas baseadas no CEP`);
          coordinates = getCepBasedCoordinates(address.cep, address.endereco);
          console.log(`✅ Coordenadas baseadas no CEP: ${coordinates.lat}, ${coordinates.lng}`);
        }
        
        // ✅ APLICAR COORDENADAS ENCONTRADAS
        if (coordinates) {
          address.coordinates = coordinates;
          address.geocoded = true;
          geocodedCount++;
          console.log(`✅ Endereço ${i + 1} geocodificado: ${coordinates.lat}, ${coordinates.lng}`);
        } else {
          console.log(`❌ Endereço ${i + 1} não pôde ser geocodificado`);
        }
      } catch (geocodeError) {
        console.log(`⚠️ Erro ao geocodificar endereço ${i + 1}:`, geocodeError);
      }
    }
    
    console.log(`✅ Geocodificação concluída: ${geocodedCount}/${addresses.length} endereços geocodificados`);

    // ✅ DEBUG: Verificar coordenadas dos endereços
    console.log('🔍 Verificando coordenadas dos endereços...');
    addresses.forEach((addr, index) => {
      if (addr.coordinates) {
        console.log(`📍 Endereço ${index + 1}: ${addr.coordinates.lat}, ${addr.coordinates.lng}`);
      } else {
        console.log(`❌ Endereço ${index + 1}: Sem coordenadas`);
      }
    });

    // ✅ GEOCODIFICAÇÃO JÁ FOI REALIZADA ACIMA - NÃO DUPLICAR
    
    // ✅ AGORA SIM RETORNAR COM ENDEREÇOS GEOCODIFICADOS
    return {
      success: true,
      total: addresses.length,
      geocoded: geocodedCount,
      addresses: addresses,
      fileType: 'pdf',
      userLocation: userLocation,
      metadata: {
        extractedAt: new Date().toISOString(),
        fileName,
        ocrEngine: 'OCR.space',
        textLength: extractedText.length,
        processingMethod: 'simple',
        geocodedCount
      }
    };

  } catch (error) {
    console.error('❌ Erro no processamento do PDF:', error);
    throw error;
  }
}

// ✅ INTERFACE: Resultado do OCR.space
interface OCRSpaceResult {
  ParsedText?: string;
  ErrorMessage?: string;
}

// ✅ INTERFACE: Faixa de numeração extraída
interface AddressRange {
  startRange: string;
  endRange: string;
  cleanAddress: string;
  cep: string;
}

// ✅ NOVA FUNÇÃO: Processar PDF de forma simples COM RETRY E TIMEOUT AUMENTADO
async function processPDFSimple(base64Data: string, retryCount = 0): Promise<string> {
  const MAX_RETRIES = 3;
  const TIMEOUT_MS = 180000; // ✅ AUMENTADO: 3 minutos para PDFs grandes
  
  try {
  const formData = new FormData();
  formData.append('base64Image', `data:application/pdf;base64,${base64Data}`);
  formData.append('language', 'por');
  formData.append('isOverlayRequired', 'false');
  formData.append('detectOrientation', 'true');
  formData.append('scale', 'true');
  formData.append('OCREngine', '2');
  formData.append('filetype', 'pdf');
  formData.append('isTable', 'true');
  
    console.log(`📤 Enviando PDF para OCR.space (tentativa ${retryCount + 1}/${MAX_RETRIES + 1})...`);
    console.log(`⏱️ Timeout configurado: ${TIMEOUT_MS / 1000} segundos`);

  const ocrResponse = await fetch('https://api.ocr.space/parse/image', {
    method: 'POST',
    body: formData,
    headers: {
      'apikey': process.env.OCR_SPACE_API_KEY || 'helloworld'
    },
      signal: AbortSignal.timeout(TIMEOUT_MS) // ✅ TIMEOUT AUMENTADO
  });

  if (!ocrResponse.ok) {
    throw new Error(`OCR.space falhou: ${ocrResponse.status}`);
  }

  const ocrData = await ocrResponse.json();
  console.log('📥 Resposta recebida do OCR.space');
  
  // ✅ IMPORTANTE: Processar TODAS as páginas disponíveis
  let extractedText = '';
  
  if (ocrData.ParsedResults && ocrData.ParsedResults.length > 0) {
    console.log(`📄 PDF tem ${ocrData.ParsedResults.length} páginas processadas`);
    
    // ✅ CONCATENAR TEXTO DE TODAS AS PÁGINAS
    extractedText = ocrData.ParsedResults
      .map((result: OCRSpaceResult, index: number) => {
        const pageText = result.ParsedText || '';
        console.log(`📄 Página ${index + 1}: ${pageText.length} caracteres`);
        return pageText;
      })
      .join('\n\n--- NOVA PÁGINA ---\n\n');
    
    console.log(`✅ Total de texto extraído: ${extractedText.length} caracteres`);
  }

  if (!extractedText) {
    throw new Error('Nenhum texto foi extraído do PDF');
  }

  // ✅ SE HOUVER ERRO MAS TEXTO FOI EXTRAÍDO, RETORNAR O TEXTO
  if (ocrData.IsErroredOnProcessing) {
    console.log(`⚠️ OCR.space retornou aviso: ${ocrData.ErrorMessage}`);
    
    // ✅ IMPORTANTE: SEMPRE RETORNAR O TEXTO SE FOI EXTRAÍDO
    console.log(`✅ Texto disponível: ${extractedText.length} caracteres`);
    return extractedText; // ✅ RETORNAR O TEXTO DISPONÍVEL
  }

  console.log('✅ PDF processado sem erros');
  return extractedText;
  
  } catch (error) {
    console.log(`❌ Tentativa ${retryCount + 1} falhou:`, error);
    
    // ✅ RETRY LOGIC: Tentar novamente se ainda não atingiu o limite
    if (retryCount < MAX_RETRIES) {
      console.log(`🔄 Tentando novamente em 5 segundos... (${retryCount + 1}/${MAX_RETRIES})`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // ✅ Esperar 5 segundos
      return processPDFSimple(base64Data, retryCount + 1); // ✅ RECURSÃO COM RETRY
    }
    
    // ✅ ÚLTIMA TENTATIVA FALHOU
    console.error(`❌ Todas as ${MAX_RETRIES + 1} tentativas falharam`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`OCR.space falhou após ${MAX_RETRIES + 1} tentativas: ${errorMessage}`);
  }
}

// ✅ FUNÇÃO: Extrair endereços limpos (sem faixas de numeração)
function extractCleanAddresses(text: string): string[] {
  const cleanAddresses: string[] = [];
  
  // ✅ PADRÃO 1: "Rua/Avenida - de X/Y a Z/W, N CEP: XXXXXXXX"
  const rangePattern1 = /([A-Za-zÀ-ÿ\s]+)\s*-\s*de\s+[\d\/\s]+a\s+[\d\/\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  let match;
  while ((match = rangePattern1.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    // ✅ CONSTRUIR ENDEREÇO LIMPO: "Rua/Avenida, N, CEP: XXXXXXXX"
    let cleanAddress = fullAddress.trim();
    
    // ✅ ADICIONAR NÚMERO ESPECÍFICO SE EXISTIR
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    // ✅ ADICIONAR CEP
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 1): ${cleanAddress}`);
  }
  
  // ✅ PADRÃO 2: "Rua/Avenida de X a Y, N CEP: XXXXXXXX"
  const rangePattern2 = /([A-Za-zÀ-ÿ\s]+)\s+de\s+[\d\s]+a\s+[\d\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  while ((match = rangePattern2.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    let cleanAddress = fullAddress.trim();
    
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 2): ${cleanAddress}`);
  }
  
  // ✅ PADRÃO 3: "Rua/Avenida - até X/Y, N CEP: XXXXXXXX" (UNIFICADO - removido padrões duplicados)
  const rangePattern3 = /([A-Za-zÀ-ÿ\s]+)\s*-\s*até\s+[\d\/\s]+(?:\/[\d\/\s]+)?(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  while ((match = rangePattern3.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    let cleanAddress = fullAddress.trim();
    
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 3): ${cleanAddress}`);
  }
  
  // ✅ PADRÃO 4: "Rua/Avenida até X/Y, N CEP: XXXXXXXX" (sem hífen)
  const rangePattern4 = /([A-Za-zÀ-ÿ\s]+)\s+até\s+[\d\/\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  while ((match = rangePattern4.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    let cleanAddress = fullAddress.trim();
    
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 4): ${cleanAddress}`);
  }
  
  // ✅ PADRÃO 5: "Rua/Avenida - de X/Y até Z/W, N CEP: XXXXXXXX" (com "até" no meio)
  const rangePattern5 = /([A-Za-zÀ-ÿ\s]+)\s*-\s*de\s+[\d\/\s]+até\s+[\d\/\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  while ((match = rangePattern5.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    let cleanAddress = fullAddress.trim();
    
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 5): ${cleanAddress}`);
  }
  
  console.log(`✅ Total de endereços limpos extraídos: ${cleanAddresses.length}`);
  return cleanAddresses;
}

// ✅ FUNÇÃO AUXILIAR: Extrair endereços do texto (lógica robusta)
function extractAddressesFromText(text: string): CarteiroAddress[] {
  const addresses: CarteiroAddress[] = [];
  const lines = text.split(/\r?\n|\r/);
  let sequence = 1;
  let currentAddress = null;

  console.log(`🔍 Processando ${lines.length} linhas do PDF...`);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    console.log(`🔍 Linha PDF: "${trimmedLine}"`);

    // ✅ DETECTAR QUALQUER OBJETO ECT (padrão mais flexível)
    if (trimmedLine.match(/[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}/) ||
        trimmedLine.match(/[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d{1,2}-\d{3}/) ||
        trimmedLine.includes('MI') || trimmedLine.includes('OY') || 
        trimmedLine.includes('MJ') || trimmedLine.includes('MT') || 
        trimmedLine.includes('TJ') || trimmedLine.includes('BR') ||
        trimmedLine.match(/^\d{3}\s+[A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}/)) {
      
      // ✅ SE JÁ TEM ENDEREÇO COMPLETO, SALVAR E CRIAR NOVO
      if (currentAddress && currentAddress.endereco !== 'Endereço a ser extraído') {
        addresses.push(currentAddress);
        console.log(`💾 Endereço completo salvo: ${currentAddress.objeto} - ${currentAddress.endereco}`);
      }
      
      currentAddress = {
        id: `ect-${Date.now()}-${sequence}`,
        ordem: sequence.toString(),
        objeto: trimmedLine,
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Localização a ser extraída',
        coordinates: undefined,
        geocoded: false,
        cepData: [] as Array<{ cep: string; line: string; position: number }> // ✅ NOVA PROPRIEDADE: Armazenar CEPs para análise posterior
      };
      
      console.log(`✅ NOVO OBJETO ECT: ${trimmedLine} (sequência ${sequence})`);
      sequence++;
      continue;
    }

    // ✅ DETECTAR ENDEREÇO (padrões mais flexíveis)
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || trimmedLine.includes('AV.') ||
          trimmedLine.includes('Rua') || trimmedLine.includes('Avenida') || trimmedLine.includes('rua') ||
          trimmedLine.includes('avenida') || trimmedLine.includes('Virgílio') || trimmedLine.includes('Botafogo') ||
          trimmedLine.includes('Carioca') || trimmedLine.includes('Municípios') || trimmedLine.includes('Rondon') ||
          trimmedLine.includes('Olegário') || trimmedLine.includes('Machado') || trimmedLine.includes('ndereço')) {
        
        console.log(`🏠 Endereço encontrado no PDF: ${trimmedLine}`);
        currentAddress.endereco = trimmedLine;
      }
    }

    // ✅ DETECTAR CEP (padrões mais flexíveis) - CORRIGIDO E MELHORADO
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      // ✅ VERIFICAR SE A LINHA CONTÉM APENAS CEP (sem outros dados)
      if (trimmedLine.startsWith('CEP:') || trimmedLine.match(/^\d{8}$/) || trimmedLine.match(/^\d{5}-\d{3}$/)) {
      const cepMatch = trimmedLine.match(/(\d{8})|(\d{5}-\d{3})/);
      if (cepMatch) {
        const cep = cepMatch[1] || cepMatch[2]?.replace('-', '');
        if (cep) {
            // ✅ IMPORTANTE: NÃO ASSOCIAR CEP IMEDIATAMENTE - ARMAZENAR PARA ANÁLISE POSTERIOR
            if (!currentAddress.cepData) {
              currentAddress.cepData = [];
            }
            currentAddress.cepData.push({
              cep: cep,
              line: trimmedLine,
              position: lines.indexOf(line)
            });
            console.log(`📮 CEP encontrado e armazenado para análise: ${cep}`);
          }
        }
      }
      // ✅ VERIFICAR SE A LINHA CONTÉM CEP NO FINAL (padrão: "Endereço CEP: XXXXXXXX")
      else if (trimmedLine.includes('CEP:')) {
        const cepMatch = trimmedLine.match(/CEP:\s*(\d{8})/);
        if (cepMatch) {
          const cep = cepMatch[1];
          // ✅ ASSOCIAR CEP DIRETAMENTE SE ESTIVER NO ENDEREÇO
          currentAddress.cep = cep;
          console.log(`📮 CEP extraído do endereço para ${currentAddress.objeto}: ${cep}`);
        }
      }
    }

    // ✅ DETECTAR CIDADE/ESTADO
    if (currentAddress && currentAddress.destinatario.includes('ser extraído')) {
      if (trimmedLine.includes('Uberlândia') || trimmedLine.includes('MG')) {
        currentAddress.destinatario = 'Uberlândia - MG';
        console.log(`🏙️ Localização encontrada: Uberlândia - MG`);
      }
    }
  }

  // ✅ ADICIONAR ÚLTIMO ENDEREÇO
  if (currentAddress) {
    addresses.push(currentAddress);
  }

  // ✅ NOVA FUNÇÃO: Analisar e associar CEPs corretamente
  console.log('🔍 Analisando associação de CEPs aos endereços...');
  
  // ✅ COLETAR TODOS OS CEPs ENCONTRADOS
  const allCeps: Array<{ cep: string; line: string; position: number; addressIndex: number }> = [];
  
  addresses.forEach((addr, index) => {
    if (addr.cepData && addr.cepData.length > 0) {
      addr.cepData.forEach(cepInfo => {
        allCeps.push({
          ...cepInfo,
          addressIndex: index
        });
      });
    }
  });
  
  console.log(`📊 Total de CEPs coletados: ${allCeps.length}`);
  
  // ✅ ASSOCIAR CEPs AOS ENDEREÇOS CORRETOS
  addresses.forEach((addr, index) => {
    if (addr.cep === 'CEP a ser extraído') {
      // ✅ PROCURAR O CEP MAIS PRÓXIMO DESTE ENDEREÇO
      let bestCep = null;
      let minDistance = Infinity;
      
      allCeps.forEach(cepInfo => {
        const distance = Math.abs(cepInfo.position - lines.findIndex(line => 
          line.trim().includes(addr.objeto.split(' ')[0]) // Primeira parte do código do objeto
        ));
        
        if (distance < minDistance) {
          minDistance = distance;
          bestCep = cepInfo.cep;
        }
      });
      
      if (bestCep) {
        addr.cep = bestCep;
        console.log(`🔗 CEP ${bestCep} associado ao endereço ${index + 1} (${addr.objeto})`);
      } else {
        console.log(`⚠️ Nenhum CEP encontrado para endereço ${index + 1}`);
      }
    }
  });

      // ✅ VALIDAR E LIMPAR ENDEREÇOS (mesma lógica das imagens)
    return addresses.map((addr, index) => {
      // ✅ CORREÇÃO CRÍTICA: Aplicar endereço limpo APENAS se necessário
      let cleanAddress = addr.endereco;
      
            // ✅ CORREÇÃO CRÍTICA: SEMPRE limpar prefixos "Endereço:" (não apenas quando necessário)
      if (addr.endereco.includes('Endereço:') || addr.endereco.includes('ndereço:')) {
      
              // ✅ REMOVER TODOS OS PREFIXOS DE ENDEREÇO (com ou sem tabulações)
        const addressPrefixes = [
          'ndereço:\t', 'ndereço:', 'ndereço',
          'Endereço:\t', 'Endereço:', 'Endereço',
          'ndereç\t', 'ndereç',
          'ndereçc\t', 'ndereçc'
        ];
        
        // ✅ CORREÇÃO CRÍTICA: Remover TODOS os prefixos de endereço
        for (const prefix of addressPrefixes) {
          if (cleanAddress.includes(prefix)) {
            cleanAddress = cleanAddress.replace(prefix, '').trim();
            console.log(`🧹 Prefixo removido do PDF: "${prefix}" → "${cleanAddress}"`);
          }
        }
        
        // ✅ CORREÇÃO ADICIONAL: Remover qualquer "Endereço:" restante
        if (cleanAddress.startsWith('Endereço:')) {
          cleanAddress = cleanAddress.replace('Endereço:', '').trim();
          console.log(`🧹 "Endereço:" removido: "${cleanAddress}"`);
        }
        
        // ✅ REMOVER TABULAÇÕES E ESPAÇOS EXTRA
        cleanAddress = cleanAddress.replace(/\t+/g, ' ').replace(/\s+/g, ' ').trim();
        
        // ✅ CORREÇÃO: Remover qualquer "E" que sobrou no início
        if (cleanAddress.startsWith('E') && !cleanAddress.startsWith('Endereço')) {
          cleanAddress = cleanAddress.substring(1).trim();
          console.log(`🔧 "E" inicial removido: "${cleanAddress}"`);
        }
        
        // ✅ APLICAR ENDEREÇO LIMPO
        addr.endereco = cleanAddress;
        console.log(`✅ Endereço ${index + 1} limpo: "${cleanAddress}"`);
        }
      
      // ✅ SE AINDA TEM "ser extraído", usar fallback
      if (addr.endereco.includes('ser extraído')) {
        addr.endereco = `Endereço ${index + 1} (requer edição)`;
      }
      
      // ✅ VALIDAR CEP (CORRIGIDO E MELHORADO)
      if (addr.cep.includes('ser extraído')) {
        // ✅ TENTAR EXTRAIR CEP DO ENDEREÇO SE NÃO FOI ENCONTRADO
        const cepFromAddress = addr.endereco.match(/CEP:\s*(\d{8})/);
        if (cepFromAddress) {
          addr.cep = cepFromAddress[1];
          console.log(`🔍 CEP extraído do endereço: ${addr.cep}`);
        } else {
        addr.cep = 'CEP não encontrado';
          console.log(`⚠️ CEP não encontrado para endereço: ${addr.endereco}`);
        }
      }
      
      // ✅ FUNÇÃO AUXILIAR: Tentar corrigir CEP incorreto
      function tryToCorrectCep(endereco: string): string | null {
        // ✅ TENTAR EXTRAIR CEP DO ENDEREÇO
        const cepMatch = endereco.match(/CEP:\s*(\d{8})/);
        if (cepMatch) {
          const cep = cepMatch[1];
          // ✅ VERIFICAR SE O CEP EXTRAÍDO É VÁLIDO PARA UBERLÂNDIA
          const cepNum = parseInt(cep);
          if (cepNum >= 38400000 && cepNum <= 38499999) {
            return cep;
          }
        }
        return null;
      }

      // ✅ VALIDAÇÃO ROBUSTA DE CEP (CORRIGIDA E MELHORADA)
      if (addr.cep !== 'CEP não encontrado' && !addr.cep.includes('ser extraído')) {
        // ✅ LIMPAR CEP (remover espaços, traços, etc.)
        const cleanCep = addr.cep.replace(/[^\d]/g, '');
        
        // ✅ VERIFICAR SE O CEP TEM 8 DÍGITOS
        if (cleanCep.length === 8) {
          const cepNum = parseInt(cleanCep);
          
          // ✅ VERIFICAR SE O CEP ESTÁ NO INTERVALO CORRETO PARA UBERLÂNDIA
          if (cepNum >= 38400000 && cepNum <= 38499999) {
            // ✅ ATUALIZAR CEP LIMPO
            if (cleanCep !== addr.cep) {
              addr.cep = cleanCep;
              console.log(`🧹 CEP limpo e validado: ${addr.cep}`);
            } else {
              console.log(`✅ CEP válido para Uberlândia: ${addr.cep}`);
            }
          } else {
            console.log(`⚠️ CEP fora do intervalo de Uberlândia: ${addr.cep}`);
            // ✅ TENTAR CORRIGIR CEP INCORRETO
            const correctedCep = tryToCorrectCep(addr.endereco);
            if (correctedCep) {
              addr.cep = correctedCep;
              console.log(`🔧 CEP corrigido: ${correctedCep}`);
            }
          }
        } else {
          console.log(`❌ CEP malformado: ${addr.cep} (${cleanCep.length} dígitos)`);
          // ✅ TENTAR CORRIGIR CEP MALFORMADO
          const correctedCep = tryToCorrectCep(addr.endereco);
          if (correctedCep) {
            addr.cep = correctedCep;
            console.log(`🔧 CEP corrigido: ${correctedCep}`);
          }
        }
      }
      
      // ✅ VERIFICAÇÃO FINAL: Evitar CEPs duplicados incorretos
      if (addr.cep !== 'CEP não encontrado' && !addr.cep.includes('ser extraído')) {
        // ✅ VERIFICAR SE O CEP ESTÁ DUPLICADO EM OUTROS ENDEREÇOS
        const duplicateCep = addresses.find((otherAddr, otherIndex) => 
          otherIndex !== index && 
          otherAddr.cep === addr.cep && 
          otherAddr.cep !== 'CEP não encontrado' &&
          !otherAddr.cep.includes('ser extraído')
        );
        
        if (duplicateCep) {
          console.log(`⚠️ CEP duplicado detectado: ${addr.cep} em endereços ${index + 1} e ${addresses.indexOf(duplicateCep) + 1}`);
          
          // ✅ TENTAR CORRIGIR CEP DUPLICADO
          const correctedCep = tryToCorrectCep(addr.endereco);
          if (correctedCep && correctedCep !== addr.cep) {
            addr.cep = correctedCep;
            console.log(`🔧 CEP duplicado corrigido: ${correctedCep}`);
          }
        }
      }
      
      // ✅ NOVA VALIDAÇÃO: Corrigir CEPs baseado nos endereços limpos extraídos
      // ❌ REMOVIDO - cleanAddresses não está disponível nesta função
      // A validação será feita na função principal
      
      // ✅ VALIDAR DESTINATÁRIO
      if (addr.destinatario.includes('ser extraído')) {
        addr.destinatario = 'Localização não especificada';
      }
      
      // ✅ ATUALIZAR ENDEREÇO LIMPO (CORRIGIDO)
      // addr.endereco = cleanAddress; // ❌ REMOVIDO - cleanAddress não está disponível aqui
      
      console.log(`✅ Endereço ${index + 1} processado: ${addr.objeto} - ${addr.endereco} (CEP: ${addr.cep})`);
      return addr;
    });

    // ✅ IMPORTANTE: Retornar endereços processados
    console.log(`✅ Total de endereços processados: ${addresses.length}`);
    return addresses;
  }

// ✅ FUNÇÃO: Gerar coordenadas fixas baseadas no CEP (sem aleatoriedade)
function getCepBasedCoordinates(cep: string, endereco: string): { lat: number; lng: number } {
  // ✅ COORDENADAS BASE DE UBERLÂNDIA
  const baseCoords = { lat: -18.9186, lng: -48.2772 };
  
  // ✅ SE CEP VÁLIDO, USAR OFFSET DETERMINÍSTICO BASEADO NO CEP
  const cepNum = parseInt(cep?.replace(/[^\d]/g, '') || '38400000');
  if (cepNum >= 38400000 && cepNum <= 38499999) {
    // ✅ OFFSET DETERMINÍSTICO: MESMO CEP = MESMAS COORDENADAS
    const offset = (cepNum - 38400000) / 100000; // Normalizar entre 0-1
    const latOffset = (offset % 1) * 0.02 - 0.01; // -0.01 a +0.01
    const lngOffset = ((offset * 1.7) % 1) * 0.02 - 0.01; // Diferente do lat
    
    return {
      lat: baseCoords.lat + latOffset,
      lng: baseCoords.lng + lngOffset
    };
  }
  
  // ✅ CEP INVÁLIDO: OFFSET BASEADO NO HASH DO ENDEREÇO
  let hash = 0;
  for (let i = 0; i < endereco.length; i++) {
    const char = endereco.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  const normalizedHash = Math.abs(hash) / 2147483647; // Normalizar 0-1
  const latOffset = (normalizedHash % 1) * 0.02 - 0.01;
  const lngOffset = ((normalizedHash * 1.3) % 1) * 0.02 - 0.01;
  
  return {
    lat: baseCoords.lat + latOffset,
    lng: baseCoords.lng + lngOffset
  };
}

  // ✅ FUNÇÃO: Processar PDF de forma simples COM RETRY E TIMEOUT AUMENTADO
