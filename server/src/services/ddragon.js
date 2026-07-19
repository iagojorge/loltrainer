import { DDRAGON_VERSION } from '../data/champions.js';
import { toClientPatch } from './patch.js';

/**
 * Carrega metadados do Data Dragon (CDN público da Riot, sem chave) para
 * traduzir os IDs do match-v5 em nomes + ícones:
 *  - campeões: key numérica e id (championName) → nome (en_US, casa com os
 *    overrides de ícone do client)
 *  - itens: id → nome (pt_BR) + flags (bota/consumível)
 *  - runas/estilos: id → { nome (pt_BR), ícone }
 *
 * Usa sempre a versão mais recente do DDragon (com fallback para DDRAGON_VERSION)
 * e é memoizado por processo.
 */

// Shards de stats (statPerks) não estão no runesReforged.json — mapa fixo (pt_BR).
const STAT_SHARDS = {
  5008: 'Força Adaptável',
  5005: 'Velocidade de Ataque',
  5007: 'Aceleração de Habilidade',
  5002: 'Armadura',
  5003: 'Resistência Mágica',
  5001: 'Vida (escala)',
  5011: 'Vida',
  5013: 'Tenacidade',
};

let cache = null;

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Data Dragon ${res.status} em ${url}`);
  return res.json();
}

// Versão mais recente do Data Dragon, com fallback para a versão pinada.
async function latestVersion() {
  try {
    const vs = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    return Array.isArray(vs) && vs[0] ? vs[0] : DDRAGON_VERSION;
  } catch {
    return DDRAGON_VERSION;
  }
}

// Lista de patches recentes (major.minor, ex.: "14.13") para o seletor de edição.
let patchCache = null;
export async function listPatches(limit = 40) {
  if (patchCache) return patchCache;
  try {
    const vs = await fetchJson('https://ddragon.leagueoflegends.com/api/versions.json');
    const seen = new Set(); const out = [];
    for (const v of vs) {
      const mm = toClientPatch(String(v).split('.').slice(0, 2).join('.'));
      if (!seen.has(mm)) { seen.add(mm); out.push(mm); }
      if (out.length >= limit) break;
    }
    patchCache = out;
    return out;
  } catch {
    return [];
  }
}

export async function loadDDragonMeta() {
  if (cache) return cache;

  const version = await latestVersion();
  const EN = `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US`;
  const PT = `https://ddragon.leagueoflegends.com/cdn/${version}/data/pt_BR`;
  const [champData, itemData, runeData] = await Promise.all([
    fetchJson(`${EN}/champion.json`),     // nomes de campeão em inglês (ícones do client)
    fetchJson(`${PT}/item.json`),         // itens em português
    fetchJson(`${PT}/runesReforged.json`),// runas em português
  ]);

  // Campeões: key numérica → nome; id (championName) → nome.
  const champByKey = new Map();
  const champById = new Map();
  for (const c of Object.values(champData.data)) {
    champByKey.set(String(c.key), c.name);
    champById.set(c.id, c.name);
  }

  // Itens: id → { name, isBoots, isConsumable }.
  const itemById = new Map();
  for (const [id, it] of Object.entries(itemData.data)) {
    const tags = Array.isArray(it.tags) ? it.tags : [];
    itemById.set(Number(id), {
      name: it.name,
      isBoots: tags.includes('Boots'),
      isConsumable: tags.includes('Consumable') || tags.includes('Trinket'),
    });
  }

  // Runas + estilos: id → { name, icon } (icon é o caminho relativo do DDragon).
  const runeById = new Map();
  const styleById = new Map();
  for (const style of runeData) {
    styleById.set(style.id, { name: style.name, icon: style.icon });
    for (const slot of style.slots) {
      for (const rune of slot.runes) runeById.set(rune.id, { name: rune.name, icon: rune.icon });
    }
  }

  cache = {
    version,
    championNameByKey: (key) => champByKey.get(String(key)) || null,
    championNameById: (id) => champById.get(id) || id,
    itemName: (id) => itemById.get(Number(id))?.name || null,
    itemIsBoots: (id) => !!itemById.get(Number(id))?.isBoots,
    itemIsConsumable: (id) => !!itemById.get(Number(id))?.isConsumable,
    runeName: (id) => runeById.get(id)?.name || null,
    runeIcon: (id) => runeById.get(id)?.icon || null,
    styleName: (id) => styleById.get(id)?.name || null,
    styleIcon: (id) => styleById.get(id)?.icon || null,
    statShardName: (id) => STAT_SHARDS[id] || null,
  };
  return cache;
}
