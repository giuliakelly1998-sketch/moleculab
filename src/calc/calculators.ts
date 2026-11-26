import { CONST, CalcError, Q } from './quantity';
import { KindId, KINDS } from './units';
import * as S from './stoichiometry';
import * as Sol from './solutions';
import * as PC from './physchem';
import { fmtNum } from '../utils/format';
import { texNum, texQ } from './tex';

export type CalcCategory = 'estequiometria' | 'solucoes' | 'fisicoquimica';

export const CATEGORY_LABELS: Record<CalcCategory, string> = {
  estequiometria: 'Estequiometria',
  solucoes: 'Soluções',
  fisicoquimica: 'Físico-química',
};

export interface VarDef {
  key: string;
  symbol: string;
  label: string;
  /** Um tipo de grandeza, ou vários quando a unidade escolhida define o tipo (ex.: constantes de velocidade). */
  kind: KindId | KindId[];
  defaultUnit: string;
  help: string;
  allowZero?: boolean;
  allowNegative?: boolean;
  integer?: boolean;
  /** Mostra um campo para calcular M a partir de uma fórmula. */
  formulaHelper?: boolean;
  example?: string;
}

export interface CalcOutput {
  symbol: string;
  label: string;
  kind: KindId | KindId[];
  q: Q;
  defaultUnit: string;
}

export interface PlotSpec {
  title: string;
  xLabel: string;
  yLabel: string;
  series: { name: string; x: number[]; y: number[]; mode?: 'lines' | 'markers' | 'lines+markers' }[];
}

export interface CalcResult {
  outputs: CalcOutput[];
  /** Linhas da substituição, em LaTeX. */
  substitution: string[];
  verdict?: string;
  notes?: string[];
  plot?: PlotSpec;
}

export interface CalcMode {
  id: string;
  label: string;
  inputs: string[];
}

export interface CalcContext {
  mode: string;
  /**
   * Valor de entrada em LaTeX, já convertido para a unidade de trabalho do seu tipo
   * (ou para `unitId`, se informada). Assim a substituição é sempre homogênea.
   */
  show: (key: string, unitId?: string) => string;
}

export interface CalcDef {
  id: string;
  category: CalcCategory;
  title: string;
  summary: string;
  /** Equações em LaTeX (renderizadas com KaTeX). */
  equations: string[];
  variables: VarDef[];
  modes?: CalcMode[];
  compute: (v: Record<string, Q>, ctx: CalcContext) => CalcResult;
}

export interface CustomCalcDef {
  id: string;
  category: CalcCategory;
  title: string;
  summary: string;
  custom: 'molar-mass';
}

export type AnyCalcDef = CalcDef | CustomCalcDef;
export const isCustom = (d: AnyCalcDef): d is CustomCalcDef => 'custom' in d;

const RATE_KINDS: KindId[] = ['rate1', 'rate2', 'rate0'];

// ---- variáveis reutilizáveis -------------------------------------------------
const V = {
  m: { key: 'm', symbol: 'm', label: 'Massa', kind: 'mass', defaultUnit: 'g', help: 'Massa da amostra.' },
  M: {
    key: 'M', symbol: 'M', label: 'Massa molar', kind: 'molarMass', defaultUnit: 'g/mol',
    help: 'Massa de um mol da substância. Pode ser calculada a partir da fórmula.', formulaHelper: true,
  },
  n: { key: 'n', symbol: 'n', label: 'Quantidade de matéria', kind: 'amount', defaultUnit: 'mol', help: 'Número de mols.' },
  V: { key: 'V', symbol: 'V', label: 'Volume', kind: 'volume', defaultUnit: 'L', help: 'Volume da solução (não do solvente).' },
  T: { key: 'T', symbol: 'T', label: 'Temperatura', kind: 'temperature', defaultUnit: 'K', help: 'Temperatura termodinâmica; °C é convertido para K.' },
  c: { key: 'c', symbol: 'c', label: 'Concentração molar', kind: 'concentration', defaultUnit: 'mol/L', help: 'Quantidade de soluto por volume de solução.' },
} satisfies Record<string, VarDef>;

const withKey = (base: VarDef, key: string, symbol: string, label?: string, help?: string): VarDef => ({
  ...base, key, symbol, label: label ?? base.label, help: help ?? base.help,
});

const linspace = (a: number, b: number, n = 60) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

/** Constantes em LaTeX. */
const R_TEX = '8{,}314\\ \\mathrm{J\\,mol^{-1}\\,K^{-1}}';
const R_ATM = CONST.R.value / 101325 * 1000; // atm·L·mol⁻¹·K⁻¹
const R_ATM_TEX = `${texNum(R_ATM, 5)}\\ \\mathrm{atm\\,L\\,mol^{-1}\\,K^{-1}}`;
const NA_TEX = '6{,}022 \\times 10^{23}\\ \\mathrm{mol^{-1}}';
const t = (s: string) => `\\text{${s}}`;

// ---- Estequiometria ----------------------------------------------------------
const massToMol: CalcDef = {
  id: 'massa-mol',
  category: 'estequiometria',
  title: 'Massa → mol',
  summary: 'Converte a massa de uma amostra em quantidade de matéria.',
  equations: ['n = \\dfrac{m}{M}'],
  variables: [V.m, V.M],
  compute: (v, ctx) => {
    const n = S.massToMoles(v.m, v.M);
    return {
      outputs: [{ symbol: 'n', label: 'Quantidade de matéria', kind: 'amount', q: n, defaultUnit: 'mol' }],
      substitution: [`n = \\dfrac{${ctx.show('m')}}{${ctx.show('M')}} = ${texQ(n, 'amount')}`],
    };
  },
};

const molToMass: CalcDef = {
  id: 'mol-massa',
  category: 'estequiometria',
  title: 'Mol → massa',
  summary: 'Converte quantidade de matéria em massa.',
  equations: ['m = n \\cdot M'],
  variables: [V.n, V.M],
  compute: (v, ctx) => {
    const m = S.molesToMass(v.n, v.M);
    return {
      outputs: [{ symbol: 'm', label: 'Massa', kind: 'mass', q: m, defaultUnit: 'g' }],
      substitution: [`m = ${ctx.show('n')} \\times ${ctx.show('M')} = ${texQ(m, 'mass')}`],
    };
  },
};

const particles: CalcDef = {
  id: 'particulas',
  category: 'estequiometria',
  title: 'Número de partículas',
  summary: 'Relaciona quantidade de matéria, massa e número de entidades pela constante de Avogadro.',
  equations: ['N = n \\cdot N_A', 'n = \\dfrac{m}{M}', `N_A = 6{,}022\\,140\\,76 \\times 10^{23}\\ \\mathrm{mol^{-1}}\\quad ${t('(exato, SI 2019)')}`],
  variables: [
    V.n, V.m, V.M,
    { key: 'N', symbol: 'N', label: 'Número de entidades', kind: 'count', defaultUnit: 'un', help: 'Átomos, moléculas, íons etc.' },
  ],
  modes: [
    { id: 'n', label: 'a partir de n', inputs: ['n'] },
    { id: 'm', label: 'a partir de m e M', inputs: ['m', 'M'] },
    { id: 'N', label: 'a partir de N', inputs: ['N'] },
  ],
  compute: (v, ctx) => {
    if (ctx.mode === 'N') {
      const n = S.particlesToMoles(v.N);
      return {
        outputs: [{ symbol: 'n', label: 'Quantidade de matéria', kind: 'amount', q: n, defaultUnit: 'mol' }],
        substitution: [`n = \\dfrac{N}{N_A} = \\dfrac{${ctx.show('N')}}{${NA_TEX}} = ${texQ(n, 'amount')}`],
      };
    }
    const n = ctx.mode === 'm' ? S.massToMoles(v.m, v.M) : v.n;
    const N = S.molesToParticles(n);
    return {
      outputs: [
        ...(ctx.mode === 'm' ? [{ symbol: 'n', label: 'Quantidade de matéria', kind: 'amount' as KindId, q: n, defaultUnit: 'mol' }] : []),
        { symbol: 'N', label: 'Número de entidades', kind: 'count', q: N, defaultUnit: 'un' },
      ],
      substitution: [
        ...(ctx.mode === 'm' ? [`n = \\dfrac{${ctx.show('m')}}{${ctx.show('M')}} = ${texQ(n, 'amount')}`] : []),
        `N = ${texQ(n, 'amount')} \\times ${NA_TEX} = ${texNum(N.value)}\\ ${t('entidades')}`,
      ],
    };
  },
};

const molarMassCalc: CustomCalcDef = {
  id: 'massa-molar',
  category: 'estequiometria',
  title: 'Massa molar',
  summary: 'Calcula a massa molar e a composição percentual a partir da fórmula (massas atômicas IUPAC 2021).',
  custom: 'molar-mass',
};

const stoichRatio: CalcDef = {
  id: 'relacao-estequiometrica',
  category: 'estequiometria',
  title: 'Relações estequiométricas',
  summary: 'Para a reação balanceada a A → b B, calcula quanto de B corresponde a uma massa de A.',
  equations: ['n_A = \\dfrac{m_A}{M_A}', 'n_B = n_A \\cdot \\dfrac{b}{a}', 'm_B = n_B \\cdot M_B'],
  variables: [
    { key: 'a', symbol: 'a', label: 'Coeficiente de A', kind: 'dimensionless', defaultUnit: '1', help: 'Coeficiente de A na equação balanceada.' },
    withKey(V.m, 'mA', 'm_A', 'Massa de A'),
    withKey(V.M, 'MA', 'M_A', 'Massa molar de A'),
    { key: 'b', symbol: 'b', label: 'Coeficiente de B', kind: 'dimensionless', defaultUnit: '1', help: 'Coeficiente de B na equação balanceada.' },
    withKey(V.M, 'MB', 'M_B', 'Massa molar de B'),
  ],
  compute: (v, ctx) => {
    const a = v.a.value, b = v.b.value;
    const nA = S.massToMoles(v.mA, v.MA);
    const nB = S.stoichRatio(nA, a, b);
    const mB = S.molesToMass(nB, v.MB);
    return {
      outputs: [
        { symbol: 'n_A', label: 'Quantidade de A', kind: 'amount', q: nA, defaultUnit: 'mol' },
        { symbol: 'n_B', label: 'Quantidade de B', kind: 'amount', q: nB, defaultUnit: 'mol' },
        { symbol: 'm_B', label: 'Massa de B', kind: 'mass', q: mB, defaultUnit: 'g' },
      ],
      substitution: [
        `n_A = \\dfrac{${ctx.show('mA')}}{${ctx.show('MA')}} = ${texQ(nA, 'amount')}`,
        `n_B = ${texQ(nA, 'amount')} \\times \\dfrac{${texNum(b)}}{${texNum(a)}} = ${texQ(nB, 'amount')}`,
        `m_B = ${texQ(nB, 'amount')} \\times ${ctx.show('MB')} = ${texQ(mB, 'mass')}`,
      ],
    };
  },
};

const limiting: CalcDef = {
  id: 'reagente-limitante',
  category: 'estequiometria',
  title: 'Reagente limitante',
  summary: 'Para a A + b B → p P, identifica o reagente limitante, o excesso e a massa teórica de produto.',
  equations: [
    `\\xi_i = \\dfrac{n_i}{\\nu_i}\\quad ${t('(o menor ')}\\xi${t(' indica o limitante)')}`,
    'n_P = p \\cdot \\xi_{\\text{máx}}',
    `n_{\\text{sobra}} = n_{\\text{excesso}} - \\nu_{\\text{excesso}} \\cdot \\xi_{\\text{máx}}`,
  ],
  variables: [
    { key: 'a', symbol: 'a', label: 'Coeficiente de A', kind: 'dimensionless', defaultUnit: '1', help: 'Coeficiente de A.' },
    withKey(V.m, 'mA', 'm_A', 'Massa de A'),
    withKey(V.M, 'MA', 'M_A', 'Massa molar de A'),
    { key: 'b', symbol: 'b', label: 'Coeficiente de B', kind: 'dimensionless', defaultUnit: '1', help: 'Coeficiente de B.' },
    withKey(V.m, 'mB', 'm_B', 'Massa de B'),
    withKey(V.M, 'MB', 'M_B', 'Massa molar de B'),
    { key: 'p', symbol: 'p', label: 'Coeficiente do produto P', kind: 'dimensionless', defaultUnit: '1', help: 'Coeficiente do produto de interesse.' },
    withKey(V.M, 'MP', 'M_P', 'Massa molar de P'),
  ],
  compute: (v, ctx) => {
    const nA = S.massToMoles(v.mA, v.MA);
    const nB = S.massToMoles(v.mB, v.MB);
    const r = S.limitingReagent([
      { label: 'A', coef: v.a.value, n: nA },
      { label: 'B', coef: v.b.value, n: nB },
    ]);
    if (v.p.value <= 0) throw new CalcError('O coeficiente do produto deve ser positivo.');
    const nP = r.xiMax.mul(v.p.value);
    const mP = nP.mul(v.MP);
    const excess = r.leftovers.find((l) => l.label !== r.limiting.label)!;
    const excessMass = excess.n.mul(excess.label === 'A' ? v.MA : v.MB);
    const tie = Math.abs(r.extents[0].xi.value - r.extents[1].xi.value) / r.xiMax.value < 1e-9;
    return {
      verdict: tie
        ? 'Os reagentes estão em proporção estequiométrica: nenhum está em excesso.'
        : `Reagente limitante: ${r.limiting.label}. Excesso de ${excess.label}.`,
      outputs: [
        { symbol: 'ξ_máx', label: 'Extensão máxima da reação', kind: 'amount', q: r.xiMax, defaultUnit: 'mol' },
        { symbol: 'm_P', label: 'Massa teórica de P', kind: 'mass', q: mP, defaultUnit: 'g' },
        { symbol: `m_${excess.label},sobra`, label: `Sobra de ${excess.label}`, kind: 'mass', q: excessMass, defaultUnit: 'g' },
      ],
      substitution: [
        `n_A = \\dfrac{${ctx.show('mA')}}{${ctx.show('MA')}} = ${texQ(nA, 'amount')} \\;\\Rightarrow\\; \\xi_A = \\dfrac{${texQ(nA, 'amount')}}{${texNum(v.a.value)}} = ${texQ(r.extents[0].xi, 'amount')}`,
        `n_B = \\dfrac{${ctx.show('mB')}}{${ctx.show('MB')}} = ${texQ(nB, 'amount')} \\;\\Rightarrow\\; \\xi_B = \\dfrac{${texQ(nB, 'amount')}}{${texNum(v.b.value)}} = ${texQ(r.extents[1].xi, 'amount')}`,
        `n_P = ${texNum(v.p.value)} \\times ${texQ(r.xiMax, 'amount')} = ${texQ(nP, 'amount')}`,
        `m_P = ${texQ(nP, 'amount')} \\times ${ctx.show('MP')} = ${texQ(mP, 'mass')}`,
      ],
    };
  },
};

const yieldCalc: CalcDef = {
  id: 'rendimento',
  category: 'estequiometria',
  title: 'Rendimento percentual',
  summary: 'Compara a quantidade obtida com a quantidade teórica.',
  equations: ['\\eta = \\dfrac{m_{\\text{real}}}{m_{\\text{teórica}}} \\times 100\\,\\%'],
  variables: [
    withKey(V.m, 'real', 'm_real', 'Massa obtida', 'Massa de produto efetivamente isolada.'),
    withKey(V.m, 'teo', 'm_teórica', 'Massa teórica', 'Massa máxima prevista pela estequiometria.'),
  ],
  compute: (v, ctx) => {
    const pct = S.percentYield(v.real, v.teo);
    return {
      outputs: [{ symbol: 'η', label: 'Rendimento', kind: 'percent', q: Q.of(pct / 100), defaultUnit: '%' }],
      substitution: [`\\eta = \\dfrac{${ctx.show('real')}}{${ctx.show('teo')}} \\times 100\\,\\% = ${texNum(pct, 4)}\\,\\%`],
      notes: pct > 100 ? ['Rendimento acima de 100 % costuma indicar produto úmido, impuro ou erro de pesagem.'] : undefined,
    };
  },
};

// ---- Soluções ----------------------------------------------------------------
const molarity: CalcDef = {
  id: 'concentracao-molar',
  category: 'solucoes',
  title: 'Concentração molar',
  summary: 'Quantidade de soluto por litro de solução.',
  equations: ['c = \\dfrac{n}{V}', 'c = \\dfrac{m}{M \\cdot V}'],
  variables: [V.n, V.m, V.M, V.V],
  modes: [
    { id: 'nV', label: 'a partir de n e V', inputs: ['n', 'V'] },
    { id: 'mMV', label: 'a partir de m, M e V', inputs: ['m', 'M', 'V'] },
  ],
  compute: (v, ctx) => {
    const c = ctx.mode === 'nV' ? Sol.molarConcentration(v.n, v.V) : Sol.molarConcentrationFromMass(v.m, v.M, v.V);
    return {
      outputs: [{ symbol: 'c', label: 'Concentração molar', kind: 'concentration', q: c, defaultUnit: 'mol/L' }],
      substitution: [
        ctx.mode === 'nV'
          ? `c = \\dfrac{${ctx.show('n')}}{${ctx.show('V')}} = ${texQ(c, 'concentration')}`
          : `c = \\dfrac{${ctx.show('m')}}{${ctx.show('M')} \\times ${ctx.show('V')}} = ${texQ(c, 'concentration')}`,
      ],
    };
  },
};

const dilution: CalcDef = {
  id: 'diluicao',
  category: 'solucoes',
  title: 'Diluição',
  summary: 'Conservação da quantidade de soluto ao diluir: c₁V₁ = c₂V₂.',
  equations: ['c_1 V_1 = c_2 V_2'],
  variables: [
    withKey(V.c, 'c1', 'c₁', 'Concentração inicial'),
    withKey(V.V, 'V1', 'V₁', 'Volume da alíquota', 'Volume da solução concentrada retirado.'),
    withKey(V.c, 'c2', 'c₂', 'Concentração final'),
    withKey(V.V, 'V2', 'V₂', 'Volume final', 'Volume total após a diluição.'),
  ],
  modes: [
    { id: 'V1', label: 'calcular V₁', inputs: ['c1', 'c2', 'V2'] },
    { id: 'c2', label: 'calcular c₂', inputs: ['c1', 'V1', 'V2'] },
    { id: 'V2', label: 'calcular V₂', inputs: ['c1', 'V1', 'c2'] },
    { id: 'c1', label: 'calcular c₁', inputs: ['V1', 'c2', 'V2'] },
  ],
  compute: (v, ctx) => {
    const tg = ctx.mode as Sol.DilutionTarget;
    const r = Sol.dilution(tg, v as Partial<Record<Sol.DilutionTarget, Q>>);
    const isVol = tg.startsWith('V');
    const res = texQ(r, isVol ? 'volume' : 'concentration');
    const sub: Record<Sol.DilutionTarget, string> = {
      V1: `V_1 = \\dfrac{c_2 V_2}{c_1} = \\dfrac{${ctx.show('c2')} \\times ${ctx.show('V2')}}{${ctx.show('c1')}} = ${res}`,
      c2: `c_2 = \\dfrac{c_1 V_1}{V_2} = \\dfrac{${ctx.show('c1')} \\times ${ctx.show('V1')}}{${ctx.show('V2')}} = ${res}`,
      V2: `V_2 = \\dfrac{c_1 V_1}{c_2} = \\dfrac{${ctx.show('c1')} \\times ${ctx.show('V1')}}{${ctx.show('c2')}} = ${res}`,
      c1: `c_1 = \\dfrac{c_2 V_2}{V_1} = \\dfrac{${ctx.show('c2')} \\times ${ctx.show('V2')}}{${ctx.show('V1')}} = ${res}`,
    };
    const outputs: CalcOutput[] = [
      { symbol: tg.replace('1', '₁').replace('2', '₂'), label: isVol ? 'Volume' : 'Concentração', kind: isVol ? 'volume' : 'concentration', q: r, defaultUnit: isVol ? 'mL' : 'mol/L' },
    ];
    const notes: string[] = [];
    if (tg === 'V1' && v.V2) {
      const solvent = v.V2.sub(r);
      outputs.push({ symbol: 'V_solvente', label: 'Solvente a adicionar (aprox.)', kind: 'volume', q: solvent, defaultUnit: 'mL' });
      notes.push('O volume de solvente é aproximado: volumes nem sempre são aditivos. Na prática, complete o balão volumétrico até a marca.');
    }
    return { outputs, substitution: [sub[tg]], notes };
  },
};

const massConc: CalcDef = {
  id: 'concentracao-comum',
  category: 'solucoes',
  title: 'Concentração comum',
  summary: 'Massa de soluto por volume de solução (concentração em massa).',
  equations: ['C = \\dfrac{m}{V}'],
  variables: [V.m, V.V],
  compute: (v, ctx) => {
    const C = Sol.massConcentration(v.m, v.V);
    return {
      outputs: [{ symbol: 'C', label: 'Concentração em massa', kind: 'massConcentration', q: C, defaultUnit: 'g/L' }],
      substitution: [`C = \\dfrac{${ctx.show('m')}}{${ctx.show('V')}} = ${texQ(C, 'massConcentration')}`],
    };
  },
};

const concConversion: CalcDef = {
  id: 'conversao-concentracao',
  category: 'solucoes',
  title: 'Conversão de unidades de concentração',
  summary: 'Converte entre concentração molar e concentração em massa (g/L, mg/L, % m/v).',
  equations: ['C = c \\cdot M', 'c = \\dfrac{C}{M}', `1\\,\\%\\,(m/v) = 1\\ \\mathrm{g}\\ ${t('em')}\\ 100\\ \\mathrm{mL} = 10\\ \\mathrm{g\\,L^{-1}}`],
  variables: [
    V.c,
    { key: 'Cm', symbol: 'C', label: 'Concentração em massa', kind: 'massConcentration', defaultUnit: 'g/L', help: 'Massa de soluto por volume de solução.' },
    V.M,
  ],
  modes: [
    { id: 'c2C', label: 'mol/L → massa/volume', inputs: ['c', 'M'] },
    { id: 'C2c', label: 'massa/volume → mol/L', inputs: ['Cm', 'M'] },
  ],
  compute: (v, ctx) => {
    if (ctx.mode === 'c2C') {
      const C = Sol.molarToMassConc(v.c, v.M);
      return {
        outputs: [
          { symbol: 'C', label: 'Concentração em massa', kind: 'massConcentration', q: C, defaultUnit: 'g/L' },
          { symbol: 'C', label: 'Em % (m/v)', kind: 'massConcentration', q: C, defaultUnit: 'pct-mv' },
          { symbol: 'C', label: 'Em mg/L', kind: 'massConcentration', q: C, defaultUnit: 'mg/L' },
        ],
        substitution: [`C = ${ctx.show('c')} \\times ${ctx.show('M')} = ${texQ(C, 'massConcentration')}`],
        notes: ['mg/L só equivale a ppm (m/m) em soluções aquosas diluídas, com densidade ≈ 1 g/mL. Para outros casos é preciso a densidade da solução.'],
      };
    }
    const c = Sol.massToMolarConc(v.Cm, v.M);
    return {
      outputs: [
        { symbol: 'c', label: 'Concentração molar', kind: 'concentration', q: c, defaultUnit: 'mol/L' },
        { symbol: 'c', label: 'Em mmol/L', kind: 'concentration', q: c, defaultUnit: 'mmol/L' },
      ],
      substitution: [`c = \\dfrac{${ctx.show('Cm')}}{${ctx.show('M')}} = ${texQ(c, 'concentration')}`],
    };
  },
};

const preparation: CalcDef = {
  id: 'preparo-solucoes',
  category: 'solucoes',
  title: 'Preparo de soluções',
  summary: 'Quanto pesar (sólido) ou medir (reagente líquido concentrado) para preparar uma solução.',
  equations: [
    `m = \\dfrac{c \\cdot V \\cdot M}{P}\\quad ${t('(sólido de pureza ')}P${t(')')}`,
    `V_{\\text{estoque}} = \\dfrac{c \\cdot V \\cdot M}{w \\cdot \\rho}\\quad ${t('(líquido de título ')}w${t(' e densidade ')}\\rho${t(')')}`,
  ],
  variables: [
    withKey(V.c, 'c', 'c', 'Concentração desejada'),
    withKey(V.V, 'V', 'V', 'Volume a preparar', 'Volume do balão volumétrico.'),
    V.M,
    { key: 'P', symbol: 'P', label: 'Pureza do reagente', kind: 'percent', defaultUnit: '%', help: 'Teor declarado no rótulo (ex.: 99,5 %).' },
    { key: 'w', symbol: 'w', label: 'Título em massa', kind: 'percent', defaultUnit: '%', help: 'Ex.: HCl concentrado ≈ 37 % (m/m), conforme o rótulo.' },
    { key: 'rho', symbol: 'ρ', label: 'Densidade do reagente', kind: 'density', defaultUnit: 'g/mL', help: 'Densidade do reagente concentrado, conforme o rótulo.' },
  ],
  modes: [
    { id: 'solid', label: 'soluto sólido', inputs: ['c', 'V', 'M', 'P'] },
    { id: 'liquid', label: 'reagente líquido concentrado', inputs: ['c', 'V', 'M', 'w', 'rho'] },
  ],
  compute: (v, ctx) => {
    if (ctx.mode === 'solid') {
      const m = Sol.soluteMassForSolution(v.c, v.V, v.M, v.P.value);
      return {
        outputs: [{ symbol: 'm', label: 'Massa a pesar', kind: 'mass', q: m, defaultUnit: 'g' }],
        substitution: [`m = \\dfrac{${ctx.show('c')} \\times ${ctx.show('V')} \\times ${ctx.show('M')}}{${texNum(v.P.value)}} = ${texQ(m, 'mass')}`],
        notes: ['A pureza entra como fração (99,5 % = 0,995). Dissolva em menos solvente que o volume final, transfira para o balão volumétrico e complete até a marca.'],
      };
    }
    const Vs = Sol.stockVolumeForSolution(v.c, v.V, v.M, v.w.value, v.rho);
    return {
      outputs: [{ symbol: 'V_estoque', label: 'Volume de reagente concentrado', kind: 'volume', q: Vs, defaultUnit: 'mL' }],
      substitution: [
        `V_{\\text{estoque}} = \\dfrac{${ctx.show('c')} \\times ${ctx.show('V')} \\times ${ctx.show('M')}}{${texNum(v.w.value)} \\times ${ctx.show('rho')}} = ${texQ(Vs, 'volume', 'mL')}`,
      ],
      notes: ['O título entra como fração (37 % = 0,37). Ao diluir ácidos concentrados, adicione o ácido à água, nunca o contrário, em capela e com EPI.'],
    };
  },
};

// ---- Físico-química ----------------------------------------------------------
const rateVar = (key: string, symbol: string, label: string, help: string): VarDef => ({
  key, symbol, label, kind: RATE_KINDS, defaultUnit: 's-1', help,
});
const Ea: VarDef = { key: 'Ea', symbol: 'Eₐ', label: 'Energia de ativação', kind: 'molarEnergy', defaultUnit: 'kJ/mol', help: 'Barreira energética da etapa determinante.' };

/** Constante de velocidade em LaTeX, na unidade de trabalho da ordem correspondente. */
const texRate = (q: Q) => texQ(q, RATE_KINDS.find((k) => q.is(KINDS[k].dims)) ?? 'rate1');

const arrhenius: CalcDef = {
  id: 'arrhenius',
  category: 'fisicoquimica',
  title: 'Equação de Arrhenius',
  summary: 'Dependência da constante de velocidade com a temperatura.',
  equations: ['k = A \\cdot \\exp\\!\\left(-\\dfrac{E_a}{RT}\\right)', `R = 8{,}314\\,462\\,618\\ \\mathrm{J\\,mol^{-1}\\,K^{-1}}`],
  variables: [
    rateVar('A', 'A', 'Fator pré-exponencial', 'Mesma unidade de k (depende da ordem da reação).'),
    rateVar('k', 'k', 'Constante de velocidade', 'Unidade define a ordem: s⁻¹ (1ª), L·mol⁻¹·s⁻¹ (2ª).'),
    Ea, V.T,
  ],
  modes: [
    { id: 'k', label: 'calcular k', inputs: ['A', 'Ea', 'T'] },
    { id: 'A', label: 'calcular A', inputs: ['k', 'Ea', 'T'] },
  ],
  compute: (v, ctx) => {
    const RT = CONST.R.mul(v.T);
    const x = v.Ea.div(RT).assertDimensionless('Eₐ/RT');
    const ratio = `\\dfrac{E_a}{RT} = \\dfrac{${ctx.show('Ea')}}{${R_TEX} \\times ${ctx.show('T')}} = ${texNum(x)}`;
    if (ctx.mode === 'A') {
      const A = PC.preExponential(v.k, v.Ea, v.T);
      return {
        outputs: [{ symbol: 'A', label: 'Fator pré-exponencial', kind: RATE_KINDS, q: A, defaultUnit: 's-1' }],
        substitution: [ratio, `A = k \\cdot \\exp\\!\\left(\\dfrac{E_a}{RT}\\right) = ${ctx.show('k')} \\times \\exp(${texNum(x)}) = ${texRate(A)}`],
      };
    }
    const k = PC.arrheniusK(v.A, v.Ea, v.T);
    const T0 = v.T.value;
    const Ts = linspace(Math.max(150, T0 - 100), T0 + 100);
    return {
      outputs: [{ symbol: 'k', label: 'Constante de velocidade', kind: RATE_KINDS, q: k, defaultUnit: 's-1' }],
      substitution: [ratio, `k = ${ctx.show('A')} \\times \\exp(-${texNum(x)}) = ${texRate(k)}`],
      plot: {
        title: 'ln k em função de 1/T (gráfico de Arrhenius)',
        xLabel: '1/T (K⁻¹)',
        yLabel: 'ln k (k em unidade SI)',
        series: [
          { name: 'Arrhenius', x: Ts.map((tt) => 1 / tt), y: Ts.map((tt) => Math.log(v.A.value) - v.Ea.value / (CONST.R.value * tt)), mode: 'lines' },
          { name: 'T informada', x: [1 / T0], y: [Math.log(k.value)], mode: 'markers' },
        ],
      },
    };
  },
};

const activation: CalcDef = {
  id: 'energia-ativacao',
  category: 'fisicoquimica',
  title: 'Energia de ativação (dois pontos)',
  summary: 'Estima Eₐ a partir de constantes de velocidade medidas em duas temperaturas.',
  equations: [
    '\\ln\\dfrac{k_2}{k_1} = -\\dfrac{E_a}{R}\\left(\\dfrac{1}{T_2} - \\dfrac{1}{T_1}\\right)',
    'E_a = \\dfrac{R \\cdot \\ln(k_2/k_1)}{\\dfrac{1}{T_1} - \\dfrac{1}{T_2}}',
  ],
  variables: [
    rateVar('k1', 'k₁', 'Constante a T₁', 'k₁ e k₂ precisam ter a mesma unidade (mesma ordem).'),
    withKey(V.T, 'T1', 'T₁', 'Temperatura 1'),
    rateVar('k2', 'k₂', 'Constante a T₂', 'k₁ e k₂ precisam ter a mesma unidade (mesma ordem).'),
    withKey(V.T, 'T2', 'T₂', 'Temperatura 2'),
  ],
  compute: (v, ctx) => {
    const Eaq = PC.activationEnergy(v.k1, v.T1, v.k2, v.T2);
    const A = PC.preExponential(v.k1, Eaq, v.T1);
    const x = [1 / v.T1.value, 1 / v.T2.value];
    const y = [Math.log(v.k1.value), Math.log(v.k2.value)];
    const lnr = Math.log(v.k2.value / v.k1.value);
    const dinv = 1 / v.T1.value - 1 / v.T2.value;
    const notes = Eaq.value < 0 ? ['Eₐ negativa: k diminui com T. Isso ocorre em alguns mecanismos com pré-equilíbrio, mas confira os dados.'] : undefined;
    return {
      outputs: [
        { symbol: 'Eₐ', label: 'Energia de ativação', kind: 'molarEnergy', q: Eaq, defaultUnit: 'kJ/mol' },
        { symbol: 'A', label: 'Fator pré-exponencial (estimado)', kind: RATE_KINDS, q: A, defaultUnit: 's-1' },
      ],
      substitution: [
        `\\ln\\dfrac{k_2}{k_1} = \\ln\\dfrac{${ctx.show('k2')}}{${ctx.show('k1')}} = ${texNum(lnr)}`,
        `\\dfrac{1}{T_1} - \\dfrac{1}{T_2} = \\dfrac{1}{${ctx.show('T1')}} - \\dfrac{1}{${ctx.show('T2')}} = ${texNum(dinv)}\\ \\mathrm{K^{-1}}`,
        `E_a = \\dfrac{${R_TEX} \\times ${texNum(lnr)}}{${texNum(dinv)}\\ \\mathrm{K^{-1}}} = ${texQ(Eaq, 'molarEnergy')}`,
      ],
      notes,
      plot: {
        title: 'Reta de Arrhenius pelos dois pontos',
        xLabel: '1/T (K⁻¹)',
        yLabel: 'ln k (k em unidade SI)',
        series: [{ name: 'dados', x, y, mode: 'lines+markers' }],
      },
    };
  },
};

const gas: CalcDef = {
  id: 'gases-ideais',
  category: 'fisicoquimica',
  title: 'Equação dos gases ideais',
  summary: 'PV = nRT, resolvida para a variável desejada. Válida para gases a baixa pressão e alta temperatura.',
  equations: ['PV = nRT', `R = ${R_ATM_TEX} = ${R_TEX}`],
  variables: [
    { key: 'P', symbol: 'P', label: 'Pressão', kind: 'pressure', defaultUnit: 'atm', help: 'Pressão absoluta do gás.' },
    V.V, V.n, V.T,
  ],
  modes: [
    { id: 'V', label: 'calcular V', inputs: ['P', 'n', 'T'] },
    { id: 'P', label: 'calcular P', inputs: ['V', 'n', 'T'] },
    { id: 'n', label: 'calcular n', inputs: ['P', 'V', 'T'] },
    { id: 'T', label: 'calcular T', inputs: ['P', 'V', 'n'] },
  ],
  compute: (v, ctx) => {
    const tg = ctx.mode as PC.GasTarget;
    const r = PC.idealGas(tg, v as Partial<Record<PC.GasTarget, Q>>);
    const meta: Record<PC.GasTarget, [string, KindId, string, () => string]> = {
      V: ['Volume', 'volume', 'L', () => `V = \\dfrac{nRT}{P} = \\dfrac{${ctx.show('n')} \\times ${R_ATM_TEX} \\times ${ctx.show('T')}}{${ctx.show('P')}}`],
      P: ['Pressão', 'pressure', 'atm', () => `P = \\dfrac{nRT}{V} = \\dfrac{${ctx.show('n')} \\times ${R_ATM_TEX} \\times ${ctx.show('T')}}{${ctx.show('V')}}`],
      n: ['Quantidade de matéria', 'amount', 'mol', () => `n = \\dfrac{PV}{RT} = \\dfrac{${ctx.show('P')} \\times ${ctx.show('V')}}{${R_ATM_TEX} \\times ${ctx.show('T')}}`],
      T: ['Temperatura', 'temperature', 'K', () => `T = \\dfrac{PV}{nR} = \\dfrac{${ctx.show('P')} \\times ${ctx.show('V')}}{${ctx.show('n')} \\times ${R_ATM_TEX}}`],
    };
    const [label, kind, unit, sub] = meta[tg];
    return { outputs: [{ symbol: tg, label, kind, q: r, defaultUnit: unit }], substitution: [`${sub()} = ${texQ(r, kind)}`] };
  },
};

const nernstCalc: CalcDef = {
  id: 'nernst',
  category: 'fisicoquimica',
  title: 'Equação de Nernst',
  summary: 'Potencial de célula ou de eletrodo fora das condições padrão.',
  equations: ['E = E^{\\circ} - \\dfrac{RT}{zF}\\ln Q', 'F = 96\\,485{,}332\\,12\\ \\mathrm{C\\,mol^{-1}}'],
  variables: [
    { key: 'E0', symbol: 'E°', label: 'Potencial padrão', kind: 'potential', defaultUnit: 'V', help: 'Potencial padrão da semirreação ou da célula.', allowNegative: true, allowZero: true },
    V.T,
    { key: 'z', symbol: 'z', label: 'Elétrons transferidos', kind: 'dimensionless', defaultUnit: '1', help: 'Número de elétrons na reação balanceada.', integer: true },
    { key: 'Qr', symbol: 'Q', label: 'Quociente de reação', kind: 'dimensionless', defaultUnit: '1', help: 'Produto das atividades (≈ concentrações/c°) dos produtos sobre reagentes.' },
  ],
  compute: (v, ctx) => {
    const z = v.z.value;
    const E = PC.nernst(v.E0, v.T, z, v.Qr.value);
    const slope = CONST.R.mul(v.T).div(CONST.F.mul(z));
    return {
      outputs: [{ symbol: 'E', label: 'Potencial', kind: 'potential', q: E, defaultUnit: 'V' }],
      substitution: [
        `\\dfrac{RT}{zF} = \\dfrac{${R_TEX} \\times ${ctx.show('T')}}{${texNum(z)} \\times 96\\,485\\ \\mathrm{C\\,mol^{-1}}} = ${texNum(slope.value)}\\ \\mathrm{V}`,
        `E = ${ctx.show('E0')} - ${texNum(slope.value)}\\ \\mathrm{V} \\times \\ln(${texNum(v.Qr.value)}) = ${texQ(E, 'potential')}`,
      ],
      notes: ['Usa atividades aproximadas por concentrações; em soluções concentradas, coeficientes de atividade alteram o resultado.'],
    };
  },
};

const gibbsCalc: CalcDef = {
  id: 'gibbs',
  category: 'fisicoquimica',
  title: 'Energia livre de Gibbs',
  summary: 'Espontaneidade a T e P constantes; com valores padrão, também fornece K.',
  equations: ['\\Delta G = \\Delta H - T\\,\\Delta S', `K = \\exp\\!\\left(-\\dfrac{\\Delta G^{\\circ}}{RT}\\right)\\quad ${t('(se ')}\\Delta H${t(' e ')}\\Delta S${t(' forem padrão)')}`],
  variables: [
    { key: 'dH', symbol: 'ΔH', label: 'Variação de entalpia', kind: 'molarEnergy', defaultUnit: 'kJ/mol', help: 'Positivo para processo endotérmico.', allowNegative: true, allowZero: true },
    V.T,
    { key: 'dS', symbol: 'ΔS', label: 'Variação de entropia', kind: 'molarEntropy', defaultUnit: 'J/(mol·K)', help: 'Atenção: costuma ser tabelado em J, não kJ.', allowNegative: true, allowZero: true },
  ],
  compute: (v, ctx) => {
    const G = PC.gibbs(v.dH, v.T, v.dS);
    const K = (() => { try { return PC.equilibriumConstant(G, v.T); } catch { return NaN; } })();
    const cross = PC.crossoverTemperature(v.dH, v.dS);
    const notes: string[] = [];
    if (cross) notes.push(`ΔG muda de sinal em T ≈ ${fmtNum(cross.value)} K (${fmtNum(cross.value - 273.15)} °C), supondo ΔH e ΔS constantes.`);
    if (Number.isFinite(K)) notes.push(`Se ΔH e ΔS forem valores padrão, a constante de equilíbrio (segunda equação acima) vale K = ${fmtNum(K)}.`);
    const TdS = v.T.mul(v.dS);
    return {
      verdict: G.value < 0 ? 'ΔG < 0: processo espontâneo nessas condições.' : G.value > 0 ? 'ΔG > 0: não espontâneo nessas condições (o inverso é espontâneo).' : 'ΔG = 0: sistema em equilíbrio.',
      outputs: [{ symbol: 'ΔG', label: 'Variação de energia livre', kind: 'molarEnergy', q: G, defaultUnit: 'kJ/mol' }],
      substitution: [
        `\\Delta G = ${ctx.show('dH')} - ${ctx.show('T')} \\times ${ctx.show('dS')}`,
        `\\Delta G = ${ctx.show('dH')} - ${texQ(TdS, 'molarEnergy')} = ${texQ(G, 'molarEnergy')}`,
      ],
      notes,
    };
  },
};

const clausius: CalcDef = {
  id: 'clausius-clapeyron',
  category: 'fisicoquimica',
  title: 'Equação de Clausius-Clapeyron',
  summary: 'Pressão de vapor em função da temperatura, supondo ΔHvap constante e vapor ideal.',
  equations: ['\\ln\\dfrac{P_2}{P_1} = -\\dfrac{\\Delta H_{\\text{vap}}}{R}\\left(\\dfrac{1}{T_2} - \\dfrac{1}{T_1}\\right)'],
  variables: [
    { key: 'P1', symbol: 'P₁', label: 'Pressão de vapor 1', kind: 'pressure', defaultUnit: 'kPa', help: 'Pressão de vapor conhecida a T₁.' },
    withKey(V.T, 'T1', 'T₁', 'Temperatura 1'),
    { key: 'P2', symbol: 'P₂', label: 'Pressão de vapor 2', kind: 'pressure', defaultUnit: 'kPa', help: 'Pressão de vapor a T₂.' },
    withKey(V.T, 'T2', 'T₂', 'Temperatura 2'),
    { key: 'dH', symbol: 'ΔH_vap', label: 'Entalpia de vaporização', kind: 'molarEnergy', defaultUnit: 'kJ/mol', help: 'Ex.: água ≈ 40,7 kJ/mol no ponto de ebulição normal.' },
  ],
  modes: [
    { id: 'P2', label: 'calcular P₂', inputs: ['P1', 'T1', 'T2', 'dH'] },
    { id: 'T2', label: 'calcular T₂', inputs: ['P1', 'T1', 'P2', 'dH'] },
    { id: 'dH', label: 'calcular ΔH_vap', inputs: ['P1', 'T1', 'P2', 'T2'] },
  ],
  compute: (v, ctx) => {
    let out: CalcOutput;
    let sub: string;
    let dH = v.dH;
    const P = (k: string) => ctx.show(k, 'kPa');
    if (ctx.mode === 'P2') {
      const P2 = PC.clausiusP2(v.P1, v.T1, v.T2, v.dH);
      out = { symbol: 'P₂', label: 'Pressão de vapor a T₂', kind: 'pressure', q: P2, defaultUnit: 'kPa' };
      sub = `P_2 = ${P('P1')} \\times \\exp\\!\\left[-\\dfrac{${ctx.show('dH')}}{${R_TEX}}\\left(\\dfrac{1}{${ctx.show('T2')}} - \\dfrac{1}{${ctx.show('T1')}}\\right)\\right] = ${texQ(P2, 'pressure', 'kPa')}`;
    } else if (ctx.mode === 'T2') {
      const T2 = PC.clausiusT2(v.P1, v.T1, v.P2, v.dH);
      out = { symbol: 'T₂', label: 'Temperatura', kind: 'temperature', q: T2, defaultUnit: 'K' };
      sub = `\\dfrac{1}{T_2} = \\dfrac{1}{${ctx.show('T1')}} - \\dfrac{${R_TEX} \\times \\ln\\dfrac{${P('P2')}}{${P('P1')}}}{${ctx.show('dH')}} \\;\\Rightarrow\\; T_2 = ${texQ(T2, 'temperature')}`;
    } else {
      dH = PC.clausiusDH(v.P1, v.T1, v.P2, v.T2);
      out = { symbol: 'ΔH_vap', label: 'Entalpia de vaporização', kind: 'molarEnergy', q: dH, defaultUnit: 'kJ/mol' };
      sub = `\\Delta H_{\\text{vap}} = \\dfrac{-${R_TEX} \\times \\ln\\dfrac{${P('P2')}}{${P('P1')}}}{\\dfrac{1}{${ctx.show('T2')}} - \\dfrac{1}{${ctx.show('T1')}}} = ${texQ(dH, 'molarEnergy')}`;
    }
    const T1 = v.T1.value;
    const Ts = linspace(Math.max(100, T1 - 60), T1 + 60);
    const curve = Ts.map((tt) => (v.P1.value * Math.exp((-dH.value / CONST.R.value) * (1 / tt - 1 / T1))) / 1000);
    return {
      outputs: [out],
      substitution: [sub],
      notes: ['Aproximação: ΔH_vap constante no intervalo, volume do líquido desprezível e vapor ideal.'],
      plot: { title: 'Curva de pressão de vapor estimada', xLabel: 'T (K)', yLabel: 'P (kPa)', series: [{ name: 'Clausius-Clapeyron', x: Ts, y: curve, mode: 'lines' }] },
    };
  },
};

export const CALCULATORS: AnyCalcDef[] = [
  massToMol, molToMass, particles, molarMassCalc, stoichRatio, limiting, yieldCalc,
  molarity, dilution, massConc, concConversion, preparation,
  arrhenius, activation, gas, nernstCalc, gibbsCalc, clausius,
];

export function getCalculator(id: string): AnyCalcDef | undefined {
  return CALCULATORS.find((c) => c.id === id);
}
