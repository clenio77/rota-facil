# Design Visual do RotaFácil 🎨

## 🎨 Paleta de Cores

### Cores Principais
- **Azul Principal**: `#3B82F6` (blue-600)
- **Azul Escuro**: `#2563EB` (blue-700)
- **Fundo Claro**: `#F9FAFB` (gray-50)
- **Texto Principal**: `#111827` (gray-900)

### Cores de Status
- **Sucesso**: `#10B981` (green-600)
- **Aviso**: `#F59E0B` (yellow-600)
- **Erro**: `#EF4444` (red-600)
- **Info**: `#3B82F6` (blue-600)

## 📱 Componentes Visuais

### 1. Layout Principal
```
┌────────────────────────────────────┐
│  🗺️ RotaFácil    Entregas otimizadas│ ← Header Gradiente (blue-600 → blue-700)
├────────────────────────────────────┤
│                                    │
│  ┌──────────────────────────────┐ │
│  │ 📱 Minhas Paradas            │ │ ← Card Principal
│  │                              │ │
│  │  Total: 5 | ✅ 3 | ⏳ 2      │ │ ← Estatísticas
│  │                              │ │
│  │ [+ Adicionar] [🚀 Otimizar] │ │ ← Botões de Ação
│  └──────────────────────────────┘ │
│                                    │
│  ┌──────────────────────────────┐ │
│  │ 1️⃣ │ 📷 │ ✅ Confirmado      │ │ ← StopCard
│  │    │    │ Rua Example, 123   │ │
│  └──────────────────────────────┘ │
│                                    │
├────────────────────────────────────┤
│  🏠        🗺️        ⚙️           │ ← Bottom Navigation
└────────────────────────────────────┘
```

### 2. StopCard - Estados Visuais

#### Estado: Enviando
```
┌─────────────────────────────────────┐
│      │ ⬜⬜⬜ │ ⏫ Enviando...      │
│      │ ⬜⬜⬜ │ Aguardando...       │
│      │ ⬜⬜⬜ │                     │
└─────────────────────────────────────┘
```

#### Estado: Processando
```
┌─────────────────────────────────────┐
│  2️⃣  │  📷   │ 🔄 Processando...    │
│      │ [IMG] │ Extraindo endereço...│
│      │       │                      │
└─────────────────────────────────────┘
```

#### Estado: Confirmado
```
┌─────────────────────────────────────┐
│  3️⃣  │  📷   │ ✅ Confirmado    [🗑️]│
│      │ [IMG] │ Av. Paulista, 1000  │
│      │       │ São Paulo - SP      │
└─────────────────────────────────────┘
```

### 3. Mapa Interativo
```
┌────────────────────────────────────┐
│         Rota Otimizada             │
├────────────────────────────────────┤
│  ┌────────────────────────────┐   │
│  │                            │   │
│  │    1️⃣━━━━━2️⃣               │   │
│  │     ┃      ┃               │   │
│  │     ┃      ┃               │   │
│  │     ┃      3️⃣━━━━4️⃣        │   │
│  │     ┃             ┃        │   │
│  │     5️⃣━━━━━━━━━━━┛        │   │
│  │                            │   │
│  │  [🗺️ OpenStreetMap]        │   │
│  └────────────────────────────┘   │
│                                    │
│  📏 Distância: 12.5 km            │
│  ⏱️ Tempo estimado: 38 min         │
└────────────────────────────────────┘
```

## 🎯 Princípios de Design

### 1. **Simplicidade**
- Interface limpa e intuitiva
- Foco na funcionalidade principal
- Redução de cliques necessários

### 2. **Feedback Visual**
- Animações suaves (slideIn, fadeIn)
- Estados claros e distintos
- Loading states informativos

### 3. **Mobile-First**
- Otimizado para uso em smartphones
- Botões grandes e espaçados
- Gestos naturais (swipe, tap)

### 4. **Acessibilidade**
- Contraste adequado (WCAG AA)
- Textos legíveis
- Áreas de toque amplas (min 44x44px)

## 🎭 Animações

### Entrada de Componentes
```css
@keyframes slideIn {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
```

### Hover em Cards
```css
.card-hover {
  transition: all 0.2s;
  hover: {
    shadow: lg;
    scale: 1.02;
  }
}
```

### Loading Spinner
```css
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

## 📱 Responsividade

### Mobile (< 640px)
- Layout em coluna única
- Bottom navigation fixa
- Cards ocupam largura total

### Tablet (640px - 1024px)
- Grid de 2 colunas para cards
- Sidebar opcional
- Mapa em tela cheia

### Desktop (> 1024px)
- Layout em 3 colunas
- Mapa ao lado da lista
- Navegação no header

## 🌈 Modo Escuro (Futuro)

Preparado para implementação futura:
- Variáveis CSS customizadas
- Transições suaves
- Preservação de preferência do usuário

## 🎯 Métricas de Performance

- **First Contentful Paint**: < 1.2s
- **Time to Interactive**: < 3.5s
- **Lighthouse Score**: > 90
- **Tamanho do Bundle**: < 200KB

## 🔧 Componentes Customizados

### Badges de Status
```tsx
<span className="badge badge-success">
  ✅ Confirmado
</span>
```

### Botões Primários
```tsx
<button className="btn-primary">
  🚀 Otimizar Rota
</button>
```

### Cards Interativos
```tsx
<div className="card-hover shadow-custom">
  {/* Conteúdo */}
</div>
```

---

Este design foi criado pensando em **eficiência**, **beleza** e **usabilidade**, garantindo uma experiência excepcional para os entregadores.