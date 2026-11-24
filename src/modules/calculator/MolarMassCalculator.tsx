import { useMemo, useState } from 'react';
import s from './Calculator.module.css';
import { molarMass, FormulaError } from '../../chem/formula';
import { ATOMIC_WEIGHTS_SOURCE } from '../../chem/elements';
import { fmtNum } from '../../utils/format';
import { Notice, CopyButton } from '../../components/ui';
import { downloadText, toCsv } from '../../utils/exporters';

export function MolarMassCalculator() {
  const [formula, setFormula] = useState('C6H12O6');
  const result = useMemo(() => {
    if (!formula.trim()) return null;
    try {
      return { ok: molarMass(formula) } as const;
    } catch (e) {
      return { err: e instanceof FormulaError ? e.message : 'Fórmula inválida.' } as const;
    }
  }, [formula]);

  return (
    <div className={s.card}>
      <header className={s.cardHead}>
        <h2>Massa molar</h2>
        <p>Calcula a massa molar e a composição percentual em massa a partir da fórmula. Aceita parênteses, colchetes e hidratos (CuSO4·5H2O ou CuSO4.5H2O).</p>
      </header>
      <div className={s.equations}>
        <code>M = Σ nᵢ · Aᵣ,ᵢ  (g/mol)</code>
        <code>wᵢ = nᵢ · Aᵣ,ᵢ / M × 100 %</code>
      </div>
      <div className={s.field} style={{ maxWidth: 420 }}>
        <label htmlFor="mm-formula">Fórmula molecular</label>
        <input id="mm-formula" className="input mono" value={formula} onChange={(e) => setFormula(e.target.value)} spellCheck={false} aria-invalid={!!result && 'err' in result} maxLength={200} />
        <p className={result && 'err' in result ? s.err : s.help}>{result && 'err' in result ? result.err : 'Símbolos com maiúscula/minúscula corretas (Co ≠ CO).'}</p>
      </div>
      {result && 'ok' in result && result.ok && (
        <div className={s.result} style={{ marginTop: 8 }}>
          <div className={s.output}>
            <div className={s.outLabel}>
              <span className={s.sym}>M</span> Massa molar
            </div>
            <div className={s.outValue}>
              <span className="mono">{fmtNum(result.ok.molarMass, 7)}</span>
              <span className={s.unitText}>g/mol</span>
              <CopyButton text={result.ok.molarMass.toFixed(4)} what="Massa molar" />
            </div>
            <div className={s.dimCheck}>✓ Dimensão M·N⁻¹ — massa por quantidade de matéria</div>
          </div>
          {result.ok.hasNonStandardMass && (
            <Notice kind="warn">Há elementos sem massa atômica padrão (sem isótopos estáveis); foi usado o número de massa do isótopo mais estável.</Notice>
          )}
          <h3>Substituição</h3>
          <div className={s.steps}>
            <code>
              M = {result.ok.composition.map((r) => `${r.count} × ${fmtNum(r.atomicMass, 7)}`).join(' + ')} = {fmtNum(result.ok.molarMass, 7)} g/mol
            </code>
          </div>
          <h3>Composição</h3>
          <div style={{ overflowX: 'auto' }}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>Elemento</th>
                  <th className={s.num}>Átomos</th>
                  <th className={s.num}>Aᵣ (g/mol)</th>
                  <th className={s.num}>Contribuição (g/mol)</th>
                  <th className={s.num}>% em massa</th>
                  <th aria-hidden />
                </tr>
              </thead>
              <tbody>
                {result.ok.composition.map((r) => (
                  <tr key={r.symbol}>
                    <td>
                      <strong>{r.symbol}</strong> <span className="faint">{r.name}</span>
                    </td>
                    <td className={s.num}>{r.count}</td>
                    <td className={s.num}>{fmtNum(r.atomicMass, 9)}{r.radioactive ? '*' : ''}</td>
                    <td className={s.num}>{fmtNum(r.contribution, 7)}</td>
                    <td className={s.num}>{fmtNum(r.massFraction * 100, 4)}</td>
                    <td style={{ width: '24%' }}>
                      <div className={s.bar}>
                        <span style={{ width: `${r.massFraction * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-sm"
              onClick={() =>
                downloadText(
                  `composicao_${formula.replace(/[^\w]/g, '')}.csv`,
                  toCsv([['elemento', 'atomos', 'massa_atomica_g_mol', 'contribuicao_g_mol', 'fracao_massa_pct'], ...result.ok.composition.map((r) => [r.symbol, r.count, r.atomicMass, r.contribution.toFixed(6), (r.massFraction * 100).toFixed(4)])]),
                  'text/csv',
                )
              }
            >
              Exportar CSV
            </button>
            <span className="faint" style={{ fontSize: 12 }}>Massas atômicas: {ATOMIC_WEIGHTS_SOURCE}.</span>
          </div>
        </div>
      )}
    </div>
  );
}
