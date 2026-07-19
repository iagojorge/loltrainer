# LoL Histórico — Análise de Partidas (estilo gol.gg)

Plataforma de análise competitiva de partidas de League of Legends para times: histórico,
dashboard executivo do time, análise por campeão e por jogador, detalhe de partida com
timeline e gráficos de evolução, anotações do coach e exportação de dados.

Construída a partir da especificação em [`sistema_analise_lol_golgg.md`](./sistema_analise_lol_golgg.md).
Os dados vêm da **integração real com a Riot API** (match-v5 + timeline): o banco nasce vazio e
é populado importando partidas por Match ID (ver _Importação_ abaixo).

## Stack

- **Frontend:** React + Vite, React Router, Recharts, Tailwind CSS (dark mode esports).
- **Backend:** Node.js + Express, **SQLite nativo do Node 24** (`node:sqlite`) — sem dependências
  nativas para compilar.
- **Ícones (campeão/item/runa) e nomes:** Data Dragon CDN (público, sem chave), na **versão mais
  recente** (corrige ícones de campeões novos como Mel); itens e runas em **português (pt_BR)**.

> Requer **Node.js 24+** (usa o módulo embutido `node:sqlite`).

## Como rodar

```bash
npm install        # instala server + client (workspaces)
cp .env.example .env   # configure sua RIOT_API_KEY (veja abaixo)
npm run dev        # sobe API (http://localhost:3001) + client (http://localhost:5173)
```

Abra **http://localhost:5173**. O banco começa **vazio** — use **Importar** para popular.

### Configuração (`.env`)

Crie um `.env` na raiz (a partir de `.env.example`) com sua chave da Riot:

```
RIOT_API_KEY=RGAPI-...     # https://developer.riotgames.com/ (chave de dev expira em 24h)
RIOT_PLATFORM=br1          # fallback de roteamento (br1, na1, euw1, kr, …)
TEAM_NAME=Meu Time         # nome exibido para o "nosso time"
PORT=3001
```

Os scripts do server carregam o `.env` automaticamente (`--env-file-if-exists=../.env`).

Para build de produção (o servidor passa a servir o client compilado):

```bash
npm run build      # gera client/dist
npm start          # serve API + SPA em http://localhost:3001
```

## Funcionalidades

- **Histórico** (`/`): tabela responsiva com filtros combináveis (patch, jogador, campeão, role,
  resultado, contexto, adversário, duração, período, busca), ordenação, paginação e export CSV/JSON.
- **Dashboard do Time** (`/team`): cards executivos, sequência W/L, tendência de win rate,
  relatórios automáticos, campeões mais jogados / melhores win rates, desempenho por posição,
  ranking de jogadores, early vs late, win rate por patch, composições vencedoras, correlação de
  duplas, matchups por adversário.
- **Campeões** (`/champions`, `/champions/:nome`): card agregado, win rate por patch, **heatmap de
  matchups** colorido, builds mais comuns, gráficos (WR temporal, scatter KDA, CS/min) e tabela de
  partidas com build/runas expansíveis.
- **Jogadores** (`/players`, `/players/:nick`): **roster gerenciado manualmente** (adicione só os
  jogadores do seu time pelo nome de invocador — importar partidas não inclui companheiros aleatórios),
  perfil, tabela de campeões com tendência, distribuição e win rate por posição, gráficos pessoais.
- **Detalhe de Partida** (`/matches/:id`): resumo + bans + placar de objetivos, tabela completa dos
  10 jogadores (com build/runas), timeline cronológica de eventos, gráficos de evolução (ouro,
  kills, níveis, CS) e **notas do coach** (CRUD com tags).

## Estrutura

```
server/   API Express + node:sqlite (db, services/stats, services/riot, services/ddragon, routes)
client/   React + Vite (pages, components, charts, lib)
```

Schema e agregações: `server/src/db.js`, `server/src/services/stats.js`.
Importação/transformação Riot: `server/src/services/riot.js` (+ `services/ddragon.js`).

## Importação (Riot API)

Pela página **Importar** (`/import`), em dois modos:

1. **Buscar por jogador** (recomendado): informe o **Riot ID** (`Nome#TAG`) + região. O sistema
   resolve o PUUID (**account-v1**), lista as partidas recentes (**match-v5 by-puuid**) e mostra um
   resumo de cada uma para você importar com um clique. O **nosso lado** é detectado automaticamente
   como o lado do jogador buscado (via `ourPuuid`).
2. **Match ID / gameId direto**: cole `BR1_1234567890` **ou** apenas o `gameId` numérico
   (`1234567890`) — nesse caso a região é usada como prefixo. Escolha o nosso lado manualmente.
3. **Replay (.ROFL)**: arraste o arquivo `.rofl` do cliente do LoL (scrims/customs que **não**
   aparecem no match-v5). Faz parse dos stats de fim de jogo, mostra um preview para você escolher o
   nosso lado, salva o arquivo (download depois em cada partida) e persiste. Replays não contêm
   timeline — as abas Timeline/Gráficos ficam vazias; estatísticas e build/runas funcionam.

Endpoints:
- `GET /api/riot/history?riotId=Nome%23TAG&platform=br1&count=10` → resumo do histórico.
- `POST /api/matches/import` com `{ "matchId": "BR1_…"|"<gameId>", "ourSide"|"ourPuuid", "opponent", "series_type", "series_label", "platform" }`.
- `.rofl`: `POST /api/matches/rofl/preview` (corpo binário) → `POST /api/matches/rofl/confirm` → `GET /api/matches/:id/replay` (download).

O servidor (`server/src/services/riot.js`) busca **match-v5** + **timeline**, traduz os IDs numéricos
de campeões/itens/runas via **Data Dragon** (`services/ddragon.js`, versão mais recente) e persiste no
schema (partida, stats dos 10 jogadores com build/runas, eventos e frames). O roteamento regional é
derivado do prefixo do Match ID (`BR1_…` → `americas`); `RIOT_PLATFORM` é só fallback.

> **Não existe busca por `gameId` na API moderna da Riot.** O identificador é o `matchId`
> = `PLATAFORMA_gameId` (ex.: `BR1_1234567890`), consultado no host **regional**. Um `gameId` numérico
> cru sem o prefixo é malformado (HTTP 400) — por isso o sistema o prefixa automaticamente.

Como **não há roster fixo**, o lado escolhido (azul/vermelho) define quais 5 jogadores recebem
`is_our_team = 1` e alimentam as seções Jogadores/Dashboard.

### Swagger / debug

- **Swagger UI:** http://localhost:3001/api/docs (spec cru em `/api/openapi.json`). Permite testar
  todos os endpoints interativamente.
- **Diagnóstico da chave:** `GET /api/riot/check?platform=br1` testa a `RIOT_API_KEY` contra a Riot
  e devolve o **status HTTP bruto** (200 = válida; 403 = expirada/inválida; 401 = ausente/malformada),
  com a chave mascarada. Útil para distinguir "chave expirada" de "match não encontrado".

> O `.env` é lido **apenas no boot** (`--env-file`). Após trocar a chave, **reinicie o servidor**.
> Chaves de desenvolvimento expiram a cada 24h — o erro 403 quase sempre é isso.

> Observação: `match-v5` busca partidas por **match ID regional** ligado a invocadores resolvíveis
> (soloq/scrims) — não expõe jogos de pro play por "Game ID" como o gol.gg, que usa feeds de LoL Esports.

## Próximos passos (fora do MVP atual)

Autenticação/multi-team, mapa de progressão geográfico, export PDF, predição de picks, integrações
Discord/Twitch e comparação lado-a-lado. A arquitetura não os impede.
