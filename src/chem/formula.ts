import { getElement, ElementInfo } from './elements';

export class FormulaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FormulaError';
  }
}

export type ElementCounts = Record<string, number>;

export interface CompositionRow {
  symbol: string;
  name: string;
  count: number;
  atomicMass: number;
  contribution: number; // g/mol
  massFraction: number; // 0–1
  radioactive: boolean;
}

export interface MolarMassResult {
  formula: string;
  counts: ElementCounts;
  molarMass: number; // g/mol
  composition: CompositionRow[];
  hasNonStandardMass: boolean;
}

const MAX_FORMULA_LENGTH = 200;

/**
 * Converte uma fórmula molecular em contagem de elementos.
 * Suporta parênteses/colchetes aninhados e hidratos ("CuSO4·5H2O", "CuSO4.5H2O", "CuSO4*5H2O").
 * Rejeita cargas e caracteres inválidos em vez de ignorá-los silenciosamente.
 */
export function parseFormula(input: string): ElementCounts {
  const formula = (input ?? '').replace(/\s+/g, '');
  if (!formula) throw new FormulaError('Informe uma fórmula.');
  if (formula.length > MAX_FORMULA_LENGTH) throw new FormulaError('Fórmula longa demais.');
  if (/[+\-]/.test(formula)) {
    throw new FormulaError('Fórmulas com carga não são suportadas nesta calculadora.');
  }
  // Normaliza números subscritos Unicode (H₂O) para ASCII.
  const normalized = formula.replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));

  const total: ElementCounts = {};
  const parts = normalized.split(/[·.*•]/);
  for (const raw of parts) {
    if (!raw) throw new FormulaError('Separador de hidrato sem fórmula ao lado.');
    const m = /^(\d+)(.*)$/.exec(raw);
    const mult = m ? parseInt(m[1], 10) : 1;
    const body = m ? m[2] : raw;
    if (!body) throw new FormulaError(`Parte "${raw}" não contém elementos.`);
    const counts = parseGroup(body);
    for (const [el, n] of Object.entries(counts)) total[el] = (total[el] ?? 0) + n * mult;
  }
  return total;
}

function parseGroup(s: string): ElementCounts {
  const stack: ElementCounts[] = [{}];
  const closers: string[] = [];
  let i = 0;
  const readNumber = (): number => {
    const m = /^\d+/.exec(s.slice(i));
    if (!m) return 1;
    i += m[0].length;
    const n = parseInt(m[0], 10);
    if (n === 0) throw new FormulaError('Índice zero não é permitido.');
    return n;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[') {
      stack.push({});
      closers.push(ch === '(' ? ')' : ']');
      i++;
    } else if (ch === ')' || ch === ']') {
      const expected = closers.pop();
      if (expected !== ch) throw new FormulaError('Parênteses ou colchetes desbalanceados.');
      i++;
      const n = readNumber();
      const group = stack.pop()!;
      const top = stack[stack.length - 1];
      for (const [el, c] of Object.entries(group)) top[el] = (top[el] ?? 0) + c * n;
    } else if (/[A-Z]/.test(ch)) {
      const m = /^[A-Z][a-z]?/.exec(s.slice(i))!;
      let sym = m[0];
      // "Co" pode ser C + o inválido; se o par de letras não existe, tenta só a maiúscula.
      if (sym.length === 2 && !getElement(sym)) sym = sym[0];
      if (!getElement(sym)) throw new FormulaError(`Elemento desconhecido: "${m[0]}".`);
      i += sym.length;
      const n = readNumber();
      const top = stack[stack.length - 1];
      top[sym] = (top[sym] ?? 0) + n;
    } else if (/\d/.test(ch)) {
      throw new FormulaError('Número em posição inesperada.');
    } else {
      throw new FormulaError(`Caractere inválido: "${ch}".`);
    }
  }
  if (stack.length !== 1) throw new FormulaError('Parênteses ou colchetes desbalanceados.');
  const result = stack[0];
  if (Object.keys(result).length === 0) throw new FormulaError('Nenhum elemento encontrado.');
  return result;
}

/** Ordem de Hill: C, H e depois alfabética (ou alfabética se não houver C). */
export function hillOrder(counts: ElementCounts): string[] {
  const els = Object.keys(counts);
  if (counts.C) {
    const rest = els.filter((e) => e !== 'C' && e !== 'H').sort();
    return ['C', ...(counts.H ? ['H'] : []), ...rest];
  }
  return els.sort();
}

export function countsToFormula(counts: ElementCounts): string {
  return hillOrder(counts)
    .map((el) => `${el}${counts[el] === 1 ? '' : counts[el]}`)
    .join('');
}

export function molarMass(input: string): MolarMassResult {
  const counts = parseFormula(input);
  let total = 0;
  const rows: CompositionRow[] = [];
  for (const sym of hillOrder(counts)) {
    const el = getElement(sym) as ElementInfo;
    const contribution = el.mass * counts[sym];
    total += contribution;
    rows.push({
      symbol: sym,
      name: el.namePt,
      count: counts[sym],
      atomicMass: el.mass,
      contribution,
      massFraction: 0,
      radioactive: !!el.radioactive,
    });
  }
  rows.forEach((r) => (r.massFraction = r.contribution / total));
  return {
    formula: input.trim(),
    counts,
    molarMass: total,
    composition: rows,
    hasNonStandardMass: rows.some((r) => r.radioactive),
  };
}

/** Verifica se uma string tem a forma de fórmula molecular com elementos válidos. */
export function looksLikeFormula(s: string): boolean {
  const t = s.trim();
  if (!/^(?:[A-Z][a-z]?\d*|[()[\]]\d*)+$/.test(t)) return false;
  try {
    parseFormula(t);
    return true;
  } catch {
    return false;
  }
}
