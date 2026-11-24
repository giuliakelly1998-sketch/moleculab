import { useEffect, useRef, useState } from 'react';
import s from './Elements.module.css';
import { CELLS, CellType, cellGeometry, nearestNeighborPairs } from '../../chem/unitCell';
import { Notice, Spinner } from '../../components/ui';

interface Viewer {
  addSphere(o: object): unknown;
  addCylinder(o: object): unknown;
  addLabel(t: string, o: object): unknown;
  removeAllShapes(): void;
  removeAllLabels(): void;
  zoomTo(sel?: object): void;
  zoom(f: number): void;
  render(): void;
  resize(): void;
  rotate(deg: number, axis: string): void;
  spin(axis: string | boolean, speed?: number): void;
  setView(v: number[]): void;
  clear(): void;
}

interface Props {
  type: CellType;
  a: number; // Å
  color: string;
  theme: 'dark' | 'light';
}

/** Célula unitária 3D (3Dmol.js) no modelo de esferas rígidas, com arestas rotuladas. */
export default function UnitCellViewer({ type, a, color, theme }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const viewer = useRef<Viewer | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');
  const [spheres, setSpheres] = useState<'small' | 'contact'>('small');
  const [contacts, setContacts] = useState(true);
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      try {
        const lib = (await import('3dmol')) as unknown as { createViewer: (el: HTMLElement, cfg: object) => Viewer };
        if (disposed || !host.current) return;
        const probe = document.createElement('canvas');
        if (!probe.getContext('webgl2') && !probe.getContext('webgl')) throw new Error('WebGL indisponível neste navegador.');
        viewer.current = lib.createViewer(host.current, { backgroundAlpha: 0, antialias: true });
        setState('ready');
      } catch (e) {
        if (!disposed) {
          setErr(e instanceof Error ? e.message : String(e));
          setState('error');
        }
      }
    })();
    return () => {
      disposed = true;
      try {
        viewer.current?.clear();
      } catch {
        /* já descartado */
      }
      viewer.current = null;
    };
  }, []);

  useEffect(() => {
    const v = viewer.current;
    if (state !== 'ready' || !v) return;
    v.removeAllShapes();
    v.removeAllLabels();
    const info = CELLS[type];
    const geo = cellGeometry(type, a);
    const r = info.radiusFromA(a);
    const ink = theme === 'dark' ? '#cfd3e0' : '#5a6175';
    const edgeR = Math.max(0.025, a * 0.008);
    for (const [p, q] of geo.edges) v.addCylinder({ start: p, end: q, radius: edgeR, color: ink, fromCap: 1, toCap: 1 });
    if (contacts) {
      for (const [p, q] of nearestNeighborPairs(geo, info.nnDistance(a))) {
        v.addCylinder({ start: p, end: q, radius: edgeR * 0.7, color: '#8b6cff', opacity: 0.85, fromCap: 1, toCap: 1 });
      }
    }
    const kindColor: Record<string, string> = { vértice: color, face: color, corpo: '#ef5fb6', interior: '#3ad6e6', aresta: color };
    for (const at of geo.atoms) {
      v.addSphere({
        center: at.pos,
        radius: spheres === 'contact' ? r : r * 0.32,
        color: kindColor[at.kind],
        opacity: spheres === 'contact' ? 0.85 : 1,
      });
    }
    for (const l of geo.labels) {
      v.addLabel(l.text, {
        position: l.pos,
        fontSize: 16,
        fontColor: theme === 'dark' ? '#e6e8f0' : '#141826',
        backgroundOpacity: 0,
        inFront: true,
      });
    }
    v.zoomTo();
    // Vista oblíqua, como nos livros-texto: deixa visíveis as três dimensões da célula.
    if (type === 'HCP') {
      v.rotate(-70, 'x');
      v.rotate(18, 'y');
    } else {
      v.rotate(-22, 'x');
      v.rotate(32, 'y');
    }
    v.zoom(1.05);
    v.render();
  }, [state, type, a, color, theme, spheres, contacts]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      viewer.current?.resize();
      viewer.current?.render();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className={s.cellWrap}>
      <div className={s.cellStage}>
        <div ref={host} className={s.cellCanvas} role="img" aria-label={`Célula unitária ${CELLS[type].namePt}, a = ${a} Å. Arraste para girar.`} />
        {state === 'loading' && <div className={s.cellOverlay}><Spinner label="Carregando visualizador…" /></div>}
        {state === 'error' && <div className={s.cellOverlay}><Notice kind="warn" title="Visualização 3D indisponível">{err}</Notice></div>}
      </div>
      <div className={s.cellTools}>
        <div className="segmented" role="group" aria-label="Tamanho das esferas">
          <button aria-pressed={spheres === 'small'} onClick={() => setSpheres('small')}>Esferas reduzidas</button>
          <button aria-pressed={spheres === 'contact'} onClick={() => setSpheres('contact')}>Esferas em contato</button>
        </div>
        <label className={s.check}>
          <input type="checkbox" checked={contacts} onChange={(e) => setContacts(e.target.checked)} /> Vizinhos mais próximos
        </label>
        <button
          className="btn btn-sm"
          onClick={() => {
            viewer.current?.spin(spinning ? false : 'y', 0.5);
            setSpinning(!spinning);
          }}
        >
          {spinning ? 'Parar' : 'Girar'}
        </button>
      </div>
      <ul className={s.cellLegend}>
        <li><span style={{ background: color }} /> vértices e faces</li>
        {type === 'BCC' && <li><span style={{ background: '#ef5fb6' }} /> centro do corpo</li>}
        {(type === 'DIA' || type === 'HCP') && <li><span style={{ background: '#3ad6e6' }} /> {type === 'DIA' ? 'sítios tetraédricos internos' : 'camada intermediária'}</li>}
        {contacts && <li><span style={{ background: '#8b6cff' }} /> contatos entre vizinhos mais próximos</li>}
      </ul>
    </div>
  );
}
