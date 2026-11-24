import { CONST, CalcError, Q } from './quantity';
import { KindId } from './units';
import * as S from './stoichiometry';
import * as Sol from './solutions';
import * as PC from './physchem';
import { fmtNum } from '../utils/format';

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
  /** Valor como o usuário digitou, com a unidade escolhida (ex.: "25 °C"). */
  show: (key: string) => string;
}

export interface CalcDef {
  id: string;
  category: CalcCategory;
  title: string;
  summary: string;
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

// ---- Estequiometria ----------------------------------------------------------
const massToMol: CalcDef = {
  id: 'massa-mol',
  category: 'estequiometria',
  title: 'Massa → mol',
  summary: 'Converte a massa de uma amostra em quantidade de matéria.',
  equations: ['n = m / M'],
  variables: [V.m, V.M],
  compute: (v, ctx) => ({
    outputs: [{ symbol: 'n', label: 'Quantidade de matéria', kind: 'amount', q: S.massToMoles(v.m, v.M), defaultUnit: 'mol' }],
    substitution: [`n = ${ctx.show('m')} ÷ ${ctx.show('M')}`],
  }),
};

const molToMass: CalcDef = {
  id: 'mol-massa',
  category: 'estequiometria',
  title: 'Mol → massa',
  summary: 'Converte quantidade de matéria em massa.',
  equations: ['m = n · M'],
  variables: [V.n, V.M],
  compute: (v, ctx) => ({
    outputs: [{ symbol: 'm', label: 'Massa', kind: 'mass', q: S.molesToMass(v.n, v.M), defaultUnit: 'g' }],
    substitution: [`m = ${ctx.show('n')} × ${ctx.show('M')}`],
  }),
};

const particles: CalcDef = {
  id: 'particulas',
  category: 'estequiometria',
  title: 'Número de partículas',
  summary: 'Relaciona quantidade de matéria, massa e número de entidades pela constante de Avogadro.',
  equations: ['N = n · Nₐ', 'n = m / M', 'Nₐ = 6,02214076 × 10²³ mol⁻¹ (exato, SI 2019)'],
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
        substitution: [`n = ${ctx.show('N')} ÷ 6,02214076 × 10²³ mol⁻¹`],
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
        ...(ctx.mode === 'm' ? [`n = ${ctx.show('m')} ÷ ${ctx.show('M')} = ${fmtNum(n.value)} mol`] : []),
        `N = ${ctx.mode === 'm' ? fmtNum(n.value) + ' mol' : ctx.show('n')} × 6,02214076 × 10²³ mol⁻¹`,
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
  equations: ['n_A = m_A / M_A', 'n_B = n_A · (b / a)', 'm_B = n_B · M_B'],
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
        `n_A = ${ctx.show('mA')} ÷ ${ctx.show('MA')} = ${fmtNum(nA.value)} mol`,
        `n_B = ${fmtNum(nA.value)} mol × (${fmtNum(b)} / ${fmtNum(a)}) = ${fmtNum(nB.value)} mol`,
        `m_B = ${fmtNum(nB.value)} mol × ${ctx.show('MB')}`,
      ],
    };
  },
};

const limiting: CalcDef = {
  id: 'reagente-limitante',
  category: 'estequiometria',
  title: 'Reagente limitante',
  summary: 'Para a A + b B → p P, identifica o reagente limitante, o excesso e a massa teórica de produto.',
  equations: ['ξᵢ = nᵢ / νᵢ (o menor ξ define o limitante)', 'n_P = p · ξ_máx', 'n_excesso = n_B − b · ξ_máx'],
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
        `n_A = ${ctx.show('mA')} ÷ ${ctx.show('MA')} = ${fmtNum(nA.value)} mol → ξ_A = ${fmtNum(r.extents[0].xi.value)} mol`,
        `n_B = ${ctx.show('mB')} ÷ ${ctx.show('MB')} = ${fmtNum(nB.value)} mol → ξ_B = ${fmtNum(r.extents[1].xi.value)} mol`,
        `n_P = ${fmtNum(v.p.value)} × ${fmtNum(r.xiMax.value)} mol = ${fmtNum(nP.value)} mol`,
        `m_P = ${fmtNum(nP.value)} mol × ${ctx.show('MP')}`,
      ],
    };
  },
};

const yieldCalc: CalcDef = {
  id: 'rendimento',
  category: 'estequiometria',
  title: 'Rendimento percentual',
  summary: 'Compara a quantidade obtida com a quantidade teórica.',
  equations: ['η = (m_real / m_teórica) × 100 %'],
  variables: [
    withKey(V.m, 'real', 'm_real', 'Massa obtida', 'Massa de produto efetivamente isolada.'),
    withKey(V.m, 'teo', 'm_teórica', 'Massa teórica', 'Massa máxima prevista pela estequiometria.'),
  ],
  compute: (v, ctx) => {
    const pct = S.percentYield(v.real, v.teo);
    return {
      outputs: [{ symbol: 'η', label: 'Rendimento', kind: 'percent', q: Q.of(pct / 100), defaultUnit: '%' }],
      substitution: [`η = (${ctx.show('real')} ÷ ${ctx.show('teo')}) × 100 %`],
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
  equations: ['c = n / V', 'c = m / (M · V)'],
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
          ? `c = ${ctx.show('n')} ÷ ${ctx.show('V')}`
          : `c = ${ctx.show('m')} ÷ (${ctx.show('M')} × ${ctx.show('V')})`,
      ],
    };
  },
};

const dilution: CalcDef = {
  id: 'diluicao',
  category: 'solucoes',
  title: 'Diluição',
  summary: 'Conservação da quantidade de soluto ao diluir: c₁V₁ = c₂V₂.',
  equations: ['c₁ · V₁ = c₂ · V₂'],
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
    const t = ctx.mode as Sol.DilutionTarget;
    const r = Sol.dilution(t, v as Partial<Record<Sol.DilutionTarget, Q>>);
    const isVol = t.startsWith('V');
    const sub: Record<Sol.DilutionTarget, string> = {
      V1: `V₁ = ${ctx.show('c2')} × ${ctx.show('V2')} ÷ ${ctx.show('c1')}`,
      c2: `c₂ = ${ctx.show('c1')} × ${ctx.show('V1')} ÷ ${ctx.show('V2')}`,
      V2: `V₂ = ${ctx.show('c1')} × ${ctx.show('V1')} ÷ ${ctx.show('c2')}`,
      c1: `c₁ = ${ctx.show('c2')} × ${ctx.show('V2')} ÷ ${ctx.show('V1')}`,
    };
    const outputs: CalcOutput[] = [
      { symbol: t.replace('1', '₁').replace('2', '₂'), label: isVol ? 'Volume' : 'Concentração', kind: isVol ? 'volume' : 'concentration', q: r, defaultUnit: isVol ? 'mL' : 'mol/L' },
    ];
    const notes: string[] = [];
    if (t === 'V1' && v.V2) {
      const solvent = v.V2.sub(r);
      outputs.push({ symbol: 'V_solvente', label: 'Solvente a adicionar (aprox.)', kind: 'volume', q: solvent, defaultUnit: 'mL' });
      notes.push('O volume de solvente é aproximado: volumes nem sempre são aditivos. Na prática, complete o balão volumétrico até a marca.');
    }
    return { outputs, substitution: [sub[t]], notes };
  },
};

const massConc: CalcDef = {
  id: 'concentracao-comum',
  category: 'solucoes',
  title: 'Concentração comum',
  summary: 'Massa de soluto por volume de solução (concentração em massa).',
  equations: ['C = m / V'],
  variables: [V.m, V.V],
  compute: (v, ctx) => ({
    outputs: [{ symbol: 'C', label: 'Concentração em massa', kind: 'massConcentration', q: Sol.massConcentration(v.m, v.V), defaultUnit: 'g/L' }],
    substitution: [`C = ${ctx.show('m')} ÷ ${ctx.show('V')}`],
  }),
};

const concConversion: CalcDef = {
  id: 'conversao-concentracao',
  category: 'solucoes',
  title: 'Conversão de unidades de concentração',
  summary: 'Converte entre concentração molar e concentração em massa (g/L, mg/L, % m/v).',
  equations: ['C = c · M', 'c = C / M', '% (m/v) = g de soluto em 100 mL de solução'],
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
        substitution: [`C = ${ctx.show('c')} × ${ctx.show('M')}`],
        notes: ['mg/L só equivale a ppm (m/m) em soluções aquosas diluídas, com densidade ≈ 1 g/mL. Para outros casos é preciso a densidade da solução.'],
      };
    }
    const c = Sol.massToMolarConc(v.Cm, v.M);
    return {
      outputs: [
        { symbol: 'c', label: 'Concentração molar', kind: 'concentration', q: c, defaultUnit: 'mol/L' },
        { symbol: 'c', label: 'Em mmol/L', kind: 'concentration', q: c, defaultUnit: 'mmol/L' },
      ],
      substitution: [`c = ${ctx.show('Cm')} ÷ ${ctx.show('M')}`],
    };
  },
};

const preparation: CalcDef = {
  id: 'preparo-solucoes',
  category: 'solucoes',
  title: 'Preparo de soluções',
  summary: 'Quanto pesar (sólido) ou medir (reagente líquido concentrado) para preparar uma solução.',
  equations: ['m = c · V · M / P   (sólido de pureza P)', 'V_estoque = c · V · M / (w · ρ)   (líquido de título w e densidade ρ)'],
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
        substitution: [`m = ${ctx.show('c')} × ${ctx.show('V')} × ${ctx.show('M')} ÷ ${fmtNum(v.P.value)}`],
        notes: ['Dissolva em menos solvente que o volume final, transfira para o balão volumétrico e complete até a marca.'],
      };
    }
    const Vs = Sol.stockVolumeForSolution(v.c, v.V, v.M, v.w.value, v.rho);
    return {
      outputs: [{ symbol: 'V_estoque', label: 'Volume de reagente concentrado', kind: 'volume', q: Vs, defaultUnit: 'mL' }],
      substitution: [`V_estoque = ${ctx.show('c')} × ${ctx.show('V')} × ${ctx.show('M')} ÷ (${fmtNum(v.w.value)} × ${ctx.show('rho')})`],
      notes: ['Ao diluir ácidos concentrados, adicione o ácido à água, nunca o contrário, em capela e com EPI.'],
    };
  },
};

// ---- Físico-química ----------------------------------------------------------
const rateVar = (key: string, symbol: string, label: string, help: string): VarDef => ({
  key, symbol, label, kind: RATE_KINDS, defaultUnit: 's-1', help,
});
const Ea: VarDef = { key: 'Ea', symbol: 'Eₐ', label: 'Energia de ativação', kind: 'molarEnergy', defaultUnit: 'kJ/mol', help: 'Barreira energética da etapa determinante.' };

const arrhenius: CalcDef = {
  id: 'arrhenius',
  category: 'fisicoquimica',
  title: 'Equação de Arrhenius',
  summary: 'Dependência da constante de velocidade com a temperatura.',
  equations: ['k = A · exp(−Eₐ / RT)', 'R = 8,314462618 J·mol⁻¹·K⁻¹'],
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
    if (ctx.mode === 'A') {
      const A = PC.preExponential(v.k, v.Ea, v.T);
      return {
        outputs: [{ symbol: 'A', label: 'Fator pré-exponencial', kind: RATE_KINDS, q: A, defaultUnit: 's-1' }],
        substitution: [`Eₐ/RT = ${ctx.show('Ea')} ÷ (8,314462618 J·mol⁻¹·K⁻¹ × ${fmtNum(v.T.value)} K) = ${fmtNum(x)}`, `A = ${ctx.show('k')} × exp(${fmtNum(x)})`],
      };
    }
    const k = PC.arrheniusK(v.A, v.Ea, v.T);
    const T0 = v.T.value;
    const Ts = linspace(Math.max(150, T0 - 100), T0 + 100);
    return {
      outputs: [{ symbol: 'k', label: 'Constante de velocidade', kind: RATE_KINDS, q: k, defaultUnit: 's-1' }],
      substitution: [
        `Eₐ/RT = ${ctx.show('Ea')} ÷ (8,314462618 J·mol⁻¹·K⁻¹ × ${fmtNum(T0)} K) = ${fmtNum(x)}`,
        `k = ${ctx.show('A')} × exp(−${fmtNum(x)})`,
      ],
      plot: {
        title: 'ln k em função de 1/T (gráfico de Arrhenius)',
        xLabel: '1/T (K⁻¹)',
        yLabel: 'ln k (k em unidade SI)',
        series: [
          { name: 'Arrhenius', x: Ts.map((t) => 1 / t), y: Ts.map((t) => Math.log(v.A.value) - v.Ea.value / (CONST.R.value * t)), mode: 'lines' },
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
  equations: ['ln(k₂/k₁) = −(Eₐ/R) · (1/T₂ − 1/T₁)', 'Eₐ = R · ln(k₂/k₁) / (1/T₁ − 1/T₂)'],
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
    const notes = Eaq.value < 0 ? ['Eₐ negativa: k diminui com T. Isso ocorre em alguns mecanismos com pré-equilíbrio, mas confira os dados.'] : undefined;
    return {
      outputs: [
        { symbol: 'Eₐ', label: 'Energia de ativação', kind: 'molarEnergy', q: Eaq, defaultUnit: 'kJ/mol' },
        { symbol: 'A', label: 'Fator pré-exponencial (estimado)', kind: RATE_KINDS, q: A, defaultUnit: 's-1' },
      ],
      substitution: [
        `ln(k₂/k₁) = ln(${ctx.show('k2')} ÷ ${ctx.show('k1')}) = ${fmtNum(Math.log(v.k2.value / v.k1.value))}`,
        `1/T₁ − 1/T₂ = ${fmtNum(1 / v.T1.value)} K⁻¹ − ${fmtNum(1 / v.T2.value)} K⁻¹ = ${fmtNum(1 / v.T1.value - 1 / v.T2.value)} K⁻¹`,
        `Eₐ = 8,314462618 J·mol⁻¹·K⁻¹ × ${fmtNum(Math.log(v.k2.value / v.k1.value))} ÷ ${fmtNum(1 / v.T1.value - 1 / v.T2.value)} K⁻¹`,
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
  equations: ['P · V = n · R · T', 'R = 8,314462618 J·mol⁻¹·K⁻¹'],
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
    const t = ctx.mode as PC.GasTarget;
    const r = PC.idealGas(t, v as Partial<Record<PC.GasTarget, Q>>);
    const meta: Record<PC.GasTarget, [string, KindId, string, string]> = {
      V: ['Volume', 'volume', 'L', `V = ${ctx.show('n')} × R × ${fmtNum(v.T?.value ?? 0)} K ÷ ${ctx.show('P')}`],
      P: ['Pressão', 'pressure', 'atm', `P = ${ctx.show('n')} × R × ${fmtNum(v.T?.value ?? 0)} K ÷ ${ctx.show('V')}`],
      n: ['Quantidade de matéria', 'amount', 'mol', `n = ${ctx.show('P')} × ${ctx.show('V')} ÷ (R × ${fmtNum(v.T?.value ?? 0)} K)`],
      T: ['Temperatura', 'temperature', 'K', `T = ${ctx.show('P')} × ${ctx.show('V')} ÷ (${ctx.show('n')} × R)`],
    };
    const [label, kind, unit, sub] = meta[t];
    return { outputs: [{ symbol: t, label, kind, q: r, defaultUnit: unit }], substitution: [sub] };
  },
};

const nernstCalc: CalcDef = {
  id: 'nernst',
  category: 'fisicoquimica',
  title: 'Equação de Nernst',
  summary: 'Potencial de célula ou de eletrodo fora das condições padrão.',
  equations: ['E = E° − (RT / zF) · ln Q', 'F = 96485,33212 C·mol⁻¹'],
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
        `RT/zF = 8,314462618 × ${fmtNum(v.T.value)} K ÷ (${z} × 96485,33212) = ${fmtNum(slope.value)} V`,
        `E = ${ctx.show('E0')} − ${fmtNum(slope.value)} V × ln(${fmtNum(v.Qr.value)})`,
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
  equations: ['ΔG = ΔH − T · ΔS', 'K = exp(−ΔG° / RT)   (se ΔH e ΔS forem padrão)'],
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
    if (Number.isFinite(K)) notes.push(`Se ΔH e ΔS forem padrão: K = exp(−ΔG°/RT) = ${fmtNum(K)}.`);
    return {
      verdict: G.value < 0 ? 'ΔG < 0: processo espontâneo nessas condições.' : G.value > 0 ? 'ΔG > 0: não espontâneo nessas condições (o inverso é espontâneo).' : 'ΔG = 0: sistema em equilíbrio.',
      outputs: [{ symbol: 'ΔG', label: 'Variação de energia livre', kind: 'molarEnergy', q: G, defaultUnit: 'kJ/mol' }],
      substitution: [`ΔG = ${ctx.show('dH')} − ${fmtNum(v.T.value)} K × ${ctx.show('dS')}`],
      notes,
    };
  },
};

const clausius: CalcDef = {
  id: 'clausius-clapeyron',
  category: 'fisicoquimica',
  title: 'Equação de Clausius-Clapeyron',
  summary: 'Pressão de vapor em função da temperatura, supondo ΔHvap constante e vapor ideal.',
  equations: ['ln(P₂/P₁) = −(ΔH_vap / R) · (1/T₂ − 1/T₁)'],
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
    if (ctx.mode === 'P2') {
      out = { symbol: 'P₂', label: 'Pressão de vapor a T₂', kind: 'pressure', q: PC.clausiusP2(v.P1, v.T1, v.T2, v.dH), defaultUnit: 'kPa' };
      sub = `P₂ = ${ctx.show('P1')} × exp[−(${ctx.show('dH')} ÷ R) × (1/${fmtNum(v.T2.value)} K − 1/${fmtNum(v.T1.value)} K)]`;
    } else if (ctx.mode === 'T2') {
      out = { symbol: 'T₂', label: 'Temperatura', kind: 'temperature', q: PC.clausiusT2(v.P1, v.T1, v.P2, v.dH), defaultUnit: 'K' };
      sub = `1/T₂ = 1/${fmtNum(v.T1.value)} K − R × ln(${ctx.show('P2')} ÷ ${ctx.show('P1')}) ÷ ${ctx.show('dH')}`;
    } else {
      dH = PC.clausiusDH(v.P1, v.T1, v.P2, v.T2);
      out = { symbol: 'ΔH_vap', label: 'Entalpia de vaporização', kind: 'molarEnergy', q: dH, defaultUnit: 'kJ/mol' };
      sub = `ΔH_vap = −R × ln(${ctx.show('P2')} ÷ ${ctx.show('P1')}) ÷ (1/${fmtNum(v.T2.value)} K − 1/${fmtNum(v.T1.value)} K)`;
    }
    const T1 = v.T1.value;
    const Ts = linspace(Math.max(100, T1 - 60), T1 + 60);
    const curve = Ts.map((t) => (v.P1.value * Math.exp((-dH.value / CONST.R.value) * (1 / t - 1 / T1))) / 1000);
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
