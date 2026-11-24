import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { MoleculeRecord, Candidate } from '../chem/molecule';
import type { QueryMode, QueryType } from '../chem/queryDetect';
import type { Analysis } from '../chem/analysis';
import { searchMolecule, recordFromCid } from '../services/moleculeService';
import { AppError, toUserMessage } from '../services/errors';
import { loadRDKit } from '../services/rdkit';
import { useAppData } from './AppDataContext';

type Status = 'idle' | 'loading' | 'ready' | 'error';

interface MoleculeState {
  status: Status;
  record: MoleculeRecord | null;
  error: string | null;
  errorSuggestions: string[];
  note: string | null;
  interpretedAs: QueryType | null;
  candidates: Candidate[] | null;
  analysis: Analysis | null;
  analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
  analysisError: string | null;
  lastQuery: { text: string; mode: QueryMode } | null;
  search: (text: string, mode?: QueryMode) => Promise<void>;
  openCid: (cid: number, label?: string) => Promise<void>;
  clear: () => void;
}

const Ctx = createContext<MoleculeState | null>(null);

export function MoleculeProvider({ children }: { children: ReactNode }) {
  const { addHistory } = useAppData();
  const [status, setStatus] = useState<Status>('idle');
  const [record, setRecord] = useState<MoleculeRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorSuggestions, setErrorSuggestions] = useState<string[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [interpretedAs, setInterpretedAs] = useState<QueryType | null>(null);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<MoleculeState['analysisStatus']>('idle');
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<MoleculeState['lastQuery']>(null);
  // Só a busca mais recente pode atualizar o estado (evita corrida entre respostas).
  const seq = useRef(0);

  const search = useCallback(
    async (text: string, mode: QueryMode = 'auto') => {
      const t = text.trim();
      if (!t) return;
      const id = ++seq.current;
      setStatus('loading');
      setError(null);
      setErrorSuggestions([]);
      setNote(null);
      setCandidates(null);
      setLastQuery({ text: t, mode });
      try {
        const out = await searchMolecule(t, mode);
        if (id !== seq.current) return;
        setInterpretedAs(out.interpretedAs);
        setNote(out.note ?? null);
        if (out.kind === 'multiple') {
          setCandidates(out.candidates);
          setStatus('ready');
          addHistory({ text: t, mode });
          return;
        }
        setRecord(out.record);
        setStatus('ready');
        addHistory({ text: t, mode, title: out.record.title, key: out.record.key });
      } catch (e) {
        if (id !== seq.current) return;
        setError(toUserMessage(e));
        setErrorSuggestions(e instanceof AppError ? e.suggestions ?? [] : []);
        setStatus('error');
      }
    },
    [addHistory],
  );

  const openCid = useCallback(
    async (cid: number, label?: string) => {
      const id = ++seq.current;
      setStatus('loading');
      setError(null);
      setCandidates(null);
      try {
        const rec = await recordFromCid(cid, label ?? String(cid), 'cid');
        if (id !== seq.current) return;
        setRecord(rec);
        setNote(null);
        setInterpretedAs('cid');
        setStatus('ready');
        addHistory({ text: String(cid), mode: 'cid', title: rec.title, key: rec.key });
      } catch (e) {
        if (id !== seq.current) return;
        setError(toUserMessage(e));
        setStatus('error');
      }
    },
    [addHistory],
  );

  // Análise estrutural (RDKit) sempre que a molécula muda.
  useEffect(() => {
    if (!record) {
      setAnalysis(null);
      setAnalysisStatus('idle');
      return;
    }
    let alive = true;
    setAnalysisStatus('loading');
    setAnalysisError(null);
    (async () => {
      try {
        const rdkit = await loadRDKit();
        const { analyze } = await import('../chem/analysis');
        const a = analyze(rdkit, record);
        if (!alive) return;
        setAnalysis(a);
        setAnalysisStatus(a ? 'ready' : 'error');
        if (!a) setAnalysisError('Não foi possível interpretar a estrutura com o RDKit.');
      } catch (e) {
        if (!alive) return;
        setAnalysis(null);
        setAnalysisStatus('error');
        setAnalysisError(toUserMessage(e));
      }
    })();
    return () => {
      alive = false;
    };
  }, [record]);

  const value = useMemo<MoleculeState>(
    () => ({
      status, record, error, errorSuggestions, note, interpretedAs, candidates, analysis, analysisStatus, analysisError, lastQuery,
      search, openCid,
      clear: () => {
        seq.current++;
        setRecord(null);
        setCandidates(null);
        setStatus('idle');
        setError(null);
        setNote(null);
      },
    }),
    [status, record, error, errorSuggestions, note, interpretedAs, candidates, analysis, analysisStatus, analysisError, lastQuery, search, openCid],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMolecule() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useMolecule fora do MoleculeProvider');
  return v;
}
