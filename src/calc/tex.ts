import { Q } from './quantity';
import { KINDS, KindId, fromQ } from './units';

/**
 * Apresentação das contas em notação matemática (LaTeX, renderizado com KaTeX).
 *
 * Regra didática: na substituição, todos os valores aparecem convertidos para um
 * mesmo conjunto coerente de unidades ("unidades de trabalho"), para que a conta
 * escrita seja dimensionalmente homogênea — nunca "500 kJ/mol − 520 K × 100 J/(mol·K)".
 */
export const WORK_UNIT: Record<KindId, string> = {
  mass: 'g',
  amount: 'mol',
  volume: 'L',
  temperature: 'K',
  pressure: 'atm',
  molarEnergy: 'J/mol',
  molarEntropy: 'J/(mol·K)',
  molarMass: 'g/mol',
  concentration: 'mol/L',
  massConcentration: 'g/L',
  density: 'g/mL',
  potential: 'V',
  rate1: 's-1',
  rate2: 'L/(mol·s)',
  rate0: 'mol/(L·s)',
  dimensionless: '1',
  percent: '%',
  count: 'un',
};

export const UNIT_TEX: Record<string, string> = {
  g: '\\mathrm{g}', mg: '\\mathrm{mg}', ug: '\\mathrm{\\mu g}', kg: '\\mathrm{kg}',
  mol: '\\mathrm{mol}', mmol: '\\mathrm{mmol}', umol: '\\mathrm{\\mu mol}', kmol: '\\mathrm{kmol}',
  L: '\\mathrm{L}', mL: '\\mathrm{mL}', uL: '\\mathrm{\\mu L}', m3: '\\mathrm{m^3}', dm3: '\\mathrm{dm^3}', cm3: '\\mathrm{cm^3}',
  K: '\\mathrm{K}', C: '{}^{\\circ}\\mathrm{C}',
  Pa: '\\mathrm{Pa}', kPa: '\\mathrm{kPa}', bar: '\\mathrm{bar}', atm: '\\mathrm{atm}', mmHg: '\\mathrm{mmHg}', torr: '\\mathrm{Torr}',
  'J/mol': '\\mathrm{J\\,mol^{-1}}', 'kJ/mol': '\\mathrm{kJ\\,mol^{-1}}', 'kcal/mol': '\\mathrm{kcal\\,mol^{-1}}',
  'J/(mol·K)': '\\mathrm{J\\,mol^{-1}\\,K^{-1}}', 'kJ/(mol·K)': '\\mathrm{kJ\\,mol^{-1}\\,K^{-1}}', 'cal/(mol·K)': '\\mathrm{cal\\,mol^{-1}\\,K^{-1}}',
  'g/mol': '\\mathrm{g\\,mol^{-1}}', 'kg/mol': '\\mathrm{kg\\,mol^{-1}}',
  'mol/L': '\\mathrm{mol\\,L^{-1}}', 'mmol/L': '\\mathrm{mmol\\,L^{-1}}', 'umol/L': '\\mathrm{\\mu mol\\,L^{-1}}', 'mol/m3': '\\mathrm{mol\\,m^{-3}}',
  'g/L': '\\mathrm{g\\,L^{-1}}', 'mg/L': '\\mathrm{mg\\,L^{-1}}', 'ug/L': '\\mathrm{\\mu g\\,L^{-1}}', 'g/mL': '\\mathrm{g\\,mL^{-1}}',
  'pct-mv': '\\%\\,(m/v)', 'kg/m3': '\\mathrm{kg\\,m^{-3}}', 'g/cm3': '\\mathrm{g\\,cm^{-3}}', 'kg/L': '\\mathrm{kg\\,L^{-1}}',
  V: '\\mathrm{V}', mV: '\\mathrm{mV}',
  's-1': '\\mathrm{s^{-1}}', 'min-1': '\\mathrm{min^{-1}}', 'h-1': '\\mathrm{h^{-1}}',
  'L/(mol·s)': '\\mathrm{L\\,mol^{-1}\\,s^{-1}}', 'm3/(mol·s)': '\\mathrm{m^3\\,mol^{-1}\\,s^{-1}}', 'mol/(L·s)': '\\mathrm{mol\\,L^{-1}\\,s^{-1}}',
  '1': '', '%': '\\%', un: '',
};

/** Número em notação pt-BR para LaTeX: 448000 → "448\,000"; 6,02e23 → "6{,}022 \times 10^{23}". */
export function texNum(v: number, sig = 5): string {
  if (!Number.isFinite(v)) return '\\text{—}';
  if (v === 0) return '0';
  const neg = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6 || a < 1e-3) {
    const [m, e] = a.toExponential(sig - 1).split('e');
    const mant = m.includes('.') ? m.replace(/0+$/, '').replace(/\.$/, '') : m;
    return `${neg}${mant.replace('.', '{,}')} \\times 10^{${parseInt(e, 10)}}`;
  }
  const s = String(Number(a.toPrecision(sig)));
  const [int, dec] = s.split('.');
  const grouped = int.length > 4 ? int.replace(/\B(?=(\d{3})+(?!\d))/g, '\\,') : int;
  return neg + grouped + (dec ? `{,}${dec}` : '');
}

/** Grandeza na unidade de trabalho (ou na unidade pedida), já em LaTeX: "0{,}25\ \mathrm{mol\,L^{-1}}". */
export function texQ(q: Q, kind: KindId, unitId: string = WORK_UNIT[kind], sig = 5): string {
  const v = fromQ(q, kind, unitId);
  const u = UNIT_TEX[unitId] ?? `\\mathrm{${unitId}}`;
  return u ? `${texNum(v, sig)}\\ ${u}` : texNum(v, sig);
}

/** Primeira unidade de trabalho de uma lista de tipos possíveis que seja compatível com a grandeza. */
export function kindOfQ(q: Q, kinds: KindId[]): KindId {
  return kinds.find((k) => q.is(KINDS[k].dims)) ?? kinds[0];
}

const GREEK: Record<string, string> = {
  Δ: '\\Delta ', ξ: '\\xi ', η: '\\eta ', ρ: '\\rho ', ν: '\\nu ', λ: '\\lambda ', μ: '\\mu ', α: '\\alpha ',
};
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', 'ₐ': 'a', 'ᵢ': 'i' };

/** Símbolo de variável → LaTeX: "m_A" → m_{A}; "ξ_máx" → \xi_{\text{máx}}; "Eₐ" → E_{a}; "c₁" → c_{1}. */
export function symTex(sym: string): string {
  let s = sym.replace(/[₀₁₂₃ₐᵢ]+/g, (m) => `_${m.split('').map((c) => SUB[c]).join('')}`);
  const i = s.indexOf('_');
  const base = i < 0 ? s : s.slice(0, i);
  const sub = i < 0 ? '' : s.slice(i + 1);
  const b = base.split('').map((c) => GREEK[c] ?? c).join('').replace('°', '^{\\circ}');
  s = b;
  if (sub) s += /^[A-Za-z0-9]$/.test(sub) || /^\d+$/.test(sub) ? `_{${sub}}` : `_{\\text{${sub}}}`;
  return s;
}
