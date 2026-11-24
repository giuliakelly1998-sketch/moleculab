import { useEffect, useRef, useState } from 'react';
import s from './Explorer.module.css';
import { Icon, Notice, Spinner } from '../../components/ui';
import type { ViewerStyle } from '../../state/AppDataContext';
import { getElementLoose } from '../../chem/elements';
import { BOND_ORDER_LABEL } from '../../chem/sdf';

/* Tipos mínimos do 3Dmol usados aqui (a biblioteca é carregada sob demanda). */
interface Atom3D {
  index: number;
  elem: string;
  x: number;
  y: number;
  z: number;
  bonds: number[];
  bondOrder: number[];
}
interface Model3D {
  selectedAtoms(sel: object): Atom3D[];
}
interface Viewer3D {
  addModel(data: string, format: string): Model3D;
  setStyle(sel: object, style: object): void;
  addStyle(sel: object, style: object): void;
  setClickable(sel: object, on: boolean, cb: (atom: Atom3D) => void): void;
  setHoverable(sel: object, on: boolean, over: (a: Atom3D) => void, out: (a: Atom3D) => void): void;
  addLabel(text: string, opts: object): unknown;
  removeAllLabels(): void;
  removeAllShapes(): void;
  removeAllModels(): void;
  addSphere(opts: object): unknown;
  addCylinder(opts: object): unknown;
  zoomTo(): void;
  render(): void;
  resize(): void;
  spin(axis: string | boolean, speed?: number): void;
  setBackgroundColor(c: string, a?: number): void;
  pngURI(): string;
  clear(): void;
}

export interface SelectedAtom {
  index: number;
  symbol: string;
  name: string;
  coords: [number, number, number];
  neighbors: { index: number; symbol: string; order: string; distance: number }[];
  /** Ângulos de ligação com vértice no átomo selecionado (vizinho–átomo–vizinho), em graus. */
  angles: { a: string; b: string; aIndex: number; bIndex: number; degrees: number }[];
}

/** Ângulo a desenhar: vértice e os dois vizinhos (índices de átomo). */
export interface AngleSpec {
  vertex: number;
  a: number;
  b: number;
}

interface Props {
  molblock: string;
  style: ViewerStyle;
  showHydrogens: boolean;
  highlightAtoms?: number[];
  highlightColor?: string;
  onSelectAtom?: (a: SelectedAtom | null) => void;
  theme: 'dark' | 'light';
  title: string;
  /** Ângulo de ligação a destacar com arco e valor. */
  angle?: AngleSpec | null;
}

function styleSpec(style: ViewerStyle, color?: string) {
  const c = color ? { color } : { colorscheme: 'Jmol' };
  switch (style) {
    case 'stick':
      return { stick: { radius: 0.16, ...c } };
    case 'sphere':
      return { sphere: { scale: 1.0, ...c } };
    default:
      return { stick: { radius: 0.14, ...c }, sphere: { scale: 0.26, ...c } };
  }
}

export default function Viewer3D({ molblock, style, showHydrogens, highlightAtoms, highlightColor = '#3ad6e6', onSelectAtom, theme, title, angle }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer3D | null>(null);
  const modelRef = useRef<Model3D | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [spinning, setSpinning] = useState(false);
  const selectedRef = useRef<number | null>(null);
  const onSelectRef = useRef(onSelectAtom);
  onSelectRef.current = onSelectAtom;

  // Inicialização do visualizador (biblioteca carregada sob demanda).
  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const lib = (await import('3dmol')) as unknown as { createViewer: (el: HTMLElement, cfg: object) => Viewer3D };
        if (disposed || !hostRef.current) return;
        const probe = document.createElement('canvas');
        if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('WebGL indisponível neste navegador/dispositivo.');
        const v = lib.createViewer(hostRef.current, { backgroundAlpha: 0, antialias: true });
        if (!v) throw new Error('Falha ao criar o contexto 3D.');
        viewerRef.current = v;
        setState('ready');
      } catch (e) {
        if (disposed) return;
        setError(e instanceof Error ? e.message : String(e));
        setState('error');
      }
    })();
    return () => {
      disposed = true;
      try {
        viewerRef.current?.clear();
      } catch {
        /* contexto já descartado */
      }
      viewerRef.current = null;
    };
  }, []);

  // Carrega o modelo quando a estrutura muda.
  useEffect(() => {
    const v = viewerRef.current;
    if (state !== 'ready' || !v) return;
    v.removeAllModels();
    v.removeAllLabels();
    v.removeAllShapes();
    selectedRef.current = null;
    onSelectRef.current?.(null);
    try {
      modelRef.current = v.addModel(molblock, 'sdf');
    } catch (e) {
      setError('Não foi possível interpretar o arquivo de estrutura.');
      setState('error');
      return;
    }
    v.zoomTo();
    v.render();
  }, [molblock, state]);

  // Estilo, hidrogênios, destaque e seleção.
  useEffect(() => {
    const v = viewerRef.current;
    const model = modelRef.current;
    if (state !== 'ready' || !v || !model) return;
    v.setBackgroundColor(theme === 'dark' ? '#0f131d' : '#ffffff', 0);
    v.setStyle({}, styleSpec(style));
    if (!showHydrogens) v.setStyle({ elem: 'H' }, {});
    v.removeAllShapes();
    v.removeAllLabels();
    const atoms = model.selectedAtoms({});
    if (highlightAtoms?.length) {
      const set = new Set(highlightAtoms);
      // Átomos do grupo recebem a cor do grupo; um halo translúcido reforça o destaque.
      v.setStyle({ predicate: (a: Atom3D) => set.has(a.index) }, styleSpec(style, highlightColor));
      for (const a of atoms) {
        if (!set.has(a.index)) continue;
        v.addSphere({ center: { x: a.x, y: a.y, z: a.z }, radius: style === 'sphere' ? 1.95 : 0.7, color: highlightColor, opacity: 0.28 });
      }
    }
    if (selectedRef.current !== null) {
      const a = atoms[selectedRef.current];
      if (a) addAtomLabel(v, a, theme);
    }
    if (angle) drawAngle(v, atoms, angle, theme, style);
    v.setClickable({}, true, (atom) => {
      const all = model.selectedAtoms({});
      if (selectedRef.current === atom.index) {
        selectedRef.current = null;
        v.removeAllLabels();
        v.render();
        onSelectRef.current?.(null);
        return;
      }
      selectedRef.current = atom.index;
      v.removeAllLabels();
      addAtomLabel(v, atom, theme);
      v.render();
      onSelectRef.current?.(describeAtom(atom, all));
    });
    v.render();
  }, [style, showHydrogens, highlightAtoms, highlightColor, state, molblock, theme, angle]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const ro = new ResizeObserver(() => {
      viewerRef.current?.resize();
      viewerRef.current?.render();
    });
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const toggleSpin = () => {
    const v = viewerRef.current;
    if (!v) return;
    v.spin(spinning ? false : 'y', 0.6);
    setSpinning(!spinning);
  };

  const savePng = () => {
    const uri = viewerRef.current?.pngURI();
    if (!uri) return;
    const a = document.createElement('a');
    a.href = uri;
    a.download = `${title.replace(/[^\w.-]+/g, '_').slice(0, 50) || 'molecula'}_3d.png`;
    a.click();
  };

  return (
    <div className={s.viewer3d}>
      <div ref={hostRef} className={s.canvasHost} aria-label={`Visualização 3D de ${title}. Arraste para girar, role para aproximar, clique direito ou Ctrl+arrastar para mover.`} role="img" />
      {state === 'loading' && (
        <div className={s.overlay}>
          <Spinner label="Inicializando visualizador 3D…" />
        </div>
      )}
      {state === 'error' && (
        <div className={s.overlay}>
          <Notice kind="warn" title="Visualizador 3D indisponível">
            {error} Use a visualização 2D.
          </Notice>
        </div>
      )}
      {state === 'ready' && (
        <div className={s.viewerTools}>
          <button className="btn btn-sm" onClick={() => { viewerRef.current?.zoomTo(); viewerRef.current?.render(); }} title="Centralizar">
            <Icon name="reset" size={14} /> Centralizar
          </button>
          <button className="btn btn-sm" onClick={toggleSpin} aria-pressed={spinning}>
            {spinning ? 'Parar' : 'Girar'}
          </button>
          <button className="btn btn-sm" onClick={savePng} title="Salvar imagem PNG">
            <Icon name="download" size={14} /> PNG
          </button>
        </div>
      )}
    </div>
  );
}

/** Desenha o arco do ângulo vizinho–vértice–vizinho e o valor em graus. */
function drawAngle(v: Viewer3D, atoms: Atom3D[], spec: AngleSpec, theme: 'dark' | 'light', style: ViewerStyle) {
  const V = atoms[spec.vertex];
  const A = atoms[spec.a];
  const B = atoms[spec.b];
  if (!V || !A || !B) return;
  const unit = (p: Atom3D) => {
    const d = Math.hypot(p.x - V.x, p.y - V.y, p.z - V.z) || 1;
    return { x: (p.x - V.x) / d, y: (p.y - V.y) / d, z: (p.z - V.z) / d };
  };
  const u = unit(A);
  const w = unit(B);
  const theta = Math.acos(Math.max(-1, Math.min(1, u.x * w.x + u.y * w.y + u.z * w.z)));
  if (!Number.isFinite(theta) || theta < 1e-3) return;
  const R = style === 'sphere' ? 2.0 : 0.75;
  const color = '#f2b84b';
  const pts = Array.from({ length: 25 }, (_, i) => {
    const t = i / 24;
    const k1 = Math.sin((1 - t) * theta) / Math.sin(theta);
    const k2 = Math.sin(t * theta) / Math.sin(theta);
    return { x: V.x + R * (k1 * u.x + k2 * w.x), y: V.y + R * (k1 * u.y + k2 * w.y), z: V.z + R * (k1 * u.z + k2 * w.z) };
  });
  for (let i = 0; i < pts.length - 1; i++) v.addCylinder({ start: pts[i], end: pts[i + 1], radius: 0.045, color, fromCap: 1, toCap: 1 });
  // Raios do arco até o vértice, para deixar claro quais ligações formam o ângulo.
  for (const p of [pts[0], pts[pts.length - 1]]) v.addCylinder({ start: { x: V.x, y: V.y, z: V.z }, end: p, radius: 0.018, color, dashed: true, fromCap: 1, toCap: 1 });
  const mid = pts[12];
  const dir = { x: mid.x - V.x, y: mid.y - V.y, z: mid.z - V.z };
  const dl = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const off = 0.45;
  v.addLabel(`${((theta * 180) / Math.PI).toFixed(1).replace('.', ',')}°`, {
    position: { x: mid.x + (dir.x / dl) * off, y: mid.y + (dir.y / dl) * off, z: mid.z + (dir.z / dl) * off },
    backgroundColor: theme === 'dark' ? '#1b2130' : '#ffffff',
    backgroundOpacity: 0.9,
    fontColor: color,
    borderColor: color,
    borderThickness: 1,
    fontSize: 14,
    inFront: true,
  });
}

function addAtomLabel(v: Viewer3D, a: Atom3D, theme: 'dark' | 'light') {
  v.addLabel(`${a.elem}${a.index + 1}`, {
    position: { x: a.x, y: a.y, z: a.z },
    backgroundColor: theme === 'dark' ? '#1b2130' : '#ffffff',
    backgroundOpacity: 0.92,
    fontColor: theme === 'dark' ? '#e6e8f0' : '#141826',
    borderColor: '#8b6cff',
    borderThickness: 1,
    fontSize: 13,
    inFront: true,
  });
}

/** Ângulo (graus) entre os vetores vértice→p e vértice→q. */
export function bondAngle(v: { x: number; y: number; z: number }, p: { x: number; y: number; z: number }, q: { x: number; y: number; z: number }): number {
  const ax = p.x - v.x, ay = p.y - v.y, az = p.z - v.z;
  const bx = q.x - v.x, by = q.y - v.y, bz = q.z - v.z;
  const dot = ax * bx + ay * by + az * bz;
  const na = Math.hypot(ax, ay, az);
  const nb = Math.hypot(bx, by, bz);
  if (!na || !nb) return NaN;
  return (Math.acos(Math.max(-1, Math.min(1, dot / (na * nb)))) * 180) / Math.PI;
}

function describeAtom(a: Atom3D, all: Atom3D[]): SelectedAtom {
  const el = getElementLoose(a.elem);
  const sym = (x?: Atom3D) => getElementLoose(x?.elem ?? '')?.symbol ?? x?.elem ?? '?';
  const nbrs = (a.bonds ?? []).map((j) => all[j]).filter(Boolean);
  const angles: SelectedAtom['angles'] = [];
  for (let i = 0; i < nbrs.length; i++) {
    for (let k = i + 1; k < nbrs.length; k++) {
      angles.push({
        a: `${sym(nbrs[i])}${nbrs[i].index + 1}`,
        b: `${sym(nbrs[k])}${nbrs[k].index + 1}`,
        aIndex: nbrs[i].index,
        bIndex: nbrs[k].index,
        degrees: bondAngle(a, nbrs[i], nbrs[k]),
      });
    }
  }
  return {
    index: a.index,
    symbol: el?.symbol ?? a.elem,
    name: el?.namePt ?? a.elem,
    coords: [a.x, a.y, a.z],
    neighbors: (a.bonds ?? []).map((j, k) => {
      const b = all[j];
      const order = a.bondOrder?.[k] ?? 1;
      const d = b ? Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) : NaN;
      return {
        index: j,
        symbol: sym(b),
        order: BOND_ORDER_LABEL[Math.round(order)] ?? (order === 1.5 ? 'aromática' : String(order)),
        distance: d,
      };
    }),
    angles,
  };
}
