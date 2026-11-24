import { lazy, ReactNode, Suspense, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import s from './Elements.module.css';
import {
  PERIODIC, ElementData, namePt, findElement, SERIES_COLOR, SERIES_PT, gridPosition, toC, toF, EV_TO_KJMOL,
  prettyConfig, SHELL_LETTERS, HALF_LIFE_PT, ELEMENT_SOURCES,
} from '../../chem/periodic';
import { CELLS, drawableCell, IDEAL_C_OVER_A, LATTICE_LABELS, theoreticalDensity } from '../../chem/unitCell';
import { fmtNum } from '../../utils/format';
import { CopyButton, Icon, NatureBadge, Spinner } from '../../components/ui';
import { useAppData } from '../../state/AppDataContext';

const UnitCellViewer = lazy(() => import('./UnitCellViewer'));

const NA = <span className={s.na}>N/A</span>;
const n = (v: number | null | undefined, sig = 4) => (v === null || v === undefined ? null : fmtNum(v, sig));

function Temp({ k }: { k: number | null }) {
  if (k === null) return NA;
  return (
    <span className={s.temp}>
      {fmtNum(toC(k), 6)}
      <i className={s.uC}>°C</i> = {fmtNum(toF(k), 6)}
      <i className={s.uF}>°F</i> = {fmtNum(k, 6)}
      <i className={s.uK}>K</i>
    </span>
  );
}

function Section({ title, color, icon, children, source }: { title: string; color: string; icon: string; children: ReactNode; source?: ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle} style={{ ['--sc' as string]: color }}>
        <Icon name={icon} size={18} /> {title}
      </h2>
      <dl className={s.rows}>{children}</dl>
      {source && <p className={s.source}>Fonte: {source}</p>}
    </section>
  );
}

function Row({ label, children, badge }: { label: ReactNode; children: ReactNode; badge?: 'calculado' | 'estimado' }) {
  return (
    <div className={s.row}>
      <dt>{label}</dt>
      <dd>
        {children ?? NA}
        {badge && <NatureBadge nature={badge} />}
      </dd>
    </div>
  );
}

/** Linha com seletor de variante e de unidade (como no quadro de propriedades de referência). */
function PickerRow<V extends string, U extends string>({
  label, variants, units, get,
}: {
  label: string;
  variants?: { id: V; label: string }[];
  units?: { id: U; label: string }[];
  get: (variant: V, unit: U) => string | null;
}) {
  const [variant, setVariant] = useState<V>(variants?.[0]?.id as V);
  const [unit, setUnit] = useState<U>(units?.[0]?.id as U);
  const val = get(variant, unit);
  return (
    <div className={s.pick}>
      <span className={s.pickLabel}>
        {label}
        {variants && variants.length > 0 && (
          <select value={variant} onChange={(e) => setVariant(e.target.value as V)} aria-label={`${label}: variante`}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        )}
      </span>
      <span className={s.pickValue}>
        {val ?? <span className={s.na}>N/A</span>}
        {units && units.length > 1 ? (
          <select value={unit} onChange={(e) => setUnit(e.target.value as U)} aria-label={`${label}: unidade`}>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.label}
              </option>
            ))}
          </select>
        ) : (
          units && <span className={s.pickUnit}>{units[0].label}</span>
        )}
      </span>
    </div>
  );
}

function BohrDiagram({ shells, color }: { shells: number[]; color: string }) {
  const size = 200;
  const c = size / 2;
  const step = 82 / Math.max(shells.length, 1);
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={s.bohr} aria-label={`Camadas: ${shells.join(', ')}`} role="img">
      <circle cx={c} cy={c} r={9} fill={color} />
      {shells.map((count, i) => {
        const r = 16 + step * (i + 1);
        return (
          <g key={i}>
            <circle cx={c} cy={c} r={r} fill="none" stroke="var(--border-strong)" strokeWidth={1} />
            {Array.from({ length: count }, (_, k) => {
              const t = (2 * Math.PI * k) / count - Math.PI / 2;
              return <circle key={k} cx={c + r * Math.cos(t)} cy={c + r * Math.sin(t)} r={2.6} fill="var(--ink)" />;
            })}
          </g>
        );
      })}
    </svg>
  );
}

function MiniTable({ current }: { current: ElementData }) {
  return (
    <div className={s.mini} aria-hidden>
      {PERIODIC.map((e) => {
        const p = gridPosition(e);
        return <span key={e.z} style={{ gridRow: p.row, gridColumn: p.col }} className={e.z === current.z ? s.miniOn : undefined} />;
      })}
    </div>
  );
}

export default function ElementPage() {
  const { symbol = '' } = useParams();
  const nav = useNavigate();
  const { settings } = useAppData();
  const e = findElement(symbol);
  const [ieUnit, setIeUnit] = useState<'eV' | 'kJ'>('eV');

  const cellType = e ? drawableCell(e.symbol, e.latticeStructure) : null;
  const cellData = useMemo(() => {
    if (!e || !cellType || !e.latticeConstantA || !e.atomicWeight) return null;
    const info = CELLS[cellType];
    return {
      info,
      r: info.radiusFromA(e.latticeConstantA) * 100, // pm
      rho: theoreticalDensity(cellType, e.latticeConstantA, e.atomicWeight),
    };
  }, [e, cellType]);

  if (!e) return <Navigate to="/elements" replace />;
  const prev = PERIODIC[e.z - 2];
  const next = PERIODIC[e.z];
  const color = e.series ? SERIES_COLOR[e.series] : '#8b6cff';
  const name = namePt(e.z);
  const conductivity = e.resistivityOhmM ? 1 / e.resistivityOhmM : null;
  const isoA = e.massNumber;
  const ancient = !e.discoveryYear && /known to the ancients/i.test(e.discoverers ?? '');

  return (
    <div className={s.page} key={e.symbol}>
      <header className={s.head} style={{ ['--ec' as string]: color }}>
        <Link to="/elements" className={s.back} aria-label="Voltar à tabela periódica">
          <Icon name="arrow" size={16} className={s.backIcon} /> Tabela
        </Link>
        <div className={s.tile}>
          <span className={s.tileZ}>{e.z}</span>
          <span className={s.tileSym}>{e.symbol}</span>
        </div>
        <div className={s.headText}>
          <h1>{name}</h1>
          <p>
            {e.atomicWeight !== null ? `${fmtNum(e.atomicWeight, 8)} g/mol` : 'massa atômica indisponível'} · {e.series ? SERIES_PT[e.series] : 'categoria indefinida'}
          </p>
        </div>
      </header>

      <div className={s.particles}>
        <div className={s.pCard} style={{ ['--pc' as string]: '#ff5470' }}>
          <span>Elétrons</span>
          <strong>{e.z}</strong>
        </div>
        <div className={s.pCard} style={{ ['--pc' as string]: '#f2b84b' }}>
          <span>Prótons</span>
          <strong>{e.z}</strong>
        </div>
        <div className={s.pCard} style={{ ['--pc' as string]: '#5c9dff' }}>
          <span>Nêutrons</span>
          <strong>{e.neutrons ?? '—'}</strong>
          {isoA && <small>no isótopo {isoA}{e.symbol}</small>}
        </div>
      </div>

      <div className={s.twoCol}>
        <Section title="Quadro de propriedades" color="#8b6cff" icon="properties" source="ver seções abaixo">
          <PickerRow label="Massa atômica" units={[{ id: 'u', label: 'u' }]} get={() => n(e.atomicWeight, 8)} />
          <PickerRow label="Níveis de energia" get={() => (e.shells ? e.shells.join(', ') : null)} />
          <PickerRow
            label="Eletronegatividade"
            variants={[{ id: 'pauling', label: 'Pauling' }, { id: 'allen', label: 'Allen (eV)' }]}
            get={(v) => n(v === 'pauling' ? e.enPauling : e.enAllen, 3)}
          />
          <PickerRow
            label="Ponto de fusão"
            units={[{ id: 'C', label: '°C' }, { id: 'K', label: 'K' }, { id: 'F', label: '°F' }]}
            get={(_, u) => (e.meltingK === null ? null : fmtNum(u === 'K' ? e.meltingK : u === 'C' ? toC(e.meltingK) : toF(e.meltingK), 6))}
          />
          <PickerRow
            label="Ponto de ebulição"
            units={[{ id: 'C', label: '°C' }, { id: 'K', label: 'K' }, { id: 'F', label: '°F' }]}
            get={(_, u) => (e.boilingK === null ? null : fmtNum(u === 'K' ? e.boilingK : u === 'C' ? toC(e.boilingK) : toF(e.boilingK), 6))}
          />
          <PickerRow
            label="Eletroafinidade"
            units={[{ id: 'kJ', label: 'kJ/mol' }, { id: 'eV', label: 'eV' }]}
            get={(_, u) => (e.electronAffinityEv === null ? null : fmtNum(u === 'eV' ? e.electronAffinityEv : e.electronAffinityEv * EV_TO_KJMOL, 5))}
          />
          <PickerRow
            label="Potencial de ionização"
            variants={e.ionizationEv.map((_, i) => ({ id: String(i), label: `${i + 1}º` }))}
            units={[{ id: 'kJ', label: 'kJ/mol' }, { id: 'eV', label: 'eV' }]}
            get={(v, u) => {
              const x = e.ionizationEv[Number(v ?? 0)];
              return x === undefined ? null : fmtNum(u === 'eV' ? x : x * EV_TO_KJMOL, 6);
            }}
          />
          <PickerRow
            label="Raio"
            variants={[
              { id: 'calc', label: 'Calculado' },
              { id: 'emp', label: 'Empírico' },
              { id: 'cov', label: 'Covalente' },
              { id: 'vdw', label: 'van der Waals' },
              { id: 'met', label: 'Metálico' },
            ]}
            units={[{ id: 'pm', label: 'pm' }, { id: 'A', label: 'Å' }]}
            get={(v, u) => {
              const map = { calc: e.radiusCalculatedPm, emp: e.radiusEmpiricalPm, cov: e.radiusCovalentPm, vdw: e.radiusVdwPm, met: e.radiusMetallicPm };
              const x = map[v as keyof typeof map];
              return x === null ? null : fmtNum(u === 'A' ? x / 100 : x, 4);
            }}
          />
          <PickerRow
            label="Dureza"
            variants={[{ id: 'brinell', label: 'Brinell (MPa)' }, { id: 'vickers', label: 'Vickers (MPa)' }, { id: 'mohs', label: 'Mohs' }]}
            get={(v) => n(v === 'brinell' ? e.brinellMPa : v === 'vickers' ? e.vickersMPa : e.mohs, 4)}
          />
          <PickerRow
            label="Módulo"
            variants={[{ id: 'bulk', label: 'Volumétrico (bulk)' }, { id: 'young', label: 'Young' }, { id: 'shear', label: 'Cisalhamento' }]}
            units={[{ id: 'GPa', label: 'GPa' }]}
            get={(v) => n(v === 'bulk' ? e.bulkModulusGPa : v === 'young' ? e.youngModulusGPa : e.shearModulusGPa, 4)}
          />
          <PickerRow
            label="Densidade"
            units={[{ id: 'g', label: 'g/cm³' }, { id: 'kg', label: 'kg/m³' }]}
            get={(_, u) => (e.densityGcm3 === null ? null : fmtNum(u === 'kg' ? e.densityGcm3 * 1000 : e.densityGcm3, 5))}
          />
          <PickerRow
            label="Condutividade"
            variants={[{ id: 'th', label: 'Térmica (W/m·K)' }, { id: 'el', label: 'Elétrica (S/m)' }]}
            get={(v) => n(v === 'th' ? e.thermalConductivityWmK : conductivity, 4)}
          />
          <PickerRow
            label="Calor"
            variants={[
              { id: 'sp', label: 'Específico (J/g·K)' },
              { id: 'fus', label: 'Fusão (kJ/mol)' },
              { id: 'vap', label: 'Vaporização (kJ/mol)' },
              { id: 'mol', label: 'Capacidade molar (J/mol·K)' },
            ]}
            get={(v) => n(v === 'sp' ? e.specificHeatJgK : v === 'fus' ? e.fusionHeatKJmol : v === 'vap' ? e.evaporationHeatKJmol : e.molarHeatCapacityJmolK, 4)}
          />
          <PickerRow
            label="Abundância"
            variants={[{ id: 'crust', label: 'Crosta (mg/kg)' }, { id: 'sea', label: 'Oceano (mg/L)' }]}
            get={(v) => n(v === 'crust' ? e.abundanceCrustMgKg : e.abundanceSeaMgL, 3)}
          />
          <PickerRow label="Descoberto" get={() => (e.discoveryYear ? String(e.discoveryYear) : ancient ? 'Antiguidade' : null)} />
        </Section>

        <div>
          <Section title="Visão geral" color="#ff7a45" icon="info" source="mendeleev">
            <Row label="Nome em inglês">{e.nameEn}</Row>
            <Row label="Origem do nome (em inglês, como na fonte)">{e.nameOrigin}</Row>
            <Row label="Ano de descoberta">{e.discoveryYear ?? (ancient ? 'conhecido desde a Antiguidade' : null)}</Row>
            <Row label="Descoberto por">{ancient ? 'conhecido desde a Antiguidade' : e.discoverers}</Row>
            <Row label="Local de descoberta">{e.discoveryLocation}</Row>
            <Row label="Número CAS">
              {e.cas && (
                <span className={s.inline}>
                  <span className="mono">{e.cas}</span> <CopyButton text={e.cas} what="CAS" />
                </span>
              )}
            </Row>
            <Row label="Fase a 25 °C e 1 atm">{e.phase}</Row>
          </Section>

          <Section title="Camadas eletrônicas" color="#3ad6e6" icon="explorer">
            <div className={s.shellRow}>
              <p className="mono">{e.shells ? e.shells.map((c, i) => `${SHELL_LETTERS[i]}${c}`).join(' ') : '—'}</p>
              {e.shells && <BohrDiagram shells={e.shells} color={color} />}
            </div>
          </Section>
        </div>
      </div>

      <Section title="Posição na tabela" color="#20c997" icon="overview" source="IUPAC (grupos 1–18); notação CAS entre parênteses">
        <Row label="Número atômico">{e.z}</Row>
        <Row label="Massa atômica relativa">
          {e.atomicWeight !== null && (
            <>
              {fmtNum(e.atomicWeight, 10)}
              {e.atomicWeightUnc ? ` ± ${fmtNum(e.atomicWeightUnc, 2)}` : ''} g/mol
            </>
          )}
        </Row>
        <Row label="Bloco">{`bloco ${e.block}`}</Row>
        <Row label="Período">{e.period}</Row>
        <Row label="Grupo">{e.group ? `${e.group}${e.groupCas ? ` (${e.groupCas})` : ''}` : e.z >= 57 && e.z <= 71 ? 'lantanídeos (grupo 3)' : 'actinídeos (grupo 3)'}</Row>
        <MiniTable current={e} />
      </Section>

      <Section title="Propriedades termodinâmicas" color="#1c9cf0" icon="properties" source="CRC Handbook 95ª ed. via mendeleev; expansão térmica via pymatgen/WebElements">
        <Row label="Ponto de fusão"><Temp k={e.meltingK} /></Row>
        <Row label="Ponto de ebulição"><Temp k={e.boilingK} /></Row>
        <Row label="Calor de fusão">{e.fusionHeatKJmol !== null && `${n(e.fusionHeatKJmol)} kJ/mol`}</Row>
        <Row label="Calor de vaporização">{e.evaporationHeatKJmol !== null && `${n(e.evaporationHeatKJmol)} kJ/mol`}</Row>
        <Row label="Calor específico (25 °C)">{e.specificHeatJgK !== null && `${n(e.specificHeatJgK)} J/(g·K)`}</Row>
        <Row label="Capacidade calorífica molar">{e.molarHeatCapacityJmolK !== null && `${n(e.molarHeatCapacityJmolK)} J/(mol·K)`}</Row>
        <Row label="Expansão térmica linear">{e.thermalExpansionPerK !== null && `${n(e.thermalExpansionPerK, 3)} K⁻¹`}</Row>
        <Row label="Condutividade térmica (25 °C)">{e.thermalConductivityWmK !== null && `${n(e.thermalConductivityWmK)} W/(m·K)`}</Row>
      </Section>

      <Section title="Propriedades atômicas" color="#e03e5c" icon="explorer" source="NIST ASD (ionização); CRC Handbook (afinidade, raio de van der Waals); Slater 1964 (raio empírico); Pyykkö 2009 (raio covalente); Clementi et al. via pymatgen (raio calculado)">
        <Row label="Configuração eletrônica">
          <span className={s.config}>
            {prettyConfig(e.econf)}
            <br />
            <span className="faint">{prettyConfig(e.econfFull)}</span>
          </span>
        </Row>
        <Row label="Estados de oxidação">
          <span className={s.ox}>
            {[-4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8].map((k) => {
              const known = e.oxidationStates.includes(k);
              const common = e.commonOxidationStates.includes(k);
              return (
                <span key={k} className={`${s.oxChip} ${known ? (k < 0 ? s.oxNeg : s.oxPos) : ''} ${common ? s.oxCommon : ''}`} title={common ? 'estado comum' : known ? 'estado conhecido' : 'não registrado'}>
                  {k > 0 ? `+${k}` : k}
                </span>
              );
            })}
          </span>
          <span className="faint" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>Borda branca = estados mais comuns.</span>
        </Row>
        <Row label="Carga iônica comum">
          {e.commonOxidationStates.length > 0 &&
            e.commonOxidationStates.map((k) => `${e.symbol}${k === 0 ? '' : `${Math.abs(k) === 1 ? '' : Math.abs(k)}${k > 0 ? '+' : '−'}`}`).join(', ')}
        </Row>
        <Row label="Afinidade eletrônica">{e.electronAffinityEv !== null && `${fmtNum(e.electronAffinityEv * EV_TO_KJMOL, 5)} kJ/mol (${fmtNum(e.electronAffinityEv, 5)} eV)`}</Row>
        <Row label="Raio atômico (empírico)">{e.radiusEmpiricalPm !== null && `${e.radiusEmpiricalPm} pm`}</Row>
        <Row label="Raio atômico (calculado)">{e.radiusCalculatedPm !== null && `${e.radiusCalculatedPm} pm`}</Row>
        <Row label="Raio covalente">{e.radiusCovalentPm !== null && `${e.radiusCovalentPm} pm`}</Row>
        <Row label="Raio de van der Waals">{e.radiusVdwPm !== null && `${e.radiusVdwPm} pm`}</Row>
        <Row label="Raio metálico">{e.radiusMetallicPm !== null && `${e.radiusMetallicPm} pm`}</Row>
        <Row label={`Energias de ionização (${e.ionizationEv.length})`}>
          {e.ionizationEv.length > 0 && (
            <div>
              <div className="segmented" style={{ marginBottom: 8 }}>
                <button aria-pressed={ieUnit === 'eV'} onClick={() => setIeUnit('eV')}>eV</button>
                <button aria-pressed={ieUnit === 'kJ'} onClick={() => setIeUnit('kJ')}>kJ/mol</button>
              </div>
              <ol className={s.ieList}>
                {e.ionizationEv.map((x, i) => (
                  <li key={i}>
                    <span>{i + 1}ª</span>
                    <span className="mono">{fmtNum(ieUnit === 'eV' ? x : x * EV_TO_KJMOL, 6)}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Row>
      </Section>

      <Section title="Propriedades eletromagnéticas" color="#2b9fb3" icon="properties" source="pymatgen/WebElements; condutividade calculada como 1/resistividade">
        <Row label="Resistividade elétrica">{e.resistivityOhmM !== null && `${n(e.resistivityOhmM, 3)} Ω·m`}</Row>
        <Row label="Condutividade elétrica" badge={conductivity ? 'calculado' : undefined}>{conductivity && `${n(conductivity, 3)} S/m`}</Row>
        <Row label="Temperatura de supercondutividade"><Temp k={e.superconductionK} /></Row>
      </Section>

      <Section title="Parâmetros de rede" color="#4a7dff" icon="overview" source="estrutura e parâmetro a: mendeleev; geometria e derivados: modelo de esferas rígidas (Callister & Rethwisch, cap. 3)">
        <div className={s.lattice}>
          <div>
            <Row label="Estrutura cristalina">{e.latticeStructure && (cellType ? CELLS[cellType].namePt : LATTICE_LABELS[e.latticeStructure] ?? e.latticeStructure)}</Row>
            <Row label="Parâmetro de rede a">{e.latticeConstantA !== null && `${fmtNum(e.latticeConstantA, 4)} Å`}</Row>
            <Row label="Relação c/a">
              {cellType === 'HCP' ? (
                <span>
                  indisponível na base · desenho com o valor ideal {fmtNum(IDEAL_C_OVER_A, 4)}
                </span>
              ) : e.latticeStructure && ['SC', 'BCC', 'FCC', 'DIA', 'CUB'].includes(e.latticeStructure) ? (
                '— (cúbica: a = b = c)'
              ) : null}
            </Row>
            {cellData && (
              <>
                <Row label="Átomos por célula">{cellData.info.atomsPerCell}</Row>
                <Row label="Número de coordenação">{cellData.info.coordination}</Row>
                <Row label="Fator de empacotamento" badge="calculado">{fmtNum(cellData.info.packingFactor, 3)}</Row>
                <Row label={`Raio de esfera rígida (${cellData.info.relation})`} badge="calculado">{`${fmtNum(cellData.r, 4)} pm`}</Row>
                <Row label="Densidade teórica, ρ = n·M/(Nₐ·V)" badge={cellType === 'HCP' ? 'estimado' : 'calculado'}>
                  {`${fmtNum(cellData.rho, 4)} g/cm³`}
                  {e.densityGcm3 !== null && <span className="faint"> (medida: {fmtNum(e.densityGcm3, 4)})</span>}
                </Row>
              </>
            )}
          </div>
          <div>
            {cellType && e.latticeConstantA ? (
              <Suspense fallback={<Spinner label="Carregando 3Dmol.js…" />}>
                <UnitCellViewer type={cellType} a={e.latticeConstantA} color={color} theme={settings.theme} />
              </Suspense>
            ) : (
              <p className={s.noCell}>
                {e.latticeStructure
                  ? `Visualização disponível para cúbicas (simples, CCC, CFC, diamante) e hexagonal compacta. A estrutura de ${name} (${LATTICE_LABELS[e.latticeStructure] ?? e.latticeStructure}) exige parâmetros que a base não fornece.`
                  : 'Estrutura cristalina não registrada na base de dados.'}
              </p>
            )}
          </div>
        </div>
      </Section>

      <Section title="Propriedades mecânicas e ópticas" color="#f76707" icon="calculator" source="pymatgen (compilado do WebElements)">
        <Row label="Dureza Brinell">{e.brinellMPa !== null && `${n(e.brinellMPa)} MPa`}</Row>
        <Row label="Dureza Mohs">{n(e.mohs, 3)}</Row>
        <Row label="Dureza Vickers">{e.vickersMPa !== null && `${n(e.vickersMPa)} MPa`}</Row>
        <Row label="Módulo volumétrico (bulk)">{e.bulkModulusGPa !== null && `${n(e.bulkModulusGPa)} GPa`}</Row>
        <Row label="Módulo de Young">{e.youngModulusGPa !== null && `${n(e.youngModulusGPa)} GPa`}</Row>
        <Row label="Módulo de cisalhamento">{e.shearModulusGPa !== null && `${n(e.shearModulusGPa)} GPa`}</Row>
        <Row label="Coeficiente de Poisson">{n(e.poisson, 3)}</Row>
        <Row label="Velocidade do som">{e.soundSpeedMs !== null && `${n(e.soundSpeedMs)} m/s`}</Row>
        <Row label="Volume molar">{e.molarVolumeCm3 !== null && `${n(e.molarVolumeCm3)} cm³/mol`}</Row>
        <Row label="Índice de refração">{n(e.refractiveIndex, 6)}</Row>
        <Row label="Refletividade">{e.reflectivityPct !== null && `${n(e.reflectivityPct, 3)} %`}</Row>
      </Section>

      <Section title="Reatividade" color="#51a84b" icon="groups" source="CRC Handbook (Pauling); Mann et al. 2000 (Allen)">
        <Row label="Eletronegatividade (Pauling)">{n(e.enPauling, 3)}</Row>
        <Row label="Eletronegatividade (Allen)">{e.enAllen !== null && `${n(e.enAllen, 4)} eV`}</Row>
        <Row label="Afinidade eletrônica">{e.electronAffinityEv !== null && `${fmtNum(e.electronAffinityEv * EV_TO_KJMOL, 5)} kJ/mol`}</Row>
      </Section>

      <Section title="Propriedades nucleares" color="#d6336c" icon="alert" source="mendeleev (dados de isótopos)">
        <Row label="Radioativo">{e.radioactive ? 'Sim' : 'Não'}</Row>
        {e.mostStableIsotope && (
          <Row label="Isótopo mais estável">
            {`${e.mostStableIsotope.A}${e.symbol}, meia-vida ${fmtNum(e.mostStableIsotope.halfLife, 4)} ${HALF_LIFE_PT[e.mostStableIsotope.unit] ?? e.mostStableIsotope.unit}`}
          </Row>
        )}
        <Row label="Isótopos naturais">
          {e.naturalIsotopes.length > 0 && (
            <ul className={s.isoList}>
              {e.naturalIsotopes.map((i) => (
                <li key={i.A}>
                  <span className="mono">
                    <sup>{i.A}</sup>
                    {e.symbol}
                  </span>
                  <span className={s.isoBar}>
                    <span style={{ width: `${Math.max(i.abundance, 0.5)}%`, background: color }} />
                  </span>
                  <span className="mono">{fmtNum(i.abundance, 5)} %</span>
                </li>
              ))}
            </ul>
          )}
        </Row>
      </Section>

      <Section title="Abundância" color="#1971c2" icon="overview" source="CRC Handbook 95ª ed. via mendeleev">
        <Row label="Na crosta terrestre">
          {e.abundanceCrustMgKg !== null && `${n(e.abundanceCrustMgKg, 3)} mg/kg (${fmtNum(e.abundanceCrustMgKg / 1e4, 3)} %)`}
        </Row>
        <Row label="Nos oceanos">{e.abundanceSeaMgL !== null && `${n(e.abundanceSeaMgL, 3)} mg/L`}</Row>
      </Section>

      <section className={s.sources}>
        <h2>Fontes dos dados</h2>
        <ol>
          {ELEMENT_SOURCES.map((x) => (
            <li key={x.label}>
              {x.label}{' '}
              {x.url && (
                <a href={x.url} target="_blank" rel="noreferrer">
                  {x.url.replace(/^https?:\/\//, '')}
                </a>
              )}
            </li>
          ))}
        </ol>
        <p className="faint">
          N/A indica que a propriedade não está registrada nas bases usadas; nenhum valor é estimado para preencher lacunas. Propriedades marcadas como calculado ou estimado são derivadas pelo MOLECULAB a partir dos dados tabelados.
        </p>
      </section>

      <nav className={s.pager} aria-label="Elemento anterior e próximo">
        {prev ? (
          <button onClick={() => nav(`/elements/${prev.symbol}`)}>
            ‹ <span className="mono">{prev.z}</span> {namePt(prev.z)}
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button onClick={() => nav(`/elements/${next.symbol}`)}>
            {namePt(next.z)} <span className="mono">{next.z}</span> ›
          </button>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}
