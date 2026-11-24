/**
 * Acesso seguro ao localStorage: todas as operações toleram ausência de
 * storage (modo privado, iframes com sandbox) e dados corrompidos.
 */
const NS = 'moleculab:v1:';

function ls(): Storage | null {
  try {
    const s = globalThis.localStorage;
    const probe = NS + '__probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const storage = {
  available(): boolean {
    return ls() !== null;
  },
  get<T>(key: string): T | undefined {
    const s = ls();
    if (!s) return undefined;
    try {
      const raw = s.getItem(NS + key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return undefined;
    }
  },
  set<T>(key: string, value: T): boolean {
    const s = ls();
    if (!s) return false;
    try {
      s.setItem(NS + key, JSON.stringify(value));
      return true;
    } catch {
      return false; // cota excedida
    }
  },
  remove(key: string) {
    ls()?.removeItem(NS + key);
  },
  keys(prefix = ''): string[] {
    const s = ls();
    if (!s) return [];
    const out: string[] = [];
    for (let i = 0; i < s.length; i++) {
      const k = s.key(i);
      if (k && k.startsWith(NS + prefix)) out.push(k.slice(NS.length));
    }
    return out;
  },
  clearPrefix(prefix: string) {
    for (const k of this.keys(prefix)) this.remove(k);
  },
  clearAll() {
    for (const k of this.keys('')) this.remove(k);
  },
};
