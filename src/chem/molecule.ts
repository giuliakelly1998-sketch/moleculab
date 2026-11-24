import type { QueryType } from './queryDetect';

/** Registro de molécula exibido no app. Campos ausentes = dado indisponível (nunca preenchido por estimativa). */
export interface MoleculeRecord {
  key: string; // "cid:2244" ou "smiles:<canônico>"
  source: 'pubchem' | 'rdkit-local';
  cid?: number;
  title: string;
  iupacName?: string;
  formula?: string;
  molecularWeight?: number;
  exactMass?: number;
  smiles?: string;
  connectivitySmiles?: string;
  inchi?: string;
  inchiKey?: string;
  /** InChI calculado localmente pelo RDKit (quando não veio da PubChem). */
  inchiOrigin?: 'pubchem' | 'rdkit';
  charge?: number;
  pubchem?: {
    xlogp?: number;
    tpsa?: number;
    hbd?: number;
    hba?: number;
    rotatable?: number;
    heavyAtoms?: number;
    complexity?: number;
  };
  structure?: {
    molblock: string;
    dim: '3d' | '2d';
    origin: 'pubchem-3d' | 'pubchem-2d' | 'rdkit-2d';
    atomCount: number; // inclui H explícitos do arquivo
    bondCount: number;
  };
  query: { text: string; type: QueryType };
  retrievedAt: string;
}

export interface Candidate {
  cid: number;
  title: string;
  formula?: string;
  weight?: number;
}

export type SearchOutcome =
  | { kind: 'single'; record: MoleculeRecord; interpretedAs: QueryType; note?: string }
  | { kind: 'multiple'; candidates: Candidate[]; interpretedAs: QueryType; note?: string };

export const num = (v: unknown): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
};
