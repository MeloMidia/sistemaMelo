# Dashboard Premium Redesign — sistemaMelo

**Data:** 2026-06-18
**Status:** Aprovado para implementação

---

## Contexto

O dashboard atual (implementado no redesign de 2026-06-15, inspirado no padrão Mercado Livre) funciona bem, mas o visual usa muitas cores concorrentes por categoria (âmbar para vendas, índigo para SDR, verde/prata/ouro para metas, vermelho para alertas), orbs de gradiente borrado decorativos em quase todo card, e classes Tailwind ad-hoc repetidas sem um padrão central (`bg-white/[0.02]`, `border-white/[0.05]` etc. espalhados por todos os componentes).

O pedido é elevar o visual para um padrão "SaaS premium" no estilo Linear/Vercel: minimalista, dark, tipografia refinada, cor usada com intenção (não como textura ambiente), hierarquia visual clara.

**Escopo:** apenas a aba Dashboard (`DashboardView` e seus componentes filhos). O shell do app (navbar com as 4 abas em `page.tsx`) e as outras abas (Kanban, Mentoria, Gestão de Tarefas) ficam fora deste redesign.

---

## Princípios visuais

1. **1 accent + neutros** — índigo (`#6366f1`) é a única cor de marca/ação do dashboard. Todo o resto (textos, bordas, superfícies) em tons de slate/zinc neutros. Vermelho fica reservado exclusivamente para alertas semânticos reais (falta-lead, delta negativo) — não é mais usado como "cor de categoria".
2. **Sem decoração gratuita** — remover os orbs de gradiente blur que hoje aparecem dentro de quase todo card (`absolute ... bg-gradient-to-br ... blur-3xl`). Cor deve aparecer com propósito pontual, não como textura ambiente repetida em cada superfície.
3. **Hierarquia tipográfica mais clara** — títulos de seção com peso e tracking consistentes; números grandes com peso forte; labels uppercase pequenos só onde ajudam a escanear informação, não como padrão decorativo.
4. **Bordas e profundidade discretas** — bordas 1px bem sutis, sem `border-t-2` colorido usado como categorização visual. Profundidade vem de elevação sutil no hover (leve mudança de superfície), não de glow colorido.

---

## Abordagem técnica: tokens próprios do dashboard

Em vez de espalhar valores Tailwind ad-hoc (situação atual) ou migrar para os tokens shadcn globais (`--card`, `--border`, `--primary` em `globals.css`, que afetariam Kanban/Mentoria/Tarefas também), o dashboard recebe seu próprio pequeno conjunto de tokens, escopados via uma classe wrapper `.dash` no container raiz do `DashboardView`. Isso garante consistência interna sem nenhum risco de vazar para o resto do app.

Bloco a adicionar em `src/app/globals.css` (após a seção "Custom Design Tokens" existente):

```css
/* Dashboard design tokens — escopo: DashboardView e filhos (classe .dash) */
.dash {
  --dash-surface: rgba(255, 255, 255, 0.025);
  --dash-surface-hover: rgba(255, 255, 255, 0.045);
  --dash-border: rgba(255, 255, 255, 0.07);
  --dash-border-strong: rgba(255, 255, 255, 0.12);
  --dash-accent: #6366f1;
  --dash-accent-soft: rgba(99, 102, 241, 0.12);
  --dash-text-muted: #8b94a7;
  --dash-text-faint: #5b6478;
  --dash-danger: #ef4444;
}
```

Uso nos componentes via classes Tailwind com valor arbitrário referenciando a var, ex.: `bg-[var(--dash-surface)] border border-[var(--dash-border)] hover:bg-[var(--dash-surface-hover)]`.

A classe `.dash` é aplicada no `div` raiz de `DashboardView` (`src/components/dashboard/dashboard-view.tsx`), junto das classes existentes (`flex-1 overflow-y-auto ...`).

---

## Mudanças por componente

### `PeriodSelector` (`period-selector.tsx`)
Mantém os `<select>` nativos (fora de escopo trocar por dropdown custom), mas o trigger visual é restilizado: borda sutil única (`--dash-border`), sem fundo extra, foco com ring accent único. Remove qualquer resquício de cor fora do accent.

### Top bar de ações (`SdrLaunchModal`, `EditMetricModal`, `AddMetricModal` — botões trigger)
Os três botões hoje têm estilos visuais distintos (gradiente índigo, outline, etc). Passam a usar um único estilo "ghost com borda" consistente (`border-[var(--dash-border)] hover:bg-[var(--dash-surface-hover)]`), com o ícone + texto como única diferenciação entre eles. Nenhuma mudança de comportamento/fluxo dos modais — só a casca visual (superfície, borda, inputs com foco accent único) usando os novos tokens.

### Card "Meta de Vendas (Faturamento)" e "Falta para a Meta"
Remove os orbs de gradiente decorativos (`bg-gradient-to-br from-emerald-500...`, `from-yellow-500...`). A barra de progresso de 3 tiers vira uma única barra sólida na cor accent, com 3 marcadores finos (linhas verticais discretas, `bg-[var(--dash-border-strong)]`) indicando as divisões de meta, e labels neutros (`text-[var(--dash-text-faint)]`) abaixo — sem cores diferentes por segmento. O card "Falta para a Meta" perde o blur amarelo e o texto degradê; vira card neutro com número grande em branco.

### `TriGoalBar` (`tri-goal-bar.tsx`)
Mesma lógica do card de metas: troca os 3 segmentos coloridos (verde/prata/ouro) por uma única barra de preenchimento accent contínua, com linhas divisórias finas nas posições de `goal1`/`goal2`. Em vez da cor indicar o tier atingido, um badge de texto pequeno (ex. "Tier 2 de 3") ao lado do percentual comunica o progresso. Percentual já não usa gradiente texto verde→amarelo — vira texto sólido accent ou branco.

### `KpiCard` (`kpi-card.tsx`)
Remove `topBorderClasses` (borda superior colorida por `colorVariant`) — essa categorização visual por cor deixa de existir; os 4 `colorVariant` (`blue`/`amber`/`red`/`default`) são descontinuados em favor de uma superfície neutra padrão para todos os KPIs. O `delta` continua colorido (verde/vermelho/cinza) pois é semântico (indica direção), não categórico. Ícone, quando presente, fica em tom neutro (`--dash-text-muted`).

### `FunnelChart` (`funnel-chart.tsx`)
A paleta `COLORS` (hoje 4 cores distintas: índigo, índigo claro, lilás, âmbar) passa a usar variações de opacidade de um único tom accent (ex.: `#6366f1` em 100%, 80%, 60%, 40%) — comunica progressão do funil sem introduzir cores novas.

### `DailyLineChart` (`daily-line-chart.tsx`)
As 3 séries (hoje rosa `#e91e8c`, turquesa `#06c5b2`, violeta `#7c4dff`) passam a usar: accent cheio para "Leads WA", accent mais claro/tracejado para "Agendadas", e um tom neutro slate para "Realizadas" — eliminando a paleta multicolor.

### Seções "Vendas & Faturamento" e "Métricas SDR"
O label uppercase "Reuniões & Leads" em índigo (`text-indigo-400`) ao lado do título da seção SDR é removido (era uma marcação de categoria por cor); títulos de seção ficam visualmente idênticos entre si (mesmo peso/cor), sem diferenciação de cor entre "Vendas" e "SDR".

---

## O que não muda

- Estrutura e ordem das seções da página: Metas → Vendas & Faturamento → Métricas SDR → Gráficos.
- Lógica de negócio: queries, server actions, cálculo de metas/deltas/percentuais.
- Biblioteca de gráficos (Recharts) e os dados que alimentam cada gráfico.
- Navbar/shell do app (`page.tsx`) e as abas Kanban, Mentoria e Gestão de Tarefas.
- Comportamento funcional dos modais (campos, validação, fluxo de salvar/editar) — apenas a casca visual é redesenhada.
- Sistema de tokens shadcn global (`--card`, `--border`, `--primary` em `globals.css`) — permanece intacto para o resto do app.

---

## Fora de escopo (explicitamente adiado)

- Substituir os `<select>` nativos do `PeriodSelector` por um dropdown customizado (Radix) — mencionado como possibilidade durante o brainstorming, mas descartado para manter o escopo focado em estilo visual, não em novos componentes de interação.
- Qualquer redesign do shell/navbar ou das outras 3 abas do app.
- Mudança na hierarquia/agrupamento das seções do dashboard.
