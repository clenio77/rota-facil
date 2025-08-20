// GPX Parser e Exportador - Sistema avançado para parsing e geração de arquivos GPX
import { GPXData, GPXWaypoint, GPXTrack, GPXRoute } from './gpxOptimizer';

export class GPXParser {
  // Parse completo de arquivo GPX
  static parseGPX(gpxContent: string): GPXData {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
    
    // Verificar se há erros de parsing
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Erro ao fazer parse do arquivo GPX: XML inválido');
    }

    const gpxElement = xmlDoc.querySelector('gpx');
    if (!gpxElement) {
      throw new Error('Arquivo GPX inválido: elemento <gpx> não encontrado');
    }

    const result: GPXData = {
      waypoints: [],
      tracks: [],
      routes: [],
      metadata: this.parseMetadata(xmlDoc)
    };

    // Parse waypoints
    result.waypoints = this.parseWaypoints(xmlDoc);
    
    // Parse tracks
    result.tracks = this.parseTracks(xmlDoc);
    
    // Parse routes
    result.routes = this.parseRoutes(xmlDoc);

    return result;
  }

  // Parse waypoints (<wpt> elements)
  private static parseWaypoints(xmlDoc: Document): GPXWaypoint[] {
    const waypoints: GPXWaypoint[] = [];
    const wptElements = xmlDoc.querySelectorAll('wpt');

    wptElements.forEach(wpt => {
      const lat = parseFloat(wpt.getAttribute('lat') || '0');
      const lng = parseFloat(wpt.getAttribute('lon') || '0');
      
      if (!isNaN(lat) && !isNaN(lng)) {
        const waypoint: GPXWaypoint = {
          lat,
          lng,
          name: this.getElementText(wpt, 'name') || `Waypoint ${waypoints.length + 1}`,
          elevation: this.getElementNumber(wpt, 'ele'),
          time: this.getElementText(wpt, 'time'),
          description: this.getElementText(wpt, 'desc') || this.getElementText(wpt, 'cmt')
        };
        waypoints.push(waypoint);
      }
    });

    return waypoints;
  }

  // Parse tracks (<trk> elements)
  private static parseTracks(xmlDoc: Document): GPXTrack[] {
    const tracks: GPXTrack[] = [];
    const trkElements = xmlDoc.querySelectorAll('trk');

    trkElements.forEach((trk, index) => {
      const track: GPXTrack = {
        name: this.getElementText(trk, 'name') || `Track ${index + 1}`,
        points: []
      };

      // Parse track segments
      const trksegs = trk.querySelectorAll('trkseg');
      trksegs.forEach(trkseg => {
        const trkpts = trkseg.querySelectorAll('trkpt');
        trkpts.forEach((trkpt, pointIndex) => {
          const lat = parseFloat(trkpt.getAttribute('lat') || '0');
          const lng = parseFloat(trkpt.getAttribute('lon') || '0');
          
          if (!isNaN(lat) && !isNaN(lng)) {
            const point: GPXWaypoint = {
              lat,
              lng,
              name: this.getElementText(trkpt, 'name') || `Point ${pointIndex + 1}`,
              elevation: this.getElementNumber(trkpt, 'ele'),
              time: this.getElementText(trkpt, 'time'),
              description: this.getElementText(trkpt, 'desc')
            };
            track.points.push(point);
          }
        });
      });

      if (track.points.length > 0) {
        tracks.push(track);
      }
    });

    return tracks;
  }

  // Parse routes (<rte> elements)
  private static parseRoutes(xmlDoc: Document): GPXRoute[] {
    const routes: GPXRoute[] = [];
    const rteElements = xmlDoc.querySelectorAll('rte');

    rteElements.forEach((rte, index) => {
      const route: GPXRoute = {
        name: this.getElementText(rte, 'name') || `Route ${index + 1}`,
        waypoints: []
      };

      const rtepts = rte.querySelectorAll('rtept');
      rtepts.forEach((rtept, pointIndex) => {
        const lat = parseFloat(rtept.getAttribute('lat') || '0');
        const lng = parseFloat(rtept.getAttribute('lon') || '0');
        
        if (!isNaN(lat) && !isNaN(lng)) {
          const waypoint: GPXWaypoint = {
            lat,
            lng,
            name: this.getElementText(rtept, 'name') || `Route Point ${pointIndex + 1}`,
            elevation: this.getElementNumber(rtept, 'ele'),
            time: this.getElementText(rtept, 'time'),
            description: this.getElementText(rtept, 'desc')
          };
          route.waypoints.push(waypoint);
        }
      });

      if (route.waypoints.length > 0) {
        routes.push(route);
      }
    });

    return routes;
  }

  // Parse metadata
  private static parseMetadata(xmlDoc: Document): GPXData['metadata'] {
    const metadata = xmlDoc.querySelector('metadata');
    if (!metadata) return undefined;

    return {
      name: this.getElementText(metadata, 'name'),
      description: this.getElementText(metadata, 'desc'),
      author: this.getElementText(metadata, 'author name'),
      time: this.getElementText(metadata, 'time')
    };
  }

  // Utilitários para extrair texto e números
  private static getElementText(parent: Element, tagName: string): string | undefined {
    const element = parent.querySelector(tagName);
    return element?.textContent?.trim() || undefined;
  }

  private static getElementNumber(parent: Element, tagName: string): number | undefined {
    const text = this.getElementText(parent, tagName);
    if (!text) return undefined;
    const num = parseFloat(text);
    return isNaN(num) ? undefined : num;
  }

  // Exportar GPX otimizado
  static exportOptimizedGPX(
    originalData: GPXData, 
    optimizedWaypoints: GPXWaypoint[],
    optimizationInfo?: {
      algorithm: string;
      originalDistance: number;
      optimizedDistance: number;
      distanceSaved: number;
      percentageImprovement: number;
    }
  ): string {
    const now = new Date().toISOString();
    
    let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RotaFácil GPX Optimizer" 
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
     xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${originalData.metadata?.name || 'Rota Otimizada'}</name>
    <desc>Rota otimizada pelo RotaFácil GPX Optimizer`;

    if (optimizationInfo) {
      gpxContent += `
Algoritmo: ${optimizationInfo.algorithm}
Distância original: ${optimizationInfo.originalDistance.toFixed(2)} km
Distância otimizada: ${optimizationInfo.optimizedDistance.toFixed(2)} km
Economia: ${optimizationInfo.distanceSaved.toFixed(2)} km (${optimizationInfo.percentageImprovement.toFixed(1)}%)`;
    }

    gpxContent += `</desc>
    <author>
      <name>RotaFácil GPX Optimizer</name>
    </author>
    <time>${now}</time>
  </metadata>
`;

    // Adicionar waypoints otimizados como rota
    if (optimizedWaypoints.length > 0) {
      gpxContent += `  <rte>
    <name>Rota Otimizada</name>
    <desc>Sequência otimizada de pontos para melhor eficiência</desc>
`;

      optimizedWaypoints.forEach((waypoint, index) => {
        gpxContent += `    <rtept lat="${waypoint.lat.toFixed(8)}" lon="${waypoint.lng.toFixed(8)}">
      <name>${this.escapeXml(waypoint.name)}</name>
      <desc>Sequência: ${index + 1}`;
        
        if (waypoint.description) {
          gpxContent += ` | ${this.escapeXml(waypoint.description)}`;
        }
        
        gpxContent += `</desc>`;
        
        if (waypoint.elevation !== undefined) {
          gpxContent += `
      <ele>${waypoint.elevation}</ele>`;
        }
        
        if (waypoint.time) {
          gpxContent += `
      <time>${waypoint.time}</time>`;
        }
        
        gpxContent += `
    </rtept>
`;
      });

      gpxContent += `  </rte>
`;
    }

    // Adicionar waypoints originais (se existirem)
    if (originalData.waypoints.length > 0) {
      originalData.waypoints.forEach(waypoint => {
        gpxContent += `  <wpt lat="${waypoint.lat.toFixed(8)}" lon="${waypoint.lng.toFixed(8)}">
    <name>${this.escapeXml(waypoint.name)}</name>`;
        
        if (waypoint.description) {
          gpxContent += `
    <desc>${this.escapeXml(waypoint.description)}</desc>`;
        }
        
        if (waypoint.elevation !== undefined) {
          gpxContent += `
    <ele>${waypoint.elevation}</ele>`;
        }
        
        if (waypoint.time) {
          gpxContent += `
    <time>${waypoint.time}</time>`;
        }
        
        gpxContent += `
  </wpt>
`;
      });
    }

    // Adicionar tracks originais (se existirem)
    originalData.tracks.forEach(track => {
      gpxContent += `  <trk>
    <name>${this.escapeXml(track.name)}</name>
    <trkseg>
`;
      
      track.points.forEach(point => {
        gpxContent += `      <trkpt lat="${point.lat.toFixed(8)}" lon="${point.lng.toFixed(8)}">`;
        
        if (point.elevation !== undefined) {
          gpxContent += `
        <ele>${point.elevation}</ele>`;
        }
        
        if (point.time) {
          gpxContent += `
        <time>${point.time}</time>`;
        }
        
        gpxContent += `
      </trkpt>
`;
      });
      
      gpxContent += `    </trkseg>
  </trk>
`;
    });

    gpxContent += `</gpx>`;
    
    return gpxContent;
  }

  // Escape XML characters
  private static escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // Converter GPX para formato de waypoints simples
  static extractAllWaypoints(gpxData: GPXData): GPXWaypoint[] {
    const allWaypoints: GPXWaypoint[] = [];
    
    // Adicionar waypoints diretos
    allWaypoints.push(...gpxData.waypoints);
    
    // Adicionar pontos de tracks
    gpxData.tracks.forEach(track => {
      allWaypoints.push(...track.points);
    });
    
    // Adicionar pontos de routes
    gpxData.routes.forEach(route => {
      allWaypoints.push(...route.waypoints);
    });
    
    return allWaypoints;
  }

  // Validar arquivo GPX
  static validateGPX(gpxContent: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(gpxContent, 'text/xml');
      
      // Verificar erros de parsing XML
      const parserError = xmlDoc.querySelector('parsererror');
      if (parserError) {
        errors.push('XML inválido: ' + parserError.textContent);
        return { isValid: false, errors };
      }
      
      // Verificar elemento GPX raiz
      const gpxElement = xmlDoc.querySelector('gpx');
      if (!gpxElement) {
        errors.push('Elemento <gpx> raiz não encontrado');
      }
      
      // Verificar se há pelo menos alguns pontos
      const waypoints = xmlDoc.querySelectorAll('wpt, trkpt, rtept');
      if (waypoints.length === 0) {
        errors.push('Nenhum waypoint, track point ou route point encontrado');
      }
      
      // Validar coordenadas
      let invalidCoords = 0;
      waypoints.forEach(point => {
        const lat = parseFloat(point.getAttribute('lat') || '');
        const lng = parseFloat(point.getAttribute('lon') || '');
        
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
          invalidCoords++;
        }
      });
      
      if (invalidCoords > 0) {
        errors.push(`${invalidCoords} pontos com coordenadas inválidas encontrados`);
      }
      
    } catch (error) {
      errors.push('Erro ao processar arquivo: ' + (error instanceof Error ? error.message : 'Erro desconhecido'));
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}
