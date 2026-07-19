// Versão do Data Dragon usada nos ícones. Começa numa versão pinada e é
// atualizada para a mais recente no boot (ver setDdragonVersion / main.jsx),
// para que campeões/itens novos (ex.: Mel) tenham ícone.
export let DDRAGON_VERSION = '16.13.1';
export function setDdragonVersion(v) {
  if (v) DDRAGON_VERSION = v;
}

const ID_OVERRIDES = {
  "K'Sante": 'KSante',
  'Lee Sin': 'LeeSin',
  'Jarvan IV': 'JarvanIV',
  "Kha'Zix": 'Khazix',
  'LeBlanc': 'Leblanc',
  'Wukong': 'MonkeyKing',
  'Renata Glasc': 'Renata',
  'Miss Fortune': 'MissFortune',
  "Cho'Gath": 'Chogath',
  "Kai'Sa": 'Kaisa',
  'Twisted Fate': 'TwistedFate',
  'Xin Zhao': 'XinZhao',
  'Tahm Kench': 'TahmKench',
  'Aurelion Sol': 'AurelionSol',
  'Dr. Mundo': 'DrMundo',
  'Master Yi': 'MasterYi',
  "Vel'Koz": 'Velkoz',
  "Rek'Sai": 'RekSai',
  "Kog'Maw": 'KogMaw',
  'Nunu & Willump': 'Nunu',
  "Bel'Veth": 'Belveth',
};

export function championIcon(name) {
  if (!name) return '';
  const id = ID_OVERRIDES[name] || name.replace(/[^A-Za-z0-9]/g, '');
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/champion/${id}.png`;
}

// Ícone de item (precisa do id + versão).
export function itemIcon(id) {
  if (!id) return '';
  return `https://ddragon.leagueoflegends.com/cdn/${DDRAGON_VERSION}/img/item/${id}.png`;
}

// Ícone de runa/estilo — o caminho vem do runesReforged.json e é servido sem
// versão (cdn/img/...).
export function runeIcon(path) {
  if (!path) return '';
  return `https://ddragon.leagueoflegends.com/cdn/img/${path}`;
}

export const ROLE_ICON = {
  Top: '⚔️',
  Jungle: '🌲',
  Mid: '🔮',
  ADC: '🏹',
  Support: '🛡️',
};

// Rótulo (pt_BR) do valor de interação que cada runa acumula durante a partida
// — o número que o ReplayBook mostra ao lado da runa (PERK*_VAR* no .rofl /
// var1..3 no match-v5). É um mapa curado das runas mais comuns; runas sem
// rótulo conhecido caem no genérico "Valor" (mas ainda mostram o número).
const RUNE_VAR_LABEL = {
  8437: 'Dano/cura',            // Aperto dos Mortos-Vivos (Grasp)
  8439: 'Dano causado',         // Pós-Choque (Aftershock)
  8465: 'Escudo concedido',     // Guardião
  8010: 'Total de cura',        // Conquistador
  8009: 'Recurso restaurado',   // Presença de Espírito
  9111: 'Cura',                 // Triunfo
  9104: 'Stacks',               // Lenda: Espontaneidade
  9105: 'Stacks',               // Lenda: Tenacidade
  9103: 'Cura',                 // Lenda: Linhagem
  8014: 'Dano adicional',       // Golpe de Misericórdia
  8017: 'Dano adicional',       // Até a Morte
  8299: 'Dano adicional',       // Último Suspiro
  8473: 'Dano bloqueado',       // Osso Revestido
  8444: 'Cura',                 // Reflorescer (Second Wind)
  8242: 'Cura concedida',       // Fonte da Vida
  8451: 'Vida máx. adicional',  // Crescimento Excessivo
  8453: 'Cura/recurso',         // Revitalizar
  8126: 'Dano verdadeiro',      // Tiro Barato
  8139: 'Cura',                 // Gosto de Sangue
  8112: 'Dano causado',         // Eletrocutar
  8128: 'Dano causado',         // Colheita Sombria
  8369: 'Ouro extra',           // Primeiro Ataque
  8214: 'Dano/escudo',          // Invocar Aery
  8229: 'Dano causado',         // Cometa Arcano
  8237: 'Dano causado',         // Queimadura
  8233: 'Dano causado',         // Foco Absoluto
  8226: 'Mana adicional',       // Trança de Mana
  8236: 'Adaptável (stacks)',   // Tempestade Crescente
};

// Texto "Rótulo: valor" para a runa, ou null quando não há valor relevante.
// Usa o primeiro VAR não-zero (é o valor de destaque na maioria das runas).
export function runeVarText(rune) {
  if (!rune || typeof rune !== 'object') return null;
  const vars = Array.isArray(rune.vars) ? rune.vars : [];
  const value = vars.find((v) => Number(v) > 0);
  if (!value) return null;
  const label = RUNE_VAR_LABEL[rune.id] || 'Valor';
  const n = Math.round(Number(value));
  const pretty = n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n);
  return `${label}: ${pretty}`;
}
