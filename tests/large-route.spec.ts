import { test, expect } from '@playwright/test';

test.describe('Large Route Optimization Test (>20 stops)', () => {
    test('should optimize a route with 25 stops using the advanced solver', async ({ request }) => {
        // 1) Gerar 25 paradas simuladas (em torno de Uberlândia - MG para ser realista)
        const baseLat = -18.9186;
        const baseLng = -48.2772;
        const stops = Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            // Pequenas variações para criar uma nuvem de pontos
            lat: baseLat + (Math.random() - 0.5) * 0.05,
            lng: baseLng + (Math.random() - 0.5) * 0.05,
            address: `Ponto de Entrega ${i + 1}`
        }));

        console.log(`🧪 Iniciando teste com ${stops.length} paradas...`);

        // 2) Chamar a API de otimização
        const response = await request.post('/api/route-optimize', {
            data: {
                stops,
                origin: { lat: baseLat, lng: baseLng, city: 'Uberlândia', state: 'MG' },
                roundtrip: true
            }
        });

        // 3) Validar resposta
        expect(response.ok()).toBeTruthy();
        const result = await response.json();
        console.log('📦 API Response Body:', JSON.stringify(result, null, 2));

        expect(result.success).toBe(true);
        expect(result.optimizedStops).toHaveLength(25);

        // Validar se o provider mudou para o solver avançado (não Mapbox por causa do limite de 12)
        const allowedProviders = ['simple+osrm', 'simple'];
        expect(allowedProviders).toContain(result.provider);

        // Validar se temos distância e geometria
        expect(result.distance).toBeGreaterThan(0);
        expect(result.geometry).toBeDefined();

        console.log(`✅ Sucesso! Rota de ${result.distance.toFixed(2)}km gerada com 25 pontos.`);
        console.log(`🛰️ Provider: ${result.provider}`);

        // Verificar se as sequências estão corretas (1 a 25)
        const sequences = result.optimizedStops.map((s: any) => s.sequence).sort((a: number, b: number) => a - b);
        expect(sequences[0]).toBe(1);
        expect(sequences[24]).toBe(25);
    });
});
