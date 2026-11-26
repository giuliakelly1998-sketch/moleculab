import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { trackEvent } from '../../services/analytics';
import s from './Calculator.module.css';
import type { CalcDef, CalcOutput, CalcResult, VarDef } from '../../calc/calculators';
import { KINDS, KindId, toQ, fromQ, getUnit } from '../../calc/units';
import { CalcError, DimensionError, formatDims, Q } from '../../calc/quantity';
import { fmtNum, parseNumber } from '../../utils/format';
import { molarMass, FormulaError } from '../../chem/formula';
import { Notice, Spinner } from '../../components/ui';
import { Tex } from '../../components/Tex';
import { WORK_UNIT, texQ, texNum, symTex, UNIT_TEX } from '../../calc/tex';

const PlotView = lazy(() => import('./PlotView'));

const kindsOf = (k: KindId | KindId[]): KindId[] => (Array.isArray(k) ? k : [k]);

/** Para variáveis com vários tipos possíveis (ex.: k de 1ª ou 2ª ordem), a unidade define o tipo. */
function kindForUnit(kinds: KindId[], unitId: string): KindId {
  return kinds.find((k) => KINDS[k].units.some((u) => u.id === unitId)) ?? kinds[0];
}

function validate(v: VarDef, raw: string, unit: string): string | null {
  const n = parseNumber(raw);
  if (n === null) return 'Campo obrigatório.';
  if (Number.isNaN(n)) return 'Número inválido. Use vírgula ou ponto como separador decimal.';
  const kind = KINDS[kindForUnit(kindsOf(v.kind), unit)];
  if (v.integer && !Number.isInteger(n)) return 'Deve ser um número inteiro.';
  if (kind.id === 'temperature') {
    const u = getUnit('temperature', unit);
    return n * u.factor + (u.offset ?? 0) <= 0 ? 'Abaixo do zero absoluto (ou igual a 0 K).' : null;
  }
  if (n < 0 && !v.allowNegative && (kind.nonNegative || kind.id === 'dimensionless')) return 'Não pode ser negativo.';
  if (n === 0 && !v.allowZero) return 'Deve ser diferente de zero.';
  if (kind.id === 'percent' && n > 100) return 'Não pode passar de 100 %.';
  return null;
}

export function CalculatorCard({ def }: { def: CalcDef }) {
  const [mode, setMode] = useState(def.modes?.[0].id ?? '');
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [unitState, setUnits] = useState<Record<string, string>>(() => Object.fromEntries(def.variables.map((v) => [v.key, v.defaultUnit])));
  // Garante sempre uma unidade válida para cada variável desta calculadora.
  const units = useMemo(
    () =>
      Object.fromEntries(
        def.variables.map((v) => {
          const chosen = unitState[v.key];
          const valid = chosen && kindsOf(v.kind).some((k) => KINDS[k].units.some((u) => u.id === chosen));
          return [v.key, valid ? chosen : v.defaultUnit];
        }),
      ),
    [def, unitState],
  );
  const [formulas, setFormulas] = useState<Record<string, string>>({});
  const [outUnits, setOutUnits] = useState<Record<number, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});


  const activeVars = useMemo(() => {
    const m = def.modes?.find((x) => x.id === mode);
    return m ? def.variables.filter((v) => m.inputs.includes(v.key)) : def.variables;
  }, [def, mode]);

  const errors = useMemo(() => Object.fromEntries(activeVars.map((v) => [v.key, validate(v, raw[v.key] ?? '', units[v.key])])), [activeVars, raw, units]);
  const allValid = activeVars.every((v) => !errors[v.key]);

  const computed = useMemo((): { result?: CalcResult; error?: string; qs?: Record<string, Q> } => {
    if (!allValid) return {};
    try {
      const qs: Record<string, Q> = {};
      for (const v of activeVars) {
        const kind = kindForUnit(kindsOf(v.kind), units[v.key]);
        qs[v.key] = toQ(parseNumber(raw[v.key])!, kind, units[v.key]);
      }
      // Valor na unidade de trabalho (coerente), já convertido: a conta escrita fica homogênea.
      const show = (key: string, unitId?: string) => {
        const v = def.variables.find((x) => x.key === key)!;
        const kind = kindForUnit(kindsOf(v.kind), units[key]);
        if (kind === 'percent') return texNum(qs[key].value);
        return texQ(qs[key], kind, unitId ?? WORK_UNIT[kind]);
      };
      return { result: def.compute(qs, { mode, show }), qs };
    } catch (e) {
      if (e instanceof CalcError || e instanceof DimensionError) return { error: e.message };
      return { error: e instanceof Error ? e.message : 'Erro no cálculo.' };
    }
  }, [allValid, activeVars, raw, units, def, mode]);

  const hasResult = !!computed.result;
  useEffect(() => {
    if (hasResult) trackEvent('calculo');
  }, [hasResult]);

  const applyFormula = (key: string, formula: string) => {
    setFormulas((f) => ({ ...f, [key]: formula }));
    if (!formula.trim()) return;
    try {
      const r = molarMass(formula);
      setRaw((x) => ({ ...x, [key]: String(Number(r.molarMass.toFixed(4))) }));
      setUnits((u) => ({ ...u, [key]: 'g/mol' }));
      setTouched((t) => ({ ...t, [key]: true }));
    } catch {
      /* erro mostrado abaixo do campo */
    }
  };

  const conversions = activeVars
    .map((v) => {
      const kind = kindForUnit(kindsOf(v.kind), units[v.key]);
      const q = computed.qs?.[v.key];
      const u = getUnit(kind, units[v.key]);
      if (!q || kind === 'dimensionless' || kind === 'count') return null;
      const target = def.id === 'clausius-clapeyron' && kind === 'pressure' ? 'kPa' : WORK_UNIT[kind];
      if (kind === 'percent') return `${symTex(v.symbol)} = ${texNum(parseNumber(raw[v.key])!)}\\,\\% = ${texNum(q.value)}`;
      if (u.id === target) return null;
      return `${symTex(v.symbol)} = ${texNum(parseNumber(raw[v.key])!)}\\ ${UNIT_TEX[u.id] ?? u.label} = ${texQ(q, kind, target)}`;
    })
    .filter(Boolean) as string[];

  return (
    <div className={s.card}>
      <header className={s.cardHead}>
        <h2>{def.title}</h2>
        <p>{def.summary}</p>
      </header>

      <div className={s.equations} aria-label="Equações utilizadas">
        {def.equations.map((e) => (
          <div key={e} className={s.eq}>
            <Tex tex={e} />
          </div>
        ))}
      </div>

      {def.modes && (
        <div className="segmented" role="group" aria-label="O que calcular" style={{ marginBottom: 16 }}>
          {def.modes.map((m) => (
            <button key={m.id} aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
      )}

      <div className={s.body}>
        <form className={s.inputs} onSubmit={(e) => e.preventDefault()} noValidate>
          {activeVars.map((v) => {
            const kinds = kindsOf(v.kind);
            const id = `${def.id}-${v.key}`;
            const err = touched[v.key] ? errors[v.key] : null;
            let formulaErr: string | null = null;
            if (v.formulaHelper && formulas[v.key]) {
              try {
                molarMass(formulas[v.key]);
              } catch (e) {
                formulaErr = e instanceof FormulaError ? e.message : 'Fórmula inválida.';
              }
            }
            return (
              <div key={v.key} className={s.field}>
                <label htmlFor={id}>
                  <Tex className={s.sym} tex={symTex(v.symbol)} /> {v.label}
                </label>
                <div className={s.inputRow}>
                  <input
                    id={id}
                    className="input mono"
                    inputMode="decimal"
                    value={raw[v.key] ?? ''}
                    onChange={(e) => setRaw((x) => ({ ...x, [v.key]: e.target.value }))}
                    onBlur={() => setTouched((t) => ({ ...t, [v.key]: true }))}
                    aria-invalid={!!err}
                    aria-label={`${v.symbol} ${v.label}`}
                    aria-describedby={`${id}-help`}
                    placeholder="0"
                  />
                  {!(kinds.length === 1 && KINDS[kinds[0]].units.length === 1 && KINDS[kinds[0]].units[0].label === '—') && (
                    <select className="select" value={units[v.key]} onChange={(e) => setUnits((u) => ({ ...u, [v.key]: e.target.value }))} aria-label={`Unidade de ${v.label}`}>
                      {kinds.length === 1
                        ? KINDS[kinds[0]].units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.label}
                            </option>
                          ))
                        : kinds.map((k) => (
                            <optgroup key={k} label={KINDS[k].label}>
                              {KINDS[k].units.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.label}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                    </select>
                  )}
                </div>
                {v.formulaHelper && (
                  <input
                    className={`input mono ${s.formula}`}
                    placeholder="ou digite a fórmula (ex.: C6H12O6)"
                    value={formulas[v.key] ?? ''}
                    onChange={(e) => applyFormula(v.key, e.target.value)}
                    aria-label={`Fórmula para calcular ${v.label}`}
                    aria-invalid={!!formulaErr}
                  />
                )}
                <p id={`${id}-help`} className={err || formulaErr ? s.err : s.help}>
                  {err ?? formulaErr ?? v.help}
                </p>
              </div>
            );
          })}
        </form>

        <section className={s.result} aria-live="polite" aria-label="Resultado">
          {!allValid && <p className="faint">Preencha todos os campos com valores válidos para ver o resultado.</p>}
          {computed.error && <Notice kind="error" title="Cálculo não realizado">{computed.error}</Notice>}
          {computed.result && (
            <>
              {computed.result.outputs.map((o, i) => (
                <OutputLine key={i} o={o} unit={outUnits[i]} onUnit={(u) => setOutUnits((x) => ({ ...x, [i]: u }))} />
              ))}
              {computed.result.verdict && <p className={s.verdict}>{computed.result.verdict}</p>}
              {conversions.length > 0 && (
                <>
                  <h3>1. Conversão de unidades (antes do cálculo)</h3>
                  <div className={s.steps}>
                    {conversions.map((c) => (
                      <div key={c} className={s.step}>
                        <Tex tex={c} />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <h3>{conversions.length > 0 ? '2. ' : ''}Substituição, com todas as grandezas nas mesmas unidades</h3>
              <div className={s.steps}>
                {computed.result.substitution.map((l) => (
                  <div key={l} className={s.step}>
                    <Tex tex={l} />
                  </div>
                ))}
              </div>
              {computed.result.notes?.map((n) => (
                <p key={n} className={s.note}>
                  {n}
                </p>
              ))}
              {computed.result.plot && (
                <Suspense fallback={<Spinner label="Carregando gráfico…" />}>
                  <PlotView spec={computed.result.plot} />
                </Suspense>
              )}
            </>
          )}
        </section>
      </div>

      <details className={s.vars}>
        <summary>Variáveis e unidades</summary>
        <table>
          <thead>
            <tr>
              <th>Símbolo</th>
              <th>Significado</th>
              <th>Unidades aceitas</th>
            </tr>
          </thead>
          <tbody>
            {def.variables.map((v) => (
              <tr key={v.key}>
                <td><Tex tex={symTex(v.symbol)} /></td>
                <td>
                  {v.label}. <span className="faint">{v.help}</span>
                </td>
                <td>{kindsOf(v.kind).flatMap((k) => KINDS[k].units.map((u) => u.label)).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function OutputLine({ o, unit, onUnit }: { o: CalcOutput; unit?: string; onUnit: (u: string) => void }) {
  const kinds = kindsOf(o.kind);
  const kind = kinds.find((k) => o.q.is(KINDS[k].dims));
  if (!kind) {
    return (
      <Notice kind="error" title="Inconsistência dimensional">
        O resultado tem dimensão {formatDims(o.q.dims)}, incompatível com {kinds.map((k) => KINDS[k].label).join(' / ')}.
      </Notice>
    );
  }
  const units = KINDS[kind].units;
  const u = unit && units.some((x) => x.id === unit) ? unit : units.some((x) => x.id === o.defaultUnit) ? o.defaultUnit : units[0].id;
  const value = fromQ(o.q, kind, u);
  return (
    <div className={s.output}>
      <div className={s.outLabel}>
        <Tex className={s.sym} tex={symTex(o.symbol)} /> {o.label}
      </div>
      <div className={s.outValue}>
        <span className="mono">{fmtNum(value, 5)}</span>
        {units.length > 1 ? (
          <select className="select" value={u} onChange={(e) => onUnit(e.target.value)} aria-label={`Unidade de ${o.label}`}>
            {units.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        ) : (
          units[0].label !== '—' && <span className={s.unitText}>{units[0].label}</span>
        )}
      </div>
      <div className={s.dimCheck} title="Dimensão obtida pela própria álgebra de grandezas do cálculo">
        ✓ Dimensão {formatDims(o.q.dims)} — consistente com {KINDS[kind].label.toLowerCase()}
      </div>
    </div>
  );
}
