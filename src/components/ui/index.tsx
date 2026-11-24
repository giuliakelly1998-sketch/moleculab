import { ReactNode, useEffect, useState } from 'react';
import s from './ui.module.css';
import type { DataNature } from '../../chem/propertyCatalog';
import { copyText } from '../../utils/exporters';

const NATURE_CLASS: Record<DataNature, string> = {
  experimental: s.exp,
  calculado: s.calc,
  estimado: s.est,
  indisponível: s.na,
};
const NATURE_TITLE: Record<DataNature, string> = {
  experimental: 'Valor medido, depositado por uma fonte identificada',
  calculado: 'Obtido de forma determinística a partir da estrutura',
  estimado: 'Previsão de modelo empírico; pode diferir do valor medido',
  indisponível: 'Nenhuma fonte forneceu este dado',
};

export function NatureBadge({ nature }: { nature: DataNature }) {
  return (
    <span className={`${s.badge} ${NATURE_CLASS[nature]}`} title={NATURE_TITLE[nature]}>
      {nature}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className={s.loading} role="status" aria-live="polite">
      <span className={s.spinner} aria-hidden />
      {label ?? 'Carregando…'}
    </div>
  );
}

export function Notice({ kind = 'info', title, children }: { kind?: 'info' | 'error' | 'warn'; title?: string; children?: ReactNode }) {
  return (
    <div className={`${s.notice} ${s[kind]}`} role={kind === 'error' ? 'alert' : 'note'}>
      <Icon name={kind === 'error' ? 'alert' : kind === 'warn' ? 'alert' : 'info'} className={s.icon} />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={s.empty}>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {actions && <div className={s.actions}>{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className={s.pageHeader}>
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{actions}</div>}
    </header>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className={s.kv}>
      {items.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v ?? <span className="faint">indisponível</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

let toastSetter: ((m: string | null) => void) | null = null;
export function toast(message: string) {
  toastSetter?.(message);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => {
      toastSetter = null;
    };
  }, []);
  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2200);
    return () => clearTimeout(t);
  }, [msg]);
  return msg ? (
    <div className={s.toast} role="status">
      {msg}
    </div>
  ) : null;
}

export function CopyButton({ text, label = 'Copiar', what }: { text: string; label?: string; what?: string }) {
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm"
      onClick={async () => toast((await copyText(text)) ? `${what ?? 'Texto'} copiado` : 'Não foi possível copiar')}
      aria-label={`${label} ${what ?? ''}`.trim()}
      title={`${label} ${what ?? ''}`.trim()}
    >
      <Icon name="copy" />
    </button>
  );
}

export function CopyRow({ value, what }: { value?: string; what: string }) {
  if (!value) return <span className="faint">indisponível</span>;
  return (
    <span className={s.copyRow}>
      <span className="mono">{value}</span>
      <CopyButton text={value} what={what} />
    </span>
  );
}

/** Ícones de traço simples (SVG inline, sem dependência externa). */
const PATHS: Record<string, string> = {
  overview: 'M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z',
  explorer: 'M12 3l7.8 4.5v9L12 21l-7.8-4.5v-9zM12 3v9m0 0l7.8 4.5M12 12l-7.8 4.5',
  properties: 'M5 20V10m7 10V4m7 16v-7',
  groups: 'M7 7m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M17 17m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0M9.5 9.5l5 5M17 4v6M14 7h6',
  calculator: 'M6 3h12v18H6zM9 7h6M9 12h.01M12 12h.01M15 12h.01M9 16h.01M12 16h.01M15 16h.01',
  knowledge: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7',
  favorites: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  settings: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  search: 'M11 11m-7 0a7 7 0 1 0 14 0a7 7 0 1 0-14 0M20 20l-4-4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  download: 'M12 4v11m0 0l-4-4m4 4l4-4M5 20h14',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3 6.4 20.2l1.1-6.2L3 9.6l6.2-.9z',
  alert: 'M12 3l9.5 17h-19zM12 10v4M12 17h.01',
  info: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 11v5M12 8h.01',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  reset: 'M4 4v6h6M20 12a8 8 0 1 1-2.3-5.7L4 10',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  table: 'M3 4h4v4H3zM17 4h4v4h-4zM3 10h4v4H3zM8 10h4v4H8zM12 10h4v4h-4zM17 10h4v4h-4zM3 16h4v4H3zM8 16h13v4H8z',
};

export function Icon({ name, size = 16, className, filled }: { name: keyof typeof PATHS | string; size?: number; className?: string; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  );
}
