import { CONST, CalcError, Q, qexp, qln } from './quantity';

/** Arrhenius: k = A · exp(−Ea / RT) */
export function arrheniusK(A: Q, Ea: Q, T: Q): Q {
  return A.mul(qexp(Ea.div(CONST.R.mul(T)).mul(-1)));
}

/** Energia de ativação a partir de dois pontos: Ea = R · ln(k₂/k₁) / (1/T₁ − 1/T₂) */
export function activationEnergy(k1: Q, T1: Q, k2: Q, T2: Q): Q {
  if (Math.abs(T1.value - T2.value) < 1e-12) throw new CalcError('T₁ e T₂ precisam ser diferentes.');
  const lnRatio = qln(k2.div(k1));
  const dInvT = T1.inv().sub(T2.inv());
  return CONST.R.mul(lnRatio).div(dInvT);
}

/** Fator pré-exponencial a partir de k, Ea e T: A = k · exp(Ea/RT) */
export function preExponential(k: Q, Ea: Q, T: Q): Q {
  return k.mul(qexp(Ea.div(CONST.R.mul(T))));
}

export type GasTarget = 'P' | 'V' | 'n' | 'T';

/** PV = nRT, resolvendo para a variável escolhida. */
export function idealGas(target: GasTarget, v: Partial<Record<GasTarget, Q>>): Q {
  const need = (k: GasTarget) => {
    const q = v[k];
    if (!q) throw new CalcError(`Falta o valor de ${k}.`);
    return q;
  };
  const R = CONST.R;
  switch (target) {
    case 'P': return need('n').mul(R).mul(need('T')).div(need('V'));
    case 'V': return need('n').mul(R).mul(need('T')).div(need('P'));
    case 'n': return need('P').mul(need('V')).div(R.mul(need('T')));
    case 'T': return need('P').mul(need('V')).div(need('n').mul(R));
  }
}

/** Nernst: E = E° − (RT / zF) · ln Q */
export function nernst(E0: Q, T: Q, z: number, Qr: number): Q {
  if (!Number.isInteger(z) || z <= 0) throw new CalcError('O número de elétrons z deve ser inteiro positivo.');
  if (!(Qr > 0)) throw new CalcError('O quociente de reação Q deve ser maior que zero.');
  return E0.sub(CONST.R.mul(T).div(CONST.F.mul(z)).mul(qln(Q.of(Qr))));
}

/** Gibbs: ΔG = ΔH − TΔS */
export function gibbs(dH: Q, T: Q, dS: Q): Q {
  return dH.sub(T.mul(dS));
}

/** K = exp(−ΔG° / RT) */
export function equilibriumConstant(dG0: Q, T: Q): number {
  return qexp(dG0.div(CONST.R.mul(T)).mul(-1)).value;
}

/** Temperatura de inversão de espontaneidade, T = ΔH/ΔS (quando os sinais são iguais). */
export function crossoverTemperature(dH: Q, dS: Q): Q | null {
  if (dS.value === 0) return null;
  const T = dH.div(dS);
  return T.value > 0 ? T : null;
}

/** Clausius–Clapeyron: ln(P₂/P₁) = −(ΔHvap/R)(1/T₂ − 1/T₁) → P₂ */
export function clausiusP2(P1: Q, T1: Q, T2: Q, dHvap: Q): Q {
  const exponent = dHvap.div(CONST.R).mul(T2.inv().sub(T1.inv())).mul(-1);
  return P1.mul(qexp(exponent));
}

/** Clausius–Clapeyron resolvida para ΔHvap a partir de dois pares (T, P). */
export function clausiusDH(P1: Q, T1: Q, P2: Q, T2: Q): Q {
  if (Math.abs(T1.value - T2.value) < 1e-12) throw new CalcError('T₁ e T₂ precisam ser diferentes.');
  return CONST.R.mul(qln(P2.div(P1))).mul(-1).div(T2.inv().sub(T1.inv()));
}

/** Clausius–Clapeyron resolvida para T₂ dada uma pressão P₂. */
export function clausiusT2(P1: Q, T1: Q, P2: Q, dHvap: Q): Q {
  const invT2 = T1.inv().sub(CONST.R.mul(qln(P2.div(P1))).div(dHvap));
  if (invT2.value <= 0) throw new CalcError('Não há temperatura positiva compatível com esses dados.');
  return invT2.inv();
}
