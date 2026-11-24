import { storage } from './storage';

/**
 * Cache em dois níveis: memória (sessão) + localStorage com TTL.
 * Só armazena respostas bem-sucedidas; erros nunca são cacheados.
 */
interface Entry<T> {
  t: number;
  v: T;
}

const MEMORY = new Map<string, Entry<unknown>>();
const PREFIX = 'cache:';
const MAX_PERSISTED_BYTES = 400_000; // evita estourar a cota com SDFs grandes

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

export function cacheGet<T>(key: string, ttl = DEFAULT_TTL_MS): T | undefined {
  const now = Date.now();
  const mem = MEMORY.get(key) as Entry<T> | undefined;
  if (mem && now - mem.t < ttl) return mem.v;
  const persisted = storage.get<Entry<T>>(PREFIX + key);
  if (persisted && now - persisted.t < ttl) {
    MEMORY.set(key, persisted);
    return persisted.v;
  }
  return undefined;
}

export function cacheSet<T>(key: string, value: T, persist = true) {
  const entry = { t: Date.now(), v: value };
  MEMORY.set(key, entry);
  if (!persist) return;
  try {
    const size = JSON.stringify(entry).length;
    if (size < MAX_PERSISTED_BYTES) storage.set(PREFIX + key, entry);
  } catch {
    /* valor não serializável: fica só em memória */
  }
}

export function cacheClear() {
  MEMORY.clear();
  storage.clearPrefix(PREFIX);
}

export function cacheStats() {
  return { memoryEntries: MEMORY.size, persistedEntries: storage.keys(PREFIX).length };
}
