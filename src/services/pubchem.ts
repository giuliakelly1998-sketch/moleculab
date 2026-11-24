import { request } from './http';
import { AppError } from './errors';
import { cacheGet, cacheSet } from './cache';

/**
 * Integração com a PubChem PUG REST e PUG View (NCBI).
 * Documentação: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
 * Nenhuma chave de API é necessária; a política de uso pede ≤ 5 requisições/s.
 */
export const PUG = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
export const PUG_VIEW = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug_view';
export const compoundUrl = (cid: number) => `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

export interface PubChemProperties {
  CID: number;
  Title?: string;
  IUPACName?: string;
  MolecularFormula?: string;
  MolecularWeight?: string | number;
  ExactMass?: string | number;
  SMILES?: string;
  ConnectivitySMILES?: string;
  IsomericSMILES?: string;
  CanonicalSMILES?: string;
  InChI?: string;
  InChIKey?: string;
  XLogP?: number;
  TPSA?: number;
  HBondDonorCount?: number;
  HBondAcceptorCount?: number;
  RotatableBondCount?: number;
  HeavyAtomCount?: number;
  Charge?: number;
  Complexity?: number;
}

const PROPS_NEW =
  'Title,IUPACName,MolecularFormula,MolecularWeight,ExactMass,SMILES,ConnectivitySMILES,InChI,InChIKey,XLogP,TPSA,HBondDonorCount,HBondAcceptorCount,RotatableBondCount,HeavyAtomCount,Charge,Complexity';
// Nomes antigos (antes da revisão de 2025 dos campos de SMILES), usados como alternativa.
const PROPS_OLD = PROPS_NEW.replace('SMILES,ConnectivitySMILES', 'IsomericSMILES,CanonicalSMILES');

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError('UNKNOWN', 'Resposta inesperada da PubChem.', text.slice(0, 200));
  }
}

function faultMessage(body: unknown): string | undefined {
  const f = (body as { Fault?: { Message?: string; Details?: string[] } })?.Fault;
  return f ? [f.Message, ...(f.Details ?? [])].filter(Boolean).join(' — ') : undefined;
}

async function pugJson<T>(url: string, opts: { body?: URLSearchParams; notFoundMessage?: string } = {}): Promise<T> {
  const res = await request(url, opts.body ? { method: 'POST', body: opts.body } : {});
  if (res.ok) return (await readJson(res)) as T;
  const body = await readJson(res).catch(() => undefined);
  const detail = faultMessage(body);
  if (res.status === 404) throw new AppError('NOT_FOUND', opts.notFoundMessage ?? 'Nenhum composto encontrado na PubChem.', detail);
  if (res.status === 400) throw new AppError('BAD_REQUEST', 'A PubChem não aceitou a consulta. Confira o formato do termo.', detail);
  if (res.status === 503 || res.status === 429) throw new AppError('BUSY', 'A PubChem está sobrecarregada no momento. Tente de novo em instantes.', detail);
  if (res.status === 504) throw new AppError('TIMEOUT', 'A consulta demorou demais na PubChem. Tente um termo mais específico.', detail);
  throw new AppError('UNKNOWN', `Erro ${res.status} ao consultar a PubChem.`, detail);
}

async function cached<T>(key: string, fn: () => Promise<T>, persist = true): Promise<T> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return hit;
  const v = await fn();
  cacheSet(key, v, persist);
  return v;
}

const enc = encodeURIComponent;

type CidList = { IdentifierList?: { CID?: number[] } };
const cids = (r: CidList) => (r.IdentifierList?.CID ?? []).filter((c) => c > 0);

export function cidsByName(name: string): Promise<number[]> {
  return cached(`cids:name:${name.toLowerCase()}`, async () => {
    const r = await pugJson<CidList>(`${PUG}/compound/name/${enc(name)}/cids/JSON`, {
      notFoundMessage: `Nenhum composto chamado "${name}" foi encontrado na PubChem. Tente o nome em inglês ou um identificador.`,
    });
    return cids(r);
  });
}

export function cidsBySmiles(smiles: string): Promise<number[]> {
  // POST evita problemas com "/", "#" e "\" do SMILES na URL.
  return cached(`cids:smiles:${smiles}`, async () => {
    const r = await pugJson<CidList>(`${PUG}/compound/smiles/cids/JSON`, { body: new URLSearchParams({ smiles }) }).catch((e) => {
      if (e instanceof AppError && e.code === 'NOT_FOUND') return { IdentifierList: { CID: [] } } as CidList;
      throw e;
    });
    return cids(r);
  });
}

export function cidsByInchi(inchi: string): Promise<number[]> {
  return cached(`cids:inchi:${inchi}`, async () => cids(await pugJson<CidList>(`${PUG}/compound/inchi/cids/JSON`, { body: new URLSearchParams({ inchi }) })));
}

/** Busca rápida por fórmula (síncrona). Retorna todos os isômeros cadastrados, limitados. */
export function cidsByFormula(formula: string, max = 40): Promise<number[]> {
  return cached(`cids:formula:${formula}:${max}`, async () => {
    const r = await pugJson<CidList>(`${PUG}/compound/fastformula/${enc(formula)}/cids/JSON?MaxRecords=${max}`, {
      notFoundMessage: `Nenhum composto com a fórmula ${formula} foi encontrado.`,
    });
    return cids(r);
  });
}

export async function properties(cidList: number[]): Promise<PubChemProperties[]> {
  if (!cidList.length) return [];
  const key = `props:${cidList.join(',')}`;
  return cached(key, async () => {
    type R = { PropertyTable?: { Properties?: PubChemProperties[] } };
    let r: R;
    try {
      r = await pugJson<R>(`${PUG}/compound/cid/${cidList.join(',')}/property/${PROPS_NEW}/JSON`);
    } catch (e) {
      if (e instanceof AppError && e.code === 'BAD_REQUEST') {
        r = await pugJson<R>(`${PUG}/compound/cid/${cidList.join(',')}/property/${PROPS_OLD}/JSON`);
      } else throw e;
    }
    return r.PropertyTable?.Properties ?? [];
  });
}

/** Estrutura em SDF: tenta a conformação 3D calculada pela PubChem; se não houver, usa a 2D. */
export async function structure(cid: number): Promise<{ molblock: string; dim: '3d' | '2d' } | null> {
  const key = `sdf:${cid}`;
  const hit = cacheGet<{ molblock: string; dim: '3d' | '2d' } | null>(key);
  if (hit !== undefined) return hit;
  for (const dim of ['3d', '2d'] as const) {
    const res = await request(`${PUG}/compound/cid/${cid}/SDF?record_type=${dim}`);
    if (res.ok) {
      const text = await res.text();
      const molblock = text.split('$$$$')[0];
      const value = { molblock, dim };
      cacheSet(key, value);
      return value;
    }
    if (res.status !== 404 && res.status !== 400) {
      throw new AppError('UNKNOWN', `Erro ${res.status} ao obter a estrutura.`);
    }
  }
  cacheSet(key, null);
  return null;
}

// ---- PUG View: propriedades experimentais anotadas --------------------------
export interface AnnotatedValue {
  text: string;
  sourceName: string;
  sourceUrl?: string;
  reference?: string;
}

interface PVInfo {
  ReferenceNumber?: number;
  Reference?: string[];
  Value?: { StringWithMarkup?: { String: string }[]; Number?: number[]; Unit?: string };
}
interface PVSection {
  TOCHeading?: string;
  Section?: PVSection[];
  Information?: PVInfo[];
}
interface PVReference {
  ReferenceNumber: number;
  SourceName?: string;
  URL?: string;
}
interface PVRecord {
  Record?: { Section?: PVSection[]; Reference?: PVReference[] };
}

export function parsePugView(json: PVRecord, max = 6): AnnotatedValue[] {
  const refs = new Map<number, PVReference>();
  for (const r of json.Record?.Reference ?? []) refs.set(r.ReferenceNumber, r);
  const infos: PVInfo[] = [];
  const walk = (s: PVSection) => {
    s.Information?.forEach((i) => infos.push(i));
    s.Section?.forEach(walk);
  };
  json.Record?.Section?.forEach(walk);
  const out: AnnotatedValue[] = [];
  const seen = new Set<string>();
  for (const info of infos) {
    const v = info.Value;
    if (!v) continue;
    let text = v.StringWithMarkup?.map((s) => s.String).join(' ').trim() ?? '';
    if (!text && v.Number?.length) text = `${v.Number.join(' – ')}${v.Unit ? ' ' + v.Unit : ''}`;
    if (!text || seen.has(text)) continue;
    seen.add(text);
    const ref = info.ReferenceNumber !== undefined ? refs.get(info.ReferenceNumber) : undefined;
    out.push({
      text,
      sourceName: ref?.SourceName ?? 'PubChem',
      sourceUrl: ref?.URL,
      reference: info.Reference?.join(' '),
    });
    if (out.length >= max) break;
  }
  return out;
}

/** Retorna [] quando a PubChem não tem anotação para o tópico (não é erro). */
export function annotation(cid: number, heading: string): Promise<AnnotatedValue[]> {
  return cached(`pv:${cid}:${heading}`, async () => {
    try {
      const json = await pugJson<PVRecord>(`${PUG_VIEW}/data/compound/${cid}/JSON?heading=${enc(heading)}`);
      return parsePugView(json);
    } catch (e) {
      if (e instanceof AppError && (e.code === 'NOT_FOUND' || e.code === 'BAD_REQUEST')) return [];
      throw e;
    }
  });
}

/** Verificação leve de disponibilidade (sem cache). */
export async function ping(): Promise<{ ok: boolean; ms: number; message?: string }> {
  const t0 = performance.now();
  try {
    const res = await request(`${PUG}/compound/cid/962/property/MolecularFormula/JSON?_=${Date.now()}`, { timeoutMs: 8000 });
    return { ok: res.ok, ms: Math.round(performance.now() - t0), message: res.ok ? undefined : `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, ms: Math.round(performance.now() - t0), message: e instanceof Error ? e.message : String(e) };
  }
}
