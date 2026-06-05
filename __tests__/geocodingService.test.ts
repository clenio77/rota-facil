import {
  isValidBrazilianCoordinate,
  normalizeAddress,
  extractCEP,
  normalizeStr,
  haversineKm,
  extractStreetAndNumberLoose,
  geocodeAddressImproved
} from '../lib/geocodingService';

describe('Serviço de Geocodificação (geocodingService)', () => {
  
  describe('isValidBrazilianCoordinate', () => {
    it('deve retornar true para coordenadas dentro do Brasil', () => {
      // São Paulo
      expect(isValidBrazilianCoordinate(-23.5505, -46.6333)).toBe(true);
      // Uberlândia
      expect(isValidBrazilianCoordinate(-18.9186, -48.2772)).toBe(true);
    });

    it('deve retornar false para coordenadas fora do Brasil', () => {
      // Nova York
      expect(isValidBrazilianCoordinate(40.7128, -74.0060)).toBe(false);
      // Tóquio
      expect(isValidBrazilianCoordinate(35.6762, 139.6503)).toBe(false);
    });
  });

  describe('normalizeAddress', () => {
    it('deve limpar espaços múltiplos e normalizar abreviações comuns', () => {
      expect(normalizeAddress('  r.  afonso pena ,  262  ')).toBe('Rua afonso pena, 262');
      expect(normalizeAddress('av. paulista, n° 1000')).toBe('Avenida paulista, 1000');
      expect(normalizeAddress('al. lorena, n. 45')).toBe('Alameda lorena, 45');
    });
  });

  describe('extractCEP', () => {
    it('deve extrair CEPs no formato com ou sem hífen', () => {
      expect(extractCEP('Avenida Paulista, 1000, 01311-100, São Paulo')).toBe('01311100');
      expect(extractCEP('Rua Teste 38400000 Uberlândia')).toBe('38400000');
      expect(extractCEP('Endereço sem CEP')).toBeNull();
    });
  });

  describe('normalizeStr', () => {
    it('deve remover acentos e converter para minúsculas', () => {
      expect(normalizeStr('São Paulo')).toBe('sao paulo');
      expect(normalizeStr('RODOVÍA')).toBe('rodovia');
    });
  });

  describe('haversineKm', () => {
    it('deve calcular a distância geodésica aproximada', () => {
      // Distância de São Paulo a Uberlândia é ~540km
      const distance = haversineKm(-23.5505, -46.6333, -18.9186, -48.2772);
      expect(distance).toBeGreaterThan(530);
      expect(distance).toBeLessThan(550);
    });
  });

  describe('extractStreetAndNumberLoose', () => {
    it('deve capturar nome da rua e número em múltiplos formatos', () => {
      expect(extractStreetAndNumberLoose('Rua Afonso Pena, 262')).toEqual({
        street: 'Rua Afonso Pena',
        number: '262'
      });
      expect(extractStreetAndNumberLoose('Avenida Paulista 1000')).toEqual({
        street: 'Avenida Paulista',
        number: '1000'
      });
      expect(extractStreetAndNumberLoose('Rua do Ouvidor, 55, Centro')).toEqual({
        street: 'Rua do Ouvidor',
        number: '55'
      });
    });

    it('deve rejeitar números inválidos ou CEPs como número de casa', () => {
      expect(extractStreetAndNumberLoose('Avenida Paulista, 01311-100')).toBeNull();
      expect(extractStreetAndNumberLoose('Rua Sem Numero')).toBeNull();
    });
  });

  describe('Orquestração de Cascata de Geocodificação (geocodeAddressImproved)', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('deve retornar resultado imediato se o endereço contiver a palavra-chave de teste123', async () => {
      const result = await geocodeAddressImproved('teste123');
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('teste-deploy');
      expect(result?.lat).toBe(-18.9186);
      expect(result?.lng).toBe(-48.2772);
    });

    it('deve passar pelo ViaCEP caso possua CEP e resolver coordenadas via Nominatim', async () => {
      const mockViaCepResponse = {
        logradouro: 'Rua Afonso Pena',
        bairro: 'Centro',
        localidade: 'Uberlândia',
        uf: 'MG'
      };

      const mockNominatimResponse = [
        {
          lat: '-18.9186',
          lon: '-48.2772',
          display_name: 'Rua Afonso Pena, Centro, Uberlândia, MG, Brasil',
          osm_type: 'way',
          type: 'house'
        }
      ];

      // Mockar chamadas de fetch manualmente
      const originalFetch = global.fetch;
      const mockFetch = jest.fn().mockImplementation((url) => {
        const urlStr = String(url);
        if (urlStr.includes('viacep.com.br')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockViaCepResponse)
          } as Response);
        }
        if (urlStr.includes('nominatim.openstreetmap.org')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockNominatimResponse)
          } as Response);
        }
        return Promise.resolve({
          ok: false
        } as Response);
      });
      global.fetch = mockFetch;

      const result = await geocodeAddressImproved('Rua Afonso Pena, 38400-100');
      
      expect(result).not.toBeNull();
      expect(result?.provider).toBe('viacep+nominatim');
      expect(result?.lat).toBe(-18.9186);
      expect(result?.lng).toBe(-48.2772);

      // Restaurar fetch original
      global.fetch = originalFetch;
    });
  });
});
