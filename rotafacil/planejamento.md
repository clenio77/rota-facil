Plano de Projeto e Arquitetura: RotaFácil
Este documento descreve a estrutura completa, as etapas de desenvolvimento e a lógica de implementação para o PWA RotaFácil, utilizando uma stack otimizada para produtividade e performance.

1. Stack de Tecnologias
Categoria

Tecnologia

Propósito

Frontend & Backend

Next.js 14 (App Router)

Estrutura unificada para UI e APIs.

UI/Componentes

shadcn/ui + Tailwind CSS

Construção rápida de interfaces bonitas e responsivas.

Banco de Dados

PostgreSQL (via Supabase)

Armazenamento de dados das rotas e endereços.

Armazenamento de Fotos

Supabase Storage

Upload e armazenamento seguro das fotos dos pacotes.

Reconhecimento de Texto

Tesseract.js

Extração de endereços das imagens (rodando no backend).

Motor de Roteamento

OSRM (Self-Hosted)

Cálculo da rota otimizada de forma ultra-rápida.

Exibição de Mapas

Leaflet.js

Renderização leve e interativa do mapa e da rota no PWA.

Hospedagem (App)

Vercel

Deploy contínuo e performance otimizada para Next.js.

Hospedagem (OSRM)

DigitalOcean / Linode

Servidor dedicado para o motor de roteamento.

2. Estrutura de Diretórios do Projeto
Esta é a árvore de diretórios recomendada. Ela organiza o projeto de forma lógica e escalável.

/rota-facil
├── /app/
│   ├── /api/
│   │   ├── /ocr-process/       # API para processar a imagem
│   │   │   └── route.ts
│   │   └── /route-optimize/    # API para otimizar a rota
│   │       └── route.ts
│   ├── layout.tsx              # Layout principal da aplicação
│   ├── page.tsx                # A página inicial (interface principal)
│   └── globals.css             # Estilos globais do Tailwind
├── /components/
│   ├── /ui/                    # Componentes do shadcn (Button, Card, etc.)
│   ├── MapDisplay.tsx          # Componente do mapa com Leaflet
│   └── StopCard.tsx            # Card para exibir cada parada da rota
├── /hooks/
│   └── useGeolocation.ts       # Hook customizado para obter a localização
├── /lib/
│   ├── supabaseClient.ts       # Configuração e inicialização do cliente Supabase
│   ├── ocrService.ts           # Lógica de processamento com Tesseract.js
│   └── osrmService.ts          # Funções helper para comunicar com o servidor OSRM
├── /public/
│   ├── icons/                  # Ícones para o PWA (manifest.json)
│   └── manifest.json           # Arquivo de manifesto do PWA
├── /types/
│   └── index.ts                # Definições de tipos (Stop, Status, etc.)
├── .env.local                  # Chaves de API e variáveis de ambiente
├── next.config.mjs             # Configurações do Next.js e do PWA
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json

3. Divisão do Sistema em Etapas Lógicas
O desenvolvimento será dividido em 4 grandes etapas, construindo uma sobre a outra.

Etapa 1: Fundação e Interface de Captura (Semana 1)
O objetivo é ter a interface principal funcionando, permitindo ao usuário tirar fotos e vê-las na tela.

Lógica:

Setup do Projeto: Iniciar o projeto Next.js e configurar o Tailwind CSS e o shadcn/ui.

Estrutura da UI: Desenvolver a app/page.tsx com o layout principal, incluindo o header, a área para a lista de paradas e a barra de ações inferior.

Componente StopCard: Criar o card que exibirá a foto e o status (Processando, Confirmado, etc.).

Captura de Imagem: Implementar a lógica de captura usando um <input type="file" capture="environment"> oculto, acionado por um botão + estilizado.

Feedback Visual: Ao capturar uma foto, usar URL.createObjectURL() para exibi-la imediatamente no StopCard e definir seu status inicial como uploading.

Etapa 2: Upload, OCR e Persistência (Semana 2)
O foco é conectar o frontend ao backend, processar a imagem e salvar os dados.

Lógica:

Configurar Supabase: Criar o projeto no Supabase, configurar o Storage Bucket (delivery-photos) e obter as chaves de API.

Lógica de Upload: Na função de captura, após o feedback visual, fazer o upload da imagem para o Supabase Storage.

API de OCR (/api/ocr-process):

Criar uma API Route no Next.js que recebe a URL pública da imagem recém-enviada.

Nesta rota, o servidor baixa a imagem.

Usa a biblioteca Tesseract.js (via ocrService.ts) para extrair o texto da imagem.

[Bônus] Limpa o texto extraído usando regex para isolar o que parece ser um endereço.

Salva o endereço extraído e a URL da foto no banco de dados PostgreSQL do Supabase.

Atualização da UI: Após a API de OCR responder, o frontend atualiza o StopCard correspondente, mudando o status para confirmed e exibindo o endereço.

Etapa 3: Roteamento e Exibição no Mapa (Semana 3)
Agora, transformamos a lista de endereços em uma rota otimizada.

Lógica:

Setup do OSRM: Provisionar um servidor na DigitalOcean, instalar o Docker e rodar o contêiner do OSRM com os dados de mapa do Brasil.

Geocodificação: Antes de otimizar, os endereços em texto precisam virar coordenadas (latitude/longitude). Isso pode ser feito na API de OCR (Etapa 2) usando um serviço como o Nominatim (gratuito) ou na API de otimização.

API de Otimização (/api/route-optimize):

Criar uma API Route que recebe uma lista de coordenadas (paradas).

A API chama seu servidor OSRM para obter a rota mais eficiente (a ordem correta das paradas e a geometria da rota).

Retorna a rota otimizada para o frontend.

Componente de Mapa (MapDisplay.tsx):

Criar um componente que usa Leaflet.js para renderizar um mapa.

Quando o usuário clica em "Otimizar Rota", o frontend chama a API, recebe a rota e a passa para o componente MapDisplay.

O componente desenha a linha da rota (polyline) e os marcadores (markers) no mapa.

Etapa 4: Finalização e Deploy (Semana 4)
Polimento final, configuração do PWA e publicação.

Lógica:

Configuração do PWA: Editar o next.config.mjs para habilitar o PWA (usando next-pwa) e preencher o public/manifest.json com o nome, ícones e cores do RotaFácil.

Funcionalidades Offline: Implementar um Service Worker básico para cachear os assets da aplicação, permitindo que ela abra mesmo sem internet.

Polimento da UI/UX: Tratar casos de erro (falha no upload, OCR não encontrou endereço), adicionar animações e garantir que a experiência seja fluida.

Deploy: Conectar o repositório do GitHub à Vercel. A cada push para a branch principal, a Vercel fará o build e o deploy do PWA automaticamente.

Com este plano, você tem um caminho claro e estruturado para construir o RotaFácil do zero até a produção, de forma eficiente e organizada.

Qual etapa você gostaria de começar a detalhar agora? A Etapa 2, com a criação da API de OCR, seria um excelente próximo pass