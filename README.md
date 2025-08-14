# RotaFácil - Sistema de Otimização de Rotas de Entrega 🚚

<div align="center">
  <img src="https://img.shields.io/badge/Next.js-15.4.6-black?style=for-the-badge&logo=next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" />
  <img src="https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css" />
  <img src="https://img.shields.io/badge/PWA-Ready-5A0FC8?style=for-the-badge&logo=pwa" />
</div>

## 📱 Sobre o Projeto

RotaFácil é um Progressive Web App (PWA) inovador que revoluciona a otimização de rotas de entrega através de reconhecimento automático de endereços por OCR. Tire fotos dos pacotes e o sistema extrai automaticamente os endereços e calcula a rota mais eficiente.

### ✨ Funcionalidades Principais

- 📸 **Captura Inteligente**: Tire fotos dos pacotes diretamente do app
- 🎤 **Entrada por Voz (pt-BR)**: Dite o endereço, revise e confirme antes de enviar
- 🔍 **OCR Automático**: Extração automática de endereços das imagens
- 📍 **Geocodificação**: Conversão de endereços em coordenadas via endpoint dedicado
- 🚦 **Trânsito em Tempo Real (opcional)**: Otimização com Mapbox (free tier suportado)
- 🧭 **Origem do Dispositivo + Retorno**: Use sua localização como partida e opte por ida/volta
- ▶️ **Iniciar Rota**: Abre Google Maps com origem/waypoints/destino na ordem otimizada
- ⛶ **Mapa em Tela Cheia**: Expanda o mapa e retorne quando quiser
- 💾 **Persistência Local**: Paradas guardadas no dispositivo (não se perdem ao recarregar)
- 🗺️ **Visualização em Mapa**: Veja paradas e trajeto otimizado
- 🚀 **Otimização de Rota**: Mapbox Optimization (com trânsito), fallback OSRM e algoritmo simples
- 📱 **PWA Completo**: Funciona offline e pode ser instalado como app
- 🎨 **Design Responsivo**: Layout bonito e profissional, otimizado para qualquer tela

## 🛠️ Stack Tecnológica

| Categoria | Tecnologia | Descrição |
|-----------|------------|-----------|
| **Framework** | Next.js 15.4.6 | App Router, Server Components, API Routes |
| **UI/UX** | Tailwind CSS 4.0 | Utility-first CSS framework |
| **Linguagem** | TypeScript 5.0 | Type safety e melhor DX |
| **OCR** | Tesseract.js | Reconhecimento de texto em imagens |
| **Mapas** | Leaflet | Visualização interativa de mapas |
| **Banco de Dados** | Supabase | PostgreSQL + Storage |
| **Roteamento** | OSRM | Motor de otimização de rotas |
| **PWA** | next-pwa | Service Worker e funcionalidades offline |

## 🚀 Instalação e Configuração

> 📚 **Guias Disponíveis:**
> - 🏃 [**Guia Rápido**](docs/QUICK_START.md) - Deploy em 15 minutos!
> - 📖 [**Guia Completo**](docs/DEPLOYMENT_GUIDE.md) - Passo a passo detalhado
> - 🎨 [**Design Visual**](docs/DESIGN.md) - Componentes e UI/UX

### Pré-requisitos

- Node.js 18+ e npm/yarn
- Conta no [Supabase](https://supabase.com)
- (Opcional) Servidor OSRM para otimização avançada

### 1. Clone o Repositório

```bash
git clone https://github.com/seu-usuario/rotafacil.git
cd rotafacil
```

### 2. Instale as Dependências

```bash
npm install
# ou
yarn install
```

### 3. Configure o Supabase

1. Crie um projeto no [Supabase](https://supabase.com)
2. No painel SQL, execute:

```sql
CREATE TABLE stops (
  id SERIAL PRIMARY KEY,
  photo_url TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  extracted_text TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

3. Configure o Storage:
   - Crie um bucket chamado `delivery-photos`
   - Configure as políticas para permitir upload público

### 4. Configure as Variáveis de Ambiente

```bash
cp .env.local.example .env.local
```

Edite `.env.local` com suas credenciais:

```env
# Supabase (obrigatórios)
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-anon

# Otimização de rotas (opcionais)
MAPBOX_ACCESS_TOKEN=seu-token-mapbox # ativa trânsito em tempo real (free tier)
OSRM_URL=http://localhost:5000       # se usar OSRM próprio
```

### 5. Execute o Projeto

```bash
npm run dev
# ou
yarn dev
```

Acesse [http://localhost:3000](http://localhost:3000)

## 📱 Como Usar

1. **Adicionar Paradas**
   - Opção 1 (Foto): clique em "Adicionar Parada", fotografe o pacote e aguarde o OCR
   - Opção 2 (Voz): toque e segure "Falar endereço", revise no modal e confirme

2. **Revisar Endereços**
   - Verifique se os endereços foram extraídos corretamente
   - Remova ou tente novamente se necessário

3. **Otimizar Rota**
   - Com pelo menos 2 paradas confirmadas, clique em "Otimizar Rota"
   - Em Ajustes, você pode habilitar "Usar minha localização" e "Retornar ao ponto"
   - Se `MAPBOX_ACCESS_TOKEN` estiver definido, a otimização usa trânsito em tempo real

4. **Navegar**
   - Clique em "Iniciar rota" para abrir o Google Maps com o trajeto (origem/waypoints/destino)
   - Use "Tela cheia" para visualizar melhor o mapa e "Sair da tela cheia" para retornar
   - A lista de paradas persiste localmente; use "Limpar lista" para recomeçar

## 🏗️ Arquitetura do Projeto

```
rotafacil/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes
│   │   ├── geocode/        # Geocodificação de endereços (server-side)
│   │   ├── ocr-process/    # Processamento OCR
│   │   └── route-optimize/ # Otimização de rotas (Mapbox/OSRM/algoritmo simples)
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Página inicial
│   └── globals.css        # Estilos globais
├── components/            # Componentes React
│   ├── StopCard.tsx      # Card de parada
│   └── MapDisplay.tsx    # Visualização do mapa
├── lib/                  # Utilitários e serviços
│   └── supabaseClient.ts # Cliente Supabase (instanciado sob demanda)
└── public/              # Assets públicos
    └── manifest.json    # PWA manifest
```

## 🔧 Configuração Avançada

### Servidor OSRM (Opcional)

Para otimização avançada de rotas, configure um servidor OSRM:

```bash
# Com Docker
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-extract -p /opt/car.lua /data/brazil-latest.osm.pbf
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-partition /data/brazil-latest.osrm
docker run -t -v "${PWD}:/data" osrm/osrm-backend osrm-customize /data/brazil-latest.osrm
docker run -t -i -p 5000:5000 -v "${PWD}:/data" osrm/osrm-backend osrm-routed --algorithm mld /data/brazil-latest.osrm
```

### Deploy na Vercel

```bash
# Instale a CLI da Vercel
npm i -g vercel

# Deploy
vercel
```

Configure as variáveis de ambiente no painel da Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (obrigatórios)
- `MAPBOX_ACCESS_TOKEN` (opcional para trânsito)
- `OSRM_URL` (opcional se usar servidor próprio)

## 📊 Status de Implementação

- ✅ **Sprint 1**: Interface e captura de imagem
- ✅ **Sprint 2**: OCR e persistência de dados
- ✅ **Sprint 3**: Otimização de rotas e mapas
- ✅ **Sprint 4**: PWA e deploy

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 🙏 Agradecimentos

- [Next.js](https://nextjs.org/) - Framework React
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Tesseract.js](https://tesseract.projectnaptha.com/) - OCR
- [Leaflet](https://leafletjs.com/) - Mapas
- [Supabase](https://supabase.com/) - Backend as a Service
- [OSRM](http://project-osrm.org/) - Roteamento

---

<div align="center">
  <p>Feito com ❤️ para otimizar suas entregas</p>
  <p>⭐ Star este repositório se foi útil!</p>
</div>
