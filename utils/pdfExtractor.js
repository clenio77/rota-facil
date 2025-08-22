/**
 * 🚚 Universal File Extractor para Listas de Carteiro
 *
 * Extrai endereços de múltiplos formatos (PDF, XLS, CSV, KML, XML) e geocodifica para gerar pontos no mapa
 */

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const XLSX = require('xlsx');
const Papa = require('papaparse');
const { XMLParser } = require('fast-xml-parser');

const execAsync = util.promisify(exec);

/**
 * Detecta o tipo de arquivo baseado na extensão
 */
function detectFileType(filename) {
  const ext = filename.toLowerCase().split('.').pop();

  const typeMap = {
    'pdf': 'pdf',
    'xls': 'excel',
    'xlsx': 'excel',
    'csv': 'csv',
    'kml': 'kml',
    'gpx': 'gpx',
    'xml': 'xml',
    'json': 'json',
    'txt': 'text'
  };

  return typeMap[ext] || 'unknown';
}

/**
 * Extrai dados de planilhas Excel/CSV
 */
function extractFromSpreadsheet(filePath, fileType) {
  try {
    let workbook;

    if (fileType === 'csv') {
      const csvData = fs.readFileSync(filePath, 'utf8');
      const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
      return parsed.data;
    } else {
      workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      return XLSX.utils.sheet_to_json(worksheet);
    }
  } catch (error) {
    console.error('Erro ao processar planilha:', error);
    return [];
  }
}

/**
 * Extrai coordenadas de arquivos KML
 */
function extractFromKML(filePath) {
  try {
    const kmlData = fs.readFileSync(filePath, 'utf8');
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_'
    });

    const result = parser.parse(kmlData);
    const placemarks = [];

    // Navegar pela estrutura KML
    const kml = result.kml || result;
    const document = kml.Document || kml;
    const folders = document.Folder || [];
    const directPlacemarks = document.Placemark || [];

    // Processar placemarks diretos
    if (Array.isArray(directPlacemarks)) {
      placemarks.push(...directPlacemarks);
    } else if (directPlacemarks) {
      placemarks.push(directPlacemarks);
    }

    // Processar folders
    if (Array.isArray(folders)) {
      folders.forEach(folder => {
        const folderPlacemarks = folder.Placemark || [];
        if (Array.isArray(folderPlacemarks)) {
          placemarks.push(...folderPlacemarks);
        } else if (folderPlacemarks) {
          placemarks.push(folderPlacemarks);
        }
      });
    }

    return placemarks.map((placemark, index) => {
      const name = placemark.name || `Ponto ${index + 1}`;
      const description = placemark.description || '';

      // Extrair coordenadas
      let coordinates = null;
      if (placemark.Point && placemark.Point.coordinates) {
        const coords = placemark.Point.coordinates.split(',');
        coordinates = {
          lng: parseFloat(coords[0]),
          lat: parseFloat(coords[1])
        };
      }

      return {
        ordem: String(index + 1).padStart(3, '0'),
        objeto: `KML-${index + 1}`,
        endereco: name,
        cep: null,
        destinatario: description,
        coordinates,
        geocoded: coordinates !== null
      };
    });

  } catch (error) {
    console.error('Erro ao processar KML:', error);
    return [];
  }
}

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
 * Extrai endereços de dados de planilha
 */
function extractAddressesFromSpreadsheet(data) {
  const addresses = [];

  // Detectar colunas automaticamente
  const headers = Object.keys(data[0] || {});
  const addressColumns = headers.filter(h =>
    h.toLowerCase().includes('endereco') ||
    h.toLowerCase().includes('endereço') ||
    h.toLowerCase().includes('address') ||
    h.toLowerCase().includes('rua') ||
    h.toLowerCase().includes('avenida')
  );

  const cepColumns = headers.filter(h =>
    h.toLowerCase().includes('cep') ||
    h.toLowerCase().includes('postal') ||
    h.toLowerCase().includes('zip')
  );

  const nameColumns = headers.filter(h =>
    h.toLowerCase().includes('nome') ||
    h.toLowerCase().includes('destinatario') ||
    h.toLowerCase().includes('cliente') ||
    h.toLowerCase().includes('name')
  );

  data.forEach((row, index) => {
    const endereco = addressColumns.length > 0 ? row[addressColumns[0]] : null;
    const cep = cepColumns.length > 0 ? row[cepColumns[0]] : null;
    const nome = nameColumns.length > 0 ? row[nameColumns[0]] : null;

    if (endereco) {
      addresses.push({
        ordem: String(index + 1).padStart(3, '0'),
        objeto: `PLAN-${index + 1}`,
        endereco: cleanAddress(String(endereco)),
        cep: cep ? String(cep).replace(/\D/g, '') : null,
        destinatario: nome ? String(nome) : null
      });
    }
  });

  return addresses.filter(item => item.endereco);
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
 * Processa qualquer tipo de arquivo e retorna endereços geocodificados
 */
async function processCarteiroFile(filePath, fileName, userLocation = null) {
  const fileType = detectFileType(fileName);

  try {
    console.log(`🔍 Processando arquivo ${fileType.toUpperCase()}: ${fileName}`);

    let addresses = [];

    switch (fileType) {
      case 'pdf':
        const pdfText = await extractTextFromPDF(filePath);
        addresses = extractAddressesFromCarteiro(pdfText);
        break;

      case 'excel':
      case 'csv':
        const spreadsheetData = extractFromSpreadsheet(filePath, fileType);
        addresses = extractAddressesFromSpreadsheet(spreadsheetData);
        break;

      case 'kml':
        addresses = extractFromKML(filePath);
        break;

      case 'xml':
        // Para XML genérico, tentar detectar estrutura
        const xmlData = fs.readFileSync(filePath, 'utf8');
        const parser = new XMLParser();
        const result = parser.parse(xmlData);
        // Implementar lógica específica baseada na estrutura
        addresses = extractAddressesFromXML(result);
        break;

      case 'json':
        const jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        addresses = extractAddressesFromJSON(jsonData);
        break;

      default:
        throw new Error(`Tipo de arquivo não suportado: ${fileType}`);
    }

    console.log(`✅ Encontrados ${addresses.length} endereços`);

    // Para arquivos KML que já têm coordenadas, não geocodificar
    const needsGeocoding = addresses.filter(addr => !addr.geocoded);
    const alreadyGeocoded = addresses.filter(addr => addr.geocoded);

    console.log(`🌍 Geocodificando ${needsGeocoding.length} endereços...`);

    // Geocodificar endereços que precisam
    for (let i = 0; i < needsGeocoding.length; i++) {
      const address = needsGeocoding[i];
      console.log(`📍 Geocodificando ${i + 1}/${needsGeocoding.length}: ${address.endereco}`);

      const coords = await geocodeAddress(address.endereco, address.cep, userLocation);

      address.coordinates = coords;
      address.geocoded = coords !== null;

      // Delay para não sobrecarregar a API
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const allAddresses = [...alreadyGeocoded, ...needsGeocoding];
    const successCount = allAddresses.filter(addr => addr.geocoded).length;

    console.log(`✅ Processamento concluído: ${successCount}/${allAddresses.length} endereços geocodificados`);

    return {
      success: true,
      total: allAddresses.length,
      geocoded: successCount,
      addresses: allAddresses,
      fileType,
      metadata: {
        extractedAt: new Date().toISOString(),
        filePath,
        fileName,
        userLocation
      }
    };

  } catch (error) {
    console.error('Erro ao processar arquivo:', error);
    return {
      success: false,
      error: error.message,
      addresses: [],
      fileType
    };
  }
}

/**
 * Processa um PDF de carteiro e retorna endereços geocodificados (compatibilidade)
 */
async function processCarteiroPDF(pdfPath, userLocation = null) {
  return processCarteiroFile(pdfPath, 'arquivo.pdf', userLocation);
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

/**
 * Extrai endereços de dados XML genéricos
 */
function extractAddressesFromXML(xmlData) {
  const addresses = [];

  // Tentar encontrar estruturas comuns
  function searchForAddresses(obj, path = '') {
    if (typeof obj !== 'object' || obj === null) return;

    Object.keys(obj).forEach(key => {
      const value = obj[key];

      if (typeof value === 'string') {
        // Procurar por padrões de endereço
        if (key.toLowerCase().includes('endereco') ||
            key.toLowerCase().includes('address') ||
            value.match(/^(Rua|Avenida|R\.|Av\.)/i)) {

          addresses.push({
            ordem: String(addresses.length + 1).padStart(3, '0'),
            objeto: `XML-${addresses.length + 1}`,
            endereco: cleanAddress(value),
            cep: null,
            destinatario: null
          });
        }
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => searchForAddresses(item, `${path}.${key}[${index}]`));
      } else if (typeof value === 'object') {
        searchForAddresses(value, `${path}.${key}`);
      }
    });
  }

  searchForAddresses(xmlData);
  return addresses;
}

/**
 * Extrai endereços de dados JSON
 */
function extractAddressesFromJSON(jsonData) {
  const addresses = [];

  function searchForAddresses(obj, path = '') {
    if (typeof obj !== 'object' || obj === null) return;

    if (Array.isArray(obj)) {
      obj.forEach((item, index) => searchForAddresses(item, `${path}[${index}]`));
      return;
    }

    Object.keys(obj).forEach(key => {
      const value = obj[key];

      if (typeof value === 'string') {
        if (key.toLowerCase().includes('endereco') ||
            key.toLowerCase().includes('address') ||
            value.match(/^(Rua|Avenida|R\.|Av\.)/i)) {

          addresses.push({
            ordem: String(addresses.length + 1).padStart(3, '0'),
            objeto: `JSON-${addresses.length + 1}`,
            endereco: cleanAddress(value),
            cep: obj.cep || obj.zipcode || obj.postal_code || null,
            destinatario: obj.nome || obj.name || obj.destinatario || null
          });
        }
      } else if (typeof value === 'object') {
        searchForAddresses(value, `${path}.${key}`);
      }
    });
  }

  searchForAddresses(jsonData);
  return addresses;
}

module.exports = {
  extractTextFromPDF,
  extractAddressesFromCarteiro,
  extractFromSpreadsheet,
  extractFromKML,
  extractAddressesFromSpreadsheet,
  extractAddressesFromXML,
  extractAddressesFromJSON,
  geocodeAddress,
  processCarteiroPDF,
  processCarteiroFile,
  generateMapData,
  calculateBounds,
  detectFileType
};
