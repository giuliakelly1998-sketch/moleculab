import type { MoleculeRecord } from '../chem/molecule';
import { parseMolblock } from '../chem/sdf';
import { countsToFormula, parseFormula } from '../chem/formula';

/**
 * Biblioteca local de compostos comuns (gerada por scripts/build-compounds.py com RDKit).
 * Serve para: (1) aceitar nomes em português ("cafeína", "ácido acético");
 * (2) continuar funcionando quando a PubChem está inacessível.
 * Carregada sob demanda para não pesar a página inicial.
 */
export interface LocalCompound {
  pt: string;
  names: string[];
  smiles: string;
  formula: string;
  mw: number;
  molblock3d: string | null;
}

let cache: Promise<LocalCompound[]> | null = null;
export function loadLibrary(): Promise<LocalCompound[]> {
  cache ??= import('../data/compounds.json').then((m) => m.default as LocalCompound[]);
  return cache;
}

/** Normaliza para comparar nomes: sem acentos, minúsculas, sem espaços/hífens/vírgulas extras. */
export const normName = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-_,()]+/g, '').trim();

export async function findByName(q: string): Promise<LocalCompound | undefined> {
  const n = normName(q);
  if (!n) return undefined;
  const lib = await loadLibrary();
  return lib.find((c) => normName(c.pt) === n || c.names.some((x) => normName(x) === n));
}

export async function findByFormula(q: string): Promise<LocalCompound[]> {
  let hill: string;
  try {
    hill = countsToFormula(parseFormula(q));
  } catch {
    return [];
  }
  const lib = await loadLibrary();
  return lib.filter((c) => {
    try {
      return countsToFormula(parseFormula(c.formula)) === hill;
    } catch {
      return false;
    }
  });
}

export async function findBySmiles(canonical: string): Promise<LocalCompound | undefined> {
  const lib = await loadLibrary();
  return lib.find((c) => c.smiles === canonical);
}

/** Sugestões por prefixo/trecho (para a mensagem de "não encontrado"). */
export async function suggestLocal(q: string, max = 6): Promise<string[]> {
  const n = normName(q);
  if (n.length < 3) return [];
  const lib = await loadLibrary();
  return lib.filter((c) => normName(c.pt).includes(n) || c.names.some((x) => normName(x).includes(n))).slice(0, max).map((c) => c.pt);
}

/** Acrescenta ao registro local a conformação 3D pré-calculada e o nome em português. */
export function applyLocal(rec: MoleculeRecord, c: LocalCompound): MoleculeRecord {
  const out: MoleculeRecord = { ...rec, title: c.pt, key: `local:${c.smiles}` };
  if (c.molblock3d) {
    const p = parseMolblock(c.molblock3d);
    out.structure = { molblock: c.molblock3d, dim: '3d', origin: 'rdkit-3d', atomCount: p.atoms.length, bondCount: p.bonds.length };
  }
  return out;
}
