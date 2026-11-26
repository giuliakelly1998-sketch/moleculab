import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import s from './Elements.module.css';
import { PageHeader } from '../../components/ui';
import { PERIODIC, ElementData, SERIES_COLOR, SERIES_PT, gridPosition, namePt, findElement, toC, EV_TO_KJMOL } from '../../chem/periodic';
import { fmtNum } from '../../utils/format';

/**
 * Propriedades exibíveis na grade. Cada uma define:
 *  - value: número usado na escala de cor (null = sem dado);
 *  - text: o que aparece dentro da célula (curto, sem notação exponencial);
 *  - unit: unidade mostrada no cabeçalho da legenda.
 */
interface NumProp {
  kind: 'num';
  id: string;
  label: string;
  unit: string;
  value: (e: ElementData) => number | null;
  text: (e: ElementData) => string;
  log?: boolean;
  note?: string;
  predictedKey?: string;
}
interface CatProp {
  kind: 'cat';
  id: string;
  label: string;
  cat: (e: ElementData) => string | null;
  colors: Record<string, string>;
  labels: Record<string, string>;
  text: (e: ElementData) => string;
}
type Prop = NumProp | CatProp;

/** Texto curto para caber na célula: até 4 algarismos, sem exponencial. */
function cellNum(v: number, sig = 4): string {
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v).toLocaleString('pt-BR');
  const digits = a >= 100 ? 0 : a >= 10 ? Math.max(0, sig - 2) : a >= 1 ? Math.max(0, sig - 1) : sig;
  return Number(v.toFixed(Math.min(digits, 4))).toLocaleString('pt-BR', { maximumFractionDigits: 4 });
}
const n = (v: number | null | undefined, f: (x: number) => string = cellNum) => (v === null || v === undefined ? '—' : f(v));
const isGas = (e: ElementData) => e.phase === 'gasoso';

const PROPS: Prop[] = [
  {
    kind: 'cat', id: 'series', label: 'Categoria',
    cat: (e) => e.series, colors: SERIES_COLOR, labels: SERIES_PT,
    text: (e) => (e.atomicWeight ? fmtNum(e.atomicWeight, 5) : ''),
  },
  {
    kind: 'cat', id: 'phase', label: 'Estado físico (25 °C)',
    cat: (e) => e.phase,
    colors: { sólido: '#5c9dff', líquido: '#3ad6e6', gasoso: '#f2b84b' },
    labels: { sólido: 'Sólido', líquido: 'Líquido', gasoso: 'Gasoso' },
    text: (e) => e.phase ?? '—',
  },
  {
    kind: 'cat', id: 'block', label: 'Bloco',
    cat: (e) => e.block,
    colors: { s: '#ff6b6b', p: '#ffd43b', d: '#5c9dff', f: '#63e6be' },
    labels: { s: 'Bloco s', p: 'Bloco p', d: 'Bloco d', f: 'Bloco f' },
    text: (e) => `bloco ${e.block}`,
  },
  {
    kind: 'num', id: 'en', label: 'Eletronegatividade', unit: 'Pauling',
    value: (e) => e.enPauling, text: (e) => n(e.enPauling, (x) => x.toFixed(2).replace('.', ',')),
  },
  {
    kind: 'num', id: 'rEmp', label: 'Raio atômico', unit: 'pm',
    value: (e) => e.radiusEmpiricalPm ?? e.radiusCalculatedPm,
    text: (e) => n(e.radiusEmpiricalPm ?? e.radiusCalculatedPm, (x) => String(Math.round(x))),
    note: 'Raio empírico (Slater, 1964); quando ausente, raio calculado.',
  },
  {
    kind: 'num', id: 'rCov', label: 'Raio covalente', unit: 'pm',
    value: (e) => e.radiusCovalentPm, text: (e) => n(e.radiusCovalentPm, (x) => String(Math.round(x))),
    note: 'Pyykkö & Atsumi (2009), ligação simples.',
  },
  {
    kind: 'num', id: 'ie1', label: '1ª energia de ionização', unit: 'kJ/mol',
    value: (e) => (e.ionizationEv[0] === undefined ? null : e.ionizationEv[0] * EV_TO_KJMOL),
    text: (e) => n(e.ionizationEv[0] === undefined ? null : e.ionizationEv[0] * EV_TO_KJMOL, (x) => String(Math.round(x))),
  },
  {
    kind: 'num', id: 'ea', label: 'Afinidade eletrônica', unit: 'kJ/mol',
    value: (e) => (e.electronAffinityEv === null ? null : e.electronAffinityEv * EV_TO_KJMOL),
    text: (e) => n(e.electronAffinityEv === null ? null : e.electronAffinityEv * EV_TO_KJMOL, (x) => String(Math.round(x))),
    note: 'Energia liberada na captura de um elétron (valor positivo = processo exotérmico).',
  },
  {
    kind: 'num', id: 'density', label: 'Densidade', unit: 'g/cm³ (gases em g/L)',
    value: (e) => e.densityGcm3, log: true, predictedKey: 'densityGcm3',
    text: (e) => (e.densityGcm3 === null ? '—' : isGas(e) ? cellNum(e.densityGcm3 * 1000, 3) : cellNum(e.densityGcm3, 3)),
    note: 'Sólidos e líquidos em g/cm³ (20–25 °C). Gases, com o valor sublinhado, em g/L a 25 °C e 1 atm. Escala de cor logarítmica.',
  },
  {
    kind: 'num', id: 'mp', label: 'Ponto de fusão', unit: '°C',
    value: (e) => (e.meltingK === null ? null : toC(e.meltingK)), predictedKey: 'meltingK',
    text: (e) => n(e.meltingK === null ? null : toC(e.meltingK), (x) => String(Math.round(x))),
    note: 'A 1 atm. He não solidifica a 1 atm; C sublima.',
  },
  {
    kind: 'num', id: 'bp', label: 'Ponto de ebulição', unit: '°C',
    value: (e) => (e.boilingK === null ? null : toC(e.boilingK)),
    text: (e) => n(e.boilingK === null ? null : toC(e.boilingK), (x) => String(Math.round(x))),
    note: 'A 1 atm.',
  },
  {
    kind: 'num', id: 'cp', label: 'Calor específico', unit: 'J/(g·K)',
    value: (e) => e.specificHeatJgK, text: (e) => n(e.specificHeatJgK, (x) => cellNum(x, 3)), log: true,
  },
  {
    kind: 'num', id: 'k', label: 'Condutividade térmica', unit: 'W/(m·K)',
    value: (e) => e.thermalConductivityWmK, text: (e) => n(e.thermalConductivityWmK, (x) => cellNum(x, 3)), log: true,
  },
];

/** Escala sequencial roxo → ciano (legível nos dois temas). */
function scale(t: number) {
  const a = [111, 78, 242];
  const b = [58, 214, 230];
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t));
  return `rgb(${c.join(',')})`;
}

export default function PeriodicTablePage() {
  const nav = useNavigate();
  const [pid, setPid] = useState('series');
  const [q, setQ] = useState('');
  const match = q.trim() ? findElement(q) : undefined;
  const prop = PROPS.find((p) => p.id === pid)!;

  const range = useMemo(() => {
    if (prop.kind !== 'num') return null;
    const tf = (x: number) => (prop.log ? Math.log10(x) : x);
    const vals = PERIODIC.map(prop.value).filter((x): x is number => x !== null && (!prop.log || x > 0));
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return { min, max, tmin: tf(min), tmax: tf(max), tf };
  }, [prop]);

  const bg = (e: ElementData): string | null => {
    if (prop.kind === 'cat') {
      const c = prop.cat(e);
      return c ? prop.colors[c] ?? 'var(--ink-3)' : null;
    }
    const v = prop.value(e);
    if (v === null || !range || (prop.log && v <= 0)) return null;
    return scale((range.tf(v) - range.tmin) / (range.tmax - range.tmin || 1));
  };

  const isPredicted = (e: ElementData) => prop.kind === 'num' && !!prop.predictedKey && prop.value(e) !== null && e.predicted?.includes(prop.predictedKey);
  const anyPredicted = PERIODIC.some(isPredicted);

  return (
    <div>
      <PageHeader
        title="Tabela periódica"
        description="Escolha a propriedade que a tabela deve mostrar. Clique em um elemento para ver todas as propriedades, com fontes, e a célula unitária da estrutura cristalina."
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
      </div>
      <div className={s.propChips} role="tablist" aria-label="Propriedade exibida">
        {PROPS.map((p) => (
          <button key={p.id} role="tab" aria-selected={p.id === pid} className={`${s.propChip} ${p.id === pid ? s.propChipOn : ''}`} onClick={() => setPid(p.id)}>
            {p.label}
          </button>
        ))}
      </div>

      <div className={s.propHeader}>
        <strong>{prop.label}</strong>
        {prop.kind === 'num' && <span className={s.propUnit}>{prop.unit}</span>}
        {prop.kind === 'num' && prop.note && <span className="faint">· {prop.note}</span>}
        {prop.kind === 'cat' && prop.id === 'series' && <span className="faint">· número abaixo do nome: massa atômica (u)</span>}
      </div>

      <div className={s.tableScroll}>
        <div className={s.grid} role="grid" aria-label="Tabela periódica">
          {PERIODIC.map((e) => {
            const pos = gridPosition(e);
            const color = bg(e);
            const pred = isPredicted(e);
            const txt = prop.text(e);
            return (
              <button
                key={e.z}
                className={`${s.cell} ${match?.z === e.z ? s.cellMatch : ''} ${color ? '' : s.cellNoData}`}
                style={{ gridRow: pos.row, gridColumn: pos.col, ['--c' as string]: color ?? 'transparent' }}
                onClick={() => nav(`/elements/${e.symbol}`)}
                title={`${namePt(e.z)} (Z = ${e.z}) — ${prop.label}: ${txt}${prop.kind === 'num' && txt !== '—' ? ` ${prop.id === 'density' ? (isGas(e) ? 'g/L (gás, 25 °C, 1 atm)' : 'g/cm³') : prop.unit}` : ''}${pred ? ' (previsão teórica)' : ''}`}
              >
                <span className={s.cz}>{e.z}</span>
                <span className={s.cs}>{e.symbol}</span>
                <span className={s.cn}>{namePt(e.z)}</span>
                <span className={`${s.cw} ${prop.id !== 'series' ? s.cwProp : ''} ${pred ? s.cwPred : ''} ${prop.id === 'density' && isGas(e) ? s.cwGas : ''}`}>
                  {txt}
                  {pred && '*'}
                </span>
              </button>
            );
          })}
          <div className={s.fBlockLabel} style={{ gridRow: 6, gridColumn: 3 }}>57–71</div>
          <div className={s.fBlockLabel} style={{ gridRow: 7, gridColumn: 3 }}>89–103</div>
        </div>
      </div>

      {prop.kind === 'cat' ? (
        <ul className={s.legend}>
          {Object.entries(prop.labels).map(([k, label]) => (
            <li key={k}>
              <span style={{ background: prop.colors[k] }} /> {label}
            </li>
          ))}
        </ul>
      ) : (
        range && (
          <div className={s.scaleLegend}>
            <span>{cellNum(range.min)}</span>
            <div className={s.scaleBar} />
            <span>
              {cellNum(range.max)} {prop.unit.replace(' (gases em g/L)', '')}
            </span>
            <span className="faint">· tracejado = sem dado{anyPredicted ? ' · * = previsão teórica (elementos superpesados, não medido)' : ''}</span>
          </div>
        )
      )}
    </div>
  );
}
