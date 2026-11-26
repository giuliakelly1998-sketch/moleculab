import { Tex } from '../../components/Tex';
import { trackEvent } from '../../services/analytics';
import { useMemo, useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import s from './Knowledge.module.css';
import { AREA_LABELS, Area, TOPICS } from '../../data/knowledge';
import { REFS } from '../../data/references';
import { Icon, PageHeader } from '../../components/ui';

const AREAS = Object.keys(AREA_LABELS) as Area[];
const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export default function KnowledgePage() {
  useEffect(() => trackEvent('conhecimento'), []);
  const { topicId } = useParams();
  const [area, setArea] = useState<Area | 'all'>('all');
  const [q, setQ] = useState('');

  const list = useMemo(
    () =>
      TOPICS.filter((t) => (area === 'all' || t.area === area) && (!q.trim() || norm([t.title, t.definition, ...t.theory].join(' ')).includes(norm(q)))),
    [area, q],
  );
  const topic = TOPICS.find((t) => t.id === topicId);

  if (topic) {
    return (
      <article className={s.article}>
        <Link to="/knowledge" className={s.back}>
          ← Base de conhecimento
        </Link>
        <p className={s.area}>{AREA_LABELS[topic.area]}</p>
        <h1>{topic.title}</h1>
        <section>
          <h2>Definição</h2>
          <p className={s.lead}>{topic.definition}</p>
        </section>
        <section>
          <h2>Fundamentação teórica</h2>
          {topic.theory.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </section>
        <section>
          <h2>Equações relevantes</h2>
          <div className={s.eqs}>
            {topic.equations.map((e) => (
              <div key={e.expr} className={s.eq}>
                {e.tex ? <Tex className={s.eqTex} tex={e.tex} /> : <code title="Padrão SMARTS (linguagem de busca de subestruturas)">{e.expr}</code>}
                <span>{e.meaning}</span>
              </div>
            ))}
          </div>
        </section>
        <div className={s.twoCol}>
          <section>
            <h2>Exemplos</h2>
            <ul>
              {topic.examples.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
          <section>
            <h2>Aplicações</h2>
            <ul>
              {topic.applications.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </section>
        </div>
        {topic.tool && (
          <Link to={topic.tool.to} className="btn" style={{ marginTop: 8 }}>
            {topic.tool.label} <Icon name="arrow" size={14} />
          </Link>
        )}
        <section className={s.refs}>
          <h2>Referências</h2>
          <ol>
            {topic.refs.map((r) => {
              const ref = REFS[r];
              return (
                <li key={r}>
                  {ref.text}{' '}
                  {ref.url && (
                    <a href={ref.url} target="_blank" rel="noreferrer">
                      {ref.url.replace(/^https?:\/\//, '')}
                    </a>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      </article>
    );
  }

  return (
    <div>
      <PageHeader title="Base de conhecimento" description="Conteúdos de referência com definição, fundamentação, equações, exemplos e bibliografia verificável." />
      <div className={s.filters}>
        <div className="segmented" role="group" aria-label="Área">
          <button aria-pressed={area === 'all'} onClick={() => setArea('all')}>
            Todas
          </button>
          {AREAS.map((a) => (
            <button key={a} aria-pressed={area === a} onClick={() => setArea(a)}>
              {AREA_LABELS[a]}
            </button>
          ))}
        </div>
        <input className="input" placeholder="Filtrar por termo" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar tópicos" />
      </div>
      {list.length === 0 && <p className="faint">Nenhum tópico corresponde ao filtro.</p>}
      <div className={s.grid}>
        {list.map((t) => (
          <Link key={t.id} to={`/knowledge/${t.id}`} className={`panel ${s.item}`}>
            <span className={s.area}>{AREA_LABELS[t.area]}</span>
            <h2>{t.title}</h2>
            <p>{t.definition}</p>
            <span className={s.eqPreview}>{t.equations[0]?.tex ? <Tex tex={t.equations[0].tex} /> : <code>{t.equations[0]?.expr}</code>}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
