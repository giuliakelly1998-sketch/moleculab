/**
 * Contagem anônima de acessos (veja functions/_lib/db.ts para o lado do servidor).
 *
 * - O navegador gera um código aleatório (UUID) e o guarda só no localStorage.
 * - Nenhum dado pessoal é enviado: nada de nome, e-mail, localização ou conteúdo buscado.
 * - Respeita "Do Not Track" e a opção de desativar em Configurações.
 * - Se o servidor não tiver o contador configurado (ou em desenvolvimento), falha em silêncio.
 */
const ID_KEY = 'moleculab.visitorId';
const OPTOUT_KEY = 'moleculab.analyticsOptOut';
const SESSION_KEY = 'moleculab.visitSent';

export type AnalyticsEvent = 'molecula' | 'calculo' | 'elemento' | 'grupos' | 'propriedades' | 'conhecimento';

function store(kind: 'local' | 'session') {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function analyticsDisabled(): boolean {
  if (typeof navigator !== 'undefined' && (navigator.doNotTrack === '1' || (navigator as { globalPrivacyControl?: boolean }).globalPrivacyControl)) return true;
  return store('local')?.getItem(OPTOUT_KEY) === '1';
}

export function setAnalyticsOptOut(off: boolean) {
  const s = store('local');
  if (!s) return;
  if (off) {
    s.setItem(OPTOUT_KEY, '1');
    s.removeItem(ID_KEY);
  } else s.removeItem(OPTOUT_KEY);
}

function visitorId(): string | null {
  const s = store('local');
  if (!s) return null;
  let id = s.getItem(ID_KEY);
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    id = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : null;
    if (!id) return null;
    s.setItem(ID_KEY, id);
  }
  return id;
}

const isLocal = () => typeof location !== 'undefined' && /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(location.hostname);
const apiBase = () => new URL('api/', location.href.split('#')[0]).toString();

function send(path: string, body: unknown) {
  return fetch(apiBase() + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch(() => null);
}

/** Registra a visita uma vez por sessão do navegador. */
export function recordVisit() {
  if (analyticsDisabled() || isLocal()) return;
  const ss = store('session');
  if (ss?.getItem(SESSION_KEY)) return;
  const id = visitorId();
  if (!id) return;
  ss?.setItem(SESSION_KEY, '1');
  void send('visit', { id });
}

const sentEvents = new Set<string>();
/** Conta o uso de uma ferramenta; cada tipo é contado no máximo uma vez a cada 30 s. */
export function trackEvent(name: AnalyticsEvent) {
  if (analyticsDisabled() || isLocal()) return;
  if (sentEvents.has(name)) return;
  sentEvents.add(name);
  setTimeout(() => sentEvents.delete(name), 30_000);
  void send('event', { name });
}

export interface StatsReport {
  total: number;
  visits: number;
  returning: number;
  first: string | null;
  daily: { day: string; n: number }[];
  newDaily: { day: string; n: number }[];
  events: { name: string; n: number }[];
  generatedAt: string;
}

export async function fetchPrivateStats(token: string): Promise<StatsReport> {
  const r = await fetch(apiBase() + 'stats', { headers: { authorization: `Bearer ${token}` } });
  const j = (await r.json().catch(() => ({}))) as StatsReport & { ok?: boolean; error?: string };
  if (!r.ok || !j.ok) throw new Error(j.error ?? (r.status === 404 ? 'O contador ainda não está publicado neste endereço.' : `Erro ${r.status}.`));
  return j;
}
