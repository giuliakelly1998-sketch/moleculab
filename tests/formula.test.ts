import { molarMass, parseFormula, countsToFormula, FormulaError, looksLikeFormula } from '../src/chem/formula';

// Valores de referência calculados com as massas atômicas IUPAC 2021 (convencionais).
describe('massa molar', () => {
  it.each([
    ['H2O', 18.015],
    ['CO2', 44.009],
    ['NaCl', 58.44],
    ['C6H12O6', 180.156],
    ['Ca(OH)2', 74.092],
    ['Al2(SO4)3', 342.14],
    ['CuSO4·5H2O', 249.68],
    ['CuSO4.5H2O', 249.68],
    ['K4[Fe(CN)6]', 368.35],
    ['C9H8O4', 180.159], // ácido acetilsalicílico
  ])('%s ≈ %f g/mol', (f, expected) => {
    expect(molarMass(f).molarMass).toBeCloseTo(expected, 1);
  });

  it('composição percentual soma 100 %', () => {
    const r = molarMass('C8H10N4O2');
    const total = r.composition.reduce((s, x) => s + x.massFraction, 0);
    expect(total).toBeCloseTo(1, 10);
    expect(r.composition.find((x) => x.symbol === 'N')!.massFraction).toBeCloseTo(0.2885, 3);
  });

  it('marca elementos sem massa atômica padrão', () => {
    expect(molarMass('TcO4').hasNonStandardMass).toBe(true);
    expect(molarMass('H2O').hasNonStandardMass).toBe(false);
  });
});

describe('parser de fórmulas', () => {
  it('diferencia Co de CO', () => {
    expect(parseFormula('Co')).toEqual({ Co: 1 });
    expect(parseFormula('CO')).toEqual({ C: 1, O: 1 });
  });
  it('aceita subscritos Unicode', () => {
    expect(parseFormula('H₂SO₄')).toEqual({ H: 2, S: 1, O: 4 });
  });
  it('gera notação de Hill', () => {
    expect(countsToFormula(parseFormula('CH3COOH'))).toBe('C2H4O2');
    expect(countsToFormula(parseFormula('NaCl'))).toBe('ClNa');
  });
  it.each(['Xx2', 'H2O)', '(H2O', 'H0', '', 'H2O+', 'C6H12O6$'])('rejeita "%s"', (bad) => {
    expect(() => parseFormula(bad)).toThrow(FormulaError);
  });
  it('detecta forma de fórmula', () => {
    expect(looksLikeFormula('C6H6')).toBe(true);
    expect(looksLikeFormula('caffeine')).toBe(false);
  });
});
