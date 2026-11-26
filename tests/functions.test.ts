// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { onRequestPost as visit } from '../functions/api/visit';
import { onRequestPost as event } from '../functions/api/event';
import { onRequestGet as stats } from '../functions/api/stats';
import { _resetSchemaFlag, D1Like, D1Stmt } from '../functions/_lib/db';

/** Adaptador mínimo da API do Cloudflare D1 sobre SQLite em memória. */
function fakeD1(): D1Like {
  const db = new DatabaseSync(':memory:');
  const stmt = (sql: string, args: unknown[] = []): D1Stmt => ({
    bind: (...v) => stmt(sql, v),
    first: async <T,>() => (db.prepare(sql).get(...(args as never[])) as T) ?? null,
    run: async () => db.prepare(sql).run(...(args as never[])),
    all: async <T,>() => ({ results: db.prepare(sql).all(...(args as never[])) as T[] }),
  });
  return { prepare: (sql) => stmt(sql), batch: async (s) => Promise.all(s.map((x) => x.run())) };
}

const URL_ = 'https://moleculab.pages.dev/api/';
const post = (path: string, body: unknown, ip = '1.2.3.4', origin = 'https://moleculab.pages.dev') =>
  new Request(URL_ + path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, origin } });
const uuid = () => crypto.randomUUID();

describe('contador anônimo (Pages Functions + D1)', () => {
  let env: { DB: D1Like; STATS_TOKEN: string };
  beforeEach(() => {
    _resetSchemaFlag();
    env = { DB: fakeD1(), STATS_TOKEN: 'segredo-123' };
  });

  it('conta cada navegador uma única vez e soma visitas', async () => {
    const a = uuid(), b = uuid();
    expect(await (await visit({ request: post('visit', { id: a }), env })).json()).toEqual({ ok: true, new: true });
    expect(await (await visit({ request: post('visit', { id: a }), env })).json()).toEqual({ ok: true, new: false });
    expect(await (await visit({ request: post('visit', { id: b }), env })).json()).toEqual({ ok: true, new: true });
    const r = await (await stats({ request: new Request(URL_ + 'stats', { headers: { authorization: 'Bearer segredo-123' } }), env })).json();
    expect(r).toMatchObject({ total: 2, visits: 3, returning: 1 });
    expect(r.daily[0].n).toBe(2);
  });

  it('rejeita ids que não são UUID e chamadas de outro domínio', async () => {
    expect((await visit({ request: post('visit', { id: 'joao@email.com' }), env })).status).toBe(400);
    expect((await visit({ request: post('visit', { id: uuid() }, '1.1.1.1', 'https://outro-site.com'), env })).status).toBe(403);
  });

  it('limita visitantes novos por rede por dia (anti-inflação) sem guardar o IP', async () => {
    for (let i = 0; i < 30; i++) await visit({ request: post('visit', { id: uuid() }, '9.9.9.9'), env });
    expect((await visit({ request: post('visit', { id: uuid() }, '9.9.9.9'), env })).status).toBe(429);
    expect((await visit({ request: post('visit', { id: uuid() }, '8.8.8.8'), env })).status).toBe(200);
    const rows = await env.DB.prepare('SELECT h FROM ratelimit').all<{ h: string }>();
    expect(JSON.stringify(rows.results)).not.toContain('9.9.9.9');
  });

  it('estatísticas: nenhum número sem a senha certa', async () => {
    await visit({ request: post('visit', { id: uuid() }), env });
    const anon = await stats({ request: new Request(URL_ + 'stats'), env });
    expect(anon.status).toBe(401);
    expect(JSON.stringify(await anon.json())).not.toContain('total');
    expect((await stats({ request: new Request(URL_ + 'stats', { headers: { authorization: 'Bearer errada' } }), env })).status).toBe(401);
  });

  it('eventos: só nomes da lista fechada', async () => {
    expect((await event({ request: post('event', { name: 'calculo' }), env })).status).toBe(200);
    await event({ request: post('event', { name: 'calculo' }), env });
    expect((await event({ request: post('event', { name: '<script>' }), env })).status).toBe(400);
    const r = await (await stats({ request: new Request(URL_ + 'stats', { headers: { authorization: 'Bearer segredo-123' } }), env })).json();
    expect(r.events).toEqual([{ name: 'calculo', n: 2 }]);
  });

  it('sem banco vinculado, responde 503 (o site continua funcionando)', async () => {
    expect((await visit({ request: post('visit', { id: uuid() }), env: {} })).status).toBe(503);
  });
});
