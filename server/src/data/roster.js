import { ROLES } from './champions.js';

// Configuração do time. O sistema é dedicado a UM time (Tenebra Leviathan): o
// roster é fixo (semeado no boot) e usado tanto para casar os jogadores nas
// partidas importadas quanto para buscar as SoloQs (Riot ID → PUUID).
export const TEAM_NAME = process.env.TEAM_NAME || 'Tenebra Leviathan';

// Plataforma (região) padrão da Riot para resolver Riot IDs e SoloQ.
export const TEAM_PLATFORM = (process.env.RIOT_PLATFORM || 'br1').toLowerCase();

// Roster fixo. `gameName` casa com o `riotIdGameName` dos participantes das
// partidas; `tag` (tagLine) é usada junto ao gameName para resolver o PUUID.
export const TEAM_ROSTER = [
  { gameName: 'LeKuTaaká',       tag: 'BR1',   role: 'Top' },
  { gameName: 'Arthemis',        tag: 'presa', role: 'Jungle' },
  { gameName: 'Harrypottar',     tag: 'gandl', role: 'Mid' },
  { gameName: 'CELIN amo GBRs',  tag: '2306',  role: 'ADC' },
  { gameName: 'Aleeht',          tag: 'BR1',   role: 'Support' },
];

export { ROLES };
