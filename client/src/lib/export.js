// Exportação client-side (CSV / JSON / PNG de SVG de gráfico). Sem dependências.

function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function exportJSON(filename, data) {
  download(filename, JSON.stringify(data, null, 2), 'application/json');
}

export function exportCSV(filename, rows, columns) {
  // columns: [{ key, label }]; rows: array de objetos
  const cols = columns || (rows[0] ? Object.keys(rows[0]).map((k) => ({ key: k, label: k })) : []);
  const escape = (v) => {
    if (v === null || v === undefined) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const header = cols.map((c) => escape(c.label)).join(',');
  const body = rows.map((r) => cols.map((c) => escape(typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
  download(filename, `${header}\n${body}`, 'text/csv;charset=utf-8');
}
