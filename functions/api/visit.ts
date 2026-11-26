import { Ctx, ensureSchema, json, noDb, sameOrigin, sha256, today, UUID_RE } from '../_lib/db';

/** Máximo de visitantes NOVOS por rede (hash diário do IP) por dia: evita inflar o número. */
const NEW_PER_IP_PER_DAY = 30;

/** POST /api/visit  { id }  → registra a visita do navegador (uma vez por sessão). */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!env.DB) return noDb();
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  let id = '';
  try {
    id = String(((await request.json()) as { id?: unknown }).id ?? '').toLowerCase();
  } catch {
    return json({ ok: false, error: 'JSON inválido' }, 400);
  }
  if (!UUID_RE.test(id)) return json({ ok: false, error: 'id inválido' }, 400);

  const db = env.DB;
  await ensureSchema(db);
  const day = today();
  const now = new Date().toISOString();

  const known = await db.prepare('SELECT id FROM visitors WHERE id = ?').bind(id).first();
  if (!known) {
    const ip = request.headers.get('cf-connecting-ip') ?? '';
    const h = await sha256(`${ip}|${day}|${env.HASH_SALT ?? env.STATS_TOKEN ?? 'moleculab'}`);
    const rl = await db.prepare('SELECT n FROM ratelimit WHERE day = ? AND h = ?').bind(day, h).first<{ n: number }>();
    if (rl && rl.n >= NEW_PER_IP_PER_DAY) return json({ ok: false, error: 'limite' }, 429);
    await db.batch([
      db.prepare('INSERT INTO ratelimit (day, h, n) VALUES (?, ?, 1) ON CONFLICT(day, h) DO UPDATE SET n = n + 1').bind(day, h),
      db.prepare('INSERT INTO visitors (id, first_seen, last_seen, visits) VALUES (?, ?, ?, 1)').bind(id, now, now),
      db.prepare('DELETE FROM ratelimit WHERE day < ?').bind(today(new Date(Date.now() - 2 * 86400_000))),
    ]);
  } else {
    await db.prepare('UPDATE visitors SET last_seen = ?, visits = visits + 1 WHERE id = ?').bind(now, id).run();
  }
  await db.prepare('INSERT OR IGNORE INTO daily (day, id) VALUES (?, ?)').bind(day, id).run();
  return json({ ok: true, new: !known });
}
