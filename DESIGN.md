# SistemaMelo - Design & Frontend System

Este documento consolida as diretrizes de desenvolvimento Front-end e UX/UI para o projeto SistemaMelo, baseadas nas melhores práticas de engenharia e design.

## 🎨 Identidade Visual (Premium Dark)

O sistema utiliza uma estética "Premium Dark" com toques de glassmorfismo e profundidade.

### Tokens de Cores (OKLCH)
Utilizamos o espaço de cores OKLCH para gradientes mais suaves e cores mais vibrantes e precisas.

- **Background**: `oklch(0.145 0 0)` (Preto profundo)
- **Primary**: `oklch(0.922 0 0)` (Branco puro para destaque)
- **Accent**: Tons de Azul e Indigo para interatividade.
- **Glassmorphism**: 
  - `bg: white/4%`
  - `border: white/8%`
  - `blur: 12px`

### Tipografia
- **Heading**: Poppins (Moderno, geométrico)
- **Sans**: Inter (Altamente legível para dados)
- **Mono**: Fira Code (Para referências técnicas)

---

## 🛠️ Padrões de Desenvolvimento (Skills Aplicadas)

### 1. Composição de Componentes (React 19)
Seguimos o padrão de **Composition Over Inheritance**.
- Componentes pequenos e focados.
- Uso de `Compound Components` para elementos complexos (como abas e menus).
- Validação rigorosa com TypeScript.

### 2. Gestão de Estado
- **Server State**: `@tanstack/react-query` para cache e sincronização de dados.
- **Client State**: `Zustand` para estados globais leves (ex: preferências de UI).
- **Forms**: Controlados via state ou bibliotecas como `react-hook-form`.

### 3. Performance & UX
- **Skeleton Screens**: Carregamento progressivo em vez de spinners genéricos.
- **Micro-interações**: Feedback tátil em todos os botões e inputs.
- **Virtualização**: Listas longas de tarefas devem usar virtualização para manter 60fps.
- **Debouncing**: Buscas e inputs de alta frequência são debounced.

### 4. Acessibilidade (A11y)
- Foco total em teclado (`focus-visible`).
- Uso de componentes Radix UI (via shadcn) para garantir padrões WAI-ARIA.
- Contraste de cores validado para legibilidade.

---

## 🚀 Próximos Passos de Melhoria
1. **Framer Motion**: Adicionar transições de página e entradas de lista animadas.
2. **Error Boundaries**: Implementar tratamento de erro granular por seção.
3. **Optimistic Updates**: Refinar a criação de tarefas para refletir no UI instantaneamente antes da confirmação do servidor.

---
*Este guia deve ser seguido para manter a consistência visual e técnica do SistemaMelo.*
