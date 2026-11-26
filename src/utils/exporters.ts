import type { MoleculeRecord } from '../chem/molecule';
import type { PropertyRow } from '../chem/propertyCatalog';
import type { Analysis } from '../chem/analysis';

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Alternativa para contextos sem a API Clipboard.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export const safeFilename = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 60) || 'molecula';

/** CSV no padrão RFC 4180 (separador vírgula); campos com vírgula decimal são colocados entre aspas. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n');
}

export function propertiesCsv(rec: MoleculeRecord, rows: PropertyRow[]): string {
  return toCsv([
    ['molecula', 'cid', 'propriedade', 'valor', 'unidade', 'natureza', 'fonte', 'metodo_ou_referencia', 'url'],
    ...rows.map((r) => [rec.title, rec.cid ?? '', r.name, r.value ?? '', r.unit, r.nature, r.source, r.method ?? '', r.sourceUrl ?? '']),
  ]);
}

export function moleculeJson(rec: MoleculeRecord, analysis: Analysis | null, rows?: PropertyRow[]): string {
  return JSON.stringify(
    {
      exportedBy: 'MOLECULAB | THE BYTE LAB',
      exportedAt: new Date().toISOString(),
      molecule: { ...rec },
      functionalGroups: analysis?.groups.map((g) => ({ id: g.id, name: g.name, count: g.count, atoms: g.atoms })) ?? null,
      rdkitDescriptors: analysis?.descriptors ?? null,
      properties: rows ?? null,
      notes: 'Átomos indexados a partir de 0 na ordem do arquivo de estrutura. Valores "estimado" são previsões de modelos, não medidas.',
    },
    null,
    2,
  );
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Relatório HTML autocontido, pronto para imprimir ou salvar em PDF pelo navegador. */
export function reportHtml(rec: MoleculeRecord, rows: PropertyRow[], analysis: Analysis | null, svg: string | null): string {
  const ident: [string, string | undefined][] = [
    ['Nome', rec.title],
    ['Nome IUPAC', rec.iupacName],
    ['Fórmula', rec.formula],
    ['PubChem CID', rec.cid?.toString()],
    ['SMILES', rec.smiles],
    ['InChI', rec.inchi],
    ['InChIKey', rec.inchiKey],
  ];
  const groups = analysis?.groups.length ? analysis.groups.map((g) => `${escHtml(g.name)} (${g.count})`).join(', ') : 'Nenhum grupo da lista reconhecido.';
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório — ${escHtml(rec.title)}</title>
<style>body{font:14px/1.5 system-ui,sans-serif;color:#111;max-width:900px;margin:32px auto;padding:0 20px}h1{font-size:22px;margin:0}
.sub{color:#555;margin:4px 0 24px}table{border-collapse:collapse;width:100%;margin:12px 0 24px}th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left;vertical-align:top}
th{background:#f4f4f8;font-weight:600}td.v{white-space:nowrap}.mono{font-family:ui-monospace,monospace;word-break:break-all}.tag{font-size:12px;padding:1px 6px;border-radius:4px;background:#eee}
.svg{border:1px solid #ddd;border-radius:6px;display:inline-block;padding:8px}footer{color:#666;font-size:12px;margin-top:32px}</style></head><body>
<h1>${escHtml(rec.title)}</h1><p class="sub">MOLECULAB | THE BYTE LAB — relatório gerado em ${new Date().toLocaleString('pt-BR')}</p>
${svg ? `<div class="svg">${svg}</div>` : ''}
<h2>Identificação</h2><table>${ident.filter(([, v]) => v).map(([k, v]) => `<tr><th>${k}</th><td class="mono">${escHtml(v!)}</td></tr>`).join('')}</table>
<h2>Grupos funcionais (SMARTS / RDKit)</h2><p>${groups}</p>
<h2>Propriedades</h2><table><tr><th>Propriedade</th><th>Valor</th><th>Unidade</th><th>Natureza</th><th>Fonte</th></tr>
${rows.map((r) => `<tr><td>${escHtml(r.name)}</td><td class="v">${escHtml(r.value ?? '—')}</td><td>${escHtml(r.unit)}</td><td><span class="tag">${r.nature}</span></td><td>${r.sourceUrl ? `<a href="${escHtml(r.sourceUrl)}">${escHtml(r.source)}</a>` : escHtml(r.source)}${r.method ? `<br><small>${escHtml(r.method)}</small>` : ''}</td></tr>`).join('')}
</table><footer>Dados experimentais reproduzidos das fontes depositadas na PubChem (NCBI). Valores "calculado" vêm de algoritmos determinísticos; valores "estimado" são previsões de modelos e não substituem medidas. ${rec.cid ? `Registro original: <a href="https://pubchem.ncbi.nlm.nih.gov/compound/${rec.cid}">PubChem CID ${rec.cid}</a>.` : ''}</footer></body></html>`;
}
