/**
 * Geometria de células unitárias para as estruturas cristalinas mais comuns
 * dos elementos, no modelo de esferas rígidas.
 *
 * Referência: Callister & Rethwisch, Materials Science and Engineering, cap. 3;
 * West, Solid State Chemistry and its Applications, cap. 1.
 */
export type CellType = 'SC' | 'BCC' | 'FCC' | 'DIA' | 'HCP';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface CellInfo {
  type: CellType;
  namePt: string;
  /** Átomos por célula, contando frações (vértice 1/8, face 1/2, aresta 1/4). */
  atomsPerCell: number;
  coordination: number;
  /** Fator de empacotamento atômico (fração do volume ocupado por esferas rígidas). */
  packingFactor: number;
  /** Relação a(r) no modelo de esferas rígidas, em texto. */
  relation: string;
  /** Raio de esfera rígida a partir de a. */
  radiusFromA: (a: number) => number;
  /** Distância entre vizinhos mais próximos a partir de a. */
  nnDistance: (a: number) => number;
}

const S2 = Math.SQRT2;
const S3 = Math.sqrt(3);

export const CELLS: Record<CellType, CellInfo> = {
  SC: {
    type: 'SC', namePt: 'Cúbica simples', atomsPerCell: 1, coordination: 6,
    packingFactor: Math.PI / 6, relation: 'a = 2r',
    radiusFromA: (a) => a / 2, nnDistance: (a) => a,
  },
  BCC: {
    type: 'BCC', namePt: 'Cúbica de corpo centrado (CCC)', atomsPerCell: 2, coordination: 8,
    packingFactor: (Math.PI * S3) / 8, relation: 'a = 4r/√3',
    radiusFromA: (a) => (a * S3) / 4, nnDistance: (a) => (a * S3) / 2,
  },
  FCC: {
    type: 'FCC', namePt: 'Cúbica de face centrada (CFC)', atomsPerCell: 4, coordination: 12,
    packingFactor: Math.PI / (3 * S2), relation: 'a = 2√2·r',
    radiusFromA: (a) => a / (2 * S2), nnDistance: (a) => a / S2,
  },
  DIA: {
    type: 'DIA', namePt: 'Cúbica tipo diamante', atomsPerCell: 8, coordination: 4,
    packingFactor: (Math.PI * S3) / 16, relation: 'a = 8r/√3',
    radiusFromA: (a) => (a * S3) / 8, nnDistance: (a) => (a * S3) / 4,
  },
  HCP: {
    type: 'HCP', namePt: 'Hexagonal compacta (HC)', atomsPerCell: 6, coordination: 12,
    packingFactor: Math.PI / (3 * S2), relation: 'a = 2r; c/a ideal = √(8/3) ≈ 1,633',
    radiusFromA: (a) => a / 2, nnDistance: (a) => a,
  },
};

/**
 * Elementos que são hexagonais compactos à temperatura ambiente. Outros
 * "hexagonais" (Se, Te em cadeias; La, Pr, Nd em empilhamento duplo; H, He, N
 * moleculares) não são HC e não são desenhados como tal.
 */
export const HCP_ELEMENTS = new Set(['Be', 'Mg', 'Sc', 'Ti', 'Co', 'Zn', 'Y', 'Zr', 'Tc', 'Ru', 'Cd', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Lu', 'Hf', 'Re', 'Os', 'Tl']);

export const IDEAL_C_OVER_A = Math.sqrt(8 / 3);

export const LATTICE_LABELS: Record<string, string> = {
  SC: 'Cúbica simples',
  BCC: 'Cúbica de corpo centrado',
  FCC: 'Cúbica de face centrada',
  DIA: 'Cúbica tipo diamante',
  HEX: 'Hexagonal',
  CUB: 'Cúbica (estrutura complexa)',
  ORC: 'Ortorrômbica',
  TET: 'Tetragonal',
  RHL: 'Romboédrica',
  MCL: 'Monoclínica',
};

/** Converte o código da base de dados no tipo desenhável, quando houver. */
export function drawableCell(symbol: string, code: string | null): CellType | null {
  if (!code) return null;
  if (code === 'SC' || code === 'BCC' || code === 'FCC' || code === 'DIA') return code;
  if (code === 'HEX' && HCP_ELEMENTS.has(symbol)) return 'HCP';
  return null;
}

export interface CellGeometry {
  atoms: { pos: Vec3; kind: 'vértice' | 'face' | 'corpo' | 'interior' | 'aresta' }[];
  edges: [Vec3, Vec3][];
  /** Rótulos dos parâmetros de rede (posição no meio de uma aresta). */
  labels: { text: string; pos: Vec3 }[];
}

const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

function cubeEdges(a: number): [Vec3, Vec3][] {
  const c = [0, a];
  const out: [Vec3, Vec3][] = [];
  for (const y of c) for (const z of c) out.push([v(0, y, z), v(a, y, z)]);
  for (const x of c) for (const z of c) out.push([v(x, 0, z), v(x, a, z)]);
  for (const x of c) for (const y of c) out.push([v(x, y, 0), v(x, y, a)]);
  return out;
}

/** Coordenadas cartesianas (Å) dos átomos de uma célula convencional. */
export function cellGeometry(type: CellType, a: number): CellGeometry {
  if (type === 'HCP') return hcpGeometry(a, a * IDEAL_C_OVER_A);
  const atoms: CellGeometry['atoms'] = [];
  for (const x of [0, a]) for (const y of [0, a]) for (const z of [0, a]) atoms.push({ pos: v(x, y, z), kind: 'vértice' });
  const h = a / 2;
  if (type === 'BCC') atoms.push({ pos: v(h, h, h), kind: 'corpo' });
  if (type === 'FCC' || type === 'DIA') {
    for (const p of [v(h, h, 0), v(h, h, a), v(h, 0, h), v(h, a, h), v(0, h, h), v(a, h, h)]) atoms.push({ pos: p, kind: 'face' });
  }
  if (type === 'DIA') {
    const q = a / 4;
    for (const [i, j, k] of [[1, 1, 1], [3, 3, 1], [3, 1, 3], [1, 3, 3]]) atoms.push({ pos: v(i * q, j * q, k * q), kind: 'interior' });
  }
  return {
    atoms,
    edges: cubeEdges(a),
    labels: [
      { text: 'a', pos: v(a / 2, -0.12 * a, -0.06 * a) },
      { text: 'a', pos: v(a * 1.1, a / 2, -0.06 * a) },
      { text: 'a', pos: v(a * 1.08, -0.08 * a, a / 2) },
    ],
  };
}

function hcpGeometry(a: number, c: number): CellGeometry {
  const hex = Array.from({ length: 6 }, (_, i) => {
    const t = (Math.PI / 3) * i;
    return { x: a * Math.cos(t), y: a * Math.sin(t) };
  });
  const atoms: CellGeometry['atoms'] = [];
  const edges: [Vec3, Vec3][] = [];
  for (const z of [0, c]) {
    hex.forEach((p, i) => {
      atoms.push({ pos: v(p.x, p.y, z), kind: 'vértice' });
      const q = hex[(i + 1) % 6];
      edges.push([v(p.x, p.y, z), v(q.x, q.y, z)]);
    });
    atoms.push({ pos: v(0, 0, z), kind: 'face' });
  }
  hex.forEach((p) => edges.push([v(p.x, p.y, 0), v(p.x, p.y, c)]));
  // Três átomos da camada intermediária (sítios B), nos centroides de triângulos alternados.
  for (const i of [0, 2, 4]) {
    const p = hex[i];
    const q = hex[i + 1];
    atoms.push({ pos: v((p.x + q.x) / 3, (p.y + q.y) / 3, c / 2), kind: 'interior' });
  }
  return {
    atoms,
    edges,
    labels: [
      { text: 'a', pos: v((hex[4].x + hex[5].x) / 2, (hex[4].y + hex[5].y) / 2 - 0.25 * a, 0) },
      { text: 'c', pos: v(hex[0].x + 0.3 * a, hex[0].y, c / 2) },
    ],
  };
}

/** Pares de átomos à distância de vizinhos mais próximos (para desenhar contatos). */
export function nearestNeighborPairs(geo: CellGeometry, d: number, tol = 0.02): [Vec3, Vec3][] {
  const out: [Vec3, Vec3][] = [];
  const at = geo.atoms;
  for (let i = 0; i < at.length; i++) {
    for (let j = i + 1; j < at.length; j++) {
      const p = at[i].pos;
      const q = at[j].pos;
      const dist = Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
      if (Math.abs(dist - d) <= tol * d) out.push([p, q]);
    }
  }
  return out;
}

const NA = 6.02214076e23;

/**
 * Densidade teórica (g/cm³) a partir da célula: ρ = n·M / (N_A·V_c).
 * Para HC, usa c/a ideal quando c não é conhecido (resultado aproximado).
 */
export function theoreticalDensity(type: CellType, aAngstrom: number, molarMass: number, cOverA = IDEAL_C_OVER_A): number {
  const a = aAngstrom * 1e-8; // cm
  const V = type === 'HCP' ? ((3 * S3) / 2) * a * a * (a * cOverA) : a ** 3;
  return (CELLS[type].atomsPerCell * molarMass) / (NA * V);
}
