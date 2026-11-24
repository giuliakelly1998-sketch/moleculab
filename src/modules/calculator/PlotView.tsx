import { useEffect, useRef, useState } from 'react';
import type { PlotSpec } from '../../calc/calculators';
import { useAppData } from '../../state/AppDataContext';
import { Notice } from '../../components/ui';

/** Gráfico científico com Plotly.js (carregado sob demanda). */
export default function PlotView({ spec }: { spec: PlotSpec }) {
  const ref = useRef<HTMLDivElement>(null);
  const { settings } = useAppData();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const el = ref.current;
    (async () => {
      try {
        const mod = await import('plotly.js-basic-dist-min');
        const Plotly = (mod as { default?: unknown }).default ?? mod;
        if (!alive || !el) return;
        const dark = settings.theme === 'dark';
        const ink = dark ? '#a9afc2' : '#4a5168';
        const grid = dark ? '#252c3d' : '#dde1eb';
        const colors = ['#8b6cff', '#3ad6e6', '#ef5fb6'];
        const P = Plotly as { react: (el: HTMLElement, data: object[], layout: object, cfg: object) => Promise<void> };
        await P.react(
          el,
          spec.series.map((sr, i) => ({
            x: sr.x,
            y: sr.y,
            name: sr.name,
            type: 'scatter',
            mode: sr.mode ?? 'lines',
            line: { color: colors[i % 3], width: 2 },
            marker: { color: colors[(i + (sr.mode === 'markers' ? 2 : 0)) % 3], size: 9 },
          })),
          {
            title: { text: spec.title, font: { size: 14, color: dark ? '#e6e8f0' : '#141826' } },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: { family: 'IBM Plex Sans, system-ui, sans-serif', color: ink, size: 12 },
            margin: { l: 64, r: 16, t: 44, b: 52 },
            xaxis: { title: { text: spec.xLabel }, gridcolor: grid, zerolinecolor: grid, exponentformat: 'power' },
            yaxis: { title: { text: spec.yLabel }, gridcolor: grid, zerolinecolor: grid, exponentformat: 'power' },
            showlegend: spec.series.length > 1,
            legend: { orientation: 'h', y: -0.25 },
            autosize: true,
          },
          { responsive: true, displaylogo: false, modeBarButtonsToRemove: ['lasso2d', 'select2d'] },
        );
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [spec, settings.theme]);

  if (err) return <Notice kind="warn" title="Gráfico indisponível">{err}</Notice>;
  return <div ref={ref} style={{ width: '100%', height: 320, marginTop: 16 }} />;
}
