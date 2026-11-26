import DATA from '../data/elements.json';
import { ELEMENTS } from './elements';

/** Registro de elemento gerado por scripts/build-elements.py (mendeleev + pymatgen). */
export interface ElementData {
  z: number;
  symbol: string;
  nameEn: string;
  nameOrigin: string | null;
  period: number;
  group: number | null;
  groupCas: string | null;
  block: string;
  series: string | null;
  atomicWeight: number | null;
  atomicWeightUnc: number | null;
  massNumber: number | null;
  neutrons: number | null;
  econf: string;
  econfFull: string;
  shells: number[] | null;
  oxidationStates: number[];
  commonOxidationStates: number[];
  enPauling: number | null;
  enAllen: number | null;
  electronAffinityEv: number | null;
  ionizationEv: number[];
  radiusEmpiricalPm: number | null;
  radiusCalculatedPm: number | null;
  radiusCovalentPm: number | null;
  radiusVdwPm: number | null;
  radiusMetallicPm: number | null;
  densityGcm3: number | null;
  meltingK: number | null;
  boilingK: number | null;
  phase: string | null;
  fusionHeatKJmol: number | null;
  evaporationHeatKJmol: number | null;
  specificHeatJgK: number | null;
  molarHeatCapacityJmolK: number | null;
  thermalConductivityWmK: number | null;
  thermalExpansionPerK: number | null;
  resistivityOhmM: number | null;
  superconductionK: number | null;
  brinellMPa: number | null;
  vickersMPa: number | null;
  mohs: number | null;
  bulkModulusGPa: number | null;
  youngModulusGPa: number | null;
  shearModulusGPa: number | null;
  poisson: number | null;
  soundSpeedMs: number | null;
  molarVolumeCm3: number | null;
  refractiveIndex: number | null;
  reflectivityPct: number | null;
  latticeStructure: string | null;
  latticeConstantA: number | null;
  abundanceCrustMgKg: number | null;
  abundanceSeaMgL: number | null;
  discoveryYear: number | null;
  discoverers: string | null;
  discoveryLocation: string | null;
  cas: string | null;
  radioactive: boolean;
  naturalIsotopes: { A: number; abundance: number }[];
  mostStableIsotope: { A: number; halfLife: number; unit: string } | null;
  cpkColor: string | null;
  /** Propriedades que são previsões teóricas (Z ≥ 100), não medidas. */
  predicted: string[];
}

export const PERIODIC: ElementData[] = DATA as ElementData[];

export const namePt = (z: number) => ELEMENTS[z - 1]?.namePt ?? '';

export function findElement(q: string): ElementData | undefined {
  const t = q.trim();
  if (/^\d+$/.test(t)) return PERIODIC[parseInt(t, 10) - 1];
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return (
    PERIODIC.find((e) => e.symbol.toLowerCase() === t.toLowerCase()) ??
    PERIODIC.find((e) => norm(namePt(e.z)) === norm(t) || norm(e.nameEn) === norm(t))
  );
}

export const SERIES_PT: Record<string, string> = {
  'Alkali metals': 'Metal alcalino',
  'Alkaline earth metals': 'Metal alcalinoterroso',
  'Transition metals': 'Metal de transição',
  'Poor metals': 'Metal representativo',
  Metalloids: 'Semimetal',
  Nonmetals: 'Não metal',
  Halogens: 'Halogênio',
  'Noble gases': 'Gás nobre',
  Lanthanides: 'Lantanídeo',
  Actinides: 'Actinídeo',
};

export const SERIES_COLOR: Record<string, string> = {
  'Alkali metals': '#ff6b6b',
  'Alkaline earth metals': '#ffa94d',
  'Transition metals': '#5c9dff',
  'Poor metals': '#4dd4c6',
  Metalloids: '#9ad36a',
  Nonmetals: '#ffd43b',
  Halogens: '#f783ac',
  'Noble gases': '#b197fc',
  Lanthanides: '#63e6be',
  Actinides: '#e599f7',
};

/** Posição (linha, coluna) na tabela de 18 colunas; lantanídeos/actinídeos nas linhas 9–10. */
export function gridPosition(e: ElementData): { row: number; col: number } {
  if (e.z >= 57 && e.z <= 71) return { row: 9, col: e.z - 57 + 3 };
  if (e.z >= 89 && e.z <= 103) return { row: 10, col: e.z - 89 + 3 };
  return { row: e.period, col: e.group ?? 3 };
}

export const toC = (k: number) => k - 273.15;
export const toF = (k: number) => (k * 9) / 5 - 459.67;

export const EV_TO_KJMOL = 96.48533212; // 1 eV/partícula = 96,485 kJ/mol (CODATA 2018)

export const HALF_LIFE_PT: Record<string, string> = {
  ysec: 'ys', zsec: 'zs', asec: 'as', fsec: 'fs', psec: 'ps', nsec: 'ns', usec: 'µs', msec: 'ms', sec: 's',
  minute: 'min', hour: 'h', day: 'dias', year: 'anos', kyear: 'mil anos', Myear: 'milhões de anos',
  Gyear: 'bilhões de anos', Tyear: '10¹² anos', Pyear: '10¹⁵ anos', Eyear: '10¹⁸ anos', Zyear: '10²¹ anos', Yyear: '10²⁴ anos',
};

/** Configuração eletrônica com sobrescritos ("[Ne] 3s2 3p" → "[Ne] 3s² 3p¹"). */
export function prettyConfig(conf: string): string {
  const sup: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return conf
    .split(/\s+/)
    .map((t) => {
      const m = /^(\d+[spdfg])(\d*)$/.exec(t);
      if (!m) return t;
      return m[1] + (m[2] || '1').split('').map((d) => sup[d]).join('');
    })
    .join(' ');
}

export const SHELL_LETTERS = ['K', 'L', 'M', 'N', 'O', 'P', 'Q'];

export const ELEMENT_SOURCES = [
  { label: 'mendeleev (L. M. Mentel), base com referências primárias por propriedade', url: 'https://mendeleev.readthedocs.io' },
  { label: 'HAYNES, W. M. (ed.). CRC Handbook of Chemistry and Physics. 95. ed. Boca Raton: CRC Press, 2014.' },
  { label: 'ONG, S. P. et al. Python Materials Genomics (pymatgen). Comput. Mater. Sci. 68, 314–319, 2013 — dados compilados do WebElements.', url: 'https://doi.org/10.1016/j.commatsci.2012.10.028' },
  { label: 'NIST Atomic Spectra Database (energias de ionização).', url: 'https://www.nist.gov/pml/atomic-spectra-database' },
  { label: 'SLATER, J. C. Atomic radii in crystals. J. Chem. Phys. 41, 3199, 1964 (raio empírico).', url: 'https://doi.org/10.1063/1.1725697' },
  { label: 'PYYKKÖ, P.; ATSUMI, M. Molecular single-bond covalent radii. Chem. Eur. J. 15, 186–197, 2009 (raio covalente).', url: 'https://doi.org/10.1002/chem.200800987' },
];
