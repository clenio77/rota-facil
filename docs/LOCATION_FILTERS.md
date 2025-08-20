# Sistema de Filtros de Localização - RotaFácil

## Visão Geral

O RotaFácil agora implementa um sistema inteligente de filtros de localização que prioriza endereços da cidade atual do usuário, melhorando significativamente a precisão da geocodificação e a experiência do usuário.

## Funcionalidades Implementadas

### 1. **Detecção Automática de Cidade**
- **Reverse Geocoding**: Identifica automaticamente a cidade atual baseada na localização do dispositivo
- **Múltiplos Provedores**: Mapbox (preciso) + Nominatim (fallback gratuito)
- **Cache Inteligente**: Armazena informações de cidade para uso futuro

### 2. **Priorização de Endereços Locais**
- **Boost de Confiança**: Endereços da mesma cidade recebem +30% de confiança
- **Contexto de Localização**: APIs de geocodificação recebem contexto da cidade atual
- **Filtros Inteligentes**: Resultados são ordenados priorizando proximidade geográfica

### 3. **Flexibilidade para Outras Cidades**
- **Endereços Explícitos**: Permite endereços de outras cidades quando especificados completamente
- **Exemplo**: "Avenida Afonso Pena, 242 - Araguari" funciona mesmo estando em São Paulo
- **Validação Contextual**: Considera o contexto fornecido pelo usuário

## Como Funciona

### Fluxo de Geocodificação

```
1. Usuário ativa localização do dispositivo
   ↓
2. Sistema faz reverse geocoding para identificar cidade
   ↓
3. Todas as geocodificações subsequentes incluem contexto da cidade
   ↓
4. Resultados da mesma cidade recebem boost de confiança
   ↓
5. Sistema prioriza endereços locais automaticamente
```

### Exemplo Prático

**Cenário**: Usuário em São Paulo, SP

**Endereço 1**: "Rua Augusta, 123"
- ✅ Priorizado (mesma cidade)
- ✅ Boost de confiança aplicado
- ✅ Resultado mais preciso

**Endereço 2**: "Avenida Afonso Pena, 242 - Araguari, MG"
- ✅ Aceito (cidade explicitamente especificada)
- ✅ Processado normalmente
- ✅ Sem penalização

**Endereço 3**: "Rua das Flores, 456"
- ⚠️ Pode ser ambíguo (várias cidades têm "Rua das Flores")
- ✅ Sistema prioriza São Paulo automaticamente
- ✅ Resultado mais relevante para o usuário

## APIs Modificadas

### 1. **Nova API: `/api/reverse-geocode`**
```typescript
POST /api/reverse-geocode
{
  "lat": -23.5505,
  "lng": -46.6333
}

Response:
{
  "success": true,
  "city": "são paulo",
  "state": "sp",
  "country": "Brasil",
  "fullAddress": "São Paulo, SP, Brasil",
  "confidence": 0.9,
  "provider": "mapbox"
}
```

### 2. **API Modificada: `/api/geocode`**
```typescript
POST /api/geocode
{
  "address": "Rua Augusta, 123",
  "userLocation": {
    "lat": -23.5505,
    "lng": -46.6333,
    "city": "são paulo",
    "state": "sp"
  }
}
```

### 3. **API Modificada: `/api/ocr-process`**
```typescript
POST /api/ocr-process
{
  "imageUrl": "https://...",
  "userLocation": {
    "lat": -23.5505,
    "lng": -46.6333,
    "city": "são paulo",
    "state": "sp"
  }
}
```

## Componentes da Interface

### 1. **CityIndicator**
- Mostra cidade atual do usuário
- Permite alterar cidade manualmente
- Interface intuitiva para configuração

### 2. **Hook useGeolocation Melhorado**
- Inclui contexto de cidade
- Reverse geocoding automático
- Tratamento de erros robusto

## Benefícios

### Para o Usuário
- ✅ **Maior Precisão**: Endereços locais são encontrados com mais facilidade
- ✅ **Menos Ambiguidade**: Sistema entende contexto da cidade atual
- ✅ **Interface Clara**: Visualização da cidade atual
- ✅ **Flexibilidade**: Pode especificar outras cidades quando necessário

### Para o Sistema
- ✅ **Performance**: Cache inteligente reduz chamadas de API
- ✅ **Eficiência**: Menos erros de geocodificação
- ✅ **Escalabilidade**: Sistema funciona bem em qualquer cidade brasileira
- ✅ **Confiabilidade**: Múltiplos provedores garantem disponibilidade

## Configuração

### Variáveis de Ambiente
```bash
# Mapbox (recomendado para melhor precisão)
MAPBOX_ACCESS_TOKEN=your_token_here

# Google (opcional, último recurso)
GOOGLE_GEOCODING_API_KEY=your_key_here
```

### Banco de Dados
O sistema usa a tabela `geocoding_cache` existente, que agora inclui:
- `city`: Nome da cidade
- `state`: Sigla do estado
- `cep`: Código postal (se disponível)

## Casos de Uso

### 1. **Entregas Locais**
- Sistema prioriza endereços da cidade atual
- Ideal para entregadores e motoristas locais

### 2. **Viagens e Rotas**
- Pode especificar cidades de destino explicitamente
- Sistema entende contexto de viagem

### 3. **Logística Empresarial**
- Múltiplas filiais em diferentes cidades
- Sistema adapta-se ao contexto de cada usuário

## Limitações e Considerações

### 1. **Precisão do GPS**
- Depende da precisão do dispositivo do usuário
- Áreas rurais podem ter menor precisão

### 2. **Provedores de API**
- Mapbox oferece melhor precisão (requer token)
- Nominatim é gratuito mas menos preciso
- Fallback automático entre provedores

### 3. **Cache**
- Primeira geocodificação pode ser mais lenta
- Cache melhora performance em uso subsequente

## Roadmap Futuro

### Fase 1 (Implementado)
- ✅ Detecção automática de cidade
- ✅ Priorização de endereços locais
- ✅ Interface de configuração de cidade

### Fase 2 (Planejado)
- 🔄 Histórico de cidades visitadas
- 🔄 Sincronização com contatos do usuário
- 🔄 Preferências de localização por usuário

### Fase 3 (Futuro)
- 🔮 Integração com sistemas de navegação
- 🔮 Análise de padrões de movimento
- 🔮 Otimização automática de rotas por região

## Suporte e Troubleshooting

### Problemas Comuns

1. **Cidade não detectada**
   - Verificar permissões de localização
   - Verificar conectividade com internet
   - Usar configuração manual de cidade

2. **Geocodificação imprecisa**
   - Verificar se cidade atual está correta
   - Especificar cidade explicitamente no endereço
   - Usar CEP quando disponível

3. **Erro de API**
   - Verificar tokens de API
   - Verificar limites de uso
   - Sistema usa fallback automático

### Logs e Debug
O sistema registra logs detalhados para debug:
- Contexto de localização do usuário
- Boost de confiança aplicado
- Provedor de geocodificação usado
- Resultados de cache

## Conclusão

O sistema de filtros de localização representa uma melhoria significativa na experiência do usuário do RotaFácil. Ao priorizar endereços locais automaticamente, o sistema reduz erros de geocodificação e melhora a precisão das rotas, especialmente em cenários de entrega local e logística urbana.

A implementação mantém flexibilidade para casos especiais (como viagens e entregas interurbanas) enquanto otimiza significativamente o uso diário para a maioria dos usuários.
