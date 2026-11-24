import { D, Dims, Q, CalcError } from './quantity';

/**
 * Unidades agrupadas por tipo de grandeza. Cada unidade converte para SI por
 * `si = value * factor + offset` (offset só é usado em temperatura).
 */
export interface UnitDef {
  id: string;
  label: string;
  factor: number;
  offset?: number;
}

export interface QuantityKind {
  id: string;
  label: string;
  dims: Dims;
  units: UnitDef[];
  /** Grandezas que não podem ser negativas (ex.: massa, volume, T absoluta). */
  nonNegative?: boolean;
}

const k = (id: string, label: string, dims: Dims, units: UnitDef[], nonNegative = true): QuantityKind => ({
  id, label, dims, units, nonNegative,
});

export const KINDS = {
  mass: k('mass', 'Massa', D.mass, [
    { id: 'g', label: 'g', factor: 1e-3 },
    { id: 'mg', label: 'mg', factor: 1e-6 },
    { id: 'ug', label: 'µg', factor: 1e-9 },
    { id: 'kg', label: 'kg', factor: 1 },
  ]),
  amount: k('amount', 'Quantidade de matéria', D.amount, [
    { id: 'mol', label: 'mol', factor: 1 },
    { id: 'mmol', label: 'mmol', factor: 1e-3 },
    { id: 'umol', label: 'µmol', factor: 1e-6 },
    { id: 'kmol', label: 'kmol', factor: 1e3 },
  ]),
  volume: k('volume', 'Volume', D.volume, [
    { id: 'L', label: 'L', factor: 1e-3 },
    { id: 'mL', label: 'mL', factor: 1e-6 },
    { id: 'uL', label: 'µL', factor: 1e-9 },
    { id: 'm3', label: 'm³', factor: 1 },
    { id: 'dm3', label: 'dm³', factor: 1e-3 },
    { id: 'cm3', label: 'cm³', factor: 1e-6 },
  ]),
  temperature: k('temperature', 'Temperatura', D.temperature, [
    { id: 'K', label: 'K', factor: 1 },
    { id: 'C', label: '°C', factor: 1, offset: 273.15 },
  ]),
  pressure: k('pressure', 'Pressão', D.pressure, [
    { id: 'Pa', label: 'Pa', factor: 1 },
    { id: 'kPa', label: 'kPa', factor: 1e3 },
    { id: 'bar', label: 'bar', factor: 1e5 },
    { id: 'atm', label: 'atm', factor: 101325 },
    { id: 'mmHg', label: 'mmHg', factor: 133.322387415 },
    { id: 'torr', label: 'Torr', factor: 101325 / 760 },
  ]),
  molarEnergy: k('molarEnergy', 'Energia por mol', D.molarEnergy, [
    { id: 'J/mol', label: 'J/mol', factor: 1 },
    { id: 'kJ/mol', label: 'kJ/mol', factor: 1e3 },
    { id: 'kcal/mol', label: 'kcal/mol', factor: 4184 },
  ], false),
  molarEntropy: k('molarEntropy', 'Entropia molar', D.molarEntropy, [
    { id: 'J/(mol·K)', label: 'J/(mol·K)', factor: 1 },
    { id: 'kJ/(mol·K)', label: 'kJ/(mol·K)', factor: 1e3 },
    { id: 'cal/(mol·K)', label: 'cal/(mol·K)', factor: 4.184 },
  ], false),
  molarMass: k('molarMass', 'Massa molar', D.molarMass, [
    { id: 'g/mol', label: 'g/mol', factor: 1e-3 },
    { id: 'kg/mol', label: 'kg/mol', factor: 1 },
  ]),
  concentration: k('concentration', 'Concentração molar', D.concentration, [
    { id: 'mol/L', label: 'mol/L', factor: 1e3 },
    { id: 'mmol/L', label: 'mmol/L', factor: 1 },
    { id: 'umol/L', label: 'µmol/L', factor: 1e-3 },
    { id: 'mol/m3', label: 'mol/m³', factor: 1 },
  ]),
  massConcentration: k('massConcentration', 'Concentração em massa', D.massConcentration, [
    { id: 'g/L', label: 'g/L', factor: 1 },
    { id: 'mg/L', label: 'mg/L', factor: 1e-3 },
    { id: 'ug/L', label: 'µg/L', factor: 1e-6 },
    { id: 'g/mL', label: 'g/mL', factor: 1e3 },
    { id: 'pct-mv', label: '% (m/v) = g/100 mL', factor: 10 },
    { id: 'kg/m3', label: 'kg/m³', factor: 1 },
  ]),
  density: k('density', 'Densidade', D.density, [
    { id: 'g/mL', label: 'g/mL', factor: 1e3 },
    { id: 'g/cm3', label: 'g/cm³', factor: 1e3 },
    { id: 'kg/L', label: 'kg/L', factor: 1e3 },
    { id: 'kg/m3', label: 'kg/m³', factor: 1 },
  ]),
  potential: k('potential', 'Potencial elétrico', D.potential, [
    { id: 'V', label: 'V', factor: 1 },
    { id: 'mV', label: 'mV', factor: 1e-3 },
  ], false),
  rate1: k('rate1', 'Constante de velocidade (1ª ordem)', D.rate1, [
    { id: 's-1', label: 's⁻¹', factor: 1 },
    { id: 'min-1', label: 'min⁻¹', factor: 1 / 60 },
    { id: 'h-1', label: 'h⁻¹', factor: 1 / 3600 },
  ]),
  rate2: k('rate2', 'Constante de velocidade (2ª ordem)', D.rate2, [
    { id: 'L/(mol·s)', label: 'L·mol⁻¹·s⁻¹', factor: 1e-3 },
    { id: 'm3/(mol·s)', label: 'm³·mol⁻¹·s⁻¹', factor: 1 },
  ]),
  rate0: k('rate0', 'Constante de velocidade (ordem zero)', D.rate0, [
    { id: 'mol/(L·s)', label: 'mol·L⁻¹·s⁻¹', factor: 1e3 },
  ]),
  dimensionless: k('dimensionless', 'Adimensional', D.none, [{ id: '1', label: '—', factor: 1 }], false),
  percent: k('percent', 'Porcentagem', D.none, [{ id: '%', label: '%', factor: 0.01 }]),
  count: k('count', 'Número de entidades', D.none, [{ id: 'un', label: 'entidades', factor: 1 }]),
} satisfies Record<string, QuantityKind>;

export type KindId = keyof typeof KINDS;

export function getUnit(kind: KindId, unitId: string): UnitDef {
  const u = KINDS[kind].units.find((x) => x.id === unitId);
  if (!u) throw new CalcError(`Unidade "${unitId}" não pertence a ${KINDS[kind].label}.`);
  return u;
}

/** Converte um valor numérico na unidade escolhida em uma grandeza SI. */
export function toQ(value: number, kind: KindId, unitId: string): Q {
  const u = getUnit(kind, unitId);
  const si = value * u.factor + (u.offset ?? 0);
  if (kind === 'temperature' && si <= 0) {
    throw new CalcError('A temperatura termodinâmica deve ser maior que 0 K.');
  }
  return Q.of(si, KINDS[kind].dims);
}

/** Converte uma grandeza SI para a unidade de exibição, conferindo a dimensão. */
export function fromQ(q: Q, kind: KindId, unitId: string): number {
  if (!q.is(KINDS[kind].dims)) {
    throw new CalcError(`Resultado com dimensão incompatível com ${KINDS[kind].label}.`);
  }
  const u = getUnit(kind, unitId);
  return (q.value - (u.offset ?? 0)) / u.factor;
}

/** Converte diretamente entre unidades do mesmo tipo. */
export function convert(value: number, kind: KindId, from: string, to: string): number {
  return fromQ(toQ(value, kind, from), kind, to);
}
