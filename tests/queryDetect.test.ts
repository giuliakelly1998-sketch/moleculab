import { detectQueryType, isValidCas, normalizeCid, preValidateSmiles } from '../src/chem/queryDetect';

describe('detecção do tipo de consulta', () => {
  it.each([
    ['caffeine', 'name'],
    ['Aspirin', 'name'],
    ['acetic acid', 'name'],
    ['2-propanol', 'name'],
    ['2244', 'cid'],
    ['CID 2519', 'cid'],
    ['50-78-2', 'cas'],
    ['InChI=1S/CH4/h1H4', 'inchi'],
    ['C6H12O6', 'formula'],
    ['H2O', 'formula'],
    ['NaCl', 'formula'],
    ['CH3CH2OH', 'formula'],
    ['CCO', 'smiles'],
    ['c1ccccc1', 'smiles'],
    ['C1CCCCC1', 'smiles'],
    ['CC(=O)Oc1ccccc1C(=O)O', 'smiles'],
    ['ClC(Cl)Cl', 'smiles'],
    ['3-bromo-4-methylacetophenone', 'name'],
    ["3'-bromo-4'-methylacetophenone", 'name'],
    ['1-(3-bromo-4-methylphenyl)ethanone', 'name'],
    ['N,N-dimethylformamide', 'name'],
    ['c1ccc[nH]1', 'smiles'],
    ['CC(=O)c1ccc(C)c(Br)c1', 'smiles'],
  ])('%s → %s', (q, t) => expect(detectQueryType(q)).toBe(t));
});

describe('validações', () => {
  it('dígito verificador CAS', () => {
    expect(isValidCas('50-78-2')).toBe(true); // ácido acetilsalicílico
    expect(isValidCas('7732-18-5')).toBe(true); // água
    expect(isValidCas('58-08-2')).toBe(true); // cafeína
    expect(isValidCas('50-78-3')).toBe(false);
  });
  it('CID', () => {
    expect(normalizeCid('CID 2244')).toBe(2244);
    expect(normalizeCid('0')).toBeNull();
  });
  it('SMILES: rejeita entradas abusivas antes do RDKit', () => {
    expect(preValidateSmiles('CC<script>')).toMatch(/não permitidos/);
    expect(preValidateSmiles('C'.repeat(2000))).toMatch(/longo/);
    expect(preValidateSmiles('CCO')).toBeNull();
  });
});
