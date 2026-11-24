import { countsToFormula, ElementCounts } from './formula';

export interface SdfAtom {
  symbol: string;
  x: number;
  y: number;
  z: number;
  charge: number;
}
export interface SdfBond {
  a: number;
  b: number;
  order: number;
}
export interface ParsedMolblock {
  atoms: SdfAtom[];
  bonds: SdfBond[];
  is3D: boolean;
}

const CHARGE_CODE: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

/** Analisa o bloco de conexões de um molfile V2000 (primeiro registro de um SDF). */
export function parseMolblock(text: string): ParsedMolblock {
  const lines = text.replace(/\r/g, '').split('\n');
  const countsIdx = lines.findIndex((l) => /V2000\s*$/.test(l));
  if (countsIdx < 0) throw new Error('Formato de molfile não suportado (esperado V2000).');
  const counts = lines[countsIdx];
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(nAtoms) || !Number.isFinite(nBonds)) throw new Error('Cabeçalho de molfile inválido.');
  const atoms: SdfAtom[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[countsIdx + 1 + i] ?? '';
    const chargeCode = parseInt(l.slice(36, 39), 10) || 0;
    atoms.push({
      x: parseFloat(l.slice(0, 10)),
      y: parseFloat(l.slice(10, 20)),
      z: parseFloat(l.slice(20, 30)),
      symbol: l.slice(31, 34).trim(),
      charge: CHARGE_CODE[chargeCode] ?? 0,
    });
  }
  const bonds: SdfBond[] = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[countsIdx + 1 + nAtoms + i] ?? '';
    bonds.push({ a: parseInt(l.slice(0, 3), 10) - 1, b: parseInt(l.slice(3, 6), 10) - 1, order: parseInt(l.slice(6, 9), 10) });
  }
  // Cargas declaradas no bloco "M  CHG" sobrepõem o código da linha do átomo.
  for (const l of lines) {
    if (l.startsWith('M  CHG')) {
      const parts = l.slice(6).trim().split(/\s+/).map(Number);
      for (let i = 1; i + 1 < parts.length; i += 2) {
        if (atoms[parts[i] - 1]) atoms[parts[i] - 1].charge = parts[i + 1];
      }
    }
    if (l.startsWith('M  END')) break;
  }
  const is3D = atoms.some((a) => Math.abs(a.z) > 1e-4);
  return { atoms, bonds, is3D };
}

export function formulaFromAtoms(atoms: SdfAtom[]): string {
  const counts: ElementCounts = {};
  for (const a of atoms) counts[a.symbol] = (counts[a.symbol] ?? 0) + 1;
  const net = atoms.reduce((s, a) => s + a.charge, 0);
  const f = countsToFormula(counts);
  if (!net) return f;
  return `${f}${Math.abs(net) > 1 ? Math.abs(net) : ''}${net > 0 ? '+' : '-'}`;
}

export const BOND_ORDER_LABEL: Record<number, string> = {
  1: 'simples',
  2: 'dupla',
  3: 'tripla',
  4: 'aromática',
};
