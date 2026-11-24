import * as pc from './pubchem';
import { AppError } from './errors';
import { loadRDKit, sanitizeSmiles, withMol } from './rdkit';
import { detectQueryType, isValidCas, normalizeCid, QueryMode, QueryType } from '../chem/queryDetect';
import { countsToFormula, looksLikeFormula, parseFormula } from '../chem/formula';
import { MoleculeRecord, SearchOutcome, num, Candidate } from '../chem/molecule';
import { suggestNames } from './autocomplete';
import { parseMolblock, formulaFromAtoms } from '../chem/sdf';

const MAX_CANDIDATES = 20;

/** Ponto de entrada da busca: identifica o tipo, consulta a PubChem e monta o registro. */
export async function searchMolecule(text: string, mode: QueryMode = 'auto'): Promise<SearchOutcome> {
  const q = text.trim();
  if (!q) throw new AppError('INVALID_INPUT', 'Digite um termo de busca.');
  if (q.length > 1000) throw new AppError('INVALID_INPUT', 'Termo de busca longo demais.');
  const type: QueryType = mode === 'auto' ? detectQueryType(q) : mode;

  switch (type) {
    case 'cid': {
      const cid = normalizeCid(q);
      if (!cid) throw new AppError('INVALID_INPUT', 'CID inválido: use um número inteiro positivo.');
      return { kind: 'single', record: await recordFromCid(cid, q, type), interpretedAs: type };
    }
    case 'cas': {
      if (!isValidCas(q)) throw new AppError('INVALID_INPUT', `"${q}" não é um número CAS válido (dígito verificador incorreto).`);
      // A PubChem indexa números CAS como sinônimos depositados; a resolução depende dessas fontes.
      const list = await pc.cidsByName(q);
      return fromCidList(list, q, type, 'CAS resolvido pelos sinônimos depositados na PubChem; confira o registro original.');
    }
    case 'inchi': {
      const list = await pc.cidsByInchi(q);
      return fromCidList(list, q, type);
    }
    case 'formula': {
      const hill = countsToFormula(parseFormula(q));
      const list = await pc.cidsByFormula(hill, 40);
      return fromCidList(list, q, type, list.length > 1 ? `${list.length >= 40 ? 'Mais de 40' : list.length} compostos com fórmula ${hill}. Escolha um.` : undefined, true);
    }
    case 'smiles': {
      const rdkit = await loadRDKit();
      let canonical: string;
      try {
        canonical = sanitizeSmiles(rdkit, q);
      } catch (e) {
        // Na detecção automática, um "SMILES" inválido provavelmente é fórmula condensada (CH3COOH) ou nome.
        if (mode === 'auto') return searchMolecule(q, looksLikeFormula(q) ? 'formula' : 'name');
        throw e;
      }
      const list = await pc.cidsBySmiles(canonical);
      if (!list.length) {
        return {
          kind: 'single',
          record: await localRecordFromSmiles(canonical, q),
          interpretedAs: type,
          note: 'Estrutura não encontrada na PubChem. Exibindo dados calculados localmente pelo RDKit.',
        };
      }
      return { kind: 'single', record: await recordFromCid(list[0], q, type), interpretedAs: type };
    }
    case 'name':
    default: {
      let list: number[];
      try {
        list = await pc.cidsByName(q);
      } catch (e) {
        if (e instanceof AppError && e.code === 'NOT_FOUND') {
          const alt = await suggestNames(q, 6).catch(() => [] as string[]);
          const err = new AppError(
            'NOT_FOUND',
            `"${q}" não foi encontrado na PubChem.` +
              (alt.length ? ' Talvez você procure um destes nomes:' : ' Tente o nome em inglês, o nome IUPAC, o SMILES ou o número CAS. Em derivados de acetofenona, as posições do anel levam apóstrofo (ex.: 3\'-bromo-4\'-methylacetophenone).'),
          );
          err.suggestions = alt;
          throw err;
        }
        throw e;
      }
      return fromCidList(list, q, 'name', list.length > 1 ? `O nome corresponde a ${list.length} registros; mostrando o principal.` : undefined);
    }
  }
}

async function fromCidList(list: number[], text: string, type: QueryType, note?: string, forceChoice = false): Promise<SearchOutcome> {
  if (!list.length) throw new AppError('NOT_FOUND', 'Nenhum composto encontrado na PubChem.');
  if (list.length === 1 || !forceChoice) {
    return { kind: 'single', record: await recordFromCid(list[0], text, type), interpretedAs: type, note };
  }
  const props = await pc.properties(list.slice(0, MAX_CANDIDATES));
  const candidates: Candidate[] = props.map((p) => ({
    cid: p.CID,
    title: p.Title ?? p.IUPACName ?? `CID ${p.CID}`,
    formula: p.MolecularFormula,
    weight: num(p.MolecularWeight),
  }));
  return { kind: 'multiple', candidates, interpretedAs: type, note };
}

export async function recordFromCid(cid: number, text: string, type: QueryType): Promise<MoleculeRecord> {
  const [props] = await pc.properties([cid]);
  if (!props) throw new AppError('NOT_FOUND', `CID ${cid} não existe na PubChem.`);
  const sdf = await pc.structure(cid).catch(() => null);
  let structure: MoleculeRecord['structure'];
  if (sdf) {
    try {
      const parsed = parseMolblock(sdf.molblock);
      structure = {
        molblock: sdf.molblock,
        dim: sdf.dim,
        origin: sdf.dim === '3d' ? 'pubchem-3d' : 'pubchem-2d',
        atomCount: parsed.atoms.length,
        bondCount: parsed.bonds.length,
      };
    } catch {
      structure = undefined;
    }
  }
  return {
    key: `cid:${cid}`,
    source: 'pubchem',
    cid,
    title: props.Title ?? props.IUPACName ?? `CID ${cid}`,
    iupacName: props.IUPACName,
    formula: props.MolecularFormula,
    molecularWeight: num(props.MolecularWeight),
    exactMass: num(props.ExactMass),
    smiles: props.SMILES ?? props.IsomericSMILES,
    connectivitySmiles: props.ConnectivitySMILES ?? props.CanonicalSMILES,
    inchi: props.InChI,
    inchiKey: props.InChIKey,
    inchiOrigin: props.InChI ? 'pubchem' : undefined,
    charge: num(props.Charge),
    pubchem: {
      xlogp: num(props.XLogP),
      tpsa: num(props.TPSA),
      hbd: num(props.HBondDonorCount),
      hba: num(props.HBondAcceptorCount),
      rotatable: num(props.RotatableBondCount),
      heavyAtoms: num(props.HeavyAtomCount),
      complexity: num(props.Complexity),
    },
    structure,
    query: { text, type },
    retrievedAt: new Date().toISOString(),
  };
}

/** Registro construído apenas com o RDKit, para estruturas ausentes da PubChem. */
export async function localRecordFromSmiles(canonical: string, text: string): Promise<MoleculeRecord> {
  const rdkit = await loadRDKit();
  return withMol(rdkit, canonical, (mol) => {
    mol.set_new_coords(true);
    const molblock = mol.get_molblock();
    const withH = parseMolblock(mol.add_hs());
    const desc = JSON.parse(mol.get_descriptors()) as Record<string, number>;
    let inchi: string | undefined;
    let inchiKey: string | undefined;
    try {
      inchi = mol.get_inchi() || undefined;
      inchiKey = inchi ? rdkit.get_inchikey_for_inchi(inchi) || undefined : undefined;
    } catch {
      inchi = undefined;
    }
    return {
      key: `smiles:${canonical}`,
      source: 'rdkit-local',
      title: canonical,
      formula: formulaFromAtoms(withH.atoms),
      molecularWeight: desc.amw,
      exactMass: desc.exactmw,
      smiles: canonical,
      inchi,
      inchiKey,
      inchiOrigin: inchi ? 'rdkit' : undefined,
      structure: { molblock, dim: '2d', origin: 'rdkit-2d', atomCount: withH.atoms.length, bondCount: withH.bonds.length },
      query: { text, type: 'smiles' },
      retrievedAt: new Date().toISOString(),
    };
  });
}
