import { trackEvent } from '../../services/analytics';
import { FormEvent, useMemo, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import s from './FunctionalGroups.module.css';
import { PageHeader, Notice, Spinner, Icon } from '../../components/ui';
import { Structure2D } from '../../components/Structure2D';
import { FUNCTIONAL_GROUPS, getGroupDef, GroupMatch } from '../../chem/functionalGroups';
import { analyze, svgFromSmiles } from '../../chem/analysis';
import { useMolecule } from '../../state/MoleculeContext';
import { useRDKit } from '../../hooks/useRDKit';
import { useAppData } from '../../state/AppDataContext';
import type { MoleculeRecord } from '../../chem/molecule';
import { sanitizeSmiles } from '../../services/rdkit';
import { toUserMessage } from '../../services/errors';

export default function FunctionalGroupsPage() {
  useEffect(() => trackEvent('grupos'), []);
  const m = useMolecule();
  const { rdkit, status } = useRDKit();
  const { settings } = useAppData();
  const nav = useNavigate();
  const [selected, setSelected] = useState<string>(FUNCTIONAL_GROUPS[0].id);
  const [smilesInput, setSmilesInput] = useState('');
  const [testRec, setTestRec] = useState<MoleculeRecord | null>(null);
  const [testError, setTestError] = useState<string | null>(null);
  const [hlGroup, setHlGroup] = useState<string | null>(null);

  const subject = testRec ?? m.record;
  const groups: GroupMatch[] | null = useMemo(() => {
    if (!subject) return null;
    if (subject === m.record) return m.analysis?.groups ?? null;
    if (!rdkit) return null;
    return analyze(rdkit, subject)?.groups ?? null;
  }, [subject, m.record, m.analysis, rdkit]);

  const runTest = (e: FormEvent) => {
    e.preventDefault();
    setTestError(null);
    if (!rdkit) return;
    try {
      const canonical = sanitizeSmiles(rdkit, smilesInput);
      setTestRec({ key: `test:${canonical}`, source: 'rdkit-local', title: canonical, smiles: canonical, query: { text: smilesInput, type: 'smiles' }, retrievedAt: new Date().toISOString() });
      setHlGroup(null);
    } catch (err) {
      setTestError(toUserMessage(err));
    }
  };

  const def = getGroupDef(selected)!;
  const hl = groups?.find((g) => g.id === hlGroup);

  return (
    <div>
      <PageHeader
        title="Grupos funcionais"
        description="Reconhecimento estrutural por padrões SMARTS executados no RDKit. A classificação usa a conectividade dos átomos, nunca o nome da substância."
      />

      <section className={`panel ${s.analyzer}`}>
        <div className={s.analyzerHead}>
          <div>
            <h2>Análise da estrutura</h2>
            <p className="faint" style={{ fontSize: 13 }}>
              {testRec ? 'SMILES de teste (processado localmente).' : m.record ? `Molécula atual: ${m.record.title}` : 'Nenhuma molécula carregada: teste um SMILES abaixo ou use o Explorer.'}
            </p>
          </div>
          <form onSubmit={runTest} className={s.testForm}>
            <input className="input mono" value={smilesInput} onChange={(e) => setSmilesInput(e.target.value)} placeholder="SMILES, ex.: CC(=O)Oc1ccccc1C(=O)O" aria-label="SMILES para análise" maxLength={1000} spellCheck={false} />
            <button className="btn" type="submit" disabled={!rdkit || !smilesInput.trim()}>
              Analisar
            </button>
            {testRec && (
              <button className="btn btn-ghost" type="button" onClick={() => { setTestRec(null); setSmilesInput(''); setHlGroup(null); }}>
                Limpar
              </button>
            )}
          </form>
        </div>
        {testError && <Notice kind="error">{testError}</Notice>}
        {status === 'loading' && <Spinner label="Carregando RDKit…" />}
        {subject && (
          <div className={s.analyzerBody}>
            <div className={s.drawing}>
              <Structure2D record={subject} width={460} height={320} highlightAtoms={hl?.atoms} highlightBonds={hl?.bonds} highlightColor={hl?.color} />
            </div>
            <div>
              {!groups && <Spinner label="Analisando…" />}
              {groups && groups.length === 0 && <p className="faint">Nenhum dos grupos da biblioteca foi encontrado.</p>}
              {groups && groups.length > 0 && (
                <ul className={s.found}>
                  {groups.map((g) => (
                    <li key={g.id}>
                      <button aria-pressed={hlGroup === g.id} onClick={() => { setHlGroup(hlGroup === g.id ? null : g.id); setSelected(g.id); }} style={{ ['--c' as string]: g.color }}>
                        <span className={s.swatch} />
                        <span>{g.name}</span>
                        <span className="mono faint">{g.count} {g.count === 1 ? 'ocorrência' : 'ocorrências'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="faint" style={{ fontSize: 12, marginTop: 10 }}>Clique em um grupo para destacar seus átomos na estrutura.</p>
            </div>
          </div>
        )}
      </section>

      <div className={s.library}>
        <nav className={`panel ${s.list}`} aria-label="Biblioteca de grupos">
          {FUNCTIONAL_GROUPS.map((g) => (
            <button key={g.id} aria-current={selected === g.id} onClick={() => setSelected(g.id)} style={{ ['--c' as string]: g.color }}>
              <span className={s.swatch} />
              {g.name}
              {groups?.some((x) => x.id === g.id) && <span className={s.present}>presente</span>}
            </button>
          ))}
        </nav>

        <article className={`panel ${s.detail}`}>
          <h2>{def.name}</h2>
          <p className={s.general}>{def.generalStructure}</p>
          <dl className={s.facts}>
            <dt>Nomenclatura</dt>
            <dd>{def.nomenclature}</dd>
            <dt>Características químicas</dt>
            <dd>{def.characteristics}</dd>
            <dt>Propriedades relevantes</dt>
            <dd>{def.properties}</dd>
            <dt>Padrão SMARTS</dt>
            <dd>
              {def.smarts.map((sm) => (
                <code key={sm} className={s.smarts}>
                  {sm}
                </code>
              ))}
            </dd>
          </dl>
          <h3 className={s.exTitle}>Exemplos</h3>
          <div className={s.examples}>
            {def.examples.map((ex) => (
              <div key={ex.query} className={s.example}>
                <div className="svg-host" dangerouslySetInnerHTML={{ __html: rdkit ? svgFromSmiles(rdkit, ex.smiles, 220, 150, settings.theme === 'dark') ?? '' : '' }} />
                <div className={s.exFoot}>
                  <span>{ex.namePt}</span>
                  <button className="btn btn-sm" onClick={() => nav(`/explorer?q=${encodeURIComponent(ex.query)}`)}>
                    Explorer <Icon name="arrow" size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="faint" style={{ fontSize: 12, marginTop: 14 }}>
            Limitações: os padrões cobrem os casos usuais da química orgânica introdutória. Anidridos, carbonatos, ureias e haletos de acila podem ser classificados de forma aproximada. Veja a <Link to="/knowledge/grupos-funcionais">base de conhecimento</Link>.
          </p>
        </article>
      </div>
    </div>
  );
}
