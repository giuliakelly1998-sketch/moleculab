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

/** Requisição deduplicada: chamadas idênticas simultâneas compartilham a mesma resposta. */
export function request(url: string, opts: RequestOptions = {}): Promise<Response> {
  const key = `${opts.method ?? 'GET'} ${url} ${opts.body?.toString() ?? ''}`;
  const existing = inflight.get(key);
  if (existing) return existing.then((r) => r.clone());
  const p = doFetch(url, opts).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p.then((r) => r.clone());
}

export function __resetHttpForTests() {
  timestamps = [];
  inflight.clear();
}
