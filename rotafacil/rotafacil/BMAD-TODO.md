# RotaFácil — BMAD To-Do List

## Sprint 1: Fundação e Interface de Captura
- [x] Inicializar projeto Next.js 14 com App Router (concluído)
	- Executar `npx create-next-app@latest rotafacil --typescript`
	- Selecionar App Router e TypeScript
	- Configurar estrutura inicial do projeto
- [x] Configurar Tailwind CSS e shadcn/ui (concluído)
	- Instalar Tailwind CSS (`npm install -D tailwindcss postcss autoprefixer`)
	- Gerar arquivos de configuração (`npx tailwindcss init -p`)
	- Integrar Tailwind ao Next.js (editar globals.css)
	- Instalar shadcn/ui e importar componentes básicos
- [x] Estruturar diretórios conforme planejamento (concluído)
	- Criar pastas: /app, /components, /hooks, /lib, /public, /types
	- Adicionar arquivos iniciais conforme estrutura sugerida
- [x] Criar layout principal (layout.tsx, page.tsx) (concluído)
	- Implementar header com nome do app
	- Área principal para lista de paradas
	- Barra de ações inferior com botão de captura
- [x] Desenvolver componente StopCard (concluído)
	- Definir props: foto, status, endereço
	- Exibir imagem, status (uploading, confirmado, etc.) e endereço
	- Adicionar estilos responsivos
- [x] Implementar captura de imagem (input file + botão) (concluído)
	- Criar botão estilizado para acionar input file
	- Usar atributo `capture="environment"` para câmera
	- Lidar com evento de seleção de arquivo
- [x] Exibir feedback visual imediato ao capturar foto (concluído)
	- Gerar URL local da imagem (`URL.createObjectURL`)
	- Atualizar StopCard com status "uploading"
	- Garantir atualização reativa da interface

## Sprint 2: Upload, OCR e Persistência
- [x] Configurar Supabase (projeto, banco, storage) (concluído)
	- Criar projeto no Supabase
	- Configurar banco PostgreSQL com tabela de paradas
	- Criar Storage Bucket (delivery-photos)
	- Gerar e salvar chaves de API
- [x] Implementar upload de fotos para Supabase Storage (concluído)
	- Integrar Supabase client no frontend
	- Enviar imagem capturada para o bucket
	- Receber URL pública da foto
- [x] Criar API /api/ocr-process para processar imagem e extrair endereço (concluído)
	- Implementar rota API em /app/api/ocr-process/route.ts
	- Receber URL da imagem via POST
	- Baixar imagem no backend
- [x] Integrar Tesseract.js para OCR (concluído)
	- Instalar Tesseract.js
	- Processar imagem para extrair texto
	- Tratar texto extraído (regex para endereço)
- [x] Salvar dados (foto, endereço) no banco Supabase (concluído)
	- Persistir foto, endereço e status na tabela de paradas
	- Atualizar registro existente ou criar novo
- [x] Atualizar UI após resposta da API (concluído)
	- Receber endereço extraído e status
	- Atualizar StopCard correspondente
	- Exibir status "confirmado" e endereço

## Sprint 3: Roteamento e Exibição no Mapa
- [x] Provisionar servidor OSRM (Docker) (concluído)
	- Criar VM ou droplet na DigitalOcean/Linode
	- Instalar Docker
	- Rodar container OSRM com dados do Brasil
	- Testar endpoint OSRM local
- [x] Implementar geocodificação dos endereços (concluído)
	- Integrar serviço Nominatim ou similar
	- Converter endereços em latitude/longitude
	- Salvar coordenadas no banco
- [x] Criar API /api/route-optimize para otimizar rota (concluído)
	- Implementar rota API em /app/api/route-optimize/route.ts
	- Receber lista de coordenadas via POST
	- Chamar servidor OSRM para calcular rota
	- Retornar ordem otimizada e geometria da rota
- [x] Desenvolver componente MapDisplay com Leaflet.js (concluído)
	- Instalar Leaflet.js e dependências
	- Renderizar mapa interativo
	- Exibir polyline da rota e marcadores das paradas
- [x] Exibir rota otimizada e marcadores no mapa (concluído)
	- Integrar resposta da API ao componente
	- Atualizar visualização conforme rota otimizada

## Sprint 4: Finalização e Deploy
- [x] Configurar PWA (manifest, next-pwa, service worker) (concluído)
	- Editar next.config.js para habilitar PWA
	- Preencher public/manifest.json (nome, ícones, cores)
	- Implementar service worker para cache offline
- [x] Polir UI/UX, tratar erros e adicionar animações (concluído)
	- Tratar erros de upload, OCR e roteamento
	- Adicionar animações de carregamento e transições
	- Garantir responsividade e acessibilidade
- [x] Automatizar deploy contínuo via Vercel (concluído)
	- Conectar repositório GitHub à Vercel
	- Configurar build automático a cada push
	- Testar deploy e funcionamento do PWA
- [x] Testes automatizados para APIs e componentes principais (concluído)
	- Escrever testes unitários para APIs
	- Testar componentes principais (StopCard, MapDisplay)
	- Validar integração entre frontend e backend

---

Cada item pode ser detalhado e expandido conforme a execução. Marque os itens conforme forem concluídos para acompanhar o progresso do projeto.
