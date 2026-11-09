/** Parses CSV with comma, semicolon (Swiss Excel exports) or tab separators (pasted from Excel). */
export function parseCSV(text: string): string[][] {
  text = text.replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  let sep = ',';
  let best = -1;
  for (const c of [';', ',', '\t']) {
    const n = firstLine.split(c).length - 1;
    if (n > best) {
      best = n;
      sep = c;
    }
  }
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"' && field === '') quoted = true;
    else if (ch === sep) {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Turns table rows into guests for the given fields. A first row that names the fields
 * ("Name; Table") is used as the header, otherwise columns are taken in order.
 */
export function toGuests(table: string[][], fields: string[]): { guests: Record<string, string>[]; ignored: number } {
  if (!table.length) return { guests: [], ignored: 0 };
  const header = table[0].map(norm);
  const byHeader = fields.map((f) => header.indexOf(norm(f)));
  const hasHeader = byHeader.some((i) => i >= 0);
  const columns = hasHeader ? byHeader : fields.map((_, i) => i);
  const body = hasHeader ? table.slice(1) : table;
  const width = Math.max(...table.map((r) => r.length));
  const guests = body.map((r) => Object.fromEntries(fields.map((f, i) => [f, columns[i] >= 0 ? (r[columns[i]] ?? '') : ''])));
  return { guests, ignored: Math.max(0, width - columns.filter((c) => c >= 0).length) };
}
