# 🔧 Configuração de Variáveis de Ambiente

## ✅ **Passo 1: Configurar Supabase Local**

1. **Abra o Supabase Dashboard**: https://supabase.com/dashboard
2. **Selecione seu projeto** "rota-facil"
3. **Vá em Settings > API**
4. **Copie as credenciais:**

```bash
# Edite o arquivo .env.local com suas credenciais reais:
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO-ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SUA-CHAVE-ANON-AQUI
```

## ✅ **Passo 2: Configurar Vercel (Deploy)**

1. **Abra o Vercel Dashboard**: https://vercel.com/dashboard
2. **Selecione seu projeto** "rota-facil"
3. **Vá em Settings > Environment Variables**
4. **Adicione as mesmas variáveis:**

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU-PROJETO-ID.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.SUA-CHAVE-ANON-AQUI` |

## ✅ **Passo 3: Testar Localmente**

```bash
# Reiniciar o servidor local
npm run dev
```

## ✅ **Passo 4: Deploy no Vercel**

```bash
# Fazer deploy com as novas variáveis
vercel --prod
```

## 🧪 **Teste do Sistema**

Após configurar, o sistema deve:
1. ✅ **Detectar listas ECT** automaticamente
2. ✅ **Filtrar endereços** por cidade (Uberlândia)
3. ✅ **Rejeitar endereços** de outras cidades
4. ✅ **Aceitar endereços** de Uberlândia

## 🔍 **Verificação**

- **Local**: http://localhost:3000
- **Produção**: https://seu-projeto.vercel.app
- **Console**: Verificar logs de OCR e filtros
