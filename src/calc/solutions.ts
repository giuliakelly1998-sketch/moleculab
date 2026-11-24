import { CalcError, Q } from './quantity';

/** c = n / V */
export function molarConcentration(n: Q, V: Q): Q {
  return n.div(V);
}

/** c = m / (M · V) */
export function molarConcentrationFromMass(m: Q, M: Q, V: Q): Q {
  return m.div(M.mul(V));
}

/** Concentração comum (em massa): C = m / V */
export function massConcentration(m: Q, V: Q): Q {
  return m.div(V);
}

export type DilutionTarget = 'c1' | 'V1' | 'c2' | 'V2';

/** c₁V₁ = c₂V₂, resolvendo para a variável escolhida. */
export function dilution(target: DilutionTarget, v: Partial<Record<DilutionTarget, Q>>): Q {
  const need = (k: DilutionTarget) => {
    const q = v[k];
    if (!q) throw new CalcError(`Falta o valor de ${k}.`);
    return q;
  };
  let r: Q;
  switch (target) {
    case 'c1': r = need('c2').mul(need('V2')).div(need('V1')); break;
    case 'V1': r = need('c2').mul(need('V2')).div(need('c1')); break;
    case 'c2': r = need('c1').mul(need('V1')).div(need('V2')); break;
    case 'V2': r = need('c1').mul(need('V1')).div(need('c2')); break;
  }
  if (target === 'c2' && v.c1 && r.value > v.c1.value * (1 + 1e-12)) {
    throw new CalcError('Concentração final maior que a inicial: isso seria concentração, não diluição.');
  }
  if (target === 'c1' && v.c2 && r.value < v.c2.value * (1 - 1e-12)) {
    throw new CalcError('A concentração inicial resultou menor que a final; confira os volumes.');
  }
  return r;
}

/** Massa de soluto (sólido) para preparar V de solução a c, com pureza p (0–1]. */
export function soluteMassForSolution(c: Q, V: Q, M: Q, purity: number): Q {
  if (!(purity > 0 && purity <= 1)) throw new CalcError('A pureza deve estar entre 0 e 100 %.');
  return c.mul(V).mul(M).div(purity);
}

/**
 * Volume de reagente líquido concentrado (título em massa w, densidade ρ)
 * para preparar V de solução a c:  V_estoque = c·V·M / (w·ρ)
 */
export function stockVolumeForSolution(c: Q, V: Q, M: Q, w: number, rho: Q): Q {
  if (!(w > 0 && w <= 1)) throw new CalcError('O título em massa deve estar entre 0 e 100 %.');
  return c.mul(V).mul(M).div(rho.mul(w));
}

/** Conversões entre concentração molar e concentração em massa. */
export function molarToMassConc(c: Q, M: Q): Q {
  return c.mul(M);
}

export function massToMolarConc(Cm: Q, M: Q): Q {
  return Cm.div(M);
}
