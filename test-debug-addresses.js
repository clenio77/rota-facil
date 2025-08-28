// 🧪 TESTE DE DEBUG: Problema de correspondência entre endereços limpos e endereços do PDF

// ✅ FUNÇÃO: Extrair endereços limpos (sem faixas de numeração)
function extractCleanAddresses(text) {
  const cleanAddresses = [];
  
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
  
  // ✅ PADRÃO 3: "Rua/Avenida - até X/Y, N CEP: XXXXXXXX" (novo padrão encontrado)
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

// ✅ SIMULAR A FUNÇÃO extractAddressesFromText (versão simplificada)
function extractAddressesFromText(text) {
  const addresses = [];
  const lines = text.split(/\r?\n|\r/);
  let sequence = 1;
  let currentAddress = null;

  console.log(`🔍 Processando ${lines.length} linhas do PDF...`);

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.length < 3) continue;

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
        objeto: trimmedLine,
        endereco: 'Endereço a ser extraído',
        cep: 'CEP a ser extraído',
        destinatario: 'Destinatário a ser extraído'
      };
      
      sequence++;
      console.log(`📦 Novo objeto ECT detectado: ${trimmedLine}`);
    }

    // ✅ DETECTAR ENDEREÇO
    if (currentAddress && currentAddress.endereco.includes('ser extraído')) {
      if (trimmedLine.includes('RUA') || trimmedLine.includes('AVENIDA') || trimmedLine.includes('AV.') ||
          trimmedLine.includes('Rua') || trimmedLine.includes('Avenida') || trimmedLine.includes('rua') ||
          trimmedLine.includes('avenida')) {
        
        console.log(`🏠 Endereço encontrado no PDF: ${trimmedLine}`);
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
          console.log(`📮 CEP encontrado: ${cep}`);
        }
      }
    }
  }

  // ✅ ADICIONAR ÚLTIMO ENDEREÇO
  if (currentAddress) {
    addresses.push(currentAddress);
  }

  return addresses;
}

// ✅ TESTE COM TEXTO REAL DO PDF
console.log('🧪 TESTE DE DEBUG: Problema de correspondência entre endereços limpos e endereços do PDF...');

const testText = `
Item 011 - 011 OY 525 071 576 BR 11-
CEP: 38400617
Endereço:
Rua Rio Grande do Sul - de 240/241 a 1533/1534, 956 CEP: 38400650
Coordenadas: -18.923158, -48.276664

Item 012 - 012 AC 969 593 206 BR. 12-X 013 AC 969 593 104 BR 12-X
CEP: 38400650
Endereço:
Rua Rio Grande do Sul - de 240/241 a 1533/1534, 908 CEP: 38400650
Coordenadas: -18.915521, -48.279131

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

Item 015 - 016 BW 147 223 459 BR 15-
CEP: 38400679
Endereço:
Avenida Floriano Peixoto - de 3070/3071 a 4242/4243, 3283 CEP: 38400704
Coordenadas: -18.917106, -48.278270
`;

console.log('📝 Texto de teste:');
console.log(testText);

// ✅ EXTRAIR ENDEREÇOS LIMPOS
console.log('\n🎯 EXTRAINDO ENDEREÇOS LIMPOS...');
const cleanAddresses = extractCleanAddresses(testText);

// ✅ EXTRAIR ENDEREÇOS DO TEXTO
console.log('\n🔍 EXTRAINDO ENDEREÇOS DO TEXTO...');
const addresses = extractAddressesFromText(testText);

console.log(`\n📊 RESUMO:`);
console.log(`- Endereços limpos extraídos: ${cleanAddresses.length}`);
console.log(`- Endereços do PDF extraídos: ${addresses.length}`);

// ✅ SIMULAR A APLICAÇÃO DOS ENDEREÇOS LIMPOS
console.log('\n🧹 APLICANDO ENDEREÇOS LIMPOS...');
for (let i = 0; i < addresses.length && i < cleanAddresses.length; i++) {
  const cleanAddress = cleanAddresses[i];
  if (cleanAddress) {
    // ✅ EXTRAIR NÚMERO E CEP DO ENDEREÇO LIMPO
    const numberMatch = cleanAddress.match(/, (\d+), CEP: (\d{8})/);
    if (numberMatch) {
      const [, number, cep] = numberMatch;
      const streetName = cleanAddress.replace(/, \d+, CEP: \d{8}/, '').trim();
      
      addresses[i].endereco = `${streetName}, ${number}`;
      addresses[i].cep = cep;
      
      console.log(`🧹 Endereço ${i + 1} limpo: "${streetName}, ${number}" (CEP: ${cep})`);
    }
  }
}

// ✅ MOSTRAR RESULTADO FINAL
console.log('\n✅ RESULTADO FINAL:');
addresses.forEach((address, index) => {
  console.log(`${index + 1}. ${address.objeto}`);
  console.log(`   Endereço: ${address.endereco}`);
  console.log(`   CEP: ${address.cep}`);
  console.log('');
});

console.log('\n🎯 DIAGNÓSTICO:');
if (cleanAddresses.length < addresses.length) {
  console.log(`❌ PROBLEMA: Apenas ${cleanAddresses.length} endereços limpos para ${addresses.length} endereços do PDF`);
  console.log(`💡 SOLUÇÃO: A função extractCleanAddresses não está capturando todos os padrões`);
} else if (cleanAddresses.length > addresses.length) {
  console.log(`⚠️ AVISO: ${cleanAddresses.length} endereços limpos para ${addresses.length} endereços do PDF`);
  console.log(`💡 SOLUÇÃO: Alguns endereços limpos não serão aplicados`);
} else {
  console.log(`✅ PERFEITO: ${cleanAddresses.length} endereços limpos para ${addresses.length} endereços do PDF`);
}
