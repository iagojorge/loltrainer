// Especificação OpenAPI 3 da API do LoL Histórico, servida via Swagger UI em
// /api/docs. Escrita à mão (sem scan de JSDoc) para ser determinística.

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'LoL Histórico — API',
    version: '1.0.0',
    description:
      'API de análise de partidas de LoL (estilo gol.gg). Dados vêm da integração real com a Riot ' +
      '(match-v5 + timeline). Use **GET /api/riot/check** para diagnosticar a RIOT_API_KEY.',
  },
  servers: [{ url: '/api', description: 'API (proxy /api → :3001)' }],
  tags: [
    { name: 'Riot', description: 'Importação e diagnóstico da Riot API' },
    { name: 'Matches', description: 'Partidas e filtros' },
    { name: 'Champions', description: 'Estatísticas por campeão' },
    { name: 'Players', description: 'Jogadores do nosso time' },
    { name: 'Dashboard', description: 'Agregados do time' },
    { name: 'Notes', description: 'Notas do coach por partida' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Riot'], summary: 'Health check',
        responses: { 200: { description: 'OK' } },
      },
    },
    '/meta': {
      get: {
        tags: ['Riot'], summary: 'Versão do Data Dragon (ícones)',
        responses: { 200: { description: 'OK', content: { 'application/json': { schema: { type: 'object', properties: { ddragonVersion: { type: 'string', example: '15.11.1' } } } } } } },
      },
    },
    '/roster': {
      get: { tags: ['Players'], summary: 'Listar roster do time', responses: { 200: { description: 'OK' } } },
      post: {
        tags: ['Players'], summary: 'Adicionar jogador ao roster',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['name'], properties: { name: { type: 'string', example: 'BrTT' }, role: { type: 'string', enum: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] } } } } } },
        responses: { 201: { description: 'Adicionado' }, 400: { description: 'Falha (duplicado/nome vazio)' } },
      },
    },
    '/roster/{id}': {
      delete: {
        tags: ['Players'], summary: 'Remover jogador do roster',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Removido' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/riot/check': {
      get: {
        tags: ['Riot'],
        summary: 'Diagnóstico da RIOT_API_KEY',
        description:
          'Testa a chave contra lol-status-v4/platform-data e devolve o status HTTP bruto da Riot ' +
          '(200 = chave válida; 403 = expirada/inválida; 401 = ausente/malformada). A chave nunca é exposta.',
        parameters: [{
          name: 'platform', in: 'query', required: false,
          schema: { type: 'string', example: 'br1', enum: ['br1', 'na1', 'la1', 'la2', 'euw1', 'eune1', 'kr', 'jp1', 'oc1', 'tr1'] },
          description: 'Plataforma a testar (default: RIOT_PLATFORM).',
        }],
        responses: {
          200: { description: 'Chave válida', content: { 'application/json': { schema: { $ref: '#/components/schemas/RiotCheck' } } } },
          502: { description: 'Chave inválida/expirada ou erro de rede', content: { 'application/json': { schema: { $ref: '#/components/schemas/RiotCheck' } } } },
        },
      },
    },
    '/riot/history': {
      get: {
        tags: ['Riot'],
        summary: 'Histórico de partidas de um jogador',
        description:
          'Resolve o Riot ID via account-v1, busca os matchIds recentes (match-v5 by-puuid) e devolve ' +
          'um resumo de cada partida. O lado do jogador buscado vem em `yourSide` (usado para auto-detectar o nosso time na importação).',
        parameters: [
          { name: 'riotId', in: 'query', required: true, schema: { type: 'string', example: 'Faker#KR1' }, description: 'Nome#TAG.' },
          { name: 'platform', in: 'query', required: false, schema: { type: 'string', example: 'br1' } },
          { name: 'count', in: 'query', required: false, schema: { type: 'integer', default: 10, maximum: 20 } },
        ],
        responses: {
          200: { description: 'Histórico', content: { 'application/json': { schema: { $ref: '#/components/schemas/History' } } } },
          400: { description: 'Riot ID inválido / erro da Riot', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportErr' } } } },
        },
      },
    },
    '/matches/import': {
      post: {
        tags: ['Riot', 'Matches'],
        summary: 'Importar partida pela Riot API',
        description: 'Busca match-v5 + timeline pelo Match ID, transforma e persiste. Escolha qual lado é o nosso time.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportRequest' } } },
        },
        responses: {
          201: { description: 'Importada', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportOk' } } } },
          400: { description: 'Falha (chave, formato, duplicada, 4xx da Riot)', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportErr' } } } },
        },
      },
    },
    '/matches/rofl/preview': {
      post: {
        tags: ['Riot', 'Matches'],
        summary: 'Upload de replay .ROFL (preview)',
        description: 'Envie o arquivo .rofl como corpo binário (application/octet-stream). Faz o parse, salva o arquivo e devolve um preview + token (não persiste ainda).',
        requestBody: { required: true, content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } },
        responses: { 200: { description: 'Preview', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, token: { type: 'string' }, preview: { type: 'object' } } } } } }, 400: { description: 'Arquivo inválido' } },
      },
    },
    '/matches/rofl/confirm': {
      post: {
        tags: ['Riot', 'Matches'],
        summary: 'Confirmar importação do replay',
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['token'], properties: { token: { type: 'string' }, ourSide: { type: 'string', enum: ['blue', 'red'] }, opponent: { type: 'string' }, series_type: { type: 'string' }, series_label: { type: 'string' } } } } } },
        responses: { 201: { description: 'Importado', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportOk' } } } }, 400: { description: 'Falha', content: { 'application/json': { schema: { $ref: '#/components/schemas/ImportErr' } } } } },
      },
    },
    '/matches/{id}/replay': {
      get: {
        tags: ['Matches'], summary: 'Baixar o .rofl da partida',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Arquivo .rofl' }, 404: { description: 'Sem replay' } },
      },
    },
    '/matches': {
      get: {
        tags: ['Matches'],
        summary: 'Listar partidas (filtros/ordenação/paginação)',
        parameters: [
          { name: 'patch', in: 'query', schema: { type: 'string' } },
          { name: 'player', in: 'query', schema: { type: 'string' } },
          { name: 'champion', in: 'query', schema: { type: 'string' } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['Top', 'Jungle', 'Mid', 'ADC', 'Support'] } },
          { name: 'result', in: 'query', schema: { type: 'string', enum: ['win', 'loss'] } },
          { name: 'series', in: 'query', schema: { type: 'string' } },
          { name: 'opponent', in: 'query', schema: { type: 'string' } },
          { name: 'duration', in: 'query', schema: { type: 'string', enum: ['early', 'mid', 'late'] } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['24h', '7d', '30d'] } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'search', in: 'query', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date', 'result', 'duration', 'kda'] } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'pageSize', in: 'query', schema: { type: 'integer', default: 25 } },
        ],
        responses: { 200: { description: 'Lista paginada' } },
      },
    },
    '/matches/filters/options': {
      get: { tags: ['Matches'], summary: 'Opções para popular filtros', responses: { 200: { description: 'OK' } } },
    },
    '/matches/{id}': {
      get: {
        tags: ['Matches'], summary: 'Detalhe da partida',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'Detalhe' }, 404: { description: 'Não encontrada' } },
      },
    },
    '/matches/{matchId}/notes': {
      get: {
        tags: ['Notes'], summary: 'Listar notas da partida',
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: { 200: { description: 'OK' } },
      },
      post: {
        tags: ['Notes'], summary: 'Adicionar nota',
        parameters: [{ name: 'matchId', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { body: { type: 'string' }, tags: { type: 'array', items: { type: 'string' } } }, required: ['body'] } } } },
        responses: { 200: { description: 'Nota criada' } },
      },
    },
    '/matches/{matchId}/notes/{noteId}': {
      delete: {
        tags: ['Notes'], summary: 'Remover nota',
        parameters: [
          { name: 'matchId', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'noteId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: { 200: { description: 'Removida' } },
      },
    },
    '/champions': {
      get: { tags: ['Champions'], summary: 'Estatísticas de todos os campeões (nosso time)', responses: { 200: { description: 'OK' } } },
    },
    '/champions/{name}': {
      get: {
        tags: ['Champions'], summary: 'Detalhe do campeão',
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/champions/{name}/matchups': {
      get: {
        tags: ['Champions'], summary: 'Matchups do campeão',
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' } },
      },
    },
    '/players': {
      get: { tags: ['Players'], summary: 'Lista de jogadores (derivada das partidas)', responses: { 200: { description: 'OK' } } },
    },
    '/players/{name}': {
      get: {
        tags: ['Players'], summary: 'Perfil do jogador',
        parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }],
        responses: { 200: { description: 'OK' }, 404: { description: 'Não encontrado' } },
      },
    },
    '/dashboard/all': {
      get: { tags: ['Dashboard'], summary: 'Todos os agregados do time numa chamada', responses: { 200: { description: 'OK' } } },
    },
    '/dashboard/summary': { get: { tags: ['Dashboard'], summary: 'Resumo executivo', responses: { 200: { description: 'OK' } } } },
    '/dashboard/champions': { get: { tags: ['Dashboard'], summary: 'Top jogados / melhores WR', responses: { 200: { description: 'OK' } } } },
    '/dashboard/positions': { get: { tags: ['Dashboard'], summary: 'WR por posição', responses: { 200: { description: 'OK' } } } },
    '/dashboard/players': { get: { tags: ['Dashboard'], summary: 'Ranking de jogadores', responses: { 200: { description: 'OK' } } } },
    '/dashboard/compositions': { get: { tags: ['Dashboard'], summary: 'Composições e duplas', responses: { 200: { description: 'OK' } } } },
    '/dashboard/opponents': { get: { tags: ['Dashboard'], summary: 'Matchups por adversário', responses: { 200: { description: 'OK' } } } },
    '/dashboard/timing': { get: { tags: ['Dashboard'], summary: 'Early vs late / WR por patch', responses: { 200: { description: 'OK' } } } },
    '/dashboard/insights': { get: { tags: ['Dashboard'], summary: 'Relatórios automáticos', responses: { 200: { description: 'OK' } } } },
  },
  components: {
    schemas: {
      ImportRequest: {
        type: 'object',
        required: ['matchId'],
        properties: {
          matchId: { type: 'string', example: 'BR1_1234567890', description: 'Match ID regional OU gameId numérico (prefixado com a região).' },
          ourSide: { type: 'string', enum: ['blue', 'red'], example: 'blue', description: 'Opcional se ourPuuid for informado.' },
          ourPuuid: { type: 'string', description: 'PUUID do jogador do nosso time — detecta o lado automaticamente.' },
          opponent: { type: 'string', example: 'Adversário' },
          series_type: { type: 'string', enum: ['Scrim', 'Regular Season', 'Playoffs', 'Qualifiers'], example: 'Scrim' },
          series_label: { type: 'string', example: 'Bo5 Game 3' },
          platform: { type: 'string', example: 'br1', description: 'Fallback de roteamento (o prefixo do Match ID tem prioridade).' },
        },
      },
      ImportOk: { type: 'object', properties: { ok: { type: 'boolean', example: true }, id: { type: 'integer', example: 1 } } },
      ImportErr: { type: 'object', properties: { ok: { type: 'boolean', example: false }, reason: { type: 'string' }, id: { type: 'integer' } } },
      History: {
        type: 'object',
        properties: {
          ok: { type: 'boolean', example: true },
          account: { type: 'object', properties: { gameName: { type: 'string' }, tagLine: { type: 'string' }, puuid: { type: 'string' } } },
          platform: { type: 'string', example: 'br1' },
          matches: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                matchId: { type: 'string', example: 'BR1_1234567890' },
                date: { type: 'string', format: 'date-time' },
                queueId: { type: 'integer', example: 420 },
                durationS: { type: 'integer' },
                patch: { type: 'string' },
                yourSide: { type: 'string', enum: ['blue', 'red'] },
                yourChampion: { type: 'string' },
                win: { type: 'boolean' },
                alreadyImported: { type: 'boolean' },
                participants: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, champion: { type: 'string' }, side: { type: 'string' }, isYou: { type: 'boolean' } } } },
              },
            },
          },
        },
      },
      RiotCheck: {
        type: 'object',
        properties: {
          ok: { type: 'boolean' },
          keyPresent: { type: 'boolean' },
          keyPreview: { type: 'string', example: 'RGAPI-587…3764 (len 42)' },
          platform: { type: 'string', example: 'br1' },
          routing: { type: 'string', example: 'americas' },
          status: { type: 'integer', example: 403 },
          statusText: { type: 'string', example: 'Forbidden' },
          endpoint: { type: 'string' },
          response: { type: 'object' },
          hint: { type: 'string' },
          warning: { type: 'string' },
        },
      },
    },
  },
};
