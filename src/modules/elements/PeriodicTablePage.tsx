import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Elements.module.css';
import { PageHeader } from '../../components/ui';
import { PERIODIC, ElementData, SERIES_COLOR, SERIES_PT, gridPosition, namePt, findElement } from '../../chem/periodic';
import { fmtNum } from '../../utils/format';

type ColorBy = 'series' | 'enPauling' | 'radiusEmpiricalPm' | 'densityGcm3' | 'meltingK' | 'ie1';

const COLOR_BY: { id: ColorBy; label: string; unit: string }[] = [
  { id: 'series', label: 'Categoria', unit: '' },
  { id: 'enPauling', label: 'Eletronegatividade (Pauling)', unit: '' },
  { id: 'radiusEmpiricalPm', label: 'Raio atômico (empírico)', unit: 'pm' },
  { id: 'ie1', label: '1ª energia de ionização', unit: 'eV' },
  { id: 'densityGcm3', label: 'Densidade', unit: 'g/cm³' },
  { id: 'meltingK', label: 'Ponto de fusão', unit: 'K' },
];

const value = (e: ElementData, by: ColorBy): number | null => (by === 'ie1' ? e.ionizationEv[0] ?? null : by === 'series' ? null : (e[by] as number | null));

/** Escala sequencial roxo → ciano (legível nos dois temas). */
function scale(t: number) {
  const a = [111, 78, 242];
  const b = [58, 214, 230];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${c.join(',')})`;
}

export default function PeriodicTablePage() {
  const nav = useNavigate();
  const [by, setBy] = useState<ColorBy>('series');
  const [q, setQ] = useState('');
  const match = q.trim() ? findElement(q) : undefined;

  const range = useMemo(() => {
    if (by === 'series') return null;
    const vals = PERIODIC.map((e) => value(e, by)).filter((x): x is number => x !== null);
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [by]);

  const bg = (e: ElementData) => {
    if (by === 'series') return e.series ? SERIES_COLOR[e.series] : 'var(--ink-3)';
    const v = value(e, by);
    if (v === null || !range) return null;
    return scale((v - range.min) / (range.max - range.min || 1));
  };

  return (
    <div>
      <PageHeader
        title="Periodic Table"
        description="Clique em um elemento para ver propriedades físicas, atômicas, térmicas, mecânicas, nucleares e a célula unitária da estrutura cristalina."
      />
      <div className={s.tableTools}>
        <input
          className="input"
          placeholder="Buscar: Al, alumínio, 13…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && match && nav(`/elements/${match.symbol}`)}
          aria-label="Buscar elemento"
        />
        <label className={s.colorBy}>
          <span className="label">Colorir por</span>
          <select className="select" value={by} onChange={(e) => setBy(e.target.value as ColorBy)}>
            {COLOR_BY.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={s.tableScroll}>
        <div className={s.grid} role="grid" aria-label="Tabela periódica">
          {PERIODIC.map((e) => {
            const pos = gridPosition(e);
            const color = bg(e);
            const v = value(e, by);
            return (
              <button
                key={e.z}
                className={`${s.cell} ${match?.z === e.z ? s.cellMatch : ''} ${color ? '' : s.cellNoData}`}
                style={{ gridRow: pos.row, gridColumn: pos.col, ['--c' as string]: color ?? 'transparent' }}
                onClick={() => nav(`/elements/${e.symbol}`)}
                title={`${namePt(e.z)} (${e.z})${by !== 'series' ? ` — ${v === null ? 'sem dado' : fmtNum(v, 4)}` : ''}`}
              >
                <span className={s.cz}>{e.z}</span>
                <span className={s.cs}>{e.symbol}</span>
                <span className={s.cn}>{namePt(e.z)}</span>
                <span className={s.cw}>{by === 'series' ? (e.atomicWeight ? fmtNum(e.atomicWeight, 5) : '') : v === null ? '—' : fmtNum(v, 3)}</span>
              </button>
            );
          })}
          <div className={s.fBlockLabel} style={{ gridRow: 6, gridColumn: 3 }}>57–71</div>
          <div className={s.fBlockLabel} style={{ gridRow: 7, gridColumn: 3 }}>89–103</div>
        </div>
      </div>

      {by === 'series' ? (
        <ul className={s.legend}>
          {Object.entries(SERIES_PT).map(([k, label]) => (
            <li key={k}>
              <span style={{ background: SERIES_COLOR[k] }} /> {label}
            </li>
          ))}
        </ul>
      ) : (
        range && (
          <div className={s.scaleLegend}>
            <span>{fmtNum(range.min, 3)}</span>
            <div className={s.scaleBar} />
            <span>
              {fmtNum(range.max, 3)} {COLOR_BY.find((c) => c.id === by)!.unit}
            </span>
            <span className="faint">· cinza tracejado = sem dado</span>
          </div>
        )
      )}
    </div>
  );
}
