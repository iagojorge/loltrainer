# LoL Histórico — notas para o agente

Plataforma de análise de partidas de LoL (estilo gol.gg). Spec completa em
`sistema_analise_lol_golgg.md`. Visão geral e features em `README.md`.

## Comandos
- `npm install` — instala workspaces (server + client).
- `npm run dev` — API em :3001 + client Vite em :5173 (proxy `/api`).
- `npm run build` / `npm start` — build do client e servir SPA pela API.
- O banco (`server/src/data/lol.db`) **nasce vazio** e é criado no boot (`initSchema`);
  popule via importação real (form `/import` ou `POST /api/matches/import`).

## Pontos importantes
- **Requer Node 24+**: usa o módulo embutido `node:sqlite` (`DatabaseSync`). NÃO usar
  `better-sqlite3` (falha ao compilar sem Visual Studio nesta máquina).
  - `node:sqlite` não tem `db.pragma()` nem `db.transaction()`: usar `db.exec('PRAGMA …')` e
    `BEGIN/COMMIT/ROLLBACK` manuais.
- **Integração real Riot** em `server/src/services/riot.js`: `listMatchHistory` (account-v1 →
  match-v5 by-puuid → resumos) e `importMatchById` (match-v5 + timeline → schema), traduzindo IDs via
  Data Dragon (`server/src/services/ddragon.js`, versão dinâmica = última). Requer `RIOT_API_KEY` no
  `.env` da raiz (carregada via `--env-file-if-exists=../.env`). `.env.example` documenta as variáveis.
- **Sem busca por `gameId`** na API moderna: o id é `matchId = PLATAFORMA_gameId`. `normalizeMatchId`
  aceita `BR1_123` ou `gameId` numérico (prefixa com a plataforma). Rotas: `GET /api/riot/history`,
  `POST /api/matches/import` (aceita `ourSide` ou `ourPuuid` para auto-detectar o lado).
- **Importação de replays `.rofl`** (`services/rofl.js`, `routes/replays.js`): parser nativo do
  formato ROFL (lê o JSON `statsJson` dos metadados), reutiliza o Data Dragon e `insertAll` (de
  `riot.js`). Fluxo `POST /api/matches/rofl/preview` (corpo binário via `express.raw`) → `POST
  /api/matches/rofl/confirm` → `GET /api/matches/:id/replay` (download). Coluna `matches.source`
  ('riot'|'rofl') + `replay_path`; arquivos em `server/src/data/replays/`. ROFL **não tem timeline**
  (eventos/frames vazios). Para scrims/customs que não aparecem no match-v5.
  - `parseRofl` extrai `gameVersion` (→ `patch` + coluna `matches.game_version`) e `gameDate`; o
    `confirm` aceita `date` (editável no preview). Quando o metadado do .rofl não traz versão/data,
    o patch fica "desconhecido" e a data cai no que o usuário informar / mtime / agora.
- **Assistir no cliente (LCU)** (`services/lcu.js`, `POST /api/matches/:id/watch`): copia o .rofl para
  a pasta de replays do cliente (descoberta via LCU), faz `scan` + `watch`. Lê porta/senha do
  `lockfile` (detecta o caminho via processo `LeagueClientUx` ou `RIOT_LOL_PATH` no `.env`); usa
  `node:https` com `rejectUnauthorized:false` (cert self-signed). **Só roda replays do patch atual** e
  exige o cliente aberto; precisa de `gameId` numérico no metadado.
- **Runas com valores de interação** (cura do Conquistador, dano bloqueado do Osso Revestido, etc.):
  `buildRunes` (em `riot.js` e `rofl.js`) guarda `{ id, name, icon, vars:[v1,v2,v3] }` por runa
  (match-v5: `selection.var*`; .rofl: `PERK{n}_VAR*`). Rótulos pt_BR curados por id em
  `client/lib/champ.js` (`RUNE_VAR_LABEL`/`runeVarText`), renderizados em `Build.jsx` (`RunesView`).
- **Aba "Stats" (MatchDetail)**: gráficos por jogador (dano, composição físico/mágico/verdadeiro,
  ouro, dano causado×recebido, visão, CC) derivados só dos totais de fim de jogo — **independem da
  timeline**, então funcionam para .rofl. Colunas novas em `player_stats`:
  `damage_physical/magic/true/mitigated`. Componente `StackedBar` em `components/charts.jsx`.
- **Roster manual** (tabela `roster`, `services/roster.js`, rotas `GET/POST/DELETE /api/roster`,
  UI na página Jogadores). `stats.js` (`ourRoster`/`listPlayers`/`filterOptions`) lista **apenas** o
  roster — importar partidas não adiciona companheiros aleatórios. Match por `summoner_name`.
- **Ícones/idioma (Data Dragon):** `ddragon.js` usa a versão **mais recente** (exposta em `/api/meta`;
  o client a aplica via `setDdragonVersion` no boot, corrigindo ícones de campeões novos como Mel).
  Itens e runas vêm em **pt_BR**; itens guardam `id` e runas guardam `icon` para renderizar ícones
  (`itemIcon`/`runeIcon` em `client/lib/champ.js`, render em `components/Build.jsx`).
- **Build: `items` vs `final_items`** (player_stats). `items` = ordem de compra (com timestamp, via
  timeline; no .rofl é só a build final sem ordem) — usado na "history line" (aba Builds & Runas do
  MatchDetail e expansão no ChampionDetail). `final_items` = build fechada (slots item0..6 / ITEM0..6)
  — usado em "Builds Mais Comuns". O Histórico (Dashboard) **não** mostra KDA/CS/Dano (só na tela do
  campeão); a coluna "vs" do ChampionDetail mostra o ícone do oponente de lane (`vsChampion`).
- **Sem roster fixo**: ao importar, escolhe-se qual lado (azul/vermelho) é "nosso"
  (`player_stats.is_our_team`). Os jogadores são derivados dinamicamente em `stats.js`
  (`ourRoster()`), não de uma lista fixa. `TEAM_NAME` vem do `.env`.
- **Swagger UI** em `/api/docs` (spec em `server/src/openapi.js`, cru em `/api/openapi.json`).
- **Debug da chave Riot:** `GET /api/riot/check?platform=br1` (`server/src/routes/riot.js` →
  `checkRiotKey` em `riot.js`) devolve o status HTTP bruto da Riot. `riotFetch` agora loga
  status+corpo e diferencia 401/403/404/429. O `.env` é lido só no boot — reiniciar após trocar a chave.
- Toda agregação/estatística está em `server/src/services/stats.js` (funções puras sobre o banco).
- Ícones de campeão vêm do Data Dragon; o mapa de IDs especiais está duplicado em
  `server/src/data/champions.js` e `client/src/lib/champ.js` — manter os dois em sincronia.
- Cores/tema (win/loss/blue/red/gold) em `client/tailwind.config.js`.

## Estrutura
- `server/src/routes/*` — matches, champions, players, dashboard, notes.
- `client/src/pages/*` — Dashboard, TeamDashboard, MatchDetail, ChampionDetail, PlayerDetail, Champions, Players.
- `client/src/components/charts.jsx` — wrappers Recharts reutilizáveis.
