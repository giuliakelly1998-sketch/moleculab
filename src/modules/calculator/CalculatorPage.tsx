import { NavLink, Navigate, useNavigate, useParams } from 'react-router-dom';
import s from './Calculator.module.css';
import { CALCULATORS, CATEGORY_LABELS, CalcCategory, getCalculator, isCustom } from '../../calc/calculators';
import { PageHeader } from '../../components/ui';
import { CalculatorCard } from './CalculatorCard';
import { MolarMassCalculator } from './MolarMassCalculator';

const CATS = Object.keys(CATEGORY_LABELS) as CalcCategory[];

export default function CalculatorPage() {
  const { id } = useParams();
  const nav = useNavigate();
  if (!id) return <Navigate to={`/calculator/${CALCULATORS[0].id}`} replace />;
  const def = getCalculator(id);
  if (!def) return <Navigate to={`/calculator/${CALCULATORS[0].id}`} replace />;

  return (
    <div>
      <PageHeader
        title="Calculadora química"
        description="Cada cálculo converte as entradas para o SI e propaga as dimensões; somas e funções exponenciais/logarítmicas com dimensões incompatíveis são bloqueadas."
      />
      <div className={s.layout}>
        <nav className={`panel ${s.nav}`} aria-label="Calculadoras">
          {CATS.map((c) => (
            <div key={c}>
              <div className={s.navCat}>{CATEGORY_LABELS[c]}</div>
              {CALCULATORS.filter((x) => x.category === c).map((x) => (
                <NavLink key={x.id} to={`/calculator/${x.id}`} className={({ isActive }) => `${s.navLink} ${isActive ? s.navActive : ''}`}>
                  {x.title}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <label className={s.mobileNav}>
          <span className="label">Calculadora</span>
          <select className="select" value={def.id} onChange={(e) => nav(`/calculator/${e.target.value}`)}>
            {CATS.map((c) => (
              <optgroup key={c} label={CATEGORY_LABELS[c]}>
                {CALCULATORS.filter((x) => x.category === c).map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <div className="panel">{isCustom(def) ? <MolarMassCalculator key={def.id} /> : <CalculatorCard key={def.id} def={def} />}</div>
      </div>
    </div>
  );
}
