# 🚀 Guia Rápido - RotaFácil em 15 minutos!

Este é um guia super rápido para colocar o RotaFácil no ar em menos de 15 minutos.

## ⏱️ Timeline
- **5 min**: Configurar Supabase
- **5 min**: Deploy no Vercel
- **5 min**: Testes e ajustes

---

## 1️⃣ Supabase (5 minutos)

### A. Criar Projeto
1. Acesse [supabase.com](https://supabase.com) → **Start your project**
2. Login com GitHub
3. **New project** com estes dados:
   ```
   Name: rotafacil
   Password: [crie uma senha forte]
   Region: South America (São Paulo)
   ```

### B. Executar SQL
1. Menu lateral → **SQL Editor** → **New query**
2. **Cole TODO este código** e clique em **RUN**:

```sql
-- CRIAÇÃO COMPLETA DO BANCO DE DADOS ROTAFÁCIL

-- 1. Tabela de paradas
CREATE TABLE IF NOT EXISTS stops (
  id SERIAL PRIMARY KEY,
  photo_url TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 2. Índices
CREATE INDEX idx_stops_created_at ON stops(created_at DESC);
CREATE INDEX idx_stops_coordinates ON stops(latitude, longitude);

-- 3. RLS e Políticas
ALTER TABLE stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura pública" ON stops
  FOR SELECT USING (true);

CREATE POLICY "Permitir inserção pública" ON stops
  FOR INSERT WITH CHECK (true);

-- 4. Bucket de Storage (execute separadamente se der erro)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('delivery-photos', 'delivery-photos', true);

-- 5. Políticas do Storage
CREATE POLICY "Permitir upload público 1" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'delivery-photos');

CREATE POLICY "Permitir leitura pública 1" ON storage.objects
  FOR SELECT USING (bucket_id = 'delivery-photos');
```

### C. Pegar Credenciais
1. Menu lateral → **Settings** → **API**
2. Copie e salve:
   - **URL**: `https://xxxxxxxxxxxxx.supabase.co`
   - **anon key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

## 2️⃣ Vercel (5 minutos)

### A. Importar Projeto
1. Acesse [vercel.com](https://vercel.com) → Login com GitHub
2. **New Project** → Procure `rota-facil` → **Import**

### B. Configurar Variáveis
Adicione estas variáveis de ambiente:

```env
NEXT_PUBLIC_SUPABASE_URL=cola_aqui_sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=cola_aqui_sua_anon_key_do_supabase
```

### C. Deploy
1. Clique em **Deploy**
2. Aguarde ~3 minutos
3. Pronto! Acesse sua URL: `https://rota-facil-seu-usuario.vercel.app`

---

## 3️⃣ Teste Rápido (5 minutos)

### Checklist de Verificação:
- [ ] Site abre sem erros
- [ ] Botão "Adicionar Parada" funciona
- [ ] Consegue tirar/selecionar foto
- [ ] Upload da foto funciona
- [ ] OCR extrai endereço (pode demorar alguns segundos)
- [ ] Com 2+ paradas, botão "Otimizar Rota" aparece
- [ ] Mapa mostra as paradas

---

## 🆘 Problemas Comuns

### "Failed to fetch" ou erro de rede
```env
# Verifique se as variáveis no Vercel estão corretas:
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJI...
```

### Storage não funciona
1. No Supabase → **Storage**
2. Verifique se o bucket `delivery-photos` existe
3. Deve estar marcado como **Public**

### Build falhou no Vercel
```bash
# Teste localmente primeiro:
npm install
npm run build
```

---

## 📱 Dicas Extras

### Instalar como App (PWA)
1. Abra o site no celular
2. Chrome: Menu → "Adicionar à tela inicial"
3. Safari: Compartilhar → "Adicionar à Tela de Início"

### Domínio Personalizado
1. Vercel → Settings → Domains
2. Adicione: `seudominio.com.br`
3. Configure DNS conforme instruções

### Performance
- Use imagens < 2MB para OCR mais rápido
- Tire fotos com boa iluminação
- Endereço deve estar legível na foto

---

## 🎯 Comandos Úteis

```bash
# Desenvolvimento local
git clone https://github.com/seu-usuario/rota-facil
cd rota-facil
npm install
npm run dev

# Criar .env.local
echo "NEXT_PUBLIC_SUPABASE_URL=sua_url_aqui" >> .env.local
echo "NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_key_aqui" >> .env.local
```

---

## 📊 Métricas de Sucesso

Após deploy, você deve conseguir:
- ✅ Adicionar 5 paradas em < 2 minutos
- ✅ Ver rota otimizada no mapa
- ✅ Instalar como app no celular
- ✅ Usar offline (após primeira visita)

---

## 🏁 Próximos Passos

1. **Personalizar**
   - Mude cores em `app/globals.css`
   - Ajuste logo em `app/layout.tsx`
   - Configure nome em `public/manifest.json`

2. **Melhorar**
   - Adicione autenticação (Supabase Auth)
   - Salve rotas favoritas
   - Exporte para Google Maps

3. **Monetizar**
   - Limite free: 50 rotas/mês
   - Plano Pro: rotas ilimitadas
   - API para empresas

---

🎉 **Parabéns!** Você tem um app de otimização de rotas funcionando!

💡 **Dica**: Entre no [Discord da Vercel](https://vercel.com/discord) para suporte da comunidade.