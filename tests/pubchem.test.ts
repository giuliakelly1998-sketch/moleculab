import { searchMolecule } from '../src/services/moleculeService';
import { parsePugView, annotation } from '../src/services/pubchem';
import { __resetHttpForTests } from '../src/services/http';
import { cacheClear } from '../src/services/cache';
import { AppError } from '../src/services/errors';

/*
 * Respostas simuladas no formato da PUG REST (fixtures de teste, não dados reais
 * exibidos no app). O molfile mínimo descreve a água.
 */
const WATER_SDF = `962
  -OEChem-

  3  2  0     0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.1173 O   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000    0.7572   -0.4692 H   0  0  0  0  0  0  0  0  0  0  0  0
    0.0000   -0.7572   -0.4692 H   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  1  3  1  0  0  0  0
M  END
$$$$
`;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mockFetch(routes: [RegExp, () => Response][]) {
  const calls: string[] = [];
  globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
    const u = String(url);
    calls.push(u);
    for (const [re, fn] of routes) if (re.test(u)) return fn();
    return json({ Fault: { Code: 'PUGREST.NotFound', Message: 'No CID found' } }, 404);
  }) as typeof fetch;
  return calls;
}

beforeEach(() => {
  __resetHttpForTests();
  cacheClear();
});

describe('consulta de moléculas (PubChem simulada)', () => {
  it('nome → CID → propriedades + estrutura 3D', async () => {
    const calls = mockFetch([
      [/name\/water\/cids/, () => json({ IdentifierList: { CID: [962] } })],
      [/cid\/962\/property/, () => json({ PropertyTable: { Properties: [{ CID: 962, Title: 'Water', MolecularFormula: 'H2O', MolecularWeight: '18.015', SMILES: 'O', InChI: 'InChI=1S/H2O/h1H2', XLogP: -0.5, TPSA: 1 }] } })],
      [/SDF\?record_type=3d/, () => new Response(WATER_SDF, { status: 200 })],
    ]);
    const out = await searchMolecule('water');
    expect(out.kind).toBe('single');
    if (out.kind !== 'single') return;
    expect(out.interpretedAs).toBe('name');
    expect(out.record.cid).toBe(962);
    expect(out.record.molecularWeight).toBeCloseTo(18.015);
    expect(out.record.structure?.dim).toBe('3d');
    expect(out.record.structure?.atomCount).toBe(3);
    expect(out.record.structure?.bondCount).toBe(2);
    expect(out.record.pubchem?.xlogp).toBe(-0.5);
    // Propriedade ausente continua ausente (não é inventada).
    expect(out.record.pubchem?.hbd).toBeUndefined();

    // Segunda busca idêntica vem do cache, sem novas chamadas.
    const before = calls.length;
    await searchMolecule('water');
    expect(calls.length).toBe(before);
  });

  it('nome inexistente gera erro compreensível', async () => {
    mockFetch([]);
    await expect(searchMolecule('notacompound')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('CAS com dígito verificador errado é rejeitado sem chamar a API', async () => {
    const calls = mockFetch([]);
    await expect(searchMolecule('50-78-3')).rejects.toBeInstanceOf(AppError);
    expect(calls.length).toBe(0);
  });

  it('fórmula com vários isômeros retorna lista para escolha', async () => {
    mockFetch([
      [/fastformula\/C2H6O\/cids/, () => json({ IdentifierList: { CID: [702, 8254] } })],
      [/cid\/702,8254\/property/, () => json({ PropertyTable: { Properties: [{ CID: 702, Title: 'Ethanol', MolecularFormula: 'C2H6O' }, { CID: 8254, Title: 'Dimethyl Ether', MolecularFormula: 'C2H6O' }] } })],
    ]);
    const out = await searchMolecule('CH3CH2OH');
    expect(out.kind).toBe('multiple');
    if (out.kind === 'multiple') expect(out.candidates.map((c) => c.title)).toEqual(['Ethanol', 'Dimethyl Ether']);
  });

  it('servidor ocupado (503) é tentado novamente', async () => {
    let n = 0;
    mockFetch([
      [/cid\/962\/property/, () => (++n < 2 ? json({ Fault: { Code: 'PUGREST.ServerBusy' } }, 503) : json({ PropertyTable: { Properties: [{ CID: 962, Title: 'Water' }] } }))],
      [/SDF/, () => new Response('', { status: 404 })],
    ]);
    const out = await searchMolecule('962');
    expect(n).toBe(2);
    expect(out.kind === 'single' && out.record.structure).toBeUndefined();
  }, 15000);

  it('falha de rede vira mensagem para o usuário', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
    await expect(searchMolecule('2244')).rejects.toMatchObject({ code: 'NETWORK' });
  }, 15000);
});

describe('PUG View (dados experimentais)', () => {
  const sample = {
    Record: {
      Reference: [{ ReferenceNumber: 7, SourceName: 'Fonte A', URL: 'https://exemplo.org/a' }],
      Section: [
        {
          TOCHeading: 'Chemical and Physical Properties',
          Section: [
            {
              TOCHeading: 'Experimental Properties',
              Section: [
                {
                  TOCHeading: 'Melting Point',
                  Information: [
                    { ReferenceNumber: 7, Value: { StringWithMarkup: [{ String: '135 °C' }] } },
                    { ReferenceNumber: 7, Value: { StringWithMarkup: [{ String: '135 °C' }] } },
                    { ReferenceNumber: 99, Value: { Number: [136], Unit: '°C' } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
  it('extrai valores com fonte, sem duplicatas', () => {
    const v = parsePugView(sample);
    expect(v).toHaveLength(2);
    expect(v[0]).toMatchObject({ text: '135 °C', sourceName: 'Fonte A', sourceUrl: 'https://exemplo.org/a' });
    expect(v[1].text).toBe('136 °C');
  });
  it('tópico sem anotação resulta em lista vazia (dado indisponível)', async () => {
    mockFetch([]);
    expect(await annotation(962, 'Dipole Moment')).toEqual([]);
  });
});

describe('acesso à PubChem bloqueado pela rede', () => {
  it('usa o proxy do próprio site (/api/pubchem/) quando a chamada direta falha', async () => {
    const { request, __resetHttpForTests } = await import('../src/services/http');
    __resetHttpForTests();
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: new URL('https://moleculab.pages.dev/#/explorer'), configurable: true });
    const calls: string[] = [];
    const f = vi.fn(async (u: string) => {
      calls.push(u);
      if (u.startsWith('https://pubchem.ncbi.nlm.nih.gov/')) throw new TypeError('Failed to fetch');
      return new Response('{"ok":1}', { status: 200, headers: { 'content-type': 'application/json', 'x-moleculab-proxy': '1' } });
    });
    vi.stubGlobal('fetch', f);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const r = await request('https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/cids/JSON');
    vi.useRealTimers();
    expect(await r.json()).toEqual({ ok: 1 });
    expect(calls.at(-1)).toBe('https://moleculab.pages.dev/api/pubchem/rest/pug/compound/name/aspirin/cids/JSON');
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { value: orig, configurable: true });
  });
});

describe('biblioteca local (nomes em português e uso sem PubChem)', () => {
  const offline = () => {
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as typeof fetch;
  };

  it('encontra compostos por nome em português, sinônimo e sem acento', async () => {
    const { findByName } = await import('../src/services/localLibrary');
    expect((await findByName('cafeína'))?.pt).toBe('Cafeína');
    expect((await findByName('CAFEINA'))?.pt).toBe('Cafeína');
    expect((await findByName('vinagre'))?.pt).toBe('Ácido etanoico');
    expect((await findByName('aspirin'))?.pt).toBe('Ácido acetilsalicílico');
  });

  it('sem PubChem, a busca por fórmula lista os isômeros da biblioteca', async () => {
    offline();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const r = await searchMolecule('C6H12O6');
    vi.useRealTimers();
    expect(r.kind).toBe('multiple');
    if (r.kind === 'multiple') expect(r.candidates.map((c) => c.title).sort()).toEqual(['D-Frutose', 'D-Galactose', 'D-Glicose']);
  });

  it('proxy ausente (resposta sem assinatura) não vira "não encontrado"', async () => {
    const orig = window.location;
    Object.defineProperty(window, 'location', { value: new URL('https://exemplo.preview.dev/#/explorer'), configurable: true });
    globalThis.fetch = vi.fn(async (u: RequestInfo | URL) => {
      if (String(u).startsWith('https://pubchem')) throw new TypeError('Failed to fetch');
      return new Response('Not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    }) as typeof fetch;
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const err = await searchMolecule('xyzcomposto').catch((e) => e);
    vi.useRealTimers();
    Object.defineProperty(window, 'location', { value: orig, configurable: true });
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('NETWORK');
    expect((err as AppError).message).toMatch(/biblioteca local/);
  });
});
