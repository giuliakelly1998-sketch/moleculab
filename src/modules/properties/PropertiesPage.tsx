import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import s from './Properties.module.css';
import { EmptyState, Icon, NatureBadge, Notice, PageHeader, Spinner } from '../../components/ui';
import { useMolecule } from '../../state/MoleculeContext';
import { computedRows, experimentalRows, PROPERTY_INFO, PropertyRow } from '../../chem/propertyCatalog';
import { annotation, compoundUrl } from '../../services/pubchem';
import { toUserMessage } from '../../services/errors';
import { downloadText, moleculeJson, propertiesCsv, reportHtml, safeFilename } from '../../utils/exporters';
import { drawSvg } from '../../chem/analysis';
import { useRDKit } from '../../hooks/useRDKit';

type ExpState = { status: 'loading' | 'ready' | 'error'; rows: PropertyRow[]; error?: string };
const EXP_IDS = PROPERTY_INFO.filter((p) => p.pugViewHeading).map((p) => p.id);

export default function PropertiesPage() {
  const { record: rec, analysis, analysisStatus } = useMolecule();
  const { rdkit } = useRDKit();
  const [exp, setExp] = useState<Record<string, ExpState>>({});

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
        <PageHeader title="Chemical Properties" description="Propriedades físico-químicas com origem e natureza de cada dado." />
        <EmptyState title="Nenhuma molécula selecionada" actions={<Link className="btn btn-primary" to="/explorer">Abrir o Molecular Explorer</Link>}>
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
        title="Chemical Properties"
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

      <div className={s.legend}>
        <span><NatureBadge nature="experimental" /> medido e depositado por fonte identificada</span>
        <span><NatureBadge nature="calculado" /> determinístico a partir da estrutura</span>
        <span><NatureBadge nature="estimado" /> previsão de modelo empírico</span>
        <span><NatureBadge nature="indisponível" /> nenhuma fonte forneceu o valor</span>
      </div>

      {analysisStatus === 'error' && <Notice kind="warn">Descritores do RDKit indisponíveis; exibindo apenas os dados da PubChem.</Notice>}

      <div className={s.grid}>
        {PROPERTY_INFO.map((info) => {
          const expState = info.pugViewHeading ? exp[info.id] : undefined;
          const rows = info.pugViewHeading ? expState?.rows ?? [] : computed.filter((r) => r.propertyId === info.id);
          return (
            <article key={info.id} className={`panel ${s.card}`}>
              <header className={s.cardHead}>
                <h2>{info.name}</h2>
                <span className={s.unit}>{info.unit}</span>
              </header>
              <p className={s.explain}>{info.explanation}</p>
              {expState?.status === 'loading' && <Spinner label="Consultando anotações da PubChem…" />}
              {expState?.status === 'error' && <Notice kind="error">{expState.error}</Notice>}
              {analysisStatus === 'loading' && !info.pugViewHeading && <Spinner label="Calculando com RDKit…" />}
              <ul className={s.values}>
                {rows.map((r, i) => (
                  <li key={i}>
                    <div className={s.valueLine}>
                      <span className={!r.value ? s.na : r.nature === 'experimental' ? s.valueText : s.value}>{r.value ?? 'Indisponível'}</span>
                      <NatureBadge nature={r.nature} />
                    </div>
                    {r.value && (
                      <div className={s.source}>
                        {r.sourceUrl ? (
                          <a href={r.sourceUrl} target="_blank" rel="noreferrer">
                            {r.source} <Icon name="external" size={11} />
                          </a>
                        ) : (
                          r.source
                        )}
                        {r.method && <span> · {r.method}</span>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {info.id === 'dipole' && rows.every((r) => !r.value) && expState?.status === 'ready' && (
                <p className={s.explain} style={{ marginTop: 8 }}>
                  O MOLECULAB não estima momento dipolar: um valor confiável exige medida ou cálculo de estrutura eletrônica.
                </p>
              )}
            </article>
          );
        })}
      </div>
      <p className="faint" style={{ fontSize: 12, marginTop: 20 }}>
        Valores experimentais são reproduzidos como depositados (com condições e unidades originais) e podem divergir entre fontes. Confira sempre a referência original antes de usar em trabalhos acadêmicos.
      </p>
    </div>
  );
}
