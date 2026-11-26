import { AppError } from './errors';

/**
 * Cliente HTTP para APIs públicas:
 * - limite de taxa (a PubChem pede no máximo 5 requisições/s);
 * - deduplicação de chamadas idênticas em andamento;
 * - timeout com AbortController;
 * - nova tentativa com espera exponencial em 503 (servidor ocupado) e falhas de rede.
 */
const MAX_PER_SECOND = 4;
const TIMEOUT_MS = 20_000;
const MAX_RETRIES = 2;

let timestamps: number[] = [];
const inflight = new Map<string, Promise<Response>>();

async function rateLimit() {
  for (;;) {
    const now = Date.now();
    timestamps = timestamps.filter((t) => now - t < 1000);
    if (timestamps.length < MAX_PER_SECOND) {
      timestamps.push(now);
      return;
    }
    await sleep(1000 - (now - timestamps[0]) + 5);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: URLSearchParams;
  timeoutMs?: number;
  signal?: AbortSignal;
}

async function doFetch(url: string, opts: RequestOptions): Promise<Response> {
  let attempt = 0;
  for (;;) {
    await rateLimit();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? TIMEOUT_MS);
    const onAbort = () => ctrl.abort();
    opts.signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(url, { method: opts.method ?? 'GET', body: opts.body, signal: ctrl.signal });
      if ((res.status === 503 || res.status === 429) && attempt < MAX_RETRIES) {
        attempt++;
        await sleep(600 * 2 ** attempt);
        continue;
      }
      return res;
    } catch (e) {
      if (opts.signal?.aborted) throw new AppError('TIMEOUT', 'Consulta cancelada.');
      if (ctrl.signal.aborted) {
        if (attempt < MAX_RETRIES) { attempt++; continue; }
        throw new AppError('TIMEOUT', 'O serviço demorou demais para responder. Tente novamente.');
      }
      if (attempt < MAX_RETRIES) {
        attempt++;
        await sleep(500 * 2 ** attempt);
        continue;
      }
      throw new AppError('NETWORK', 'Não foi possível conectar ao serviço. Verifique sua conexão.', String(e));
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener('abort', onAbort);
    }
  }
}

const PUBCHEM_HOST = 'https://pubchem.ncbi.nlm.nih.gov/';
const isLocalHost = () => typeof location !== 'undefined' && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
let proxyWorks: boolean | null = null;

/** Endereço do proxy do próprio site (Cloudflare Pages Function em /api/pubchem/). */
function proxyUrl(url: string): string | null {
  if (typeof location === 'undefined' || !url.startsWith(PUBCHEM_HOST) || isLocalHost()) return null;
  return new URL('api/pubchem/' + url.slice(PUBCHEM_HOST.length), location.href.split('#')[0]).toString();
}

const inIframe = () => {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
};

/**
 * Tenta a PubChem diretamente; se a rede bloquear o acesso, tenta pelo proxy do próprio site.
 * Depois que o proxy funciona uma vez, as próximas chamadas já vão direto por ele.
 */
async function fetchWithFallback(url: string, opts: RequestOptions): Promise<Response> {
  const proxy = proxyUrl(url);
  if (proxy && proxyWorks) return doFetch(proxy, opts);
  try {
    return await doFetch(url, opts);
  } catch (e) {
    if (!(e instanceof AppError) || e.code !== 'NETWORK') throw e;
    if (proxy && proxyWorks !== false) {
      try {
        const r = await doFetch(proxy, opts);
        // Só aceita a resposta se ela vier do proxy do MOLECULAB (cabeçalho próprio). Sem a função
        // publicada (ou numa pré-visualização), o servidor devolve outra coisa: não é a PubChem.
        if (r.headers.get('x-moleculab-proxy') === '1') {
          proxyWorks = true;
          return r;
        }
        proxyWorks = false;
      } catch {
        proxyWorks = false;
      }
    }
    if (url.startsWith(PUBCHEM_HOST)) {
      throw new AppError(
        'NETWORK',
        inIframe()
          ? 'A PubChem não pode ser acessada nesta pré-visualização incorporada (conexões externas são bloqueadas). Abra o site em moleculab.pages.dev para buscar por nome.'
          : 'Não foi possível acessar a PubChem (pubchem.ncbi.nlm.nih.gov). Verifique a conexão ou se a rede/alguma extensão do navegador bloqueia o site. Busca por SMILES continua funcionando.',
        String(e),
      );
    }
    throw e;
  }
}

/** Requisição deduplicada: chamadas idênticas simultâneas compartilham a mesma resposta. */
export function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const key = `${opts.method ?? 'GET'} ${url} ${opts.body?.toString() ?? ''}`;
  const existing = inflight.get(key);
  if (existing) return existing.then((r) => r.clone());
  const p = fetchWithFallback(url, opts).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p.then((r) => r.clone());
}

export function __resetHttpForTests() {
  timestamps = [];
  proxyWorks = null;
  inflight.clear();
}
