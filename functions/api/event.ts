import { Ctx, ensureSchema, EVENTS, json, noDb, sameOrigin, today } from '../_lib/db';

/** POST /api/event  { name }  → soma 1 ao contador diário do uso de uma ferramenta. */
export async function onRequestPost({ request, env }: Ctx): Promise<Response> {
  if (!env.DB) return noDb();
  if (!sameOrigin(request)) return json({ ok: false }, 403);
  let name = '';
  try {
    name = String(((await request.json()) as { name?: unknown }).name ?? '');
  } catch {
    return json({ ok: false }, 400);
  }
  if (!(EVENTS as readonly string[]).includes(name)) return json({ ok: false, error: 'evento desconhecido' }, 400);
  await ensureSchema(env.DB);
  await env.DB.prepare('INSERT INTO events (day, name, n) VALUES (?, ?, 1) ON CONFLICT(day, name) DO UPDATE SET n = n + 1').bind(today(), name).run();
  return json({ ok: true });
}
