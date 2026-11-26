import type { Ctx } from '../../_lib/db';

/**
 * Proxy de leitura para a PubChem, usado só quando o navegador não consegue acessar
 * pubchem.ncbi.nlm.nih.gov diretamente (rede da escola/empresa, extensão que bloqueia etc.).
 * Aceita apenas os caminhos públicos da API (rest/pug, rest/pug_view, rest/autocomplete).
 */
const ALLOWED = /^rest\/(pug|pug_view|autocomplete)\//;

async function handle({ request }: Ctx): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/pubchem\//, '');
  if (!ALLOWED.test(path)) return new Response('Caminho não permitido', { status: 400, headers: { 'x-moleculab-proxy': '1' } });
  const target = `https://pubchem.ncbi.nlm.nih.gov/${path}${url.search}`;
  const init: RequestInit = { method: request.method, headers: { accept: request.headers.get('accept') ?? '*/*' } };
  if (request.method === 'POST') {
    init.body = await request.text();
    (init.headers as Record<string, string>)['content-type'] = request.headers.get('content-type') ?? 'application/x-www-form-urlencoded';
  }
  const res = await fetch(target, init);
  const headers = new Headers();
  headers.set('content-type', res.headers.get('content-type') ?? 'application/octet-stream');
  headers.set('cache-control', res.ok ? 'public, max-age=3600' : 'no-store');
  headers.set('x-moleculab-proxy', '1');
  return new Response(res.body, { status: res.status, headers });
}

export const onRequestGet = handle;
export const onRequestPost = handle;
