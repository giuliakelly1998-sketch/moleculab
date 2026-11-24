import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import s from './Explorer.module.css';
import { SearchBar } from '../../components/SearchBar';
import { Structure2D } from '../../components/Structure2D';
import { CopyRow, EmptyState, Icon, KeyValue, Notice, PageHeader, Spinner, toast } from '../../components/ui';
import { useMolecule } from '../../state/MoleculeContext';
import { useAppData, ViewerStyle } from '../../state/AppDataContext';
import type { SelectedAtom, AngleSpec } from './Viewer3D';
import { fmtNum } from '../../utils/format';
import { compoundUrl } from '../../services/pubchem';
import { downloadText, moleculeJson, safeFilename } from '../../utils/exporters';
import { QUERY_TYPE_LABELS, QueryMode } from '../../chem/queryDetect';
import { CandidateList } from './CandidateList';

const Viewer3D = lazy(() => import('./Viewer3D'));

const STYLES: { id: ViewerStyle; label: string }[] = [
  { id: 'ballstick', label: 'Ball-and-stick' },
  { id: 'stick', label: 'Stick' },
  { id: 'sphere', label: 'Space-filling' },
];

const ORIGIN_LABEL = {
  'pubchem-3d': 'Conformação 3D calculada pela PubChem',
  'pubchem-2d': 'Coordenadas 2D da PubChem (sem conformação 3D disponível)',
  'rdkit-2d': 'Coordenadas 2D geradas pelo RDKit',
} as const;

export default function ExplorerPage() {
  const m = useMolecule();
  const { settings, updateSettings, isFavorite, toggleFavorite } = useAppData();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<'3d' | '2d'>('3d');
  const [selectedAtom, setSelectedAtomState] = useState<SelectedAtom | null>(null);
  const [angle, setAngle] = useState<AngleSpec | null>(null);
  // Ao selecionar um átomo, o primeiro ângulo com vértice nele já aparece desenhado.
  const setSelectedAtom = (a: SelectedAtom | null) => {
    setSelectedAtomState(a);
    const g = a?.angles[0];
    setAngle(a && g ? { vertex: a.index, a: g.aIndex, b: g.bIndex } : null);
  };
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const rec = m.record;

  // Busca a partir da URL (#/explorer?q=...&mode=...), útil para links compartilháveis.
  useEffect(() => {
    const q = params.get('q');
    const mode = (params.get('mode') as QueryMode) ?? 'auto';
    if (q && q !== m.lastQuery?.text) m.search(q, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useEffect(() => {
    setActiveGroup(null);
    setSelectedAtom(null);
    const has3d = rec?.structure?.dim === '3d';
    setView(has3d ? '3d' : '2d');
  }, [rec?.key]);

  const group = m.analysis?.groups.find((g) => g.id === activeGroup);
  const highlight3D = useMemo(
    () => (group && m.analysis?.indicesAlignedWithStructure ? group.atoms : undefined),
    [group, m.analysis?.indicesAlignedWithStructure],
  );

  const onSearch = (text: string, mode: QueryMode) => {
    // Mesma URL (ex.: repetir após erro de rede): busca direto, pois os parâmetros não mudam.
    if (params.get('q') === text && (params.get('mode') ?? 'auto') === mode) m.search(text, mode);
    else setParams(mode === 'auto' ? { q: text } : { q: text, mode });
  };

  const fav = rec ? isFavorite(rec.key) : false;

  return (
    <div>
      <PageHeader title="Molecular Explorer" description="Busque uma substância e explore a estrutura em 2D e 3D, com identificação de átomos, ligações e grupos funcionais." />
      <SearchBar initial={m.lastQuery?.text ?? ''} initialMode={m.lastQuery?.mode} busy={m.status === 'loading'} onSearch={onSearch} />

      <div style={{ marginTop: 16 }}>
        {m.status === 'loading' && <Spinner label="Consultando a PubChem…" />}
        {m.status === 'error' && m.error && (
          <Notice kind="error" title="Não foi possível concluir a busca">
            {m.error}
            {m.errorSuggestions.length > 0 && (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {m.errorSuggestions.map((sug) => (
                  <button key={sug} className="btn btn-sm" onClick={() => onSearch(sug, 'name')}>
                    {sug}
                  </button>
                ))}
              </span>
            )}
          </Notice>
        )}
        {m.note && m.status !== 'loading' && <Notice kind="info">{m.note}</Notice>}
      </div>

      {m.candidates && m.status !== 'loading' && (
        <CandidateList candidates={m.candidates} onPick={(c) => m.openCid(c.cid, c.title)} interpretedAs={m.interpretedAs} />
      )}

      {!rec && !m.candidates && m.status !== 'loading' && (
        <div style={{ marginTop: 24 }}>
          <EmptyState
            title="Nenhuma molécula carregada"
            actions={['caffeine', 'aspirin', 'C6H12O6', 'CC(=O)Nc1ccc(O)cc1', '50-00-0'].map((q) => (
              <button key={q} className="btn btn-sm" onClick={() => onSearch(q, 'auto')}>
                {q}
              </button>
            ))}
          >
            Experimente um nome em inglês, uma fórmula, um SMILES, um CID ou um número CAS.
          </EmptyState>
        </div>
      )}

      {rec && !m.candidates && m.status !== 'error' && m.status !== 'loading' && (
        <div className={s.layout}>
          <section className={`panel ${s.viewerPanel}`} aria-label="Visualização da estrutura">
            <div className={s.toolbar}>
              <div className="segmented" role="group" aria-label="Dimensão">
                <button aria-pressed={view === '3d'} onClick={() => setView('3d')} disabled={!rec.structure}>
                  3D
                </button>
                <button aria-pressed={view === '2d'} onClick={() => setView('2d')}>
                  2D
                </button>
              </div>
              {view === '3d' && (
                <>
                  <div className="segmented" role="group" aria-label="Representação">
                    {STYLES.map((st) => (
                      <button key={st.id} aria-pressed={settings.viewerStyle === st.id} onClick={() => updateSettings({ viewerStyle: st.id })}>
                        {st.label}
                      </button>
                    ))}
                  </div>
                  <label className={s.check}>
                    <input type="checkbox" checked={settings.showHydrogens} onChange={(e) => updateSettings({ showHydrogens: e.target.checked })} />
                    Hidrogênios
                  </label>
                </>
              )}
            </div>

            <div className={s.stage}>
              {view === '3d' && rec.structure ? (
                <Suspense fallback={<Spinner label="Carregando 3Dmol.js…" />}>
                  <Viewer3D
                    molblock={rec.structure.molblock}
                    style={settings.viewerStyle}
                    showHydrogens={settings.showHydrogens}
                    highlightAtoms={highlight3D}
                    highlightColor={group?.color}
                    onSelectAtom={setSelectedAtom}
                    theme={settings.theme}
                    title={rec.title}
                    angle={angle}
                  />
                </Suspense>
              ) : (
                <div className={s.stage2d}>
                  <Structure2D record={rec} highlightAtoms={group?.atoms} highlightBonds={group?.bonds} highlightColor={group?.color} />
                </div>
              )}
            </div>

            <div className={s.stageFoot}>
              {rec.structure ? ORIGIN_LABEL[rec.structure.origin] : 'Sem arquivo de estrutura; desenho 2D gerado a partir do SMILES.'}
              {view === '3d' && rec.structure?.dim === '2d' && ' — exibida em plano; não é uma geometria otimizada.'}
              {view === '3d' && <span className="faint"> · Clique em um átomo para inspecioná-lo.</span>}
            </div>

            {view === '3d' && selectedAtom && (
              <AtomCard atom={selectedAtom} is3D={rec.structure?.dim === '3d'} angle={angle} onAngle={setAngle} onClose={() => setSelectedAtom(null)} />
            )}

            <div className={s.groups}>
              <div className={s.groupsHead}>
                <h2>Grupos funcionais</h2>
                <Link to="/functional-groups" className="faint" style={{ fontSize: 13 }}>
                  Detalhes <Icon name="arrow" size={12} />
                </Link>
              </div>
              {m.analysisStatus === 'loading' && <Spinner label="Analisando estrutura com RDKit…" />}
              {m.analysisStatus === 'error' && <Notice kind="warn">{m.analysisError}</Notice>}
              {m.analysis && m.analysis.groups.length === 0 && <p className="faint">Nenhum dos 15 grupos da biblioteca foi reconhecido nesta estrutura.</p>}
              {m.analysis && m.analysis.groups.length > 0 && (
                <div className={s.chips}>
                  {m.analysis.groups.map((g) => (
                    <button
                      key={g.id}
                      className={s.chip}
                      aria-pressed={activeGroup === g.id}
                      style={{ ['--chip' as string]: g.color }}
                      onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
                    >
                      <span className={s.dot} />
                      {g.name}
                      <span className={s.chipCount}>×{g.count}</span>
                    </button>
                  ))}
                </div>
              )}
              {group && view === '3d' && !m.analysis?.indicesAlignedWithStructure && (
                <p className="faint" style={{ fontSize: 13, marginTop: 8 }}>O destaque está disponível na visualização 2D para esta estrutura.</p>
              )}
            </div>
          </section>

          <aside className={`panel ${s.info}`} aria-label="Informações da molécula">
            <div className={s.infoHead}>
              <div>
                <h2 className={s.title}>{rec.title}</h2>
                {rec.iupacName && rec.iupacName.toLowerCase() !== rec.title.toLowerCase() && <p className={s.iupac}>{rec.iupacName}</p>}
              </div>
              <button
                className={`btn btn-sm ${fav ? '' : 'btn-ghost'}`}
                onClick={() => {
                  toggleFavorite({ key: rec.key, cid: rec.cid, title: rec.title, formula: rec.formula, smiles: rec.smiles });
                  toast(fav ? 'Removida dos favoritos' : 'Adicionada aos favoritos');
                }}
                aria-pressed={fav}
                title={fav ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
              >
                <Icon name="star" filled={fav} size={15} />
              </button>
            </div>
            <KeyValue
              items={[
                ['Fórmula molecular', rec.formula ? <CopyRow value={rec.formula} what="Fórmula" /> : null],
                ['Massa molar', rec.molecularWeight !== undefined ? `${fmtNum(rec.molecularWeight, 6)} g/mol` : null],
                ['Átomos', rec.structure ? `${rec.structure.atomCount} (incl. H) · ${m.analysis?.heavyAtomCount ?? rec.pubchem?.heavyAtoms ?? '—'} pesados` : null],
                ['Ligações', rec.structure ? `${rec.structure.bondCount} (incl. H)` : null],
                ['SMILES', <CopyRow key="smi" value={rec.smiles} what="SMILES" />],
                ['InChI', rec.inchi ? <CopyRow value={rec.inchi} what="InChI" /> : null],
                ['InChIKey', rec.inchiKey ? <span className="mono">{rec.inchiKey}</span> : null],
                ['PubChem CID', rec.cid ? <a href={compoundUrl(rec.cid)} target="_blank" rel="noreferrer">{rec.cid} <Icon name="external" size={12} /></a> : null],
              ]}
            />
            <p className={s.provenance}>
              {rec.source === 'pubchem' ? (
                <>Fonte: PubChem (NCBI), consultado em {new Date(rec.retrievedAt).toLocaleString('pt-BR')}. Massa molar e identificadores calculados pela PubChem.</>
              ) : (
                <>Fonte: cálculo local com RDKit a partir do SMILES informado{rec.inchiOrigin === 'rdkit' ? '; InChI e InChIKey gerados pelo RDKit' : ''}.</>
              )}
              {m.interpretedAs && <> Consulta interpretada como {QUERY_TYPE_LABELS[m.interpretedAs]}.</>}
            </p>
            <div className={s.infoActions}>
              <Link className="btn btn-sm" to="/properties">
                Propriedades
              </Link>
              <button className="btn btn-sm" onClick={() => downloadText(`${safeFilename(rec.title)}.json`, moleculeJson(rec, m.analysis), 'application/json')}>
                <Icon name="download" size={14} /> JSON
              </button>
              {rec.structure && (
                <button className="btn btn-sm" onClick={() => downloadText(`${safeFilename(rec.title)}.sdf`, rec.structure!.molblock + '\n$$$$\n', 'chemical/x-mdl-sdfile')}>
                  <Icon name="download" size={14} /> SDF
                </button>
              )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function AtomCard({ atom, is3D, angle, onAngle, onClose }: { atom: SelectedAtom; is3D: boolean; angle: AngleSpec | null; onAngle: (a: AngleSpec | null) => void; onClose: () => void }) {
  return (
    <div className={s.atomCard} aria-live="polite">
      <div className={s.atomHead}>
        <span className={s.atomSymbol}>{atom.symbol}</span>
        <div>
          <strong>
            {atom.name} · átomo {atom.index + 1}
          </strong>
          <div className="faint mono" style={{ fontSize: 12 }}>
            x {atom.coords[0].toFixed(3)} · y {atom.coords[1].toFixed(3)} · z {atom.coords[2].toFixed(3)} Å
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
          <Icon name="close" size={14} />
        </button>
      </div>
      {atom.neighbors.length > 0 ? (
        <ul className={s.bondList}>
          {atom.neighbors.map((n) => (
            <li key={n.index}>
              {atom.symbol}
              {atom.index + 1}–{n.symbol}
              {n.index + 1}
              <span>ligação {n.order}</span>
              <span className="mono">{Number.isFinite(n.distance) ? `${n.distance.toFixed(3)} Å` : ''}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="faint">Sem ligações registradas.</p>
      )}
      <h3 className={s.atomSub}>Ângulos de ligação com vértice em {atom.symbol}{atom.index + 1}</h3>
      {atom.angles.length === 0 ? (
        <p className="faint" style={{ fontSize: 13 }}>Este átomo tem só {atom.neighbors.length === 1 ? 'uma ligação' : 'nenhuma ligação'}, então não forma ângulo. Selecione um átomo com dois ou mais vizinhos (ex.: um carbono).</p>
      ) : (
        <>
          <p className="faint" style={{ fontSize: 12, margin: '4px 0 0' }}>Clique em um ângulo para desenhá-lo na molécula.</p>
          <ul className={s.angleList}>
            {atom.angles.map((g) => {
              const on = angle?.vertex === atom.index && angle.a === g.aIndex && angle.b === g.bIndex;
              return (
                <li key={g.a + g.b}>
                  <button aria-pressed={on} onClick={() => onAngle(on ? null : { vertex: atom.index, a: g.aIndex, b: g.bIndex })}>
                    <span className="mono">
                      {g.a}–{atom.symbol}
                      {atom.index + 1}–{g.b}
                    </span>
                    <span className={s.angleVal}>{Number.isFinite(g.degrees) ? `${g.degrees.toFixed(1).replace('.', ',')}°` : '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className="faint" style={{ fontSize: 12, marginTop: 6 }}>
        {is3D
          ? 'Distâncias e ângulos medidos na conformação 3D calculada pela PubChem (geometria teórica, não medida experimentalmente). Referências: carbono sp³ ≈ 109,5°, sp² ≈ 120°, sp = 180°.'
          : 'Atenção: esta estrutura só tem coordenadas 2D (plana). Distâncias e ângulos aqui não representam a geometria real da molécula.'}
      </p>
    </div>
  );
}
