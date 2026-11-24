import type { Candidate } from '../../chem/molecule';
import type { QueryType } from '../../chem/queryDetect';
import { fmtNum } from '../../utils/format';
import s from './Explorer.module.css';

export function CandidateList({ candidates, onPick, interpretedAs }: { candidates: Candidate[]; onPick: (c: Candidate) => void; interpretedAs: QueryType | null }) {
  return (
    <section className={`panel ${s.candidates}`} aria-label="Resultados">
      <h2>{interpretedAs === 'formula' ? 'Isômeros encontrados' : 'Resultados'}</h2>
      <p className="faint" style={{ fontSize: 13, marginBottom: 10 }}>
        Mostrando até {candidates.length} registros da PubChem. Selecione um para abrir.
      </p>
      <ul>
        {candidates.map((c) => (
          <li key={c.cid}>
            <button onClick={() => onPick(c)}>
              <span className={s.candTitle}>{c.title}</span>
              <span className="mono faint">{c.formula}</span>
              <span className="mono faint">{c.weight !== undefined ? `${fmtNum(c.weight, 6)} g/mol` : ''}</span>
              <span className="mono faint">CID {c.cid}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
