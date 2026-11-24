/**
 * Definições de grupos funcionais por SMARTS.
 *
 * O reconhecimento é estrutural (correspondência de subestrutura no RDKit),
 * nunca pelo nome da substância. Os padrões foram escritos para evitar falsos
 * positivos clássicos: fenol ≠ álcool, ácido ≠ cetona/álcool, éster ≠ éter,
 * amida ≠ amina, nitro ≠ amina. Os casos de validação estão em
 * tests/functionalGroups.test.ts.
 */
export interface FunctionalGroupDef {
  id: string;
  name: string;
  /** SMARTS usados (a união dos matches define as ocorrências). */
  smarts: string[];
  /**
   * Índice do átomo do padrão que identifica uma ocorrência. Ex.: numa amina,
   * o N; assim a trietilamina conta 1 amina e não 3 ligações N–C.
   */
  countBy?: number;
  generalStructure: string;
  nomenclature: string;
  characteristics: string;
  properties: string;
  /** Exemplos: nome em inglês para busca no PubChem + SMILES para desenho local. */
  examples: { namePt: string; query: string; smiles: string }[];
  color: string;
}

export const FUNCTIONAL_GROUPS: FunctionalGroupDef[] = [
  {
    id: 'alcohol',
    name: 'Álcool',
    smarts: ['[OX2H1][CX4]'],
    generalStructure: 'R–OH (OH ligado a carbono sp³)',
    nomenclature: 'Sufixo "-ol" (etanol, propan-2-ol); como substituinte, "hidróxi-". Classificados em primários, secundários e terciários pelo carbono que porta o OH.',
    characteristics: 'O–H polar; atuam como ácidos muito fracos (pKa ≈ 15–18) e bases de Lewis fracas pelo oxigênio. Oxidam-se a aldeídos/ácidos (primários) ou cetonas (secundários).',
    properties: 'Doadores e aceptores de ligação de hidrogênio: pontos de ebulição maiores que hidrocarbonetos de massa semelhante; os de cadeia curta são miscíveis em água.',
    examples: [
      { namePt: 'Etanol', query: 'ethanol', smiles: 'CCO' },
      { namePt: 'Propan-2-ol', query: '2-propanol', smiles: 'CC(C)O' },
    ],
    color: '#5BC0EB',
  },
  {
    id: 'phenol',
    name: 'Fenol',
    smarts: ['[OX2H1][c]'],
    generalStructure: 'Ar–OH (OH ligado diretamente a anel aromático)',
    nomenclature: 'Derivados nomeados a partir de "fenol" (4-metilfenol); "hidróxi-" como substituinte.',
    characteristics: 'Mais ácidos que álcoois (pKa ≈ 10) pela estabilização do fenóxido por ressonância. Anel ativado para substituição eletrofílica (orto/para).',
    properties: 'Formam ligações de hidrogênio; muitos têm atividade antioxidante ou antisséptica; reagem com FeCl₃ formando complexos coloridos.',
    examples: [
      { namePt: 'Fenol', query: 'phenol', smiles: 'Oc1ccccc1' },
      { namePt: 'Paracetamol', query: 'acetaminophen', smiles: 'CC(=O)Nc1ccc(O)cc1' },
    ],
    color: '#9B8CFF',
  },
  {
    id: 'ether',
    name: 'Éter',
    smarts: ['[OD2;!$(O[#6]=[O,S,N]);!$(O[#1])]([#6])[#6]'],
    generalStructure: 'R–O–R′',
    nomenclature: 'Substitutiva: "alcóxi-" + hidrocarboneto (metoxietano); funcional: "éter dietílico".',
    characteristics: 'Pouco reativos; o oxigênio é base de Lewis (solvatam cátions, ex.: Grignard em THF). Podem formar peróxidos explosivos em armazenamento.',
    properties: 'Aceptores, mas não doadores, de ligação de hidrogênio: pontos de ebulição baixos em relação aos álcoois isômeros.',
    examples: [
      { namePt: 'Éter dietílico', query: 'diethyl ether', smiles: 'CCOCC' },
      { namePt: 'Anisol', query: 'anisole', smiles: 'COc1ccccc1' },
    ],
    color: '#7FD1AE',
  },
  {
    id: 'aldehyde',
    name: 'Aldeído',
    smarts: ['[CX3;H1,H2;!$(C(=O)[#7,#8,#16,F,Cl,Br,I])]=[OX1]'],
    generalStructure: 'R–CHO',
    nomenclature: 'Sufixo "-al" (etanal); "-carbaldeído" quando ligado a anel.',
    characteristics: 'Carbonila eletrofílica; sofrem adição nucleofílica; oxidam-se facilmente a ácidos carboxílicos (testes de Tollens e Fehling).',
    properties: 'Polares, aceptores de ligação de hidrogênio; os de baixa massa têm odor intenso.',
    examples: [
      { namePt: 'Etanal (acetaldeído)', query: 'acetaldehyde', smiles: 'CC=O' },
      { namePt: 'Benzaldeído', query: 'benzaldehyde', smiles: 'O=Cc1ccccc1' },
    ],
    color: '#FFB86B',
  },
  {
    id: 'ketone',
    name: 'Cetona',
    smarts: ['[#6][CX3](=[OX1])[#6]'],
    generalStructure: 'R–CO–R′',
    nomenclature: 'Sufixo "-ona" (propanona, butan-2-ona); "oxo-" como substituinte.',
    characteristics: 'Carbonila menos reativa que a de aldeídos; resistentes à oxidação branda; hidrogênios α são ácidos (enolização).',
    properties: 'Bons solventes polares apróticos (acetona); aceptores de ligação de hidrogênio.',
    examples: [
      { namePt: 'Propanona (acetona)', query: 'acetone', smiles: 'CC(C)=O' },
      { namePt: 'Ciclo-hexanona', query: 'cyclohexanone', smiles: 'O=C1CCCCC1' },
    ],
    color: '#F38BA8',
  },
  {
    id: 'carboxylic-acid',
    name: 'Ácido carboxílico',
    smarts: ['[CX3](=O)[OX2H1,OX1-]'],
    generalStructure: 'R–COOH (ou carboxilato R–COO⁻)',
    nomenclature: '"Ácido ... -oico" (ácido etanoico); sais: "-oato".',
    characteristics: 'Ácidos fracos (pKa ≈ 4–5); formam ésteres, amidas e cloretos de acila; reduzidos a álcoois primários por LiAlH₄.',
    properties: 'Formam dímeros por ligação de hidrogênio: pontos de ebulição elevados; solubilidade em água diminui com a cadeia.',
    examples: [
      { namePt: 'Ácido acético', query: 'acetic acid', smiles: 'CC(=O)O' },
      { namePt: 'Ácido benzoico', query: 'benzoic acid', smiles: 'OC(=O)c1ccccc1' },
    ],
    color: '#FF6B9A',
  },
  {
    id: 'ester',
    name: 'Éster',
    smarts: ['[CX3;!$(C(=O)[OX2][CX3]=O)](=O)[OX2H0][#6;!$(C=O)]'],
    generalStructure: 'R–COO–R′',
    nomenclature: '"-oato de alquila" (etanoato de etila).',
    characteristics: 'Hidrolisam em meio ácido ou básico (saponificação); formados por esterificação de Fischer.',
    properties: 'Aceptores de ligação de hidrogênio; voláteis e frequentemente aromáticos (aromas de frutas).',
    examples: [
      { namePt: 'Acetato de etila', query: 'ethyl acetate', smiles: 'CCOC(C)=O' },
      { namePt: 'Ácido acetilsalicílico', query: 'aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
    ],
    color: '#E5C07B',
  },
  {
    id: 'amine',
    name: 'Amina',
    smarts: ['[NX3;!$(N[#6,#16,#15]=[#8,#16,#7]);!$(N[#7,#8]);!$([N+]);!$(N#*);!$(N=*)][#6]'],
    countBy: 0,
    generalStructure: 'R–NH₂, R₂NH, R₃N',
    nomenclature: 'Sufixo "-amina" (metanamina); "amino-" como substituinte.',
    characteristics: 'Bases de Brønsted e nucleófilos pelo par de elétrons do nitrogênio; arilaminas (anilina) são bases mais fracas.',
    properties: 'Primárias e secundárias doam ligação de hidrogênio; as de baixa massa têm odor característico.',
    examples: [
      { namePt: 'Metilamina', query: 'methylamine', smiles: 'CN' },
      { namePt: 'Anilina', query: 'aniline', smiles: 'Nc1ccccc1' },
    ],
    color: '#61AFEF',
  },
  {
    id: 'amide',
    name: 'Amida',
    // [#7X3]/[#6X3] incluem átomos aromáticos: lactamas em anéis aromatizados pelo RDKit (ex.: cafeína).
    smarts: ['[#7X3][#6X3]=[OX1]'],
    countBy: 1,
    generalStructure: 'R–CO–NR′R″',
    nomenclature: 'Sufixo "-amida" (etanamida); N-substituídas: N-metiletanamida.',
    characteristics: 'Nitrogênio pouco básico pela ressonância com a carbonila; ligação C–N com caráter parcial de dupla (ligação peptídica planar).',
    properties: 'Pontos de fusão e ebulição elevados; base estrutural de proteínas e poliamidas (náilon).',
    examples: [
      { namePt: 'Acetamida', query: 'acetamide', smiles: 'CC(N)=O' },
      { namePt: 'Paracetamol', query: 'acetaminophen', smiles: 'CC(=O)Nc1ccc(O)cc1' },
    ],
    color: '#56B6C2',
  },
  {
    id: 'nitrile',
    name: 'Nitrila',
    smarts: ['[NX1]#[CX2]'],
    generalStructure: 'R–C≡N',
    nomenclature: 'Sufixo "-nitrila" (etanonitrila); "ciano-" como substituinte.',
    characteristics: 'Carbono eletrofílico; hidrolisam a amidas e ácidos carboxílicos; reduzidas a aminas primárias.',
    properties: 'Muito polares (momento dipolar elevado); acetonitrila é solvente comum em HPLC.',
    examples: [
      { namePt: 'Acetonitrila', query: 'acetonitrile', smiles: 'CC#N' },
      { namePt: 'Benzonitrila', query: 'benzonitrile', smiles: 'N#Cc1ccccc1' },
    ],
    color: '#98C379',
  },
  {
    id: 'nitro',
    name: 'Nitrocomposto',
    smarts: ['[$([NX3](=O)=O),$([NX3+](=O)[O-])][#6]'],
    generalStructure: 'R–NO₂',
    nomenclature: 'Prefixo "nitro-" (nitrometano, nitrobenzeno).',
    characteristics: 'Grupo fortemente retirador de elétrons; desativa o anel aromático (meta-dirigente); reduzido a aminas.',
    properties: 'Alta polaridade; vários polinitrocompostos são energéticos.',
    examples: [
      { namePt: 'Nitrometano', query: 'nitromethane', smiles: 'C[N+](=O)[O-]' },
      { namePt: 'Nitrobenzeno', query: 'nitrobenzene', smiles: 'O=[N+]([O-])c1ccccc1' },
    ],
    color: '#D19A66',
  },
  {
    id: 'halide',
    name: 'Haleto orgânico',
    smarts: ['[#6;!$([#6]=[O,S])][F,Cl,Br,I]'],
    generalStructure: 'R–X (X = F, Cl, Br, I)',
    nomenclature: 'Prefixos "fluoro-, cloro-, bromo-, iodo-" (clorometano, 2-bromopropano).',
    characteristics: 'Haletos de alquila sofrem substituição (SN1/SN2) e eliminação (E1/E2); haletos de arila são pouco reativos nessas vias.',
    properties: 'Densidade elevada (sobretudo bromo e iodo); polares, mas pouco solúveis em água.',
    examples: [
      { namePt: 'Clorofórmio', query: 'chloroform', smiles: 'ClC(Cl)Cl' },
      { namePt: 'Clorobenzeno', query: 'chlorobenzene', smiles: 'Clc1ccccc1' },
    ],
    color: '#C678DD',
  },
  {
    id: 'alkene',
    name: 'Alceno',
    smarts: ['[CX3]=[CX3]'],
    generalStructure: 'C=C (não aromática)',
    nomenclature: 'Sufixo "-eno" com localizador (but-2-eno); isomeria E/Z.',
    characteristics: 'Ligação π nucleofílica: adição eletrofílica (Markovnikov), hidrogenação, polimerização.',
    properties: 'Apolares; propriedades físicas próximas às dos alcanos correspondentes.',
    examples: [
      { namePt: 'Eteno', query: 'ethylene', smiles: 'C=C' },
      { namePt: 'Limoneno', query: 'limonene', smiles: 'CC1=CCC(CC1)C(C)=C' },
    ],
    color: '#8BE9FD',
  },
  {
    id: 'alkyne',
    name: 'Alcino',
    smarts: ['[CX2]#[CX2]'],
    generalStructure: 'C≡C',
    nomenclature: 'Sufixo "-ino" (etino, but-1-ino).',
    characteristics: 'Duas ligações π; alcinos terminais são ácidos (pKa ≈ 25) e formam acetiletos.',
    properties: 'Geometria linear (carbono sp); apolares.',
    examples: [
      { namePt: 'Etino (acetileno)', query: 'acetylene', smiles: 'C#C' },
      { namePt: 'Propino', query: 'propyne', smiles: 'CC#C' },
    ],
    color: '#BD93F9',
  },
  {
    id: 'aromatic',
    name: 'Anel aromático',
    smarts: ['a1aaaaa1', 'a1aaaa1'],
    generalStructure: 'Anel cíclico, planar, conjugado com 4n + 2 elétrons π (regra de Hückel)',
    nomenclature: 'Derivados do benzeno (metilbenzeno = tolueno), heteroaromáticos (piridina, furano, tiofeno).',
    characteristics: 'Estabilização por ressonância; preferem substituição eletrofílica à adição.',
    properties: 'Planaridade e empilhamento π–π; absorção característica no UV.',
    examples: [
      { namePt: 'Benzeno', query: 'benzene', smiles: 'c1ccccc1' },
      { namePt: 'Piridina', query: 'pyridine', smiles: 'c1ccncc1' },
    ],
    color: '#F1FA8C',
  },
];

export interface GroupMatch {
  id: string;
  name: string;
  count: number;
  atoms: number[]; // união dos átomos (índices RDKit)
  bonds: number[];
  occurrences: { atoms: number[]; bonds: number[] }[];
  color: string;
}

/** Interface mínima do RDKit usada aqui — permite testar com o módulo real no Node. */
export interface RDKitLike {
  get_qmol(smarts: string): { get_smarts?: () => string; delete(): void } | null;
}
export interface MolLike {
  get_substruct_matches(q: unknown): string;
}

const qmolCache = new Map<string, unknown>();

export function detectFunctionalGroups(rdkit: RDKitLike, mol: MolLike): GroupMatch[] {
  const out: GroupMatch[] = [];
  for (const g of FUNCTIONAL_GROUPS) {
    const occ: { atoms: number[]; bonds: number[] }[] = [];
    const seen = new Map<string, { atoms: number[]; bonds: number[] }>();
    for (const sm of g.smarts) {
      let q = qmolCache.get(sm);
      if (!q) {
        q = rdkit.get_qmol(sm);
        if (!q) throw new Error(`SMARTS inválido: ${sm}`);
        qmolCache.set(sm, q);
      }
      const raw = mol.get_substruct_matches(q);
      const parsed: { atoms: number[]; bonds?: number[] }[] = raw && raw !== '{}' ? JSON.parse(raw) : [];
      for (const m of parsed) {
        const key = g.countBy !== undefined ? `@${m.atoms[g.countBy]}` : [...m.atoms].sort((a, b) => a - b).join(',');
        const prev = seen.get(key);
        if (prev) {
          prev.atoms = [...new Set([...prev.atoms, ...m.atoms])];
          prev.bonds = [...new Set([...prev.bonds, ...(m.bonds ?? [])])];
          continue;
        }
        const o = { atoms: [...m.atoms], bonds: [...(m.bonds ?? [])] };
        seen.set(key, o);
        occ.push(o);
      }
    }
    if (occ.length) {
      out.push({
        id: g.id,
        name: g.name,
        count: occ.length,
        atoms: [...new Set(occ.flatMap((o) => o.atoms))],
        bonds: [...new Set(occ.flatMap((o) => o.bonds))],
        occurrences: occ,
        color: g.color,
      });
    }
  }
  return out;
}

export function getGroupDef(id: string) {
  return FUNCTIONAL_GROUPS.find((g) => g.id === id);
}
