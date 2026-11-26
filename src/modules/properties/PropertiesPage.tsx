import { trackEvent } from '../../services/analytics';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './Properties.module.css';
import { EmptyState, Icon, NatureBadge, Notice, PageHeader, Spinner } from '../../components/ui';
import { useMolecule } from '../../state/MoleculeContext';
import { computedRows, experimentalRows, infoById, PROPERTY_INFO, PropertyRow } from '../../chem/propertyCatalog';
import { annotation, compoundUrl } from '../../services/pubchem';
import { toUserMessage } from '../../services/errors';
import { downloadText, moleculeJson, propertiesCsv, reportHtml, safeFilename } from '../../utils/exporters';
import { drawSvg } from '../../chem/analysis';
import { useRDKit } from '../../hooks/useRDKit';

type ExpState = { status: 'loading' | 'ready' | 'error'; rows: PropertyRow[]; error?: string };
const EXP_IDS = PROPERTY_INFO.filter((p) => p.pugViewHeading).map((p) => p.id);
const MAX_ROWS = 3;

/** Organização da página: do que se mede no laboratório para o que se calcula a partir da estrutura. */
const GROUPS = [
  { title: 'Propriedades físicas', subtitle: 'Valores medidos em laboratório, reproduzidos da PubChem com a fonte original de cada um.', ids: ['mp', 'bp', 'solubility', 'dipole'] },
  { title: 'Massa e lipofilicidade', subtitle: 'Calculadas ou estimadas a partir da fórmula e da estrutura.', ids: ['mw', 'logp'] },
  { title: 'Polaridade, superfície e ligações de hidrogênio', subtitle: 'Descritores contados ou calculados no grafo molecular.', ids: ['tpsa', 'asa', 'hbd', 'hba', 'rotb'] },
];
const SUMMARY = [
  { id: 'mw', label: 'Massa molar' },
  { id: 'logp', label: 'LogP' },
  { id: 'tpsa', label: 'TPSA' },
  { id: 'hbd', label: 'Doadores de H' },
  { id: 'hba', label: 'Aceptores de H' },
];

export default function PropertiesPage() {
  useEffect(() => trackEvent('propriedades'), []);
  const { record: rec, analysis, analysisStatus } = useMolecule();
  const { rdkit } = useRDKit();
  const [exp, setExp] = useState<Record<string, ExpState>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});

  // Dados experimentais via PUG View, sob demanda (somente quando este módulo é aberto).
  useEffect(() => {
    if (!rec) return;
    const cid = rec.cid;
    if (!cid) {
      setExp(Object.fromEntries(EXP_IDS.map((id) => [id, { status: 'ready', rows: experimentalRows(id, []) }])));
      return;
    }
    let alive = true;
    setExp(Object.fromEntries(EXP_IDS.map((id) => [id, { status: 'loading', rows: [] }])));
    for (const info of PROPERTY_INFO.filter((p) => p.pugViewHeading)) {
      annotation(cid, info.pugViewHeading!)
        .then((vals) => alive && setExp((e) => ({ ...e, [info.id]: { status: 'ready', rows: experimentalRows(info.id, vals) } })))
        .catch((err) => alive && setExp((e) => ({ ...e, [info.id]: { status: 'error', rows: [], error: toUserMessage(err) } })));
    }
    return () => {
      alive = false;
    };
  }, [rec]);

  const computed = useMemo(() => (rec ? computedRows(rec, analysis?.descriptors ?? null) : []), [rec, analysis]);

  const allRows = useMemo(() => {
    const out: PropertyRow[] = [];
    for (const info of PROPERTY_INFO) {
      if (info.pugViewHeading) out.push(...(exp[info.id]?.rows ?? []));
      else out.push(...computed.filter((r) => r.propertyId === info.id));
    }
    return out;
  }, [computed, exp]);

  if (!rec) {
    return (
      <div>
        <PageHeader title="Propriedades químicas" description="Propriedades físico-químicas com origem e natureza de cada dado." />
        <EmptyState title="Nenhuma molécula selecionada" actions={<Link className="btn btn-primary" to="/explorer">Abrir o Explorador molecular</Link>}>
          Busque uma substância no Explorer; as propriedades aparecem aqui.
        </EmptyState>
      </div>
    );
  }

  const expLoading = Object.values(exp).some((e) => e.status === 'loading');
  const base = safeFilename(rec.title);

  return (
    <div>
      <PageHeader
        title="Propriedades químicas"
        description={
          <>
            {rec.title}
            {rec.formula && <span className="mono faint"> · {rec.formula}</span>}
            {rec.cid && (
              <>
                {' · '}
                <a href={compoundUrl(rec.cid)} target="_blank" rel="noreferrer">
                  PubChem CID {rec.cid} <Icon name="external" size={12} />
                </a>
              </>
            )}
          </>
        }
        actions={
          <>
            <button className="btn btn-sm" onClick={() => downloadText(`${base}_propriedades.csv`, propertiesCsv(rec, allRows), 'text/csv')} disabled={expLoading}>
              <Icon name="download" size={14} /> CSV
            </button>
            <button className="btn btn-sm" onClick={() => downloadText(`${base}.json`, moleculeJson(rec, analysis, allRows), 'application/json')} disabled={expLoading}>
              <Icon name="download" size={14} /> JSON
            </button>
            <button
              className="btn btn-sm btn-primary"
              disabled={expLoading}
              onClick={() => {
                const svg = rdkit ? drawSvg(rdkit, rec, { width: 360, height: 260, darkInk: false }) : null;
                downloadText(`${base}_relatorio.html`, reportHtml(rec, allRows, analysis, svg), 'text/html');
              }}
            >
              <Icon name="download" size={14} /> Relatório
            </button>
          </>
        }
      />

      <div className={s.summary}>
        {SUMMARY.map(({ id, label }) => {
          const r = computed.find((x) => x.propertyId === id && x.value);
          return (
            <div key={id} className={s.sumCard}>
              <span className={s.sumLabel}>{label}</span>
              <strong className={s.sumValue}>{r?.value ?? '—'}</strong>
              <span className={s.sumUnit}>{infoById(id).unit === '—' || infoById(id).unit === 'contagem' ? '' : infoById(id).unit}</span>
            </div>
          );
        })}
      </div>

      <details className={s.legendBox}>
        <summary>O que significa cada selo?</summary>
        <div className={s.legend}>
          <span><NatureBadge nature="experimental" /> medido e depositado por fonte identificada</span>
          <span><NatureBadge nature="calculado" /> determinístico a partir da estrutura</span>
          <span><NatureBadge nature="estimado" /> previsão de modelo empírico</span>
          <span><NatureBadge nature="indisponível" /> nenhuma fonte forneceu o valor</span>
        </div>
      </details>

      {analysisStatus === 'error' && <Notice kind="warn">Descritores do RDKit indisponíveis; exibindo apenas os dados da PubChem.</Notice>}

      {GROUPS.map((g) => (
        <section key={g.title} className={`panel ${s.group}`}>
          <header className={s.groupHead}>
            <h2>{g.title}</h2>
            <p>{g.subtitle}</p>
          </header>
          <table className={s.table}>
            <colgroup>
              <col className={s.c1} />
              <col className={s.c2} />
              <col className={s.c3} />
              <col className={s.c4} />
            </colgroup>
            <thead>
              <tr>
                <th>Propriedade</th>
                <th>Valor</th>
                <th>Natureza</th>
                <th>Fonte e método</th>
              </tr>
            </thead>
            <tbody>
              {g.ids.map((id) => {
                const info = infoById(id);
                const expState = info.pugViewHeading ? exp[id] : undefined;
                const rows = info.pugViewHeading ? expState?.rows ?? [] : computed.filter((r) => r.propertyId === id);
                const loading = expState?.status === 'loading' || (!info.pugViewHeading && analysisStatus === 'loading' && rows.length === 0);
                const isOpen = !!open[id];
                const shown = isOpen ? rows : rows.slice(0, MAX_ROWS);
                const nameCell = (span: number) => (
                  <th scope="row" rowSpan={span} className={s.propCell}>
                    <span className={s.propName}>{info.name}</span>
                    {info.unit !== '—' && info.unit !== 'contagem' && info.unit !== 'conforme a fonte' && <span className={s.unit}>{info.unit}</span>}
                    <details className={s.explain}>
                      <summary>o que é?</summary>
                      <p>{info.explanation}</p>
                      {id === 'dipole' && <p>O MOLECULAB não estima momento dipolar: um valor confiável exige medida ou cálculo de estrutura eletrônica.</p>}
                    </details>
                  </th>
                );
                if (loading || expState?.status === 'error') {
                  return (
                    <tr key={id}>
                      {nameCell(1)}
                      <td colSpan={3}>{loading ? <Spinner label={info.pugViewHeading ? 'Consultando a PubChem…' : 'Calculando com RDKit…'} /> : <span className={s.err}>{expState?.error}</span>}</td>
                    </tr>
                  );
                }
                const extra = rows.length - shown.length;
                return [
                  ...shown.map((r, i) => (
                    <tr key={`${id}-${i}`} className={i === 0 ? s.firstRow : ''}>
                      {i === 0 && nameCell(shown.length + (rows.length > MAX_ROWS ? 1 : 0))}
                      <td className={!r.value ? s.na : r.nature === 'experimental' ? s.valueText : s.value}>{r.value ?? 'indisponível'}</td>
                      <td>
                        <NatureBadge nature={r.nature} />
                      </td>
                      <td className={s.source}>
                        {r.value ? (
                          <>
                            {r.sourceUrl ? (
                              <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                                {r.source} <Icon name="external" size={11} />
                              </a>
                            ) : (
                              r.source
                            )}
                            {r.method && <span className="faint"> · {r.method}</span>}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )),
                  rows.length > MAX_ROWS && (
                    <tr key={`${id}-more`}>
                      <td colSpan={3}>
                        <button className="btn btn-sm btn-ghost" onClick={() => setOpen((o) => ({ ...o, [id]: !isOpen }))}>
                          {isOpen ? 'Mostrar menos' : `Mostrar mais ${extra} ${extra === 1 ? 'valor' : 'valores'}`}
                        </button>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </section>
      ))}

      <p className="faint" style={{ fontSize: 12, marginTop: 20 }}>
        Valores experimentais são reproduzidos como depositados (com condições e unidades originais) e podem divergir entre fontes. Confira sempre a referência original antes de usar em trabalhos acadêmicos.
      </p>
    </div>
  );
}
