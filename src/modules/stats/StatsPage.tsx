import { useEffect, useMemo, useState } from 'react';
import s from './Stats.module.css';
import { Notice, PageHeader, Spinner } from '../../components/ui';
import { fetchPrivateStats, StatsReport } from '../../services/analytics';
import { downloadText } from '../../utils/exporters';

const TOKEN_KEY = 'moleculab.statsToken';
const EVENT_LABEL: Record<string, string> = {
  molecula: 'Moléculas abertas',
  calculo: 'Cálculos feitos',
  elemento: 'Elementos consultados',
  grupos: 'Análises de grupos funcionais',
  propriedades: 'Consultas de propriedades',
  conhecimento: 'Leituras na base de conhecimento',
};
const nf = (n: number) => n.toLocaleString('pt-BR');
const fmtDay = (d: string) => d.split('-').reverse().slice(0, 2).join('/');

/**
 * Painel privado de engajamento (rota #/estatisticas, fora do menu).
 * A senha é a variável STATS_TOKEN definida no Cloudflare; fica só nesta aba (sessionStorage).
 */
export default function StatsPage() {
  const [token, setToken] = useState(() => {
    try {
      return sessionStorage.getItem(TOKEN_KEY) ?? '';
    } catch {
      return '';
    }
  });
  const [input, setInput] = useState('');
  const [data, setData] = useState<StatsReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = (t: string) => {
    setLoading(true);
    setErr(null);
    fetchPrivateStats(t)
      .then((d) => {
        setData(d);
        setToken(t);
        try {
          sessionStorage.setItem(TOKEN_KEY, t);
        } catch {
          /* sem armazenamento de sessão */
        }
      })
      .catch((e: Error) => {
        setErr(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const series = useMemo(() => {
    if (!data) return [];
    const map = new Map(data.daily.map((d) => [d.day, d.n]));
    const nw = new Map(data.newDaily.map((d) => [d.day, d.n]));
    const out: { day: string; n: number; nw: number }[] = [];
    const end = new Date(Date.now() - 3 * 3600_000);
    for (let i = 29; i >= 0; i--) {
      const day = new Date(end.getTime() - i * 86400_000).toISOString().slice(0, 10);
      out.push({ day, n: map.get(day) ?? 0, nw: nw.get(day) ?? 0 });
    }
    return out;
  }, [data]);

  const csv = () => {
    if (!data) return;
    const lines = ['dia,visitantes_unicos_no_dia,novos_visitantes', ...series.map((d) => `${d.day},${d.n},${d.nw}`)];
    downloadText(`moleculab_acessos_${new Date().toISOString().slice(0, 10)}.csv`, lines.join('\n'), 'text/csv');
  };

  return (
    <div className={s.page}>
      <PageHeader title="Estatísticas de acesso" description="Painel privado. Contagem anônima: cada navegador recebe um código aleatório; nenhum dado pessoal é coletado." />

      {!data && (
        <form
          className={`panel ${s.login}`}
          onSubmit={(e) => {
            e.preventDefault();
            if (input.trim()) load(input.trim());
          }}
        >
          <label htmlFor="stats-token" className="label">
            Senha do painel (STATS_TOKEN definido no Cloudflare)
          </label>
          <div className={s.loginRow}>
            <input id="stats-token" className="input" type="password" value={input} onChange={(e) => setInput(e.target.value)} autoComplete="current-password" />
            <button className="btn btn-primary" disabled={loading}>
              Entrar
            </button>
          </div>
          {loading && <Spinner label="Consultando…" />}
          {err && <Notice kind="error">{err}</Notice>}
        </form>
      )}

      {data && (
        <>
          <div className={s.kpis}>
            <Kpi label="Visitantes únicos" value={nf(data.total)} hint="navegadores diferentes desde o início" />
            <Kpi label="Visitas" value={nf(data.visits)} hint="sessões abertas no total" />
            <Kpi label="Voltaram ao site" value={data.total ? `${Math.round((100 * data.returning) / data.total)} %` : '—'} hint={`${nf(data.returning)} visitantes com mais de uma visita`} />
            <Kpi label="Contando desde" value={data.first ? new Date(data.first).toLocaleDateString('pt-BR') : '—'} hint="primeiro acesso registrado" />
          </div>

          <section className={`panel ${s.box}`}>
            <div className={s.boxHead}>
              <h2>Últimos 30 dias</h2>
              <button className="btn btn-sm" onClick={csv}>
                Baixar CSV
              </button>
            </div>
            <Bars data={series} />
            <p className={s.legend}>
              <span className={s.swA} /> visitantes únicos no dia <span className={s.swB} /> novos visitantes
            </p>
          </section>

          <section className={`panel ${s.box}`}>
            <h2>Uso das ferramentas</h2>
            {data.events.length === 0 ? (
              <p className="faint">Ainda sem registros.</p>
            ) : (
              <table className={s.table}>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.name}>
                      <td>{EVENT_LABEL[e.name] ?? e.name}</td>
                      <td className={s.num}>{nf(e.n)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
              Cada tipo de uso é contado no máximo uma vez a cada 30 segundos por navegador.
            </p>
          </section>

          <section className={`panel ${s.box}`}>
            <h2>Para o portfólio</h2>
            <p className={s.quote}>
              “O MOLECULAB já foi acessado por {nf(data.total)} visitantes únicos{data.first ? ` desde ${new Date(data.first).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}` : ''}
              {data.events.find((e) => e.name === 'calculo') ? `, com ${nf(data.events.find((e) => e.name === 'calculo')!.n)} cálculos realizados` : ''}.”
            </p>
            <p className="faint" style={{ fontSize: 12 }}>
              “Visitantes únicos” conta navegadores, não pessoas: quem usa celular e computador conta duas vezes; quem limpa os dados do navegador volta a contar. Gerado em {new Date(data.generatedAt).toLocaleString('pt-BR')}.
            </p>
          </section>

          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              try {
                sessionStorage.removeItem(TOKEN_KEY);
              } catch {
                /* ok */
              }
              setData(null);
              setToken('');
            }}
          >
            Sair do painel
          </button>
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={`panel ${s.kpi}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

function Bars({ data }: { data: { day: string; n: number; nw: number }[] }) {
  const W = 720, H = 200, pad = 26;
  const max = Math.max(1, ...data.map((d) => d.n));
  const bw = (W - pad) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className={s.chart} role="img" aria-label="Visitantes únicos por dia nos últimos 30 dias">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={pad} x2={W} y1={H - f * (H - 10)} y2={H - f * (H - 10)} className={s.grid} />
          <text x={pad - 6} y={H - f * (H - 10) + 4} textAnchor="end" className={s.axis}>
            {Math.round(f * max)}
          </text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = (d.n / max) * (H - 10);
        const hn = (d.nw / max) * (H - 10);
        const x = pad + i * bw + 2;
        return (
          <g key={d.day}>
            <title>{`${fmtDay(d.day)}: ${d.n} visitantes (${d.nw} novos)`}</title>
            <rect x={x} y={H - h} width={bw - 4} height={h} rx={2} className={s.barA} />
            <rect x={x + (bw - 4) * 0.25} y={H - hn} width={(bw - 4) * 0.5} height={hn} rx={1.5} className={s.barB} />
            {i % 5 === 0 && (
              <text x={x + (bw - 4) / 2} y={H + 16} textAnchor="middle" className={s.axis}>
                {fmtDay(d.day)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
