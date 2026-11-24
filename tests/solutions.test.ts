import { Q, D, CalcError } from '../src/calc/quantity';
import { toQ, fromQ } from '../src/calc/units';
import { dilution, molarConcentrationFromMass, soluteMassForSolution, stockVolumeForSolution, massConcentration } from '../src/calc/solutions';

const M = (v: number) => toQ(v, 'molarMass', 'g/mol');
const mol_L = (v: number) => toQ(v, 'concentration', 'mol/L');
const L = (v: number) => toQ(v, 'volume', 'L');
const mL = (v: number) => toQ(v, 'volume', 'mL');

describe('soluções', () => {
  it('5,844 g de NaCl em 100 mL → 1,000 mol/L', () => {
    const c = molarConcentrationFromMass(toQ(5.844, 'mass', 'g'), M(58.44), mL(100));
    expect(fromQ(c, 'concentration', 'mol/L')).toBeCloseTo(1.0, 6);
  });
  it('diluição: 10 mL de 1 mol/L → 100 mL a 0,1 mol/L', () => {
    expect(fromQ(dilution('c2', { c1: mol_L(1), V1: mL(10), V2: mL(100) }), 'concentration', 'mol/L')).toBeCloseTo(0.1);
    expect(fromQ(dilution('V1', { c1: mol_L(1), c2: mol_L(0.1), V2: mL(100) }), 'volume', 'mL')).toBeCloseTo(10);
    expect(fromQ(dilution('V2', { c1: mol_L(1), V1: mL(10), c2: mol_L(0.1) }), 'volume', 'mL')).toBeCloseTo(100);
  });
  it('diluição não pode concentrar', () => {
    expect(() => dilution('c2', { c1: mol_L(0.1), V1: mL(100), V2: mL(10) })).toThrow(CalcError);
  });
  it('diluição com volume final zero → divisão por zero', () => {
    expect(() => dilution('c2', { c1: mol_L(1), V1: mL(10), V2: Q.of(0, D.volume) })).toThrow(/Divisão por zero/);
  });
  it('preparo: 250 mL de NaOH 0,1 mol/L com pureza 98 % → 1,0204 g', () => {
    const m = soluteMassForSolution(mol_L(0.1), mL(250), M(39.997), 0.98);
    expect(fromQ(m, 'mass', 'g')).toBeCloseTo(1.0203, 3);
  });
  it('preparo a partir de HCl 37 % (ρ 1,19 g/mL): 1 L de 1 mol/L → ≈ 82,8 mL', () => {
    const V = stockVolumeForSolution(mol_L(1), L(1), M(36.46), 0.37, toQ(1.19, 'density', 'g/mL'));
    expect(fromQ(V, 'volume', 'mL')).toBeCloseTo(82.81, 1);
  });
  it('concentração comum em g/L', () => {
    expect(fromQ(massConcentration(toQ(9, 'mass', 'g'), L(1)), 'massConcentration', 'g/L')).toBeCloseTo(9);
  });
});
