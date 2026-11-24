import { ReactNode, useEffect, useState } from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import s from './Layout.module.css';
import { Icon } from '../ui';
import { useAppData } from '../../state/AppDataContext';

const NAV: { to: string; label: string; icon: string; end?: boolean }[] = [
  { to: '/', label: 'Overview', icon: 'overview', end: true },
  { to: '/explorer', label: 'Molecular Explorer', icon: 'explorer' },
  { to: '/properties', label: 'Chemical Properties', icon: 'properties' },
  { to: '/functional-groups', label: 'Functional Groups', icon: 'groups' },
  { to: '/calculator', label: 'Chemistry Calculator', icon: 'calculator' },
  { to: '/elements', label: 'Periodic Table', icon: 'table' },
  { to: '/knowledge', label: 'Knowledge Base', icon: 'knowledge' },
];

export function Logo({ size = 30 }: { size?: number }) {
  // Hexágono (anel) com um nó de dados: química + código.
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path d="M16 3.5 26.8 9.75v12.5L16 28.5 5.2 22.25V9.75Z" fill="none" stroke="var(--purple)" strokeWidth="2" />
      <path d="M16 9.5 21.6 12.75v6.5L16 22.5l-5.6-3.25v-6.5Z" fill="var(--purple-soft)" stroke="var(--cyan)" strokeWidth="1.4" />
      <circle cx="16" cy="16" r="2.1" fill="var(--magenta)" />
    </svg>
  );
}

function Brand() {
  return (
    <Link to="/" className={s.brand} aria-label="MOLECULAB — início">
      <Logo />
      <span className={s.brandText}>
        <span className={s.brandName}>MOLECULAB</span>
        <span className={s.brandSub}>BYTE LAB</span>
      </span>
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const { favorites } = useAppData();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const link = ({ isActive }: { isActive: boolean }) => `${s.link} ${isActive ? s.active : ''}`;

  return (
    <div className={s.shell}>
      <div className={s.topbar}>
        <Brand />
        <button className="btn btn-ghost" onClick={() => setOpen(true)} aria-label="Abrir menu" aria-expanded={open}>
          <Icon name="menu" size={20} />
        </button>
      </div>
      <div className={`${s.scrim} ${open ? s.open : ''}`} onClick={() => setOpen(false)} />
      <aside className={`${s.sidebar} ${open ? s.open : ''}`} aria-label="Navegação principal">
        <Brand />
        <nav className={s.nav}>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={link}>
              <Icon name={n.icon} size={18} />
              {n.label}
            </NavLink>
          ))}
          <div className={s.navGroup}>Workspace</div>
          <NavLink to="/favorites" className={link}>
            <Icon name="favorites" size={18} />
            Favorites
            {favorites.length > 0 && <span className={s.count}>{favorites.length}</span>}
          </NavLink>
          <NavLink to="/settings" className={link}>
            <Icon name="settings" size={18} />
            Settings
          </NavLink>
        </nav>
        <div className={s.sidebarFoot}>
          Explore Chemistry at Molecular Scale.
          <br />
          Dados: PubChem (NCBI) · RDKit · 3Dmol.js
          <br />
          <span className="mono">v{__APP_VERSION__}</span>
        </div>
      </aside>
      <main className={s.main} id="conteudo">
        {children}
      </main>
    </div>
  );
}
