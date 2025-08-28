// 🧪 TESTE: Correção do CEP e Localização do Dispositivo

// ✅ SIMULAR A FUNÇÃO extractCleanAddresses CORRIGIDA
function extractCleanAddresses(text) {
  const cleanAddresses = [];
  
  // ✅ PADRÃO 1: "Rua/Avenida - de X/Y a Z/W, N CEP: XXXXXXXX"
  const rangePattern1 = /([A-Za-zÀ-ÿ\s]+)\s*-\s*de\s+[\d\/\s]+a\s+[\d\/\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
  let match;
  while ((match = rangePattern1.exec(text)) !== null) {
    const [, fullAddress, singleNumber, cep] = match;
    
    let cleanAddress = fullAddress.trim();
    
    if (singleNumber) {
      cleanAddress += `, ${singleNumber}`;
    }
    
    cleanAddress += `, CEP: ${cep}`;
    
    cleanAddresses.push(cleanAddress);
    
    console.log(`🎯 Endereço limpo extraído (padrão 1): ${cleanAddress}`);
  }
  
  // ✅ PADRÃO 3: "Rua/Avenida - até X/Y, N CEP: XXXXXXXX"
  const rangePattern3 = /([A-Za-zÀ-ÿ\s]+)\s*-\s*até\s+[\d\/\s]+(?:,\s*(\d+))?\s*CEP:\s*(\d{8})/g;
  
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
  
  console.log(`✅ Total de endereços limpos extraídos: ${cleanAddresses.length}`);
  return cleanAddresses;
}

// ✅ SIMULAR A FUNÇÃO extractAddressesFromText
function extractAddressesFromText(text) {
  const addresses = [];
  const lines = text.split(/\r?\n|\r/);
  let sequence = 1;
  let currentAddress = null;

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

    // ✅ DETECTAR OBJETO ECT
    if (trimmedLine.match(/[A-Z]{1,2}\s+\d{3}\s+\d{3}\s+\d{3}/) ||
        trimmedLine.includes('MI') || trimmedLine.includes('OY') || 
        trimmedLine.includes('MJ') || trimmedLine.includes('MT') || 
        trimmedLine.includes('TJ') || trimmedLine.includes('BR')) {
      
      if (currentAddress && currentAddress.endereco !== 'Endereço a ser extraído') {
        addresses.push(currentAddress);
      }
      
      currentAddress = {
        id: `ect-${Date.now()}-${sequence}`,
        objeto: trimmedLine,
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Destinatário a ser extraído'
      };
      
      sequence++;
    }

    // ✅ DETECTAR ENDEREÇO
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || 
          trimmedLine.includes('Rua') || trimmedLine.includes('Avenida')) {
        
        currentAddress.endereco = trimmedLine;
      }
    }

    // ✅ DETECTAR CEP
    if (currentAddress && currentAddress.cep.includes('ser extraído')) {
      const cepMatch = trimmedLine.match(/(\d{8})|(\d{5}-\d{3})/);
      if (cepMatch) {
        const cep = cepMatch[1] || cepMatch[2]?.replace('-', '');
        if (cep) {
          currentAddress.cep = cep;
        }
      }
    }
  }

  if (currentAddress) {
    addresses.push(currentAddress);
  }

  return addresses;
}

// ✅ SIMULAR A APLICAÇÃO DOS ENDEREÇOS LIMPOS (CORRIGIDA)
function applyCleanAddresses(addresses, cleanAddresses) {
  console.log('🧹 Aplicando endereços limpos (CORRIGIDA)...');
  
  // ✅ ESTRATÉGIA 1: Aplicar endereços limpos por correspondência de índice
  for (let i = 0; i < addresses.length && i < cleanAddresses.length; i++) {
    const cleanAddress = cleanAddresses[i];
    if (cleanAddress) {
      const numberMatch = cleanAddress.match(/, (\d+), CEP: (\d{8})/);
      if (numberMatch) {
        const [, number, cep] = numberMatch;
        const streetName = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
        
        addresses[i].endereco = `${streetName}, ${number}`;
        // ✅ IMPORTANTE: NÃO SOBRESCREVER O CEP ORIGINAL!
        // addresses[i].cep = cep; // ❌ REMOVIDO - mantém CEP original
        
        console.log(`🧹 Endereço ${i + 1} limpo (índice): "${streetName}, ${number}" (CEP: ${addresses[i].cep} - MANTIDO)`);
      }
    }
  }
  
  // ✅ ESTRATÉGIA 2: Aplicar endereços limpos por correspondência de CEP
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    if (address.endereco.includes('de ') && address.endereco.includes(' a ') && address.cep !== 'CEP a ser extraído') {
      console.log(`🔍 Endereço ${i + 1} ainda tem faixa de numeração: ${address.endereco}`);
      
      for (const cleanAddress of cleanAddresses) {
        if (cleanAddress.includes(`CEP: ${address.cep}`)) {
          const numberMatch = cleanAddress.match(/, (\d+), CEP: (\d{8})/);
          if (numberMatch) {
            const [, number, cep] = numberMatch;
            const streetName = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
            
            address.endereco = `${streetName}, ${number}`;
            // ✅ IMPORTANTE: NÃO SOBRESCREVER O CEP ORIGINAL!
            console.log(`🧹 Endereço ${i + 1} limpo (CEP): "${streetName}, ${number}" (CEP: ${address.cep} - MANTIDO)`);
            break;
          }
        }
      }
    }
  }
  
  // ✅ ESTRATÉGIA 3: Limpeza manual para endereços restantes
  for (let i = 0; i < addresses.length; i++) {
    const address = addresses[i];
    
    if (address.endereco.includes('de ') && address.endereco.includes(' a ')) {
      console.log(`🔧 Aplicando limpeza manual ao endereço ${i + 1}: ${address.endereco}`);
      
      const manualClean = address.endereco.match(/^([^-]+)-\s*de\s+[\d\/\s]+a\s+[\d\/\s]+,\s*(\d+)\s*CEP:\s*(\d{8})/);
      if (manualClean) {
        const [, streetName, number, cep] = manualClean;
        address.endereco = `${streetName.trim()}, ${number}`;
        // ✅ IMPORTANTE: NÃO SOBRESCREVER O CEP ORIGINAL!
        console.log(`🔧 Endereço ${i + 1} limpo manualmente: "${address.endereco}" (CEP: ${address.cep} - MANTIDO)`);
      }
      
      const manualClean2 = address.endereco.match(/^([^-]+)-\s*até\s+[\d\/\s]+,\s*(\d+)\s*CEP:\s*(\d{8})/);
      if (manualClean2) {
        const [, streetName, number, cep] = manualClean2;
        address.endereco = `${streetName.trim()}, ${number}`;
        // ✅ IMPORTANTE: NÃO SOBRESCREVER O CEP ORIGINAL!
        console.log(`🔧 Endereço ${i + 1} limpo manualmente: "${address.endereco}" (CEP: ${address.cep} - MANTIDO)`);
      }
    }
  }
}

// ✅ SIMULAR A FUNÇÃO generateOptimizedRoute
function generateOptimizedRoute(addresses, userLocation) {
  console.log('🚀 Iniciando roteamento automático inteligente...');
  console.log('📍 Localização recebida como parâmetro:', userLocation);

  // ✅ CAPTURAR LOCALIZAÇÃO AUTOMATICAMENTE
  let startLocation = userLocation;
  
  if (!startLocation) {
    console.log('📍 Localização do usuário não fornecida, usando coordenadas padrão de Uberlândia');
    startLocation = { lat: -18.9186, lng: -48.2772, city: 'Uberlândia', state: 'MG' };
  }
  
  console.log(`📍 Ponto inicial definido: ${startLocation.lat}, ${startLocation.lng}`);
  console.log('📍 Localização completa do startLocation:', JSON.stringify(startLocation, null, 2));

  // ✅ VALIDAR ENDEREÇOS
  if (!addresses || addresses.length === 0) {
    console.log('⚠️ Nenhum endereço para otimizar');
    return {
      success: false,
      error: 'Nenhum endereço encontrado para otimização'
    };
  }
  
  // ✅ FILTRAR ENDEREÇOS COM COORDENADAS
  const validAddresses = addresses.filter(addr => 
    addr.coordinates && addr.coordinates.lat && addr.coordinates.lng
  );
  
  if (validAddresses.length === 0) {
    console.log('⚠️ Nenhum endereço com coordenadas válidas');
    return {
      success: false,
      error: 'Nenhum endereço com coordenadas válidas encontrado'
    };
  }
  
  console.log(`✅ ${validAddresses.length} endereços válidos para otimização`);
  
  // ✅ SIMULAR ROTA OTIMIZADA
  const optimizedRoute = [
    {
      id: 'start',
      ordem: '0',
      objeto: 'PONTO INICIAL',
      endereco: 'Sua Localização',
      cep: 'N/A',
      destinatario: 'Ponto de Partida',
      coordinates: startLocation,
      geocoded: true,
      isStartPoint: true
    },
    ...validAddresses,
    {
      id: 'end',
      ordem: String(validAddresses.length + 1).padStart(3, '0'),
      objeto: 'PONTO FINAL',
      endereco: 'Sua Localização',
      cep: 'N/A',
      destinatario: 'Ponto de Chegada',
      coordinates: startLocation,
      geocoded: true,
      isEndPoint: true
    }
  ];
  
  console.log('✅ Rota com pontos inicial/final:', optimizedRoute.length, 'pontos');
  console.log('📍 Ponto inicial:', optimizedRoute[0]);
  console.log('📍 Ponto final:', optimizedRoute[optimizedRoute.length - 1]);
  
  return {
    success: true,
    optimizedRoute,
    startLocation,
    totalStops: optimizedRoute.length
  };
}

// ✅ TESTE COM TEXTO REAL DO PDF
console.log('🧪 TESTE: Correção do CEP e Localização do Dispositivo...');

const testText = `
Item 011 - 011 OY 525 071 576 BR 11-
CEP: 38400617
Endereço:
Rua Rio Grande do Sul - de 240/241 a 1533/1534, 956 CEP: 38400650
Coordenadas: -18.923158, -48.276664

Item 013 - 014 AC 973 482 100 BR 13-
CEP: 38400704
Endereço:
Avenida Floriano Peixoto - de 3070/3071 a 4242/4243, 3283 CEP: 38400704
Coordenadas: -18.917106, -48.278270

Item 014 - 015 AC 973 768 535 BR • 14-
CEP: 38400734
Endereço:
Avenida Amazonas - até 1469/1470, 232 CEP: 38400734
Coordenadas: -18.921621, -48.275986
`;

// ✅ SIMULAR LOCALIZAÇÃO DO USUÁRIO
const userLocation = {
  lat: -18.9186,
  lng: -48.2772,
  city: 'Uberlândia',
  state: 'MG'
};

console.log('📝 Texto de teste:');
console.log(testText);

console.log('📍 Localização do usuário:', userLocation);

// ✅ EXTRAIR ENDEREÇOS LIMPOS
console.log('\n🎯 EXTRAINDO ENDEREÇOS LIMPOS...');
const cleanAddresses = extractCleanAddresses(testText);

// ✅ EXTRAIR ENDEREÇOS DO TEXTO
console.log('\n🔍 EXTRAINDO ENDEREÇOS DO TEXTO...');
const addresses = extractAddressesFromText(testText);

console.log(`\n📊 RESUMO:`);
console.log(`- Endereços limpos extraídos: ${cleanAddresses.length}`);
console.log(`- Endereços do PDF extraídos: ${addresses.length}`);

// ✅ APLICAR ENDEREÇOS LIMPOS (CORRIGIDA)
console.log('\n🧹 APLICANDO ENDEREÇOS LIMPOS (CORRIGIDA)...');
applyCleanAddresses(addresses, cleanAddresses);

// ✅ SIMULAR COORDENADAS PARA TESTE
addresses.forEach((address, index) => {
  address.coordinates = {
    lat: -18.9186 + (Math.random() - 0.5) * 0.01,
    lng: -48.2772 + (Math.random() - 0.5) * 0.01
  };
  address.geocoded = true;
});

// ✅ GERAR ROTA OTIMIZADA
console.log('\n🚀 GERANDO ROTA OTIMIZADA...');
const optimizedRoute = generateOptimizedRoute(addresses, userLocation);

// ✅ MOSTRAR RESULTADO FINAL
console.log('\n✅ RESULTADO FINAL:');
addresses.forEach((address, index) => {
  console.log(`${index + 1}. ${address.objeto}`);
  console.log(`   Endereço: ${address.endereco}`);
  console.log(`   CEP: ${address.cep}`);
  console.log(`   Coordenadas: ${address.coordinates.lat}, ${address.coordinates.lng}`);
  console.log('');
});

console.log('\n🎯 VERIFICAÇÃO FINAL:');
console.log('✅ CEPs originais mantidos:', addresses.every(addr => addr.cep !== 'CEP a ser extraído'));
console.log('✅ Endereços limpos (sem faixas):', addresses.every(addr => !addr.endereco.includes('de ') || !addr.endereco.includes(' a ')));
console.log('✅ Localização do usuário usada:', optimizedRoute.startLocation === userLocation);
console.log('✅ Rota com ponto inicial/final:', optimizedRoute.optimizedRoute[0].isStartPoint && optimizedRoute.optimizedRoute[optimizedRoute.optimizedRoute.length - 1].isEndPoint);

console.log('\n🚀 ROTA OTIMIZADA:');
console.log(`- Total de pontos: ${optimizedRoute.totalStops}`);
console.log(`- Ponto inicial: ${optimizedRoute.optimizedRoute[0].endereco} (${optimizedRoute.optimizedRoute[0].coordinates.lat}, ${optimizedRoute.optimizedRoute[0].coordinates.lng})`);
console.log(`- Ponto final: ${optimizedRoute.optimizedRoute[optimizedRoute.optimizedRoute.length - 1].endereco} (${optimizedRoute.optimizedRoute[optimizedRoute.optimizedRoute.length - 1].coordinates.lat}, ${optimizedRoute.optimizedRoute[optimizedRoute.optimizedRoute.length - 1].coordinates.lng})`);
