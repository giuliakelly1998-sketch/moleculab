/** Formatação numérica em pt-BR com algarismos significativos. */
export function fmtNum(value: number, sig = 5): string {
  if (!Number.isFinite(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e6 || abs < 1e-3) {
    const [mant, exp] = value.toExponential(sig - 1).split('e');
    const m = trimZeros(mant).replace('.', ',');
    return `${m} × 10${toSup(parseInt(exp, 10))}`;
  }
  const s = Number(value.toPrecision(sig));
  return s.toLocaleString('pt-BR', { maximumFractionDigits: 10, useGrouping: abs >= 1e4 });
}

function trimZeros(s: string) {
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

const SUP: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};
export function toSup(n: number): string {
  return String(n).split('').map((c) => SUP[c] ?? c).join('');
}

/** Aceita "1,5", "1.5", "1,5e-3", "1.5E3"; rejeita valores ambíguos como "1.000,5". */
export function parseNumber(raw: string): number | null {
  const t = (raw ?? '').trim().replace(/\s+/g, '').replace('×10^', 'e').replace('x10^', 'e');
  if (!t) return null;
  if ((t.match(/[.,]/g) ?? []).length > 1) return NaN;
  const n = Number(t.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export function fmtUnitValue(value: number | null | undefined, unit?: string, sig = 5) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return unit ? `${fmtNum(value, sig)} ${unit}` : fmtNum(value, sig);
}
