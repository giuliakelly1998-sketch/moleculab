import { Q, D, qexp, qln, DimensionError, CalcError, CONST } from '../src/calc/quantity';
import { toQ, fromQ, convert } from '../src/calc/units';

describe('álgebra dimensional', () => {
  it('multiplica e divide dimensões', () => {
    const n = Q.of(2, D.amount);
    const V = Q.of(0.5e-3, D.volume);
    const c = n.div(V);
    expect(c.is(D.concentration)).toBe(true);
    expect(c.value).toBeCloseTo(4000);
  });
  it('bloqueia soma de grandezas incompatíveis', () => {
    expect(() => Q.of(1, D.mass).add(Q.of(1, D.volume))).toThrow(DimensionError);
  });
  it('exige argumento adimensional em exp e ln', () => {
    expect(() => qexp(Q.of(1, D.temperature))).toThrow(DimensionError);
    expect(() => qln(Q.of(-1))).toThrow(CalcError);
    expect(qln(Q.of(Math.E)).value).toBeCloseTo(1);
  });
  it('divisão por zero gera erro', () => {
    expect(() => Q.of(1, D.mass).div(Q.of(0, D.molarMass))).toThrow(CalcError);
  });
  it('RT/F tem dimensão de potencial e vale 25,69 mV a 298,15 K', () => {
    const v = CONST.R.mul(Q.of(298.15, D.temperature)).div(CONST.F);
    expect(v.is(D.potential)).toBe(true);
    expect(v.value * 1000).toBeCloseTo(25.693, 2);
  });
});

describe('conversão de unidades', () => {
  it('°C para K', () => {
    expect(toQ(25, 'temperature', 'C').value).toBeCloseTo(298.15);
    expect(fromQ(Q.of(373.15, D.temperature), 'temperature', 'C')).toBeCloseTo(100);
  });
  it('rejeita temperatura abaixo do zero absoluto', () => {
    expect(() => toQ(-300, 'temperature', 'C')).toThrow(CalcError);
  });
  it('pressão e volume', () => {
    // mmHg convencional (133,322387415 Pa) difere levemente do Torr (101325/760 Pa).
    expect(convert(1, 'pressure', 'atm', 'torr')).toBeCloseTo(760, 9);
    expect(convert(1, 'pressure', 'atm', 'mmHg')).toBeCloseTo(760, 3);
    expect(convert(1, 'pressure', 'bar', 'kPa')).toBeCloseTo(100);
    expect(convert(250, 'volume', 'mL', 'L')).toBeCloseTo(0.25);
    expect(convert(1, 'molarEnergy', 'kcal/mol', 'kJ/mol')).toBeCloseTo(4.184);
  });
  it('% (m/v) equivale a g/100 mL', () => {
    expect(convert(0.9, 'massConcentration', 'pct-mv', 'g/L')).toBeCloseTo(9);
  });
  it('não converte entre tipos diferentes', () => {
    expect(() => fromQ(Q.of(1, D.mass), 'volume', 'L')).toThrow();
  });
});
