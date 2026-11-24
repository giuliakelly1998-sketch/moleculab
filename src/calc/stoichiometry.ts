import { CONST, CalcError, D, Q } from './quantity';

/** n = m / M */
export function massToMoles(m: Q, M: Q): Q {
  return m.div(M);
}

/** m = n · M */
export function molesToMass(n: Q, M: Q): Q {
  return n.mul(M);
}

/** N = n · N_A */
export function molesToParticles(n: Q): Q {
  return n.mul(CONST.NA);
}

/** n = N / N_A */
export function particlesToMoles(N: Q): Q {
  return N.div(CONST.NA);
}

/**
 * Relação estequiométrica para aA → bB:
 * n_B = n_A · (b / a)
 */
export function stoichRatio(nA: Q, a: number, b: number): Q {
  assertCoef(a, 'a');
  assertCoef(b, 'b');
  return nA.mul(b / a);
}

export interface Reactant {
  label: string;
  coef: number;
  n: Q; // quantidade de matéria disponível
}

export interface LimitingResult {
  limiting: Reactant;
  /** Extensão máxima da reação ξ = n/ν para cada reagente. */
  extents: { label: string; xi: Q }[];
  xiMax: Q;
  /** Quantidade em excesso que sobra de cada reagente. */
  leftovers: { label: string; n: Q }[];
}

/** Reagente limitante: aquele com menor ξ = n_i / ν_i. */
export function limitingReagent(reactants: Reactant[]): LimitingResult {
  if (reactants.length < 2) throw new CalcError('Informe ao menos dois reagentes.');
  reactants.forEach((r) => assertCoef(r.coef, r.label));
  const extents = reactants.map((r) => ({ label: r.label, xi: r.n.div(r.coef) }));
  let minIdx = 0;
  extents.forEach((e, i) => {
    if (e.xi.value < extents[minIdx].xi.value) minIdx = i;
  });
  const xiMax = extents[minIdx].xi;
  const leftovers = reactants.map((r) => ({ label: r.label, n: r.n.sub(xiMax.mul(r.coef)) }));
  return { limiting: reactants[minIdx], extents, xiMax, leftovers };
}

/** Rendimento percentual = real / teórico × 100 */
export function percentYield(actual: Q, theoretical: Q): number {
  if (theoretical.value <= 0) throw new CalcError('O rendimento teórico deve ser maior que zero.');
  const ratio = actual.div(theoretical).assertDimensionless('Razão real/teórico');
  return ratio * 100;
}

function assertCoef(c: number, label: string) {
  if (!Number.isFinite(c) || c <= 0) throw new CalcError(`O coeficiente estequiométrico de ${label} deve ser positivo.`);
}

export const isAmount = (q: Q) => q.is(D.amount);
