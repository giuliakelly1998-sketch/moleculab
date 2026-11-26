import { Ctx, ensureSchema, json, noDb, today } from '../_lib/db';

/**
 * GET /api/stats  — painel privado: exige "Authorization: Bearer <STATS_TOKEN>".
 * Sem a senha certa, não devolve nenhum número.
 */
export async function onRequestGet({ request, env }: Ctx): Promise<Response> {
  if (!env.DB) return noDb();
  const db = env.DB;
  await ensureSchema(db);
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!env.STATS_TOKEN) return json({ ok: false, error: 'STATS_TOKEN não configurado no Cloudflare.' }, 503);
  if (!token || !(await safeEqual(token, env.STATS_TOKEN))) return json({ ok: false, error: 'Senha incorreta.' }, 401);
  const total = (await db.prepare('SELECT COUNT(*) AS n FROM visitors').first<{ n: number }>())?.n ?? 0;

  const since = today(new Date(Date.now() - 89 * 86400_000));
  const visits = (await db.prepare('SELECT COALESCE(SUM(visits), 0) AS n FROM visitors').first<{ n: number }>())?.n ?? 0;
  const returning = (await db.prepare('SELECT COUNT(*) AS n FROM visitors WHERE visits > 1').first<{ n: number }>())?.n ?? 0;
  const first = (await db.prepare('SELECT MIN(first_seen) AS d FROM visitors').first<{ d: string | null }>())?.d ?? null;
  const daily = (await db.prepare('SELECT day, COUNT(*) AS n FROM daily WHERE day >= ? GROUP BY day ORDER BY day').bind(since).all<{ day: string; n: number }>()).results ?? [];
  const newDaily = (await db.prepare("SELECT substr(datetime(first_seen, '-3 hours'), 1, 10) AS day, COUNT(*) AS n FROM visitors WHERE first_seen >= ? GROUP BY day ORDER BY day").bind(since).all<{ day: string; n: number }>()).results ?? [];
  const events = (await db.prepare('SELECT name, SUM(n) AS n FROM events GROUP BY name ORDER BY n DESC').all<{ name: string; n: number }>()).results ?? [];
  return json({ ok: true, total, visits, returning, first, daily, newDaily, events, generatedAt: new Date().toISOString() });
}

async function safeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  const u = new Uint8Array(x), v = new Uint8Array(y);
  let d = 0;
  for (let i = 0; i < u.length; i++) d |= u[i] ^ v[i];
  return d === 0;
}
