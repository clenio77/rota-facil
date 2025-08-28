// 🧪 TESTE DE TODOS OS PADRÕES DE ENDEREÇOS
// Este arquivo testa se todos os padrões estão sendo capturados corretamente

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

// ✅ TESTE COM TODOS OS PADRÕES ENCONTRADOS
console.log('🧪 TESTANDO TODOS OS PADRÕES DE ENDEREÇOS...');

const testText = `
Item 013 - 014 AC 973 482 100 BR 13-
CEP: 38400650
Endereço:
Rua Rio Grande do Sul - de 240/241 a 1533/1534, 956 CEP: 38400650
Coordenadas: -18.923158, -48.276664

Item 014 - 015 AC 973 768 535 BR • 14-
CEP: 38400650
Endereço:
Rua Rio Grande do Sul - de 240/241 a 1533/1534, 908 CEP: 38400650
Coordenadas: -18.915521, -48.279131

Item 015 - 016 BW 147 223 459 BR 15-
CEP: 38400704
Endereço:
Avenida Floriano Peixoto - de 3070/3071 a 4242/4243, 3283 CEP: 38400704
Coordenadas: -18.917106, -48.278270

Item 016 - 017 BW 147 223 312 BR 16-
CEP: 38400734
Endereço:
Avenida Amazonas - até 1469/1470, 232 CEP: 38400734
Coordenadas: -18.921621, -48.275986

Avenida João Pinheiro - de 1148/1149 a 2500/2501, 1783 CEP: 38400712
Rua das Flores de 100 a 200, 150 CEP: 38400100
Avenida Brasil até 500/600, 550 CEP: 38400200
`;

console.log('📝 Texto de teste:');
console.log(testText);

const cleanAddresses = extractCleanAddresses(testText);

console.log('\n✅ RESULTADO:');
cleanAddresses.forEach((address, index) => {
  console.log(`${index + 1}. ${address}`);
});

console.log('\n🎯 VERIFICAÇÃO:');
console.log('✅ Todos os padrões devem ser capturados e limpos');
console.log('✅ As faixas de numeração devem ser removidas');
console.log('✅ O formato deve ser: "Rua/Avenida, Número, CEP: XXXXXXXX"');
console.log('✅ Padrões testados:');
console.log('   - "Rua - de X/Y a Z/W, N CEP: XXXXXXXX"');
console.log('   - "Rua de X a Y, N CEP: XXXXXXXX"');
console.log('   - "Rua - até X/Y, N CEP: XXXXXXXX"');
console.log('   - "Rua até X/Y, N CEP: XXXXXXXX"');
console.log('   - "Rua - de X/Y até Z/W, N CEP: XXXXXXXX"');
