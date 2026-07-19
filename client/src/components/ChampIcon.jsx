import { useState } from 'react';
import { championIcon } from '../lib/champ.js';

const SIZES = { xs: 'h-6 w-6', sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-14 w-14' };

export default function ChampIcon({ champion, src, size = 'sm', title, className = '', ring }) {
  const [err, setErr] = useState(false);
  const url = src || championIcon(champion);
  const dim = SIZES[size] || SIZES.sm;
  const ringCls = ring === 'blue' ? 'ring-2 ring-blueteam/70' : ring === 'red' ? 'ring-2 ring-redteam/70' : '';

  if (err || !url) {
    return (
      <div
        className={`${dim} ${ringCls} ${className} rounded-md bg-bg-soft border border-line flex items-center justify-center text-[10px] font-bold text-gray-400`}
        title={title || champion}
      >
        {(champion || '?').slice(0, 3)}
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={champion}
      title={title || champion}
      onError={() => setErr(true)}
      className={`${dim} ${ringCls} ${className} rounded-md object-cover bg-bg-soft`}
      loading="lazy"
    />
  );
}
