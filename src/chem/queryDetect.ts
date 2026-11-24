import { looksLikeFormula } from './formula';

export type QueryType = 'name' | 'formula' | 'smiles' | 'cid' | 'cas' | 'inchi';
export type QueryMode = QueryType | 'auto';

export const QUERY_TYPE_LABELS: Record<QueryType, string> = {
  name: 'Nome',
  formula: 'Fórmula molecular',
  smiles: 'SMILES',
  cid: 'PubChem CID',
  cas: 'Número CAS',
  inchi: 'InChI',
};

/** Valida o dígito verificador de um número CAS (ex.: 50-78-2). */
export function isValidCas(s: string): boolean {
  const m = /^(\d{2,7})-(\d{2})-(\d)$/.exec(s.trim());
  if (!m) return false;
  const digits = (m[1] + m[2]).split('').reverse();
  const sum = digits.reduce((acc, d, i) => acc + parseInt(d, 10) * (i + 1), 0);
  return sum % 10 === parseInt(m[3], 10);
}

const SMILES_CHARS = /^[A-Za-z0-9@+\-[\]()\\/%=#$:.*~]+$/;
const SMILES_HINTS = /[=#()[\]@\\/%]|[cnops][^a-z]|[cnops]$|^[cnops]/;

/**
 * Heurística de detecção. Casos ambíguos (ex.: "CO" = monóxido de carbono como
 * fórmula ou metanol como SMILES) são resolvidos em favor da fórmula; a
 * interface mostra o tipo interpretado e permite trocar.
 */
export function detectQueryType(raw: string): QueryType {
  const s = raw.trim();
  if (/^\d{1,10}$/.test(s)) return 'cid';
  if (/^(?:CID[:\s]*)\d{1,10}$/i.test(s)) return 'cid';
  if (/^InChI=/i.test(s)) return 'inchi';
  if (/^\d{2,7}-\d{2}-\d$/.test(s)) return 'cas';
  if (/\s/.test(s)) return 'name';
  // Palavras como "caffeine" ou "Aspirin" são nomes, mesmo contendo letras de SMILES aromático.
  if (/^[A-Za-z][a-z]{3,}$/.test(s)) return 'name';
  if (looksLikeFormula(s) && !hasRepeatedAdjacentElement(s)) return 'formula';
  // Fora de colchetes e de Cl/Br, SMILES só usa minúsculas aromáticas (c, n, o, p, s, b).
  // Outras minúsculas indicam nome: "3-bromo-4-methylacetophenone", "2-propanol".
  if (/[a-z]/.test(s) && /[ad-mqrt-z]/.test(s.replace(/\[[^\]]*\]/g, '').replace(/Cl|Br/g, ''))) return 'name';
  if (SMILES_CHARS.test(s) && (SMILES_HINTS.test(s) || /^[BCNOSPFIcnops]+$/.test(s) || /Cl|Br/.test(s) || hasRingClosures(s))) {
    return 'smiles';
  }
  return 'name';
}

/** Fechamentos de anel do SMILES aparecem aos pares, logo após um átomo (C1CCCCC1). */
function hasRingClosures(s: string): boolean {
  const digits = s.match(/(?<=[A-Za-z\]])\d/g);
  if (!digits) return false;
  const counts = new Map<string, number>();
  digits.forEach((d) => counts.set(d, (counts.get(d) ?? 0) + 1));
  return [...counts.values()].every((c) => c % 2 === 0);
}

/** "CCO" repete C: improvável como fórmula escrita à mão, provável como SMILES. */
function hasRepeatedAdjacentElement(s: string): boolean {
  const tokens = s.match(/[A-Z][a-z]?\d*/g) ?? [];
  for (let i = 1; i < tokens.length; i++) {
    const a = tokens[i - 1].replace(/\d+/, '');
    const b = tokens[i].replace(/\d+/, '');
    if (a === b) return true;
  }
  return false;
}

export function normalizeCid(s: string): number | null {
  const m = /(\d{1,10})/.exec(s);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n > 0 ? n : null;
}

const MAX_SMILES = 1000;
export function preValidateSmiles(s: string): string | null {
  const t = s.trim();
  if (!t) return 'Informe um SMILES.';
  if (t.length > MAX_SMILES) return `SMILES longo demais (máximo ${MAX_SMILES} caracteres).`;
  if (!SMILES_CHARS.test(t)) return 'O SMILES contém caracteres não permitidos.';
  return null;
}
