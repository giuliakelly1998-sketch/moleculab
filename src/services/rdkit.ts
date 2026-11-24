import type { MainModule as RDKitModule, Mol as JSMol } from '@rdkit/rdkit';
export type { RDKitModule, JSMol };
import { AppError } from './errors';
import { preValidateSmiles } from '../chem/queryDetect';

/**
 * Carregamento sob demanda do RDKit (WebAssembly). O runtime é servido a
 * partir de /rdkit (copiado de node_modules no postinstall), sem CDN.
 */
export type RDKitStatus = 'idle' | 'loading' | 'ready' | 'error';

let modulePromise: Promise<RDKitModule> | null = null;
let status: RDKitStatus = 'idle';
let lastError = '';
const listeners = new Set<(s: RDKitStatus) => void>();

function setStatus(s: RDKitStatus) {
  status = s;
  listeners.forEach((l) => l(s));
}

export function getRDKitStatus() {
  return { status, error: lastError };
}

export function onRDKitStatus(cb: (s: RDKitStatus) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

declare global {
  interface Window {
    initRDKitModule?: (opts?: { locateFile?: (f: string) => string }) => Promise<RDKitModule>;
  }
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.initRDKitModule) return resolve();
    const el = document.createElement('script');
    el.src = src;
    el.async = true;
    el.onload = () => resolve();
    el.onerror = () => reject(new Error(`Falha ao carregar ${src}`));
    document.head.appendChild(el);
  });
}

export function loadRDKit(): Promise<RDKitModule> {
  if (modulePromise) return modulePromise;
  setStatus('loading');
  const base = `${import.meta.env.BASE_URL}rdkit/`;
  modulePromise = injectScript(`${base}RDKit_minimal.js`)
    .then(() => {
      if (!window.initRDKitModule) throw new Error('initRDKitModule indisponível');
      return window.initRDKitModule({ locateFile: (f) => base + f });
    })
    .then((m) => {
      setStatus('ready');
      return m;
    })
    .catch((e) => {
      lastError = String(e);
      modulePromise = null;
      setStatus('error');
      throw new AppError('RDKIT_UNAVAILABLE', 'O módulo de processamento químico (RDKit) não pôde ser carregado.', String(e));
    });
  return modulePromise;
}

/** Cria uma molécula, executa `fn` e libera a memória WASM em seguida. */
export function withMol<T>(rdkit: RDKitModule, input: string, fn: (mol: JSMol) => T): T {
  const mol = rdkit.get_mol(input);
  if (!mol || !mol.is_valid()) {
    mol?.delete();
    throw new AppError('INVALID_INPUT', 'Estrutura inválida: o RDKit não conseguiu interpretá-la.');
  }
  try {
    return fn(mol);
  } finally {
    mol.delete();
  }
}

/**
 * Valida um SMILES do usuário antes de qualquer uso: tamanho, caracteres
 * permitidos e interpretação/sanitização pelo RDKit. Retorna o SMILES canônico.
 */
export function sanitizeSmiles(rdkit: RDKitModule, smiles: string): string {
  const problem = preValidateSmiles(smiles);
  if (problem) throw new AppError('INVALID_INPUT', problem);
  return withMol(rdkit, smiles.trim(), (m) => {
    if (m.get_num_atoms() > 500) throw new AppError('INVALID_INPUT', 'Estrutura grande demais para processamento no navegador (> 500 átomos pesados).');
    return m.get_smiles();
  });
}
