import type { RDKitModule, JSMol } from '../services/rdkit';
import { detectFunctionalGroups, GroupMatch } from './functionalGroups';
import type { MoleculeRecord } from './molecule';

/** Descritores calculados pelo RDKit (todos são valores CALCULADOS, nunca experimentais). */
export interface RDKitDescriptors {
  clogp?: number; // Wildman–Crippen
  tpsa?: number; // Ertl et al.
  hbd?: number;
  hba?: number;
  rotatable?: number;
  labuteASA?: number;
  mr?: number;
  amw?: number;
  heavyAtoms?: number;
  rings?: number;
  aromaticRings?: number;
  fsp3?: number;
  stereocenters?: number;
}

export interface Analysis {
  groups: GroupMatch[];
  descriptors: RDKitDescriptors;
  /** Se true, índices de átomos do RDKit coincidem com os do arquivo de estrutura (destaque 3D possível). */
  indicesAlignedWithStructure: boolean;
  heavyAtomCount: number;
}

/**
 * Cria a molécula de trabalho. Preferimos o molfile da PubChem (os átomos
 * pesados vêm antes dos H), o que mantém os índices alinhados ao visualizador 3D.
 */
export function workingMol(rdkit: RDKitModule, rec: MoleculeRecord): { mol: JSMol; aligned: boolean } | null {
  if (rec.structure) {
    // removeHs: H explícitos saem; como vêm depois dos pesados, os índices dos pesados se mantêm.
    const m = rdkit.get_mol(rec.structure.molblock, JSON.stringify({ removeHs: true }));
    if (m && m.is_valid()) {
      const aligned = heavyAtomsFirst(rec.structure.molblock);
      return { mol: m, aligned };
    }
    m?.delete();
  }
  const smi = rec.smiles ?? rec.connectivitySmiles;
  if (smi) {
    const m = rdkit.get_mol(smi);
    if (m && m.is_valid()) return { mol: m, aligned: false };
    m?.delete();
  }
  return null;
}

function heavyAtomsFirst(molblock: string): boolean {
  const lines = molblock.replace(/\r/g, '').split('\n');
  const ci = lines.findIndex((l) => /V2000\s*$/.test(l));
  if (ci < 0) return false;
  const n = parseInt(lines[ci].slice(0, 3), 10);
  let seenH = false;
  for (let i = 0; i < n; i++) {
    const sym = (lines[ci + 1 + i] ?? '').slice(31, 34).trim();
    if (sym === 'H') seenH = true;
    else if (seenH) return false;
  }
  return true;
}

export function analyze(rdkit: RDKitModule, rec: MoleculeRecord): Analysis | null {
  const w = workingMol(rdkit, rec);
  if (!w) return null;
  try {
    const d = JSON.parse(w.mol.get_descriptors()) as Record<string, number>;
    const descriptors: RDKitDescriptors = {
      clogp: d.CrippenClogP,
      tpsa: d.tpsa,
      hbd: d.NumHBD,
      hba: d.NumHBA,
      rotatable: d.NumRotatableBonds,
      labuteASA: d.labuteASA,
      mr: d.CrippenMR,
      amw: d.amw,
      heavyAtoms: d.NumHeavyAtoms,
      rings: d.NumRings,
      aromaticRings: d.NumAromaticRings,
      fsp3: d.FractionCSP3,
      stereocenters: d.NumAtomStereoCenters,
    };
    const groups = detectFunctionalGroups(rdkit, w.mol);
    return { groups, descriptors, indicesAlignedWithStructure: w.aligned, heavyAtomCount: w.mol.get_num_atoms(true) };
  } finally {
    w.mol.delete();
  }
}

export interface SvgOptions {
  width: number;
  height: number;
  highlightAtoms?: number[];
  highlightBonds?: number[];
  highlightColor?: [number, number, number];
  darkInk?: boolean;
}

/** Desenho 2D (SVG) com destaque opcional; recalcula coordenadas 2D a partir da mesma molécula. */
export function drawSvg(rdkit: RDKitModule, rec: MoleculeRecord, o: SvgOptions): string | null {
  const w = workingMol(rdkit, rec);
  if (!w) return null;
  try {
    w.mol.set_new_coords(true);
    const details: Record<string, unknown> = {
      width: o.width,
      height: o.height,
      bondLineWidth: 1.6,
      addStereoAnnotation: true,
      clearBackground: false,
    };
    if (o.highlightAtoms?.length) {
      details.atoms = o.highlightAtoms;
      details.bonds = o.highlightBonds ?? [];
      const c = (o.highlightColor ?? [80, 220, 230]).map((x) => x / 255);
      details.highlightColour = c;
    }
    const svg = w.mol.get_svg_with_highlights(JSON.stringify(details));
    return o.darkInk === false ? svg : recolorForDark(svg);
  } finally {
    w.mol.delete();
  }
}

/** SVG pré-renderizado a partir de um SMILES (usado nos exemplos de grupos funcionais). */
export function svgFromSmiles(rdkit: RDKitModule, smiles: string, width = 220, height = 150, dark = true): string | null {
  const m = rdkit.get_mol(smiles);
  if (!m || !m.is_valid()) {
    m?.delete();
    return null;
  }
  try {
    const svg = m.get_svg_with_highlights(JSON.stringify({ width, height, clearBackground: false, bondLineWidth: 1.4 }));
    return dark ? recolorForDark(svg) : svg;
  } finally {
    m.delete();
  }
}

/** Ajusta a paleta padrão do RDKit (traço preto, heteroátomos escuros) para fundo escuro. */
export function recolorForDark(svg: string): string {
  return svg
    .replace(/<rect[^>]*class='background'[^>]*\/>/g, '')
    .replace(/#000000/gi, '#E4E6F0')
    .replace(/#0000FF/gi, '#7AA2FF')
    .replace(/#FF0000/gi, '#FF6B6B')
    .replace(/#33CCCC/gi, '#5FE0D0')
    .replace(/#00CC00/gi, '#5FD35F')
    .replace(/#CCCC00/gi, '#E8D44D');
}
