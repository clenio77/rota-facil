/**
 * 🚚 PDF Extractor para Listas de Carteiro
 * 
 * Extrai endereços de PDFs dos Correios e geocodifica para gerar pontos no mapa
 */

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Extrai texto de um arquivo PDF usando pdftotext
 */
async function extractTextFromPDF(pdfPath) {
  try {
    const { stdout } = await execAsync(`pdftotext "${pdfPath}" -`);
    return stdout;
  } catch (error) {
    console.error('Erro ao extrair texto do PDF:', error);
    throw new Error('Falha na extração do PDF');
  }
}

/**
 * Limpa e normaliza um endereço removendo informações extras dos Correios
 */
function cleanAddress(address) {
  return address
    // Remover informações de faixa de numeração dos Correios
    .replace(/\s*-\s*de\s+\d+\/\d+\s+a\s+\d+\/\d+/gi, '')
    // Remover informações extras como "até X/Y"
    .replace(/\s*-\s*até\s+\d+\/\d+/gi, '')
    // Limpar espaços extras
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrai endereços de uma lista de carteiro dos Correios
 */
function extractAddressesFromCarteiro(pdfText) {
  const addresses = [];
  const lines = pdfText.split('\n');

  let currentItem = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detectar início de um novo item (formato: "001 MG 054 429 022 BR 1-7")
    const itemMatch = line.match(/^(\d{3})\s+([A-Z]{2}\s+\d{3}\s+\d{3}\s+\d{3}\s+BR\s+\d+-\d+)/);
    if (itemMatch) {
      if (currentItem) {
        addresses.push(currentItem);
      }

      currentItem = {
        ordem: itemMatch[1],
        objeto: itemMatch[2],
        endereco: null,
        cep: null,
        destinatario: null
      };
      continue;
    }

    // Extrair endereço (linha que contém rua/avenida e número)
    if (currentItem && !currentItem.endereco) {
      // Procurar por padrões de endereço
      if (line.match(/^(Rua|Avenida|Av\.|R\.|Travessa|Trav\.|Alameda|Al\.)/i)) {
        currentItem.endereco = cleanAddress(line);
        continue;
      }

      // Ou endereços que começam com nome de rua
      if (line.match(/^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ][a-záàâãéêíóôõúç\s]+,\s*\d+/)) {
        currentItem.endereco = cleanAddress(line);
        continue;
      }
    }

    // Extrair CEP (formato: "CEP: 38400688")
    const cepMatch = line.match(/CEP:\s*(\d{8})/);
    if (cepMatch && currentItem) {
      currentItem.cep = cepMatch[1];
      continue;
    }

    // Extrair destinatário
    if (line.startsWith('Destinatário:') && currentItem) {
      const destinatario = line.replace('Destinatário:', '').trim();
      if (destinatario) {
        currentItem.destinatario = destinatario;
      }
      continue;
    }
  }

  // Adicionar último item
  if (currentItem) {
    addresses.push(currentItem);
  }

  // Debug: mostrar o que foi extraído
  console.log('📋 Debug - Endereços extraídos:', addresses.map(addr => ({
    ordem: addr.ordem,
    objeto: addr.objeto,
    endereco: addr.endereco,
    cep: addr.cep
  })));

  // Filtrar apenas endereços válidos
  return addresses.filter(item => item.endereco && item.cep);
}

/**
 * Geocodifica um endereço usando a API de busca do sistema
 */
async function geocodeAddress(endereco, cep, userLocation) {
  try {
    const query = `${endereco}, CEP ${cep}`;
    
    const response = await fetch('http://localhost:3000/api/address-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        userLocation,
        limit: 1
      })
    });
    
    const data = await response.json();
    
    if (data.success && data.results && data.results.length > 0) {
      const result = data.results[0];
      return {
        lat: result.lat,
        lng: result.lng,
        display_name: result.display_name,
        confidence: result.confidence
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Erro ao geocodificar ${endereco}:`, error);
    return null;
  }
}

/**
 * Processa um PDF de carteiro e retorna endereços geocodificados
 */
async function processCarteiroPDF(pdfPath, userLocation = null) {
  try {
    console.log('🔍 Extraindo texto do PDF...');
    const pdfText = await extractTextFromPDF(pdfPath);
    
    console.log('📍 Extraindo endereços...');
    const addresses = extractAddressesFromCarteiro(pdfText);
    
    console.log(`✅ Encontrados ${addresses.length} endereços`);
    
    // Geocodificar endereços
    console.log('🌍 Geocodificando endereços...');
    const geocodedAddresses = [];
    
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      console.log(`📍 Geocodificando ${i + 1}/${addresses.length}: ${address.endereco}`);
      
      const coords = await geocodeAddress(address.endereco, address.cep, userLocation);
      
      geocodedAddresses.push({
        ...address,
        coordinates: coords,
        geocoded: coords !== null
      });
      
      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const successCount = geocodedAddresses.filter(addr => addr.geocoded).length;
    console.log(`✅ Geocodificação concluída: ${successCount}/${addresses.length} endereços`);
    
    return {
      success: true,
      total: addresses.length,
      geocoded: successCount,
      addresses: geocodedAddresses,
      metadata: {
        extractedAt: new Date().toISOString(),
        pdfPath,
        userLocation
      }
    };
    
  } catch (error) {
    console.error('Erro ao processar PDF do carteiro:', error);
    return {
      success: false,
      error: error.message,
      addresses: []
    };
  }
}

/**
 * Gera dados para visualização no mapa
 */
function generateMapData(geocodedAddresses) {
  const validAddresses = geocodedAddresses.filter(addr => addr.geocoded);
  
  const mapPoints = validAddresses.map((addr, index) => ({
    id: `carteiro-${addr.ordem}`,
    position: {
      lat: addr.coordinates.lat,
      lng: addr.coordinates.lng
    },
    title: `${addr.ordem}. ${addr.endereco}`,
    description: `CEP: ${addr.cep}${addr.destinatario ? `\nDestinatário: ${addr.destinatario}` : ''}`,
    type: 'delivery',
    order: parseInt(addr.ordem),
    trackingCode: addr.objeto,
    confidence: addr.coordinates.confidence
  }));
  
  // Calcular centro do mapa
  if (mapPoints.length > 0) {
    const avgLat = mapPoints.reduce((sum, point) => sum + point.position.lat, 0) / mapPoints.length;
    const avgLng = mapPoints.reduce((sum, point) => sum + point.position.lng, 0) / mapPoints.length;
    
    return {
      center: { lat: avgLat, lng: avgLng },
      zoom: 14,
      points: mapPoints,
      bounds: calculateBounds(mapPoints)
    };
  }
  
  return {
    center: { lat: -18.9186, lng: -48.2772 }, // Uberlândia como padrão
    zoom: 12,
    points: [],
    bounds: null
  };
}

/**
 * Calcula os limites (bounds) para ajustar o zoom do mapa
 */
function calculateBounds(points) {
  if (points.length === 0) return null;
  
  const lats = points.map(p => p.position.lat);
  const lngs = points.map(p => p.position.lng);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lngs),
    west: Math.min(...lngs)
  };
}

module.exports = {
  extractTextFromPDF,
  extractAddressesFromCarteiro,
  geocodeAddress,
  processCarteiroPDF,
  generateMapData,
  calculateBounds
};
