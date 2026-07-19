// Versão do Data Dragon usada para os ícones de campeão (CDN público, sem chave).
// É um fallback: no boot o servidor atualiza para a versão mais recente via
// setIconVersion (ver index.js), para que campeões novos (Yunara, etc.) apareçam.
export const DDRAGON_VERSION = '16.13.1';
let iconVersion = DDRAGON_VERSION;
export function setIconVersion(v) { if (v) iconVersion = v; }

// Nomes de exibição cujo ID no Data Dragon difere de "remover não-alfanuméricos".
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

export function championId(name) {
  return ID_OVERRIDES[name] || name.replace(/[^A-Za-z0-9]/g, '');
}

export function championIcon(name) {
  return `https://ddragon.leagueoflegends.com/cdn/${iconVersion}/img/champion/${championId(name)}.png`;
}

export const ROLES = ['Top', 'Jungle', 'Mid', 'ADC', 'Support'];
