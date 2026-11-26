/**
 * Contador anônimo do MOLECULAB (Cloudflare Pages Functions + D1).
 *
 * Privacidade (LGPD): não guardamos nome, e-mail, IP, cookies de terceiros nem
 * "fingerprint". Cada navegador gera um código aleatório (UUID) que fica só nele;
 * o servidor guarda esse código, a data do primeiro e do último acesso e o número
 * de visitas. Para limitar abuso, o IP é transformado em um hash com sal secreto
 * que muda todo dia (não é possível recuperar o IP a partir dele) e é apagado
 * depois de 2 dias.
 */

// Tipos mínimos do D1 (evita depender de @cloudflare/workers-types).
export interface D1Result<T = unknown> { results?: T[] }
export interface D1Stmt {
  bind(...v: unknown[]): D1Stmt;
  first<T = unknown>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = unknown>(): Promise<D1Result<T>>;
}
export interface D1Like {
  prepare(sql: string): D1Stmt;
  batch(stmts: D1Stmt[]): Promise<unknown>;
}
export interface Env {
  DB?: D1Like;
  /** Senha do painel de estatísticas (variável secreta no Cloudflare). */
  STATS_TOKEN?: string;
  /** Sal para o hash diário do IP (variável secreta; opcional, cai no STATS_TOKEN). */
  HASH_SALT?: string;
}
export interface Ctx {
  request: Request;
  env: Env;
}

export const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS visitors (id TEXT PRIMARY KEY, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, visits INTEGER NOT NULL DEFAULT 1)`,
  `CREATE TABLE IF NOT EXISTS daily (day TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY (day, id))`,
  `CREATE TABLE IF NOT EXISTS events (day TEXT NOT NULL, name TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, name))`,
  `CREATE TABLE IF NOT EXISTS ratelimit (day TEXT NOT NULL, h TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, h))`,
];

let ready = false;
export async function ensureSchema(db: D1Like) {
  if (ready) return;
  for (const sql of SCHEMA) await db.prepare(sql).run();
  ready = true;
}
/** Só para testes. */
export const _resetSchemaFlag = () => { ready = false; };

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Eventos aceitos (lista fechada: o cliente não consegue criar nomes arbitrários). */
export const EVENTS = ['molecula', 'calculo', 'elemento', 'grupos', 'propriedades', 'conhecimento'] as const;

/** Dia no fuso de Brasília (UTC−3), formato AAAA-MM-DD. */
export function today(now = new Date()): string {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10);
}

export function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Aceita apenas chamadas do próprio site (bloqueia formulários/scripts de outros domínios). */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // navegadores antigos / sendBeacon sem Origin
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export function noDb() {
  return json({ ok: false, configured: false, error: 'Banco D1 não vinculado (binding "DB").' }, 503);
}
