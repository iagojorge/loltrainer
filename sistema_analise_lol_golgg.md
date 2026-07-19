# Sistema de Análise de Partidas League of Legends (estilo gol.gg)

## Visão Geral

Você está desenvolvendo uma **plataforma de análise competitiva para times de League of Legends** que funciona como um hub centralizado de dados, estatísticas e históricos de partidas, similar ao **gol.gg** (Game of Legends esports).

Esta plataforma permite que times profissionais, coaches e analistas rastreiem, analisem e otimizem o desempenho das partidas através de dados detalhados, gráficos interativos e filtros avançados.

---

## 1. IMPORTAÇÃO E INTEGRAÇÃO DE DADOS

### 1.1 Fonte de Dados Principal
- **API Riot Games** (match-v5, league-v4)
- **Input**: Game ID do League of Legends
- **Validação**: Confirmar que o Game ID é válido antes de processar

### 1.2 Dados Extraídos Automaticamente
- Informações gerais da partida:
  - Data, horário e duração
  - Resultado (Win/Loss)
  - Série/Contexto (Playoffs, Regular Season, Qualificatórios, Treino)
  - Patch da partida
  
- Dados de cada jogador (5 por time):
  - Nick/Tag do jogador
  - Campeão jogado
  - Posição/Role (Top, Jungle, Mid, ADC, Support)
  - Nível final
  
- Estatísticas detalhadas por jogador:
  - KDA (Kills, Deaths, Assists)
  - CS total e CS/min
  - Dano dealer (físico, mágico, true damage)
  - Dano recebido
  - Ouro gerado e ouro por minuto
  - Wards colocados e destruídos
  - Vision score
  - CC (Crowd Control) aplicado
  - Participação em kills (%)
  
- Timeline completa da partida:
  - Kills com timestamps
  - Torres destruídas
  - Dragões (tipo e timestamp)
  - Barão Nashor
  - Inhibidores
  - Eventos de visão
  
- Builds e Runas:
  - Itens construídos na ordem com timestamp
  - Runas primárias e secundárias
  - Shards
  
- Análise temporal:
  - Evolução de ouro por time
  - Evolução de kills
  - Evolução de níveis
  - Mapa de expansão territorial

---

## 2. DASHBOARD PRINCIPAL

### 2.1 Visualização Padrão
- **Tipo**: Tabela interativa com cards complementares
- **Objetivo**: Exibir histórico de todas as partidas registradas

### 2.2 Informações Visíveis por Padrão
Cada linha da tabela contém:

| Campo | Descrição |
|-------|-----------|
| Data/Horário | Quando a partida foi disputada |
| Resultado | WIN (verde) ou LOSS (vermelho) |
| Duração | Tempo total da partida |
| Nicks | Nomes dos 5 jogadores do time |
| Campeões | Champion de cada posição com ícone |
| KDA | Kills/Deaths/Assists agregado |
| CS/min | Farm médio do time |
| Dano Total | Dano dealer do time |
| Série | Tipo de competição |
| Patch | Versão do jogo |

### 2.3 Layout Responsivo
- **Desktop**: Tabela completa com todas as colunas
- **Tablet**: Colunas reduzidas com opção de expandir
- **Mobile**: Cards empilhados com informações essenciais

### 2.4 Ordenação e Paginação
- Ordenar por: Data (padrão), Resultado, Duração, Win Rate
- Paginação: 10, 25, 50 partidas por página
- Busca rápida: Filtrar por nick ou campeão

---

## 3. SISTEMA DE FILTROS AVANÇADOS

### 3.1 Filtros Disponíveis
Todos os filtros podem ser combinados simultaneamente:

#### **Por Versão do Jogo**
- Patch específico (ex: 14.11, 14.12)
- Range de patches
- Patch atual vs histórico

#### **Por Jogador**
- Filtrar por nick/tag específico
- Múltiplos nicknames (AND/OR)
- Excluir jogadores

#### **Por Campeão**
- Selecionar campeão específico
- Múltiplos campeões (OR)
- Por posição/role (Top, Jungle, Mid, ADC, Support)

#### **Por Resultado**
- Vitórias apenas
- Derrotas apenas
- Todos os resultados

#### **Por Período**
- Últimas 24 horas
- Últimos 7 dias
- Últimos 30 dias
- Range customizado (data início - data fim)
- Por mês/semana específica

#### **Por Contexto**
- Playoffs
- Regular Season
- Qualificatórios
- Treino/Scrimmage

#### **Por Adversário**
- Contra time específico
- Múltiplos adversários

#### **Por Duração**
- Early game: < 25 minutos
- Mid game: 25-35 minutos
- Late game: > 35 minutos

### 3.2 Aplicação de Filtros
- Interface visual com checkboxes e dropdowns
- Botão "Limpar Filtros" para reset
- Salvar filtros favoritos
- Indicador visual de filtros ativos
- Resultado: "Mostrando 7 de 142 partidas"

---

## 4. CLIQUE EM CAMPEÃO - ANÁLISE DETALHADA

### 4.1 Visão Geral do Campeão
Ao clicar em um campeão, exibe uma tela dedicada com:

#### **Estatísticas Agregadas (Cards Resumidos)**
```
┌─────────────────────────────────┐
│  AHRI (MID)                     │
│  ⭐⭐⭐⭐⭐ 4.8/5.0           │
├─────────────────────────────────┤
│  Games Played:        16        │
│  Win Rate:            75% ✓     │
│  Pick Rate:           80%       │
│  Ban Rate:            15%       │
│  KDA Médio:          5.2 / 2.1  │
│  CS/min Médio:       6.5        │
│  Dano/min Médio:     520        │
│  Ouro/min Médio:     385        │
│  Participação:        72%       │
│  Win Rate vs Patch:   14.11: 80%│
│                       14.12: 70%│
└─────────────────────────────────┘
```

#### **Tendências**
- Win rate ao longo dos últimos patches
- Evolução de pick rate
- Ban rate over time

### 4.2 Tabela Detalhada de Partidas
Lista todas as partidas jogadas com esse campeão:

| Data | vs Time | Resultado | KDA | CS | CS/min | Dano | Ouro | Dur | Patch |
|------|---------|-----------|-----|-------|--------|------|------|-----|-------|
| 2024-06-02 | Team X | WIN ✓ | 5/1/8 | 285 | 10.5 | 14.2k | 12.5k | 27m | 14.12 |
| 2024-06-01 | Team Y | LOSS ✗ | 2/4/5 | 240 | 8.2 | 11.8k | 10.2k | 32m | 14.12 |
| 2024-05-31 | Team Z | WIN ✓ | 6/2/7 | 310 | 11.8 | 15.5k | 13.8k | 26m | 14.11 |

#### **Recursos Adicionais**
- Expandir linha para ver build e runas
- Ordenação por: Data, Resultado, KDA, CS/min, Win Rate
- Filtros secundários: vs Time, Resultado, Patch

### 4.3 Análise de Matchups
- **Heatmap Interativo**: Campeão vs Campeões Inimigos
- **Formato**: Matriz mostrando win rate contra cada pick inimigo
- **Cores**: Verde (>60% win rate), Amarelo (40-60%), Vermelho (<40%)
- **Exemplo**:
  - Ahri vs Fizz: 2-0 (100%)
  - Ahri vs Zed: 3-1 (75%)
  - Ahri vs Yasuo: 2-1 (67%)

### 4.4 Build Análise
- Itens mais comuns nessa champion
- Build com melhor win rate
- Build histórico (últimos 10 jogos)
- Runas padrão e alternativas

### 4.5 Gráficos Específicos
- **Win Rate Temporal**: Linha mostrando tendência ao longo do tempo
- **KDA Distribuição**: Gráfico de dispersão
- **CS/min Comparação**: Bar chart vs média do time
- **Matchup Winrate**: Bar chart com win rates vs cada campeão inimigo

---

## 5. DETALHES DE PARTIDA INDIVIDUAL

### 5.1 Expandir/Clicar em Partida
Ao selecionar uma partida específica, exibir:

#### **Resumo Geral**
```
┌────────────────────────────────────────────┐
│  VITÓRIA - 28:45 - Patch 14.12             │
│  vs Team X (Playoffs - Série Bo5 Game 3)   │
├────────────────────────────────────────────┤
│  Bans nosso: Sylas, Aatrox, Kalista        │
│  Bans deles: Ahri, Zed, LeBlanc           │
└────────────────────────────────────────────┘
```

#### **Composição de Times**
- Team 1 (Our Team)
  - Top: Player1 - Champion Icon + Nome
  - Jungle: Player2 - Champion Icon + Nome
  - Mid: Player3 - Champion Icon + Nome
  - ADC: Player4 - Champion Icon + Nome
  - Support: Player5 - Champion Icon + Nome

- Team 2 (Opponent)
  - Mesma estrutura

### 5.2 Estatísticas Individuais Detalhadas
Para cada um dos 10 jogadores, exibir tabela:

| Stat | Descrição |
|------|-----------|
| **Champion** | Nome do campeão com ícone |
| **Lane** | Top/Jungle/Mid/ADC/Support |
| **Level** | Nível final (1-18) |
| **Kills** | Abates |
| **Deaths** | Mortes |
| **Assists** | Assistências |
| **KDA** | Razão KDA (ex: 5.2) |
| **Kill Participation** | % de participação em kills |
| **CS** | Creep Score total |
| **CS/min** | Farm por minuto |
| **Gold** | Ouro total gerado |
| **Gold/min** | Ouro por minuto |
| **Damage** | Dano dealer total |
| **Damage/min** | DPS |
| **Damage Taken** | Dano recebido |
| **Healing** | Cura (se aplicável) |
| **Wards Placed** | Wards colocados |
| **Wards Destroyed** | Wards destruídos |
| **Vision Score** | Pontuação de visão |
| **CC Duration** | Tempo de CC aplicado (segundos) |

### 5.3 Build por Jogador
Para cada jogador:
- **Itens na Ordem**: Sequência de construção com timestamp de cada item
- **Boot Type**: Tipo de bota (Plated Steelcaps, Mercury Treads, etc)
- **Final Build**: 6 itens finais
- **Runas**:
  - Árvore Primária (Keystone + 3 runas + 2 shards adaptativos)
  - Árvore Secundária (2 runas)
- **Evolução de Stats**: Gráfico mostrando crescimento de Ataque/Defesa ao longo do jogo

### 5.4 Timeline Interativa da Partida

#### **Eventos com Timestamps**
Listar cronologicamente:
- **Kills**: "12:34 - Player1 (Ahri) matou Player2 (Fizz) [Assist: Player3]"
- **Torres**: "14:20 - Team 1 destruiu Tier 1 Top (200g)"
- **Dragões**: "16:45 - Team 1 conquistou Fire Dragon [4 stacks]"
- **Barão**: "28:10 - Team 1 conquistou Baron Nashor"
- **Inhibidores**: "25:30 - Team 1 destruiu Mid Inhibitor"
- **First Blood**: Indicador especial no início

#### **Gráficos Temporais**
1. **Evolução de Ouro**:
   - Duas linhas (uma por time)
   - Eixo X: Tempo (minutos)
   - Eixo Y: Ouro acumulado

2. **Evolução de Kills**:
   - Duas linhas (kills cumulativas por time)
   - Mostra qual time foi ahead

3. **Evolução de Níveis**:
   - 5 linhas (uma por jogador do nosso time)
   - Mostrar quando ficou atrasado ou avançado

4. **Evolução de CS**:
   - Mostrar farm por jogador
   - Identificar quem farm melhor

#### **Mapa de Progressão**
- Mapa visual mostrando avanço das lanes
- Últimos 2-3 minutos de avanço visível
- Posições aproximadas de torres destruídas

### 5.5 Análise de Teamfights
- Listar principais teamfights com timestamps
- Para cada teamfight:
  - Participantes
  - Resultado (qual time venceu)
  - Ordem de mortes
  - Ouro conquistado após fight
  - Objetivo conquistado (torre, dragão, etc)

---

## 6. ANÁLISE POR JOGADOR (NICK)

### 6.1 Perfil do Jogador
Ao clicar em um nick específico, exibir:

#### **Resumo Geral**
- Histórico completo de partidas
- Win rate global
- Total de games
- KDA médio
- CS/min médio
- Principais campeões

#### **Tabela de Campeões**
| Campeão | Games | Win Rate | KDA | CS/min | Dano/min | Trend |
|---------|-------|----------|-----|--------|----------|-------|
| Ahri | 8 | 75% | 5.2 | 6.5 | 520 | ↑ |
| Zed | 5 | 60% | 4.8 | 5.9 | 480 | ↓ |
| LeBlanc | 3 | 67% | 5.5 | 6.2 | 510 | ↑ |

#### **Análise por Posição**
Se o jogador joga múltiplas posições:
- Win rate por role (Top, Jungle, Mid, ADC, Support)
- Gráfico de distribuição (pizza chart)
- Desempenho em cada posição

#### **Gráficos Pessoais**
- **KDA Temporal**: Evolução de KDA ao longo do tempo
- **Win Rate Temporal**: Tendência de win rate
- **CS/min Temporal**: Evolução de farm
- **Performance Scatter**: Cada partida como ponto (x=cs/min, y=kda)

---

## 7. DASHBOARD DE CONTROLE DO TIME

### 7.1 Visão Executiva Geral

#### **Cards Resumidos**
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Win Rate    │  │   Patch      │  │   Séries    │
│    67%       │  │   14.12      │  │    3-5      │
│   (12-5)     │  │              │  │             │
└──────────────┘  └──────────────┘  └──────────────┘

┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Avg Duration │  │ Avg KDA      │  │  Tendência   │
│   27:30      │  │   5.1/2.2    │  │     ↑ +8%    │
└──────────────┘  └──────────────┘  └──────────────┘
```

#### **Série Histórica Visual**
Últimas 10-15 partidas em linha:
```
[W] [W] [L] [W] [W] [W] [L] [W] [W] [L] [W] [W]
```
Com cores: Verde (W), Vermelho (L)

#### **Tendência de Desempenho**
- Gráfico de linha mostrando evolução de win rate (últimas 20 partidas)
- Indicador se está em melhora ou declínio

### 7.2 Análises Específicas

#### **Campeões Mais Jogados**
Ranking dos top 5 campeões:
| # | Campeão | Games | Win Rate |
|---|---------|-------|----------|
| 1 | Ahri | 8 | 75% |
| 2 | Zed | 5 | 60% |
| 3 | Sylas | 4 | 75% |
| 4 | LeBlanc | 3 | 67% |
| 5 | Aatrox | 3 | 66% |

#### **Campeões com Melhor Win Rate**
(Mínimo 3 jogos)
| Campeão | Games | Win Rate | Pick Rate |
|---------|-------|----------|-----------|
| Sylas | 4 | 75% | 8% |
| Ahri | 8 | 75% | 16% |
| LeBlanc | 3 | 67% | 6% |

#### **Desempenho por Posição**
Bar chart mostrando win rate de:
- Top: 65%
- Jungle: 72%
- Mid: 75%
- ADC: 58%
- Support: 70%

#### **Ranking de Jogadores**
Por KDA, Win Rate, CS/min:
| Player | KDA | Win Rate | CS/min |
|--------|-----|----------|--------|
| Player1 | 5.8 | 78% | 6.8 |
| Player2 | 5.2 | 72% | 6.2 |
| Player3 | 4.9 | 68% | 5.9 |

### 7.3 Comparações Estratégicas

#### **Composições Vencedoras**
Top composições (5 campeões) que mais ganharam:
1. Aatrox + Lee Sin + Ahri + Kalista + Leona: 3-0 (100%)
2. Sylas + Nidalee + Zed + Jinx + Thresh: 2-1 (67%)
3. Garen + Graves + LeBlanc + Sivir + Nautilus: 2-0 (100%)

#### **Matchups Críticos**
Win rate vs times específicos:
| Adversário | Games | Win Rate |
|-----------|-------|----------|
| Team X | 3 | 100% |
| Team Y | 2 | 50% |
| Team Z | 4 | 75% |

#### **Análise de Early vs Late Game**
- Win rate em partidas < 25min: 80%
- Win rate em partidas 25-35min: 70%
- Win rate em partidas > 35min: 58%

**Conclusão**: Time é forte em early game, fraco em late game

#### **Correlação de Campeões**
Quais duplas/trios de campeões ganham juntos:
- Ahri + Zed: 2-0 (100%)
- Ahri + Sylas: 3-0 (100%)
- Zed + Lee Sin: 2-1 (67%)

#### **Tendência por Patch**
Win rate em cada patch:
- Patch 14.10: 60%
- Patch 14.11: 75%
- Patch 14.12: 68%

---

## 8. GRÁFICOS E VISUALIZAÇÕES

### 8.1 Tipos de Gráficos Implementados

#### **Gráficos de Comparação**
- **Bar Chart (Coluna/Barra)**: Win rate por campeão, KDA por jogador
- **Horizontal Bar**: Ranking de campeões
- **Stacked Bar**: Distribuição por categoria

#### **Gráficos de Série Temporal**
- **Line Chart**: Win rate over time, KDA trend, patch evolution
- **Area Chart**: Visualizar acumulação (ouro, kills, cs)
- **Step Chart**: Evolução discreta (levels)

#### **Gráficos de Distribuição**
- **Pie Chart**: Distribuição de posições/roles
- **Donut Chart**: Proporção de wins vs losses
- **Heatmap**: Matchup matrix (campeão vs campeão)

#### **Gráficos Interativos**
- **Scatter Plot**: Cada partida como ponto (x vs y: cs/min vs kda)
- **Radar/Spider Chart**: Comparação multidimensional de stats
- **Timeline Visual**: Eventos da partida com linha do tempo

#### **Gráficos Específicos de LoL**
- **Gold Evolution**: Duas linhas mostrando economia dos times
- **Kill Tracker**: Kills cumulativas ao longo do tempo
- **Objective Tracker**: Timeline com dragões, barons, torres
- **Mapa de Progressão**: Visualização geográfica do avanço

### 8.2 Gráficos Mandatórios

1. **Win Rate por Campeão** (Bar Chart)
2. **Win Rate Temporal** (Line Chart)
3. **KDA Médio Comparativo** (Bar Chart)
4. **Distribuição de Wins/Losses** (Pie Chart)
5. **Matchup Matrix** (Heatmap)
6. **Performance por Posição** (Bar Chart)
7. **Evolução de Ouro** (Line Chart - timeline da partida)
8. **Evolução de Kills** (Line Chart - timeline da partida)
9. **Campeões Mais Jogados** (Donut Chart)
10. **Win Rate por Patch** (Line Chart)

### 8.3 Interatividade
- Tooltips ao passar mouse
- Zoom em gráficos de linha
- Filtrar dados ao clicar em elementos
- Exportar gráfico como imagem (PNG)
- Responsivo em diferentes tamanhos de tela

---

## 9. RECURSOS AVANÇADOS

### 9.1 Exportação de Dados
- **Formatos Suportados**:
  - CSV: Exportar tabelas para Excel
  - PDF: Relatório formatado com gráficos
  - PNG/JPG: Exportar gráficos individuais
  - JSON: Exportar dados brutos para integração

- **Conteúdo Exportável**:
  - Histórico de partidas
  - Estatísticas de campeão
  - Gráficos
  - Relatórios customizados

### 9.2 Comparação de Patches
- Mostrar performance em cada versão
- Campeões que melhoraram/pioraram
- Win rate evolution por patch
- Identificar patches problemáticos

### 9.3 Análise de Adversários
- Estatísticas do time inimigo
- Campeões favoritos vs cada adversário
- Matchups históricos
- Predição de próximos picks

### 9.4 Relatórios Automáticos
Gerar insights automáticos:
- "Jungle tem 65% win rate com Elise"
- "Early game está 85% win rate, late game 45%"
- "Composição com Ahri + Zed: 100% winrate (2/2)"
- "Player1 tem melhor performance na Posição Mid"

### 9.5 Notas e Anotações
- Coach pode adicionar comentários às partidas
- Marcar pontos críticos
- Adicionar tags customizadas
- Exemplo: "Bom macro game", "Erro decisão de Baron"

### 9.6 Favoritos e Bookmarks
- Marcar partidas importantes
- Salvar combinações de filtros
- Salvar análises frequentes

### 9.7 Comparação Lado-a-Lado
- Comparar 2 partidas (mesmos campeões vs diferentes composições)
- Comparar 2 campeões de um jogador
- Comparar performance em diferentes patches

### 9.8 Cálculo de Tendências
- **Moving Average**: Média móvel de 5 últimas partidas
- **Win Rate Trend**: Tendência de melhora/queda
- **Peak Performance**: Melhor período
- **Slump Detection**: Período com baixo desempenho

---

## 10. DESIGN E INTERFACE

### 10.1 Tema Visual
- **Dark Mode**: Padrão (esports standard)
- **Cores Principais**:
  - Vitória: Verde (#00D166 ou similar)
  - Derrota: Vermelho (#FF5252 ou similar)
  - Time Azul: Azul (#2E94DE ou similar)
  - Time Vermelho: Vermelho escuro (#D04040 ou similar)
  - Destaque: Dourado/Amarelo (#FFD700)

### 10.2 Tipografia
- Fonte principal: Inter, Roboto ou similar sans-serif
- Tamanhos: Headlines (24px), Body (14px), Small (12px)
- Weights: Regular (400), Medium (600), Bold (700)

### 10.3 Componentes Reutilizáveis
- Buttons (primary, secondary, danger)
- Cards (com hover effects)
- Badges (status, tags)
- Modals/Dialogs
- Tooltips
- Dropdowns/Selects
- Input fields
- Tabs
- Pagination
- Loading spinners

### 10.4 Responsividade
- **Desktop**: Layout completo (1920px+)
- **Tablet**: Layout adaptado (768px - 1024px)
- **Mobile**: Stack vertical (320px - 767px)
- Toques longos (long press) para menus em mobile

### 10.5 Acessibilidade
- WCAG 2.1 AA compliance
- Alto contraste de cores
- Labels em inputs
- Navegação por teclado
- ARIA labels onde necessário

### 10.6 Ícones
- League of Legends Champion Icons (via API ou assets Riot)
- Material Icons ou Font Awesome para UI elements
- Custom icons para stats (KDA, CS, Gold, etc)

### 10.7 Animações
- Transições suaves (200-300ms)
- Hover effects nos cards/rows
- Loading states
- Fade in/out para modais
- Nenhuma animação bloqueante (não prejudicar UX)

---

## 11. ESTRUTURA TÉCNICA

### 11.1 Stack Recomendado

#### **Frontend**
- **Framework**: React / Vue 3 / Angular
- **Charting**: Chart.js, Recharts, D3.js ou Plotly
- **State Management**: Redux, Zustand ou Pinia
- **HTTP Client**: Axios ou Fetch API
- **Styling**: Tailwind CSS, Material-UI ou styled-components
- **Build Tool**: Vite ou Webpack

#### **Backend**
- **Runtime**: Node.js (Express, NestJS) ou Python (FastAPI, Django)
- **Database**: PostgreSQL (relacional) ou MongoDB (documental)
- **Cache**: Redis para respostas frequentes
- **Queue**: Bull/RabbitMQ para processamento assíncrono
- **API**: REST ou GraphQL

#### **Integrações**
- **Riot Games API**: match-v5, league-v4, champion-v3
- **Authentication**: JWT, OAuth2
- **CDN**: CloudFlare para assets

### 11.2 Arquitetura de Banco de Dados

#### **Tabelas Principais**
```
users
├── id (PK)
├── username
├── email
├── password_hash
└── created_at

teams
├── id (PK)
├── name
├── owner_id (FK → users)
└── created_at

matches
├── id (PK)
├── game_id (unique)
├── team_id (FK → teams)
├── date
├── duration
├── result (win/loss)
├── patch
├── series_type
└── created_at

player_stats
├── id (PK)
├── match_id (FK → matches)
├── summoner_id
├── summoner_name
├── champion
├── role
├── kills
├── deaths
├── assists
├── cs
├── gold
├── damage
├── wards_placed
├── wards_destroyed
└── vision_score

match_events
├── id (PK)
├── match_id (FK → matches)
├── event_type (kill, tower, dragon, baron)
├── timestamp
├── details (JSON)

champion_stats
├── id (PK)
├── player_id (FK → users)
├── champion
├── role
├── games_played
├── wins
├── losses
├── avg_kda
├── avg_cs_per_min
```

### 11.3 Fluxo de Dados

```
1. Usuário insere Game ID
   ↓
2. Validação do Game ID
   ↓
3. Chamada à Riot Games API (match-v5)
   ↓
4. Processamento de dados brutos
   ↓
5. Cálculo de estatísticas agregadas
   ↓
6. Armazenamento em banco de dados
   ↓
7. Cache de gráficos/respostas
   ↓
8. Disponibilizar para frontend
```

### 11.4 API Endpoints

#### **Matches**
```
GET /api/matches                      → Lista todas as partidas
GET /api/matches/:id                  → Detalhes de uma partida
POST /api/matches                     → Importar nova partida
GET /api/matches?patch=14.12          → Filtrar por patch
GET /api/matches?player=nickname      → Filtrar por jogador
```

#### **Champions**
```
GET /api/champions                    → Estatísticas de todos os campeões
GET /api/champions/:name              → Detalhes do campeão
GET /api/champions/:name/matchups     → Matchups do campeão
```

#### **Players**
```
GET /api/players                      → Lista de jogadores do time
GET /api/players/:id                  → Perfil do jogador
GET /api/players/:id/stats            → Estatísticas do jogador
```

#### **Dashboard**
```
GET /api/dashboard/summary            → Resumo geral do time
GET /api/dashboard/trends             → Tendências
GET /api/dashboard/champions          → Top campeões
GET /api/dashboard/compositions       → Composições vencedoras
```

### 11.5 Processamento de Dados

#### **Cálculo de Estatísticas**
```javascript
// Exemplo: Calcular Win Rate de um Campeão
const calculateWinRate = (matches) => {
  const wins = matches.filter(m => m.result === 'win').length;
  return ((wins / matches.length) * 100).toFixed(2);
};

// Exemplo: KDA Médio
const calculateAvgKDA = (matches) => {
  const totalKDA = matches.reduce((sum, m) => {
    return sum + ((m.kills + m.assists) / (m.deaths || 1));
  }, 0);
  return (totalKDA / matches.length).toFixed(2);
};
```

#### **Caching de Gráficos**
- Armazenar respostas de gráficos em Redis
- TTL: 1 hora para dados históricos
- Invalidar cache quando nova partida é adicionada

---

## 12. FLUXO DE USUÁRIO

### 12.1 Caminho Padrão

```
1. Usuário acessa dashboard
   ↓
2. Vê histórico de partidas em tabela
   ↓
3. Visualiza gráficos resumidos (win rate, campeões, etc)
   ↓
4. Aplica filtros (patch, nick, campeão, data)
   ↓
5. Tabela é filtrada dinamicamente
   ↓
6. Clica em um campeão na tabela
   ↓
7. Expande para análise detalhada do campeão
   ├── Vê todas as partidas com esse campeão
   ├── Win rate específico
   ├── Matchups contra inimigos
   ├── Build mais comum
   └── Gráficos relacionados
   ↓
8. Clica em uma partida específica
   ↓
9. Vê detalhes completos:
   ├── KDA de cada jogador
   ├── Build e runas
   ├── Timeline de eventos
   └── Gráficos de evolução
   ↓
10. Exporta relatório se necessário
```

### 12.2 Fluxo Alternativo: Análise por Jogador

```
1. Dashboard → Clica em nick do jogador
   ↓
2. Vê perfil do jogador com:
   ├── Win rate global
   ├── Campeões principais
   ├── Estatísticas por posição
   └── Gráficos pessoais
   ↓
3. Clica em um campeão do jogador
   ↓
4. Vê todas as partidas daquele jogador com aquele campeão
```

### 12.3 Fluxo de Importação Nova Partida

```
1. Botão "Adicionar Partida" ou "Import Game ID"
   ↓
2. Modal com campo de input
   ↓
3. Usuário insere Game ID
   ↓
4. Sistema valida com Riot API
   ↓
5. Se válido: importa dados, processa, armazena
   ↓
6. Se inválido: mostra erro
   ↓
7. Partida aparece no histórico
```

---

## 13. SEGURANÇA E PRIVACIDADE

### 13.1 Autenticação
- Login com email/senha ou OAuth2 (Google, Discord)
- JWT tokens com expiração
- Refresh tokens para sessões longas

### 13.2 Autorização
- Apenas membros do time podem ver dados do time
- Coach pode editar notas
- Admin pode gerenciar usuários

### 13.3 Validação de Dados
- Validar Game ID antes de processar
- Sanitizar inputs de usuários
- Rate limiting na API (ex: 100 requisições/minuto)

### 13.4 Proteção de API
- HTTPS only
- CORS configurado corretamente
- API keys para integração com Riot Games

---

## 14. PERFORMANCE

### 14.1 Otimizações Frontend
- Lazy loading de gráficos
- Paginação de tabelas (não carregar 1000 rows de uma vez)
- Compressão de imagens/ícones
- Minificação de CSS/JS

### 14.2 Otimizações Backend
- Índices no banco de dados
- Queries otimizadas (evitar N+1)
- Caching de respostas frequentes
- Pagination de resultados

### 14.3 Métricas
- Tempo de carregamento < 2 segundos
- Gráficos renderizando em < 500ms
- API responder em < 200ms (sem incluir Riot API)

---

## 15. MONITORAMENTO E LOGGING

### 15.1 Logs
- Registrar importações de partidas
- Registrar erros de API
- Audit trail de edições (notas, favoritos)

### 15.2 Alertas
- Falha ao conectar com Riot API
- Taxa de erro acima do normal
- Performance degradada

### 15.3 Analytics
- Campeões mais visualizados
- Filtros mais usados
- Tempo médio na plataforma

---

## 16. ESCALABILIDADE

### 16.1 Para Múltiplos Times
- Suportar múltiplas equipes
- Cada time tem seus próprios dados
- Dashboard por time
- Comparação entre times

### 16.2 Suporte Múltiplos Servidores/Regiões
- Dados de BR, EUNE, NA, etc
- Converter entre nomes de servidor
- Suportar diferentes timezones

---

## 17. ROADMAP

### Fase 1 (MVP)
- ✅ Importação de partidas via Game ID
- ✅ Histórico de partidas
- ✅ Filtros básicos (patch, nick, campeão)
- ✅ Análise de campeões
- ✅ Gráficos principais (win rate, KDA, etc)
- ✅ Detalhes de partida

### Fase 2
- ✅ Análise por jogador
- ✅ Dashboard do time
- ✅ Mais gráficos (matchups, composições)
- ✅ Notas e anotações
- ✅ Exportação de dados

### Fase 3
- ✅ Análise de adversários
- ✅ Predição de próximos picks
- ✅ Integração Discord/Twitch
- ✅ Mobile app
- ✅ AI insights

### Fase 4
- ✅ Suporte múltiplos times
- ✅ Comparação entre times
- ✅ Marketplace de análises
- ✅ API pública

---

## 18. DOCUMENTAÇÃO E SUPORTE

### 18.1 Documentação Técnica
- API Documentation (Swagger/OpenAPI)
- Database Schema Diagram
- Architecture Overview
- Setup Guide

### 18.2 Documentação de Usuário
- Tutorial de primeiro uso
- Guias de cada feature
- FAQ
- Vídeos demonstrativos

### 18.3 Suporte
- Email support
- Discord community
- Bug tracking (GitHub Issues)
- Feature requests

---

## Conclusão

Este documento fornece especificação técnica completa para desenvolver um sistema de análise de partidas League of Legends idêntico ao gol.gg, com toda a estrutura, fluxos, gráficos e integrações necessárias para uma plataforma profissional de esports analytics.

O sistema deve ser intuitivo, performático e escalável, permitindo times profissionais rastrearem e otimizarem continuamente seu desempenho competitivo através de dados detalhados e visualizações claras.
