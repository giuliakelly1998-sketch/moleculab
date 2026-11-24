// @vitest-environment node
import { createRequire } from 'node:module';
import { detectFunctionalGroups, FUNCTIONAL_GROUPS } from '../src/chem/functionalGroups';
import { analyze } from '../src/chem/analysis';
import type { MoleculeRecord } from '../src/chem/molecule';

// RDKit real (WebAssembly) rodando no Node, o mesmo usado no navegador.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let R: any;
beforeAll(async () => {
  R = await require('@rdkit/rdkit')();
}, 30000);

const groupsOf = (smiles: string) => {
  const m = R.get_mol(smiles);
  try {
    return Object.fromEntries(detectFunctionalGroups(R, m).map((g) => [g.id, g.count]));
  } finally {
    m.delete();
  }
};

describe('reconhecimento de grupos funcionais (SMARTS)', () => {
  it('todos os SMARTS são válidos no RDKit', () => {
    for (const g of FUNCTIONAL_GROUPS) for (const s of g.smarts) expect(R.get_qmol(s), `${g.id}: ${s}`).toBeTruthy();
  });

  it.each([
    ['etanol', 'CCO', { alcohol: 1 }],
    ['fenol (não é álcool)', 'Oc1ccccc1', { phenol: 1, aromatic: 1 }],
    ['éter dietílico', 'CCOCC', { ether: 1 }],
    ['anisol', 'COc1ccccc1', { ether: 1, aromatic: 1 }],
    ['etanal', 'CC=O', { aldehyde: 1 }],
    ['formaldeído', 'C=O', { aldehyde: 1 }],
    ['acetona', 'CC(C)=O', { ketone: 1 }],
    ['ácido acético (não é cetona nem álcool)', 'CC(=O)O', { 'carboxylic-acid': 1 }],
    ['acetato (carboxilato)', 'CC(=O)[O-]', { 'carboxylic-acid': 1 }],
    ['acetato de etila (éster, não éter)', 'CCOC(C)=O', { ester: 1 }],
    ['formiato de metila', 'COC=O', { ester: 1 }],
    ['trietilamina (1 amina, não 3)', 'CCN(CC)CC', { amine: 1 }],
    ['anilina', 'Nc1ccccc1', { amine: 1, aromatic: 1 }],
    ['acetamida (amida, não amina)', 'CC(N)=O', { amide: 1 }],
    ['acetonitrila', 'CC#N', { nitrile: 1 }],
    ['nitrometano (forma com cargas)', 'C[N+](=O)[O-]', { nitro: 1 }],
    ['nitrobenzeno', 'O=[N+]([O-])c1ccccc1', { nitro: 1, aromatic: 1 }],
    ['clorofórmio', 'ClC(Cl)Cl', { halide: 3 }],
    ['cloreto de acetila (não é haleto orgânico simples)', 'CC(Cl)=O', {}],
    ['but-2-eno', 'CC=CC', { alkene: 1 }],
    ['propino', 'CC#C', { alkyne: 1 }],
    ['benzeno (não é alceno)', 'c1ccccc1', { aromatic: 1 }],
    ['naftaleno', 'c1ccc2ccccc2c1', { aromatic: 2 }],
    ['piridina', 'c1ccncc1', { aromatic: 1 }],
    ['ácido acetilsalicílico', 'CC(=O)Oc1ccccc1C(=O)O', { 'carboxylic-acid': 1, ester: 1, aromatic: 1 }],
    ['paracetamol', 'CC(=O)Nc1ccc(O)cc1', { phenol: 1, amide: 1, aromatic: 1 }],
    ['cafeína (lactamas aromáticas)', 'Cn1c(=O)c2c(ncn2C)n(C)c1=O', { amide: 2, aromatic: 2 }],
  ])('%s', (_name, smiles, expected) => {
    expect(groupsOf(smiles)).toEqual(expected);
  });
});

describe('análise a partir de molfile', () => {
  it('mantém índices alinhados quando H vêm depois dos átomos pesados', () => {
    const m = R.get_mol('CCO');
    m.set_new_coords(true);
    const withH = m.add_hs(); // RDKit coloca H depois dos pesados
    m.delete();
    const rec: MoleculeRecord = {
      key: 't', source: 'rdkit-local', title: 'etanol', query: { text: 'CCO', type: 'smiles' }, retrievedAt: '',
      structure: { molblock: withH, dim: '2d', origin: 'rdkit-2d', atomCount: 9, bondCount: 8 },
    };
    const a = analyze(R, rec)!;
    expect(a.indicesAlignedWithStructure).toBe(true);
    expect(a.heavyAtomCount).toBe(3);
    const alc = a.groups.find((g) => g.id === 'alcohol')!;
    expect(alc.atoms.sort()).toEqual([1, 2]);
    expect(a.descriptors.tpsa).toBeCloseTo(20.23, 2);
    expect(a.descriptors.hbd).toBe(1);
  });
});
