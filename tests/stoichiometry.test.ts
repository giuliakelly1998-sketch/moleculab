import { Q, D } from '../src/calc/quantity';
import { toQ } from '../src/calc/units';
import { massToMoles, molesToMass, molesToParticles, limitingReagent, percentYield, stoichRatio } from '../src/calc/stoichiometry';
import { getCalculator, CalcDef } from '../src/calc/calculators';

const g = (v: number) => toQ(v, 'mass', 'g');
const gmol = (v: number) => toQ(v, 'molarMass', 'g/mol');

describe('estequiometria', () => {
  it('massa → mol: 18,015 g de água = 1 mol', () => {
    const n = massToMoles(g(18.015), gmol(18.015));
    expect(n.is(D.amount)).toBe(true);
    expect(n.value).toBeCloseTo(1, 10);
  });
  it('mol → massa: 0,5 mol de NaCl = 29,22 g', () => {
    expect(molesToMass(Q.of(0.5, D.amount), gmol(58.44)).value * 1000).toBeCloseTo(29.22, 2);
  });
  it('1 mol contém Nₐ entidades', () => {
    expect(molesToParticles(Q.of(1, D.amount)).value).toBe(6.02214076e23);
  });
  it('relação estequiométrica 2 H₂ → 2 H₂O', () => {
    expect(stoichRatio(Q.of(3, D.amount), 2, 2).value).toBe(3);
  });
  it('reagente limitante: 2 H₂ + O₂ com 4,0 g H₂ e 32,0 g O₂ → H₂ limita', () => {
    const nH2 = massToMoles(g(4.0), gmol(2.016));
    const nO2 = massToMoles(g(32.0), gmol(31.998));
    const r = limitingReagent([
      { label: 'H2', coef: 2, n: nH2 },
      { label: 'O2', coef: 1, n: nO2 },
    ]);
    expect(r.limiting.label).toBe('H2');
    expect(r.xiMax.value).toBeCloseTo(0.99206, 4);
    // água teórica: 2 ξ × 18,015 g/mol ≈ 35,74 g
    expect(r.xiMax.mul(2).mul(gmol(18.015)).value * 1000).toBeCloseTo(35.74, 1);
  });
  it('rendimento percentual', () => {
    expect(percentYield(g(7.5), g(10))).toBeCloseTo(75);
    expect(() => percentYield(g(1), Q.of(0, D.mass))).toThrow();
  });
  it('calculadora de reagente limitante (definição completa)', () => {
    const def = getCalculator('reagente-limitante') as CalcDef;
    const r = def.compute(
      { a: Q.of(2), mA: g(4.0), MA: gmol(2.016), b: Q.of(1), mB: g(32.0), MB: gmol(31.998), p: Q.of(2), MP: gmol(18.015) },
      { mode: '', show: (k) => k },
    );
    expect(r.verdict).toMatch(/limitante: A/);
    const mP = r.outputs.find((o) => o.symbol === 'm_P')!;
    expect(mP.q.value * 1000).toBeCloseTo(35.74, 1);
  });
});
