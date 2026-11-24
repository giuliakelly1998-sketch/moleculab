import { request } from './http';
import { cacheGet, cacheSet } from './cache';

/** Sugestões de nomes do serviço de autocompletar da PubChem. */
export async function suggestNames(term: string, limit = 6, signal?: AbortSignal): Promise<string[]> {
  const t = term.trim().toLowerCase();
  if (t.length < 3) return [];
  const key = `ac:${t}`;
  const hit = cacheGet<string[]>(key);
  if (hit) return hit;
  const res = await request(
    `https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(t)}/json?limit=${limit}`,
    { timeoutMs: 6000, signal },
  );
  if (!res.ok) return [];
  const json = (await res.json()) as { dictionary_terms?: { compound?: string[] } };
  const list = json.dictionary_terms?.compound ?? [];
  cacheSet(key, list, false);
  return list;
}
