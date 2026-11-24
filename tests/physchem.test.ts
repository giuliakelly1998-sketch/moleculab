import { Q, D, CalcError } from '../src/calc/quantity';
import { toQ, fromQ } from '../src/calc/units';
import * as PC from '../src/calc/physchem';

const K = (v: number) => toQ(v, 'temperature', 'K');
const kJ = (v: number) => toQ(v, 'molarEnergy', 'kJ/mol');
const s1 = (v: number) => toQ(v, 'rate1', 's-1');

describe('gases ideais', () => {
  it('1 mol a 273,15 K e 1 atm ocupa 22,414 L', () => {
    const V = PC.idealGas('V', { n: Q.of(1, D.amount), T: K(273.15), P: toQ(1, 'pressure', 'atm') });
    expect(fromQ(V, 'volume', 'L')).toBeCloseTo(22.414, 3);
  });
  it('resolve T e n de forma consistente', () => {
    const P = toQ(1, 'pressure', 'bar');
    const V = toQ(24.79, 'volume', 'L');
    const T = PC.idealGas('T', { P, V, n: Q.of(1, D.amount) });
    expect(T.value).toBeCloseTo(298.15, 0);
    expect(PC.idealGas('n', { P, V, T }).value).toBeCloseTo(1, 6);
  });
});

describe('Arrhenius', () => {
  it('k = A exp(−Ea/RT)', () => {
    const k = PC.arrheniusK(s1(1e13), kJ(100), K(298.15));
    expect(k.is(D.rate1)).toBe(true);
    expect(k.value).toBeCloseTo(1e13 * Math.exp(-100000 / (8.314462618 * 298.15)), 12);
  });
  it('Ea por dois pontos recupera o valor usado para gerar os dados', () => {
    const A = s1(5e10);
    const Ea = kJ(75);
    const k1 = PC.arrheniusK(A, Ea, K(300));
    const k2 = PC.arrheniusK(A, Ea, K(330));
    expect(fromQ(PC.activationEnergy(k1, K(300), k2, K(330)), 'molarEnergy', 'kJ/mol')).toBeCloseTo(75, 8);
  });
  it('regra prática: Ea ≈ 50 kJ/mol dobra k entre 298 e 308 K', () => {
    const r = PC.arrheniusK(s1(1), kJ(50), K(308)).value / PC.arrheniusK(s1(1), kJ(50), K(298)).value;
    expect(r).toBeCloseTo(1.93, 2);
  });
  it('constantes de ordens diferentes são dimensionalmente incompatíveis', () => {
    const k2 = toQ(1, 'rate2', 'L/(mol·s)');
    expect(() => PC.activationEnergy(s1(1), K(300), k2, K(310))).toThrow();
  });
  it('T₁ = T₂ é rejeitado', () => {
    expect(() => PC.activationEnergy(s1(1), K(300), s1(2), K(300))).toThrow(CalcError);
  });
});

describe('Nernst', () => {
  it('Cu²⁺/Cu, [Cu²⁺] = 0,010 mol/L a 25 °C → 0,281 V', () => {
    // Cu²⁺ + 2e⁻ → Cu ; Q = 1/[Cu²⁺] = 100
    const E = PC.nernst(toQ(0.34, 'potential', 'V'), K(298.15), 2, 100);
    expect(E.value).toBeCloseTo(0.2808, 3);
  });
  it('Q = 1 → E = E°', () => {
    expect(PC.nernst(toQ(1.23, 'potential', 'V'), K(298.15), 4, 1).value).toBeCloseTo(1.23, 12);
  });
  it('valida z e Q', () => {
    expect(() => PC.nernst(Q.of(0, D.potential), K(298), 0, 1)).toThrow();
    expect(() => PC.nernst(Q.of(0, D.potential), K(298), 1, 0)).toThrow();
  });
});

describe('Gibbs', () => {
  it('fusão do gelo: ΔH = 6,01 kJ/mol, ΔS = 22,0 J/(mol·K) → ΔG ≈ 0 a 273 K', () => {
    const dH = kJ(6.01);
    const dS = toQ(22.0, 'molarEntropy', 'J/(mol·K)');
    expect(Math.abs(PC.gibbs(dH, K(273.15), dS).value)) .toBeLessThan(10);
    expect(PC.gibbs(dH, K(298.15), dS).value).toBeLessThan(0);
    expect(PC.crossoverTemperature(dH, dS)!.value).toBeCloseTo(273.2, 0);
  });
  it('K = exp(−ΔG°/RT): ΔG° = 0 → K = 1', () => {
    expect(PC.equilibriumConstant(kJ(0), K(298.15))).toBe(1);
  });
});

describe('Clausius–Clapeyron', () => {
  // Água: ΔHvap ≈ 40,7 kJ/mol; P(373,15 K) = 101,325 kPa; tabelado P(353,15 K) ≈ 47,4 kPa.
  it('pressão de vapor da água a 80 °C (aproximação dá ≈ 48 kPa)', () => {
    const P2 = PC.clausiusP2(toQ(101.325, 'pressure', 'kPa'), K(373.15), K(353.15), kJ(40.7));
    expect(fromQ(P2, 'pressure', 'kPa')).toBeGreaterThan(46);
    expect(fromQ(P2, 'pressure', 'kPa')).toBeLessThan(50);
  });
  it('ΔHvap e T₂ são inversas consistentes de P₂', () => {
    const P1 = toQ(101.325, 'pressure', 'kPa');
    const P2 = PC.clausiusP2(P1, K(373.15), K(350), kJ(40.7));
    expect(fromQ(PC.clausiusDH(P1, K(373.15), P2, K(350)), 'molarEnergy', 'kJ/mol')).toBeCloseTo(40.7, 8);
    expect(PC.clausiusT2(P1, K(373.15), P2, kJ(40.7)).value).toBeCloseTo(350, 8);
  });
});
