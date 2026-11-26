import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import s from './Overview.module.css';
import { SearchBar } from '../../components/SearchBar';
import { Logo } from '../../components/layout/Shell';
import { Icon } from '../../components/ui';
import { useAppData } from '../../state/AppDataContext';
import { useRDKit } from '../../hooks/useRDKit';
import { svgFromSmiles } from '../../chem/analysis';
import { ping } from '../../services/pubchem';
import type { QueryMode } from '../../chem/queryDetect';

/** Estruturas de destaque: o desenho é gerado localmente a partir do SMILES; os dados vêm da PubChem ao abrir. */
const FEATURED = [
  { name: 'Cafeína', query: 'caffeine', smiles: 'Cn1c(=O)c2c(ncn2C)n(C)c1=O' },
  { name: 'Ácido acetilsalicílico', query: 'aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O' },
  { name: 'Paracetamol', query: 'acetaminophen', smiles: 'CC(=O)Nc1ccc(O)cc1' },
  { name: 'Serotonina', query: 'serotonin', smiles: 'NCCc1c[nH]c2ccc(O)cc12' },
  { name: 'Dopamina', query: 'dopamine', smiles: 'NCCc1ccc(O)c(O)c1' },
  { name: 'D-Glicose', query: 'glucose', smiles: 'C([C@@H]1[C@H]([C@@H]([C@H](C(O1)O)O)O)O)O' },
];

const MODULES = [
  { to: '/explorer', icon: 'explorer', title: 'Explorador molecular', text: 'Busca na PubChem e visualização 2D/3D interativa.' },
  { to: '/properties', icon: 'properties', title: 'Propriedades químicas', text: 'Propriedades com fonte e natureza do dado.' },
  { to: '/functional-groups', icon: 'groups', title: 'Grupos funcionais', text: '15 grupos reconhecidos por SMARTS no RDKit.' },
  { to: '/calculator', icon: 'calculator', title: 'Calculadora química', text: '18 calculadoras com verificação dimensional.' },
  { to: '/elements', icon: 'table', title: 'Tabela periódica', text: '118 elementos com propriedades e célula unitária 3D.' },
  { to: '/knowledge', icon: 'knowledge', title: 'Base de conhecimento', text: 'Conteúdos com equações e referências.' },
];

type PingState = { status: 'checking' | 'ok' | 'down'; ms?: number; message?: string };

export default function OverviewPage() {
  const nav = useNavigate();
  const { history, storageAvailable, settings } = useAppData();
  const { rdkit, status: rdkitStatus } = useRDKit();
  const [pc, setPc] = useState<PingState>({ status: 'checking' });

  const check = () => {
    setPc({ status: 'checking' });
    ping().then((r) => setPc({ status: r.ok ? 'ok' : 'down', ms: r.ms, message: r.message }));
  };
  useEffect(check, []);

  const go = (text: string, mode: QueryMode = 'auto') => nav(`/explorer?q=${encodeURIComponent(text)}${mode !== 'auto' ? `&mode=${mode}` : ''}`);

  return (
    <div className={s.page}>
      <section className={s.hero}>
        <div className={s.heroText}>
          <div className={s.brandLine}>
            <Logo size={40} />
            <div>
              <h1>MOLECULAB</h1>
              <p className={s.byte}>THE BYTE LAB</p>
            </div>
          </div>
          <p className={s.slogan}>Explore a Química em escala molecular.</p>
          <p className={s.lede}>Estruturas, propriedades, grupos funcionais e cálculos químicos em um só lugar, com a origem de cada dado sempre visível.</p>
          <div className={s.search}>
            <SearchBar size="lg" onSearch={go} />
          </div>
        </div>
      </section>

      <div className={s.cols}>
        <section>
          <h2 className={s.h2}>Moléculas em destaque</h2>
          <div className={s.featured}>
            {FEATURED.map((f) => (
              <button key={f.query} className={`panel ${s.mol}`} onClick={() => go(f.query, 'name')}>
                <div className={`svg-host ${s.molSvg}`} dangerouslySetInnerHTML={{ __html: rdkit ? svgFromSmiles(rdkit, f.smiles, 200, 130, settings.theme === 'dark') ?? '' : '' }} />
                <span>{f.name}</span>
              </button>
            ))}
          </div>

          <h2 className={s.h2}>Módulos</h2>
          <div className={s.modules}>
            {MODULES.map((m) => (
              <Link key={m.to} to={m.to} className={`panel ${s.module}`}>
                <Icon name={m.icon} size={20} />
                <div>
                  <strong>{m.title}</strong>
                  <p>{m.text}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <aside className={s.side}>
          <section className={`panel ${s.box}`}>
            <h2 className={s.h3}>Serviços</h2>
            <ul className={s.status}>
              <li>
                <Dot ok={pc.status === 'ok' ? true : pc.status === 'down' ? false : undefined} />
                <span>PubChem PUG REST</span>
                <span className="faint mono">{pc.status === 'checking' ? 'verificando…' : pc.status === 'ok' ? `${pc.ms} ms` : 'indisponível'}</span>
              </li>
              <li>
                <Dot ok={rdkitStatus === 'ready' ? true : rdkitStatus === 'error' ? false : undefined} />
                <span>RDKit (WebAssembly)</span>
                <span className="faint mono">{rdkitStatus === 'ready' ? 'pronto' : rdkitStatus === 'error' ? 'falhou' : 'carregando…'}</span>
              </li>
              <li>
                <Dot ok />
                <span>3Dmol.js · Plotly.js</span>
                <span className="faint mono">sob demanda</span>
              </li>
              <li>
                <Dot ok={storageAvailable} />
                <span>Armazenamento local</span>
                <span className="faint mono">{storageAvailable ? 'ativo' : 'bloqueado'}</span>
              </li>
            </ul>
            {pc.status === 'down' && (
              <p className="faint" style={{ fontSize: 12, marginTop: 8 }}>
                Sem acesso à PubChem ({pc.message}). Calculadoras, análise de SMILES e a base de conhecimento continuam funcionando offline.{' '}
                <button className="btn btn-sm btn-ghost" onClick={check}>
                  Tentar de novo
                </button>
              </p>
            )}
          </section>

          <section className={`panel ${s.box}`}>
            <h2 className={s.h3}>Últimas pesquisas</h2>
            {history.length === 0 ? (
              <p className="faint" style={{ fontSize: 14 }}>Suas pesquisas aparecerão aqui.</p>
            ) : (
              <ul className={s.recent}>
                {history.slice(0, 6).map((h) => (
                  <li key={h.at}>
                    <button onClick={() => go(h.text, h.mode as QueryMode)}>
                      <span>{h.title ?? h.text}</span>
                      <span className="faint mono">{new Date(h.at).toLocaleDateString('pt-BR')}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {history.length > 0 && (
              <Link to="/favorites" style={{ fontSize: 13 }}>
                Ver histórico completo
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Dot({ ok }: { ok?: boolean }) {
  const color = ok === undefined ? 'var(--warning)' : ok ? 'var(--success)' : 'var(--danger)';
  return <span aria-hidden style={{ width: 8, height: 8, borderRadius: '50%', background: color, flex: 'none', boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 20%, transparent)` }} />;
}
