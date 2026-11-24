import type { MoleculeRecord } from './molecule';
import type { RDKitDescriptors } from './analysis';
import type { AnnotatedValue } from '../services/pubchem';
import { compoundUrl } from '../services/pubchem';
import { molarMass } from './formula';
import { fmtNum } from '../utils/format';

/**
 * Natureza do dado:
 * - experimental: medido e depositado por uma fonte identificada;
 * - calculado: obtido de forma determinística a partir da estrutura (ex.: massa molar, contagens, TPSA);
 * - estimado: previsto por modelo empírico/estatístico (ex.: logP por XLogP3 ou Wildman–Crippen);
 * - indisponível: nenhuma fonte forneceu o valor.
 */
export type DataNature = 'experimental' | 'calculado' | 'estimado' | 'indisponível';

export interface PropertyRow {
  propertyId: string;
  name: string;
  value: string | null;
  unit: string;
  nature: DataNature;
  source: string;
  sourceUrl?: string;
  method?: string;
}

export interface PropertyInfo {
  id: string;
  name: string;
  unit: string;
  explanation: string;
  /** Cabeçalho correspondente na PubChem PUG View (dados experimentais). */
  pugViewHeading?: string;
}

export const PROPERTY_INFO: PropertyInfo[] = [
  { id: 'mw', name: 'Massa molar', unit: 'g/mol', explanation: 'Soma das massas atômicas médias dos átomos da fórmula. Grandeza calculada, não medida.' },
  { id: 'logp', name: 'LogP (octanol/água)', unit: '—', explanation: 'Logaritmo do coeficiente de partição octanol/água: mede lipofilicidade. Não é uma medida de polaridade ou momento dipolar. Valores aqui são previsões de modelos.' },
  { id: 'tpsa', name: 'TPSA', unit: 'Å²', explanation: 'Área superficial polar topológica: soma das contribuições de N, O e H ligados, calculada a partir do grafo molecular (Ertl et al., 2000). Usada para prever permeabilidade.' },
  { id: 'hbd', name: 'Doadores de ligação de H', unit: 'contagem', explanation: 'Número de grupos N–H e O–H capazes de doar ligação de hidrogênio, segundo a regra de contagem do software indicado.' },
  { id: 'hba', name: 'Aceptores de ligação de H', unit: 'contagem', explanation: 'Número de átomos com par isolado capaz de aceitar ligação de hidrogênio; as definições variam entre programas.' },
  { id: 'rotb', name: 'Ligações rotacionáveis', unit: 'contagem', explanation: 'Ligações simples, fora de anéis, entre átomos pesados não terminais. Indicador de flexibilidade conformacional.' },
  { id: 'solubility', name: 'Solubilidade', unit: 'conforme a fonte', explanation: 'Quantidade máxima dissolvida em um solvente (geralmente água) a uma temperatura dada. Valores reproduzidos como depositados.', pugViewHeading: 'Solubility' },
  { id: 'mp', name: 'Ponto de fusão', unit: 'conforme a fonte', explanation: 'Temperatura de transição sólido–líquido a 1 atm; depende da pureza e do polimorfo.', pugViewHeading: 'Melting Point' },
  { id: 'bp', name: 'Ponto de ebulição', unit: 'conforme a fonte', explanation: 'Temperatura em que a pressão de vapor iguala a pressão externa (normalmente 760 mmHg).', pugViewHeading: 'Boiling Point' },
  { id: 'dipole', name: 'Momento dipolar', unit: 'D (debye)', explanation: 'Medida da separação de cargas na molécula. Requer medição ou cálculo quântico; o MOLECULAB não o calcula e só exibe valores experimentais depositados.', pugViewHeading: 'Dipole Moment' },
  { id: 'asa', name: 'Área superficial molecular', unit: 'Å²', explanation: 'Área superficial acessível aproximada pelo método de Labute (2000), a partir de contribuições atômicas. Não é uma superfície de van der Waals calculada em 3D.' },
];

export const infoById = (id: string) => PROPERTY_INFO.find((p) => p.id === id)!;

const PUBCHEM = 'PubChem (computado)';
const RDKIT = 'RDKit (calculado no navegador)';

function row(propertyId: string, value: number | undefined, nature: DataNature, source: string, method: string, digits = 4, sourceUrl?: string): PropertyRow {
  const info = infoById(propertyId);
  return {
    propertyId,
    name: info.name,
    value: value === undefined ? null : fmtNum(value, digits),
    unit: info.unit,
    nature: value === undefined ? 'indisponível' : nature,
    source: value === undefined ? '—' : source,
    sourceUrl: value === undefined ? undefined : sourceUrl,
    method: value === undefined ? undefined : method,
  };
}

/** Monta as linhas de propriedades calculadas/estimadas. Ausência vira "indisponível", nunca um valor inventado. */
export function computedRows(rec: MoleculeRecord, d: RDKitDescriptors | null): PropertyRow[] {
  const pcUrl = rec.cid ? compoundUrl(rec.cid) : undefined;
  const rows: PropertyRow[] = [];
  const pc = rec.pubchem ?? {};

  if (rec.source === 'pubchem') rows.push(row('mw', rec.molecularWeight, 'calculado', PUBCHEM, 'PubChem 2.2 (massas atômicas médias)', 6, pcUrl));
  let iupacMass: number | undefined;
  try {
    if (rec.formula) iupacMass = molarMass(rec.formula.replace(/[+-]\d*$/, '')).molarMass;
  } catch {
    iupacMass = undefined;
  }
  rows.push(row('mw', iupacMass ?? d?.amw, 'calculado', iupacMass ? 'MOLECULAB (fórmula × IUPAC 2021)' : RDKIT, iupacMass ? 'Massas atômicas padrão IUPAC/CIAAW 2021' : 'RDKit amw', 6));

  if (rec.source === 'pubchem') rows.push(row('logp', pc.xlogp, 'estimado', PUBCHEM, 'XLogP3 (modelo aditivo por átomos com correções)', 3, pcUrl));
  rows.push(row('logp', d?.clogp, 'estimado', RDKIT, 'Wildman–Crippen (contribuições atômicas)', 3));

  if (rec.source === 'pubchem') rows.push(row('tpsa', pc.tpsa, 'calculado', PUBCHEM, 'Cactvs (Ertl et al.)', 4, pcUrl));
  rows.push(row('tpsa', d?.tpsa, 'calculado', RDKIT, 'Ertl et al. (2000), N e O', 4));

  if (rec.source === 'pubchem') rows.push(row('hbd', pc.hbd, 'calculado', PUBCHEM, 'Cactvs', 3, pcUrl));
  rows.push(row('hbd', d?.hbd, 'calculado', RDKIT, 'RDKit NumHBD', 3));
  if (rec.source === 'pubchem') rows.push(row('hba', pc.hba, 'calculado', PUBCHEM, 'Cactvs', 3, pcUrl));
  rows.push(row('hba', d?.hba, 'calculado', RDKIT, 'RDKit NumHBA', 3));
  if (rec.source === 'pubchem') rows.push(row('rotb', pc.rotatable, 'calculado', PUBCHEM, 'Cactvs', 3, pcUrl));
  rows.push(row('rotb', d?.rotatable, 'calculado', RDKIT, 'RDKit NumRotatableBonds', 3));
  rows.push(row('asa', d?.labuteASA, 'estimado', RDKIT, 'Labute ASA (aproximação por contribuições atômicas)', 4));
  return rows;
}

/** Linhas experimentais a partir de anotações da PubChem (cada valor com sua fonte original). */
export function experimentalRows(propertyId: string, values: AnnotatedValue[]): PropertyRow[] {
  const info = infoById(propertyId);
  if (!values.length) {
    return [{ propertyId, name: info.name, value: null, unit: info.unit, nature: 'indisponível', source: '—' }];
  }
  return values.map((v) => ({
    propertyId,
    name: info.name,
    value: v.text,
    unit: '',
    nature: 'experimental' as const,
    source: v.sourceName,
    sourceUrl: v.sourceUrl,
    method: v.reference,
  }));
}
