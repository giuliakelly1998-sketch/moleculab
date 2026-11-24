import { FormEvent, KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import s from './SearchBar.module.css';
import { Icon } from './ui';
import { detectQueryType, QueryMode, QUERY_TYPE_LABELS } from '../chem/queryDetect';
import { useDebouncedValue } from '../hooks/useDebounce';
import { suggestNames } from '../services/autocomplete';
import { useAppData } from '../state/AppDataContext';

const MODES: QueryMode[] = ['auto', 'name', 'formula', 'smiles', 'cid', 'cas', 'inchi'];

/** Explicação de cada tipo de busca, com um exemplo que pode ser testado. */
export const MODE_HELP: { mode: QueryMode; title: string; text: string; example: string }[] = [
  { mode: 'auto', title: 'Automático', text: 'O MOLECULAB descobre sozinho o tipo do termo. Use na maioria das vezes.', example: 'caffeine' },
  { mode: 'name', title: 'Nome', text: 'Nome comum ou IUPAC, de preferência em inglês, como a PubChem registra.', example: 'acetylsalicylic acid' },
  { mode: 'formula', title: 'Fórmula molecular', text: 'Mostra todos os compostos com essa fórmula (isômeros) para você escolher.', example: 'C2H6O' },
  { mode: 'smiles', title: 'SMILES', text: 'Texto que descreve a estrutura átomo por átomo. Funciona até para moléculas que não estão na PubChem.', example: 'CC(=O)Oc1ccccc1C(=O)O' },
  { mode: 'cid', title: 'PubChem CID', text: 'Número de identificação do composto no banco PubChem.', example: '2244' },
  { mode: 'cas', title: 'Número CAS', text: 'Registro do Chemical Abstracts Service, no formato 000-00-0 (aparece em rótulos de reagentes).', example: '58-08-2' },
  { mode: 'inchi', title: 'InChI', text: 'Identificador padronizado da IUPAC, sempre começa com "InChI=".', example: 'InChI=1S/C2H6O/c1-2-3/h3H,2H2,1H3' },
];

interface Props {
  initial?: string;
  initialMode?: QueryMode;
  busy?: boolean;
  onSearch: (text: string, mode: QueryMode) => void;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
}

export function SearchBar({ initial = '', initialMode = 'auto', busy, onSearch, size = 'md', autoFocus }: Props) {
  const { settings } = useAppData();
  const [text, setText] = useState(initial);
  const [mode, setMode] = useState<QueryMode>(initialMode);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [showHelp, setShowHelp] = useState(false);
  const listId = useId();
  const debounced = useDebouncedValue(text, 350);
  const abortRef = useRef<AbortController | null>(null);
  const lastSubmitted = useRef<string>('');

  useEffect(() => setText(initial), [initial]);

  const detected = text.trim() ? detectQueryType(text) : null;
  const effective = mode === 'auto' ? detected : mode;

  // Autocompletar com debounce; só para nomes, para não poluir buscas por SMILES/fórmula.
  useEffect(() => {
    if (!settings.autocomplete || effective !== 'name' || debounced.trim().length < 3 || debounced === lastSubmitted.current) {
      setSuggestions([]);
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    suggestNames(debounced, 6, ctrl.signal)
      .then((list) => {
        if (!ctrl.signal.aborted) {
          setSuggestions(list.filter((x) => x.toLowerCase() !== debounced.trim().toLowerCase()));
          setActive(-1);
        }
      })
      .catch(() => setSuggestions([]));
    return () => ctrl.abort();
  }, [debounced, effective, settings.autocomplete]);

  const submit = (value = text) => {
    const v = value.trim();
    if (!v || busy) return;
    lastSubmitted.current = v;
    setOpen(false);
    setSuggestions([]);
    onSearch(v, mode);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter' && active >= 0) {
      e.preventDefault();
      setText(suggestions[active]);
      submit(suggestions[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <form
      className={`${s.wrap} ${size === 'lg' ? s.lg : ''}`}
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        submit();
      }}
      role="search"
    >
      <div className={s.field}>
        <Icon name="search" size={18} className={s.icon} />
        <input
          className={s.input}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Nome, fórmula, SMILES, CID, CAS ou InChI"
          aria-label="Buscar molécula"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open && suggestions.length > 0}
          role="combobox"
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={1000}
        />
        <select className={s.mode} value={mode} onChange={(e) => setMode(e.target.value as QueryMode)} aria-label="Tipo de consulta">
          {MODES.map((m) => (
            <option key={m} value={m}>
              {m === 'auto' ? 'Automático' : QUERY_TYPE_LABELS[m]}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`btn btn-ghost ${s.helpBtn}`}
          onClick={() => setShowHelp((v) => !v)}
          aria-expanded={showHelp}
          aria-label="O que é cada tipo de busca?"
          title="O que é cada tipo de busca?"
        >
          ?
        </button>
        <button className="btn btn-primary" type="submit" disabled={busy || !text.trim()}>
          {busy ? 'Buscando…' : 'Buscar'}
        </button>
        {open && suggestions.length > 0 && (
          <ul className={s.suggest} id={listId} role="listbox">
            {suggestions.map((x, i) => (
              <li
                key={x}
                role="option"
                aria-selected={i === active}
                className={i === active ? s.activeOpt : undefined}
                onMouseDown={(e) => {
                  e.preventDefault();
                  setText(x);
                  submit(x);
                }}
              >
                {x}
              </li>
            ))}
            <li className={s.suggestFoot} aria-hidden>
              Sugestões: PubChem Autocomplete
            </li>
          </ul>
        )}
      </div>
      {showHelp && (
        <div className={s.help} role="region" aria-label="Tipos de busca">
          <p className={s.helpIntro}>Você pode buscar uma molécula de várias formas. Clique em um exemplo para testar:</p>
          <dl>
            {MODE_HELP.map((h) => (
              <div key={h.mode} className={s.helpRow}>
                <dt>{h.title}</dt>
                <dd>
                  {h.text}
                  <button
                    type="button"
                    className={s.example}
                    onClick={() => {
                      setText(h.example);
                      setMode(h.mode);
                      setShowHelp(false);
                      lastSubmitted.current = h.example;
                      onSearch(h.example, h.mode);
                    }}
                  >
                    {h.example}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {detected && (
        <p className={s.hint}>
          Interpretado como <strong>{QUERY_TYPE_LABELS[effective!]}</strong>
          {mode === 'auto' && ' (detecção automática — altere no seletor se necessário)'}
        </p>
      )}
    </form>
  );
}
