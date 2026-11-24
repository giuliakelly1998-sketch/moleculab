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
