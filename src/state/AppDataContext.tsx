import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { storage } from '../services/storage';

export interface SavedMolecule {
  key: string;
  cid?: number;
  title: string;
  formula?: string;
  smiles?: string;
  savedAt: string;
}

export interface HistoryEntry {
  text: string;
  mode: string;
  title?: string;
  key?: string;
  at: string;
}

export type ViewerStyle = 'ballstick' | 'stick' | 'sphere';

export interface Settings {
  theme: 'dark' | 'light';
  viewerStyle: ViewerStyle;
  showHydrogens: boolean;
  keepHistory: boolean;
  autocomplete: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  viewerStyle: 'ballstick',
  showHydrogens: true,
  keepHistory: true,
  autocomplete: true,
};

const MAX_HISTORY = 30;
const MAX_FAVORITES = 200;

interface AppData {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
  favorites: SavedMolecule[];
  isFavorite: (key: string) => boolean;
  toggleFavorite: (m: Omit<SavedMolecule, 'savedAt'>) => void;
  removeFavorite: (key: string) => void;
  clearFavorites: () => void;
  history: HistoryEntry[];
  addHistory: (h: Omit<HistoryEntry, 'at'>) => void;
  clearHistory: () => void;
  storageAvailable: boolean;
}

const Ctx = createContext<AppData | null>(null);

/** Validação defensiva dos dados lidos do armazenamento local. */
function readArray<T>(key: string, isValid: (x: unknown) => boolean): T[] {
  const v = storage.get<unknown>(key);
  return Array.isArray(v) ? (v.filter(isValid) as T[]) : [];
}
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => ({ ...DEFAULT_SETTINGS, ...(storage.get<Partial<Settings>>('settings') ?? {}) }));
  const [favorites, setFavorites] = useState<SavedMolecule[]>(() =>
    readArray<SavedMolecule>('favorites', (x) => isObj(x) && typeof x.key === 'string' && typeof x.title === 'string'),
  );
  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    readArray<HistoryEntry>('history', (x) => isObj(x) && typeof x.text === 'string'),
  );

  useEffect(() => { storage.set('settings', settings); }, [settings]);
  useEffect(() => { storage.set('favorites', favorites); }, [favorites]);
  useEffect(() => { storage.set('history', history); }, [history]);
  useEffect(() => { document.documentElement.dataset.theme = settings.theme; }, [settings.theme]);

  const updateSettings = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);

  const toggleFavorite = useCallback((m: Omit<SavedMolecule, 'savedAt'>) => {
    setFavorites((list) =>
      list.some((f) => f.key === m.key)
        ? list.filter((f) => f.key !== m.key)
        : [{ ...m, savedAt: new Date().toISOString() }, ...list].slice(0, MAX_FAVORITES),
    );
  }, []);

  const addHistory = useCallback(
    (h: Omit<HistoryEntry, 'at'>) => {
      if (!settings.keepHistory) return;
      setHistory((list) => [{ ...h, at: new Date().toISOString() }, ...list.filter((x) => (h.key ? x.key !== h.key : x.text !== h.text))].slice(0, MAX_HISTORY));
    },
    [settings.keepHistory],
  );

  const value = useMemo<AppData>(
    () => ({
      settings,
      updateSettings,
      favorites,
      isFavorite: (key) => favorites.some((f) => f.key === key),
      toggleFavorite,
      removeFavorite: (key) => setFavorites((l) => l.filter((f) => f.key !== key)),
      clearFavorites: () => setFavorites([]),
      history,
      addHistory,
      clearHistory: () => setHistory([]),
      storageAvailable: storage.available(),
    }),
    [settings, updateSettings, favorites, toggleFavorite, history, addHistory],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppData() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppData fora do AppDataProvider');
  return v;
}
