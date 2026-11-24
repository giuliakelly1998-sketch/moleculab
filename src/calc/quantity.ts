/**
 * Grandezas com análise dimensional.
 *
 * Cada valor é armazenado em unidades SI coerentes acompanhado de um vetor de
 * dimensões [L, M, T, N, Θ, I] (comprimento, massa, tempo, quantidade de
 * matéria, temperatura, corrente). Somas exigem dimensões iguais; exp/ln
 * exigem argumentos adimensionais. Assim a verificação dimensional é parte do
 * próprio cálculo e não um rótulo decorativo.
 */
export type Dims = readonly [number, number, number, number, number, number];

export const DIM_NAMES = ['L', 'M', 'T', 'N', 'Θ', 'I'] as const;
export const DIMENSIONLESS: Dims = [0, 0, 0, 0, 0, 0];

export class DimensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DimensionError';
  }
}

export class CalcError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CalcError';
  }
}

export function sameDims(a: Dims, b: Dims): boolean {
  return a.every((v, i) => Math.abs(v - b[i]) < 1e-12);
}

export function formatDims(d: Dims): string {
  const parts = d
    .map((e, i) => (e === 0 ? '' : e === 1 ? DIM_NAMES[i] : `${DIM_NAMES[i]}${toSuperscript(e)}`))
    .filter(Boolean);
  return parts.length ? parts.join('·') : '1 (adimensional)';
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = {
    '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '.': '·',
  };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

export class Q {
  constructor(public readonly value: number, public readonly dims: Dims) {
    if (!Number.isFinite(value)) throw new CalcError('O resultado não é um número finito (estouro ou indeterminação).');
  }

  static of(value: number, dims: Dims = DIMENSIONLESS): Q {
    return new Q(value, dims);
  }

  mul(o: Q | number): Q {
    if (typeof o === 'number') return new Q(this.value * o, this.dims);
    return new Q(this.value * o.value, this.dims.map((d, i) => d + o.dims[i]) as unknown as Dims);
  }

  div(o: Q | number): Q {
    const v = typeof o === 'number' ? o : o.value;
    if (v === 0) throw new CalcError('Divisão por zero.');
    if (typeof o === 'number') return new Q(this.value / o, this.dims);
    return new Q(this.value / o.value, this.dims.map((d, i) => d - o.dims[i]) as unknown as Dims);
  }

  add(o: Q): Q {
    if (!sameDims(this.dims, o.dims)) {
      throw new DimensionError(`Soma de grandezas incompatíveis: ${formatDims(this.dims)} + ${formatDims(o.dims)}.`);
    }
    return new Q(this.value + o.value, this.dims);
  }

  sub(o: Q): Q {
    return this.add(o.mul(-1));
  }

  pow(n: number): Q {
    return new Q(this.value ** n, this.dims.map((d) => d * n) as unknown as Dims);
  }

  inv(): Q {
    return Q.of(1).div(this);
  }

  assertDimensionless(context: string): number {
    if (!sameDims(this.dims, DIMENSIONLESS)) {
      throw new DimensionError(`${context} precisa ser adimensional, mas tem dimensão ${formatDims(this.dims)}.`);
    }
    return this.value;
  }

  is(d: Dims): boolean {
    return sameDims(this.dims, d);
  }
}

export function qexp(q: Q): Q {
  return Q.of(Math.exp(q.assertDimensionless('O argumento da exponencial')));
}

export function qln(q: Q): Q {
  const v = q.assertDimensionless('O argumento do logaritmo');
  if (v <= 0) throw new CalcError('Logaritmo de número menor ou igual a zero.');
  return Q.of(Math.log(v));
}

// Dimensões de uso frequente
export const D = {
  none: DIMENSIONLESS,
  length: [1, 0, 0, 0, 0, 0] as Dims,
  mass: [0, 1, 0, 0, 0, 0] as Dims,
  time: [0, 0, 1, 0, 0, 0] as Dims,
  amount: [0, 0, 0, 1, 0, 0] as Dims,
  temperature: [0, 0, 0, 0, 1, 0] as Dims,
  volume: [3, 0, 0, 0, 0, 0] as Dims,
  pressure: [-1, 1, -2, 0, 0, 0] as Dims,
  energy: [2, 1, -2, 0, 0, 0] as Dims,
  molarEnergy: [2, 1, -2, -1, 0, 0] as Dims,
  molarEntropy: [2, 1, -2, -1, -1, 0] as Dims,
  molarMass: [0, 1, 0, -1, 0, 0] as Dims,
  concentration: [-3, 0, 0, 1, 0, 0] as Dims,
  massConcentration: [-3, 1, 0, 0, 0, 0] as Dims,
  density: [-3, 1, 0, 0, 0, 0] as Dims,
  potential: [2, 1, -3, 0, 0, -1] as Dims,
  perAmount: [0, 0, 0, -1, 0, 0] as Dims,
  rate1: [0, 0, -1, 0, 0, 0] as Dims,
  rate2: [3, 0, -1, -1, 0, 0] as Dims,
  rate0: [-3, 0, -1, 1, 0, 0] as Dims,
} as const;

/** Constantes físicas — CODATA 2018 (valores exatos no SI revisado de 2019 quando aplicável). */
export const CONST = {
  R: Q.of(8.314462618, D.molarEntropy), // J mol⁻¹ K⁻¹
  NA: Q.of(6.02214076e23, D.perAmount), // mol⁻¹ (exato)
  F: Q.of(96485.33212, [0, 0, 1, -1, 0, 1] as Dims), // C mol⁻¹ = A·s·mol⁻¹
};
