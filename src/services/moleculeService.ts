import * as pc from './pubchem';
import { AppError } from './errors';
import { loadRDKit, sanitizeSmiles, withMol } from './rdkit';
import { detectQueryType, isValidCas, normalizeCid, QueryMode, QueryType } from '../chem/queryDetect';
import { countsToFormula, looksLikeFormula, parseFormula } from '../chem/formula';
import { MoleculeRecord, SearchOutcome, num, Candidate } from '../chem/molecule';
import { suggestNames } from './autocomplete';
import { parseMolblock, formulaFromAtoms } from '../chem/sdf';
import { applyLocal, findByFormula, findByName, findBySmiles, LocalCompound, suggestLocal } from './localLibrary';

const isOffline = (e: unknown) => e instanceof AppError && (e.code === 'NETWORK' || e.code === 'TIMEOUT');
const OFFLINE_NOTE = 'Sem acesso à PubChem agora. Exibindo a molécula da biblioteca local do MOLECULAB (identificadores e geometria calculados pelo RDKit; sem dados experimentais).';

async function localOutcome(c: LocalCompound, text: string, type: QueryType, note: string): Promise<SearchOutcome> {
  const rec = await localRecordFromSmiles(c.smiles, text);
  return { kind: 'single', record: applyLocal({ ...rec, query: { text, type } }, c), interpretedAs: type, note };
}

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
      let list: number[];
      try {
        list = await pc.cidsByFormula(hill, 40);
      } catch (e) {
        if (!isOffline(e) && !(e instanceof AppError && e.code === 'NOT_FOUND')) throw e;
        const local = await findByFormula(hill);
        if (!local.length) {
          if (isOffline(e)) throw new AppError('NETWORK', `Sem acesso à PubChem agora, e a biblioteca local não tem compostos com a fórmula ${hill}. Tente pelo SMILES.`);
          throw e;
        }
        if (local.length === 1) return localOutcome(local[0], q, type, OFFLINE_NOTE);
        return {
          kind: 'multiple',
          interpretedAs: type,
          note: `${local.length} compostos com fórmula ${hill} na biblioteca local${isOffline(e) ? ' (sem acesso à PubChem agora)' : ''}. Escolha um.`,
          candidates: local.map((c) => ({ title: c.pt, formula: c.formula, weight: c.mw, smiles: c.smiles })),
        };
      }
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
      let list: number[];
      let offline = false;
      try {
        list = await pc.cidsBySmiles(canonical);
      } catch (e) {
        // Sem acesso à PubChem: a estrutura ainda pode ser analisada localmente com o RDKit.
        if (e instanceof AppError && (e.code === 'NETWORK' || e.code === 'TIMEOUT')) {
          list = [];
          offline = true;
        } else throw e;
      }
      if (!list.length) {
        const known = await findBySmiles(canonical);
        if (known) return localOutcome(known, q, type, offline ? OFFLINE_NOTE : 'Estrutura não encontrada na PubChem. Exibindo a molécula da biblioteca local do MOLECULAB.');
        return {
          kind: 'single',
          record: await localRecordFromSmiles(canonical, q),
          interpretedAs: type,
          note: offline
            ? 'Sem acesso à PubChem neste ambiente. Exibindo dados calculados localmente pelo RDKit.'
            : 'Estrutura não encontrada na PubChem. Exibindo dados calculados localmente pelo RDKit.',
        };
      }
      return { kind: 'single', record: await recordFromCid(list[0], q, type), interpretedAs: type };
    }
    case 'name':
    default: {
      const local = await findByName(q);
      let list: number[] = [];
      let lastErr: unknown = null;
      // Nome digitado e, se for um composto da biblioteca, também seus sinônimos em inglês (a PubChem não entende português).
      const tries = [q, ...(local ? local.names.filter((n) => /^[\x20-\x7e]+$/.test(n) && n.toLowerCase() !== q.toLowerCase()).slice(0, 3) : [])];
      for (const name of tries) {
        try {
          list = await pc.cidsByName(name);
          if (list.length) break;
        } catch (e) {
          lastErr = e;
          if (isOffline(e)) break;
          if (!(e instanceof AppError && e.code === 'NOT_FOUND')) throw e;
        }
      }
      if (list.length) {
        const out = await fromCidList(list, q, 'name', list.length > 1 ? `O nome corresponde a ${list.length} registros; mostrando o principal.` : undefined);
        if (local && out.kind === 'single') out.record = { ...out.record, title: local.pt };
        return out;
      }
      if (local) return localOutcome(local, q, 'name', isOffline(lastErr) ? OFFLINE_NOTE : 'Nome não encontrado na PubChem. Exibindo a molécula da biblioteca local do MOLECULAB.');
      const alt = [...new Set([...(await suggestLocal(q, 6)), ...(isOffline(lastErr) ? [] : await suggestNames(q, 6).catch(() => [] as string[]))])].slice(0, 8);
      if (isOffline(lastErr)) {
        const err = new AppError(
          'NETWORK',
          `Sem acesso à PubChem agora, e "${q}" não está na biblioteca local de compostos comuns.` + (alt.length ? ' Talvez você procure um destes:' : ' Tente o nome em português de um composto comum (ex.: cafeína, glicose, ácido acético) ou digite o SMILES.'),
        );
        err.suggestions = alt;
        throw err;
      }
      const err = new AppError(
        'NOT_FOUND',
        `"${q}" não foi encontrado na PubChem.` +
          (alt.length ? ' Talvez você procure um destes nomes:' : ' Tente o nome em inglês, o nome IUPAC, o SMILES ou o número CAS. Em derivados de acetofenona, as posições do anel levam apóstrofo (ex.: 3\'-bromo-4\'-methylacetophenone).'),
      );
      err.suggestions = alt;
      throw err;
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
