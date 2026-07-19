import { useState } from 'react';
import { mmss } from '../lib/format.js';
import { itemIcon, runeIcon, runeVarText } from '../lib/champ.js';

// Ícone de item com fallback para o nome quando a imagem falha.
function ItemImg({ id, name, t }) {
  const [err, setErr] = useState(false);
  const title = t != null ? `${name} · ${mmss(t)}` : name;
  if (err || !id) {
    return (
      <span className="chip bg-bg-soft border border-line text-gray-200" title={title}>{name}</span>
    );
  }
  return (
    <span className="relative inline-flex" title={title}>
      <img src={itemIcon(id)} alt={name} onError={() => setErr(true)}
        className="h-8 w-8 rounded-md border border-line bg-bg-soft object-cover" loading="lazy" />
      {t != null && <span className="absolute -bottom-1 -right-1 text-[9px] bg-bg px-0.5 rounded text-gray-400 leading-none">{mmss(t)}</span>}
    </span>
  );
}

// Sequência de itens comprados (com timestamp) + botas destacadas.
export function ItemSequence({ items, boots }) {
  return (
    <div className="space-y-2">
      {boots && (
        <div className="text-xs text-gray-400">
          Botas: <span className="chip bg-bg-soft border border-line text-gray-200">{boots}</span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {items.map((it, i) => (
          <span key={i} className="flex items-center">
            <ItemImg id={it.id} name={it.name} t={it.t} />
            {i < items.length - 1 && <span className="text-gray-600 mx-0.5">›</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

// Ícone de runa com fallback para bullet quando a imagem falha.
function RuneImg({ icon, name, size = 'h-5 w-5' }) {
  const [err, setErr] = useState(false);
  if (err || !icon) return <span className="text-gray-600">•</span>;
  return <img src={runeIcon(icon)} alt={name} title={name} onError={() => setErr(true)}
    className={`${size} object-contain`} loading="lazy" />;
}

// Compat: runas podem ser strings (formato antigo) ou { id, name, icon, vars }.
const runeName = (r) => (typeof r === 'string' ? r : r?.name);
const runeImg = (r) => (typeof r === 'string' ? null : r?.icon);

// Valor de interação da runa (cura, dano bloqueado, etc.), quando disponível.
function RuneVar({ rune }) {
  const text = runeVarText(rune);
  if (!text) return null;
  return <span className="ml-auto pl-2 text-[10px] text-gold/80 whitespace-nowrap tabular-nums">{text}</span>;
}

// Visualização de runas (primária + secundária + shards) com ícones.
export function RunesView({ runes }) {
  if (!runes || !runes.primary) return null;
  const { primary, secondary, shards } = runes;
  return (
    <div className="grid sm:grid-cols-3 gap-3 text-xs">
      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-gold mb-1">
          <RuneImg icon={primary.treeIcon} name={primary.tree} size="h-4 w-4" /> {primary.tree}
        </div>
        <div className="flex items-center gap-1.5 font-semibold text-gray-100 mb-1">
          <RuneImg icon={runeImg(primary.keystone)} name={runeName(primary.keystone)} size="h-6 w-6" />
          {runeName(primary.keystone)}
          <RuneVar rune={primary.keystone} />
        </div>
        <ul className="text-gray-400 space-y-1">
          {primary.runes.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5"><RuneImg icon={runeImg(r)} name={runeName(r)} /> {runeName(r)} <RuneVar rune={r} /></li>
          ))}
        </ul>
      </div>
      <div>
        <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-blueteam mb-1">
          <RuneImg icon={secondary?.treeIcon} name={secondary?.tree} size="h-4 w-4" /> {secondary?.tree}
        </div>
        <ul className="text-gray-400 space-y-1 mt-2">
          {secondary?.runes.map((r, i) => (
            <li key={i} className="flex items-center gap-1.5"><RuneImg icon={runeImg(r)} name={runeName(r)} /> {runeName(r)} <RuneVar rune={r} /></li>
          ))}
        </ul>
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-gray-500 mb-1">Atributos</div>
        <ul className="text-gray-400 space-y-0.5">
          {shards?.map((sh, i) => <li key={i}>• {sh}</li>)}
        </ul>
      </div>
    </div>
  );
}
