# 🚀 Guia de Deploy do RotaFácil

Este guia detalha o passo a passo completo para configurar o banco de dados no Supabase e fazer o deploy da aplicação no Vercel.

## 📋 Índice

1. [Configuração do Supabase](#1-configuração-do-supabase)
2. [Deploy no Vercel](#2-deploy-no-vercel)
3. [Configurações Finais](#3-configurações-finais)
4. [Troubleshooting](#4-troubleshooting)

---

## 1. Configuração do Supabase

### 1.1 Criar Conta e Projeto

1. **Acesse o Supabase**
   - Vá para [https://supabase.com](https://supabase.com)
   - Clique em "Start your project"
   - Faça login com sua conta GitHub

2. **Criar Novo Projeto**
   - Clique em "New project"
   - Preencha os campos:
     - **Name**: `rotafacil` (ou nome de sua preferência)
     - **Database Password**: Crie uma senha forte (salve-a!)
     - **Region**: Escolha a mais próxima (São Paulo - `sa-east-1`)
     - **Pricing Plan**: Free tier é suficiente para começar
   - Clique em "Create new project"
   - Aguarde a criação (pode levar 2-3 minutos)

### 1.2 Configurar Banco de Dados

1. **Acessar o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

2. **Criar Tabela de Paradas**
   
   Cole e execute o seguinte SQL:

   ```sql
   -- Criar tabela de paradas
   CREATE TABLE IF NOT EXISTS stops (
     id SERIAL PRIMARY KEY,
     photo_url TEXT NOT NULL,
     address TEXT NOT NULL,
     latitude DECIMAL(10, 8),
     longitude DECIMAL(11, 8),
     extracted_text TEXT,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
   );

   -- Criar índices para melhor performance
   CREATE INDEX idx_stops_created_at ON stops(created_at DESC);
   CREATE INDEX idx_stops_coordinates ON stops(latitude, longitude);

   -- Criar função para atualizar updated_at
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = TIMEZONE('utc', NOW());
     RETURN NEW;
   END;
   $$ language 'plpgsql';

   -- Criar trigger para atualizar updated_at automaticamente
   CREATE TRIGGER update_stops_updated_at BEFORE UPDATE ON stops
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

   -- Habilitar Row Level Security (RLS)
   ALTER TABLE stops ENABLE ROW LEVEL SECURITY;

   -- Criar política para permitir leitura pública
   CREATE POLICY "Permitir leitura pública" ON stops
     FOR SELECT USING (true);

   -- Criar política para permitir inserção pública (ajuste conforme necessário)
   CREATE POLICY "Permitir inserção pública" ON stops
     FOR INSERT WITH CHECK (true);
   ```

3. **Criar Tabela de Rotas (Opcional)**
   
   Para salvar rotas otimizadas:

   ```sql
   -- Criar tabela de rotas salvas
   CREATE TABLE IF NOT EXISTS routes (
     id SERIAL PRIMARY KEY,
     name TEXT NOT NULL,
     stops_data JSONB NOT NULL,
     total_distance DECIMAL(10, 2),
     estimated_time INTEGER,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
   );

   -- Criar índice
   CREATE INDEX idx_routes_created_at ON routes(created_at DESC);

   -- Habilitar RLS
   ALTER TABLE routes ENABLE ROW LEVEL SECURITY;

   -- Políticas
   CREATE POLICY "Permitir leitura pública de rotas" ON routes
     FOR SELECT USING (true);

   CREATE POLICY "Permitir inserção pública de rotas" ON routes
     FOR INSERT WITH CHECK (true);
   ```

### 1.3 Configurar Storage

1. **Criar Bucket para Fotos**
   - No menu lateral, clique em "Storage"
   - Clique em "Create bucket"
   - Configure:
     - **Name**: `delivery-photos`
     - **Public**: Marque esta opção ✅
     - **File size limit**: 5MB (ou conforme necessário)
     - **Allowed MIME types**: `image/jpeg, image/png, image/webp`
   - Clique em "Create bucket"

2. **Configurar Políticas do Storage**
   
   Clique no bucket criado e vá em "Policies":

   ```sql
   -- Permitir upload público
   CREATE POLICY "Permitir upload público" ON storage.objects
     FOR INSERT WITH CHECK (bucket_id = 'delivery-photos');

   -- Permitir leitura pública
   CREATE POLICY "Permitir leitura pública" ON storage.objects
     FOR SELECT USING (bucket_id = 'delivery-photos');

   -- Permitir delete (opcional - apenas para usuários autenticados)
   CREATE POLICY "Permitir delete para autenticados" ON storage.objects
     FOR DELETE USING (bucket_id = 'delivery-photos' AND auth.role() = 'authenticated');
   ```

### 1.4 Obter Credenciais

1. **Acessar Configurações da API**
   - No menu lateral, clique em "Settings"
   - Depois em "API"

2. **Copiar Credenciais**
   
   Você precisará de:
   - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **Anon/Public Key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   
   ⚠️ **IMPORTANTE**: Guarde essas credenciais com segurança!

---

## 2. Deploy no Vercel

### 2.1 Preparar o Projeto

1. **Criar arquivo `.env.local`** (se ainda não existe)
   
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. **Verificar `.gitignore`**
   
   Certifique-se de que `.env.local` está no `.gitignore`:
   ```
   .env.local
   ```

### 2.2 Deploy via GitHub

1. **Conectar GitHub ao Vercel**
   - Acesse [https://vercel.com](https://vercel.com)
   - Faça login com sua conta GitHub
   - Clique em "New Project"

2. **Importar Repositório**
   - Procure por `rota-facil`
   - Clique em "Import"

3. **Configurar Projeto**
   - **Framework Preset**: Next.js (deve ser detectado automaticamente)
   - **Root Directory**: `.` (deixe vazio)
   - **Build Command**: `npm run build` (padrão)
   - **Output Directory**: `.next` (padrão)

4. **Configurar Variáveis de Ambiente**
   
   Clique em "Environment Variables" e adicione:
   
   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxxxxxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` |
   | `OSRM_URL` | `http://router.project-osrm.org` (opcional) |

5. **Deploy**
   - Clique em "Deploy"
   - Aguarde o build (3-5 minutos)
   - Sua aplicação estará disponível em: `https://rota-facil.vercel.app`

### 2.3 Deploy via CLI (Alternativa)

1. **Instalar Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Deploy**
   ```bash
   vercel
   ```

4. **Seguir as instruções**
   - Confirme o diretório do projeto
   - Escolha as configurações padrões
   - Configure as variáveis de ambiente quando solicitado

---

## 3. Configurações Finais

### 3.1 Domínio Customizado (Opcional)

1. **No painel do Vercel**
   - Vá em "Settings" → "Domains"
   - Clique em "Add"
   - Digite seu domínio: `rotafacil.com.br`
   - Siga as instruções de DNS

2. **Configurar DNS**
   
   Adicione no seu provedor de DNS:
   ```
   Tipo: A
   Nome: @
   Valor: 76.76.21.21
   
   Tipo: CNAME
   Nome: www
   Valor: cname.vercel-dns.com
   ```

### 3.2 Configurar CORS no Supabase

Se encontrar erros de CORS:

1. **No Supabase Dashboard**
   - Vá em "Settings" → "API"
   - Em "CORS Configuration"
   - Adicione seu domínio Vercel:
     ```
     https://rota-facil.vercel.app
     https://rotafacil.com.br
     ```

### 3.3 Monitoramento

1. **Analytics no Vercel**
   - Ative o Vercel Analytics (gratuito até 2.5k eventos/mês)
   - Vá em "Analytics" → "Enable"

2. **Logs de Erro**
   - Configure alertas em "Settings" → "Notifications"
   - Integre com Slack/Discord para notificações

---

## 4. Troubleshooting

### Problemas Comuns e Soluções

#### 🔴 Erro: "Failed to fetch"
**Solução**: Verifique as variáveis de ambiente no Vercel

#### 🔴 Erro: "CORS policy"
**Solução**: 
1. Adicione o domínio nas configurações CORS do Supabase
2. Verifique se as URLs estão corretas (com https://)

#### 🔴 Erro: "Storage bucket not found"
**Solução**: 
1. Verifique se o bucket `delivery-photos` foi criado
2. Confirme que está marcado como público

#### 🔴 Build falhou no Vercel
**Solução**:
1. Verifique os logs de build
2. Rode `npm run build` localmente
3. Corrija erros de TypeScript/ESLint

#### 🔴 OCR não funciona em produção
**Solução**:
1. Tesseract.js funciona no cliente
2. Para melhor performance, considere usar uma API de OCR dedicada

### Comandos Úteis

```bash
# Verificar build local
npm run build

# Testar produção local
npm run start

# Verificar tipos TypeScript
npm run type-check

# Limpar cache
rm -rf .next node_modules
npm install
```

---

## 📞 Suporte

### Recursos Úteis

- **Documentação Next.js**: [nextjs.org/docs](https://nextjs.org/docs)
- **Documentação Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **Documentação Vercel**: [vercel.com/docs](https://vercel.com/docs)
- **Status dos Serviços**:
  - Supabase: [status.supabase.com](https://status.supabase.com)
  - Vercel: [vercel-status.com](https://vercel-status.com)

### Checklist Final

- [ ] Banco de dados criado no Supabase
- [ ] Storage bucket configurado
- [ ] Variáveis de ambiente configuradas
- [ ] Deploy bem-sucedido no Vercel
- [ ] Testado upload de imagem
- [ ] Testado OCR e extração de endereço
- [ ] Testado otimização de rota
- [ ] PWA funcionando (instalável)

---

🎉 **Parabéns!** Seu RotaFácil está no ar e pronto para otimizar entregas!