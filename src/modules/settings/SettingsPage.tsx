import { useState } from 'react';
import { useAppData, ViewerStyle } from '../../state/AppDataContext';
import { cacheClear, cacheStats } from '../../services/cache';
import { storage } from '../../services/storage';
import { Notice, PageHeader, toast } from '../../components/ui';
import s from './Settings.module.css';

export default function SettingsPage() {
  const { settings, updateSettings, clearFavorites, clearHistory, favorites, history, storageAvailable } = useAppData();
  const [stats, setStats] = useState(cacheStats());
  const [confirmAll, setConfirmAll] = useState(false);

  return (
    <div className={s.page}>
      <PageHeader title="Settings" description="Preferências e dados guardados localmente neste navegador. Nada é enviado a servidores do MOLECULAB." />
      {!storageAvailable && <Notice kind="warn" title="Armazenamento local indisponível">Preferências, favoritos e histórico valem só para esta sessão.</Notice>}

      <section className={`panel ${s.section}`}>
        <h2>Aparência</h2>
        <Row label="Tema" hint="O modo escuro é o padrão.">
          <div className="segmented">
            {(['dark', 'light'] as const).map((t) => (
              <button key={t} aria-pressed={settings.theme === t} onClick={() => updateSettings({ theme: t })}>
                {t === 'dark' ? 'Escuro' : 'Claro'}
              </button>
            ))}
          </div>
        </Row>
        <Row label="Representação 3D padrão">
          <select className="select" value={settings.viewerStyle} onChange={(e) => updateSettings({ viewerStyle: e.target.value as ViewerStyle })}>
            <option value="ballstick">Ball-and-stick</option>
            <option value="stick">Stick</option>
            <option value="sphere">Space-filling</option>
          </select>
        </Row>
        <Row label="Mostrar hidrogênios no 3D">
          <input type="checkbox" className={s.toggle} checked={settings.showHydrogens} onChange={(e) => updateSettings({ showHydrogens: e.target.checked })} />
        </Row>
      </section>

      <section className={`panel ${s.section}`}>
        <h2>Busca</h2>
        <Row label="Sugestões de nomes" hint="Consulta o autocompletar da PubChem enquanto você digita (com debounce).">
          <input type="checkbox" className={s.toggle} checked={settings.autocomplete} onChange={(e) => updateSettings({ autocomplete: e.target.checked })} />
        </Row>
        <Row label="Guardar histórico de pesquisas">
          <input type="checkbox" className={s.toggle} checked={settings.keepHistory} onChange={(e) => updateSettings({ keepHistory: e.target.checked })} />
        </Row>
      </section>

      <section className={`panel ${s.section}`}>
        <h2>Dados locais</h2>
        <Row label={`Histórico (${history.length})`}>
          <button className="btn btn-sm" onClick={() => { clearHistory(); toast('Histórico apagado'); }} disabled={!history.length}>
            Limpar
          </button>
        </Row>
        <Row label={`Favoritos (${favorites.length})`}>
          <button className="btn btn-sm" onClick={() => { clearFavorites(); toast('Favoritos apagados'); }} disabled={!favorites.length}>
            Limpar
          </button>
        </Row>
        <Row label={`Cache de consultas (${stats.persistedEntries} salvas, validade 24 h)`} hint="Evita repetir chamadas à PubChem.">
          <button className="btn btn-sm" onClick={() => { cacheClear(); setStats(cacheStats()); toast('Cache apagado'); }}>
            Limpar
          </button>
        </Row>
        <Row label="Apagar tudo" hint="Remove preferências, favoritos, histórico e cache deste navegador.">
          {confirmAll ? (
            <span style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }} onClick={() => { storage.clearAll(); location.reload(); }}>
                Confirmar
              </button>
              <button className="btn btn-sm btn-ghost" onClick={() => setConfirmAll(false)}>
                Cancelar
              </button>
            </span>
          ) : (
            <button className="btn btn-sm" onClick={() => setConfirmAll(true)}>
              Apagar tudo
            </button>
          )}
        </Row>
      </section>

      <section className={`panel ${s.section}`}>
        <h2>Sobre os dados</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          Identificadores, estruturas e propriedades computadas vêm da PubChem (NCBI/NIH) via PUG REST; dados experimentais vêm das anotações PUG View, cada um com a fonte original. Descritores e grupos funcionais são calculados no navegador com RDKit (WebAssembly). Visualização 3D: 3Dmol.js. Gráficos: Plotly.js. Massas atômicas: IUPAC/CIAAW 2021. Constantes: CODATA 2018.
        </p>
      </section>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className={s.row}>
      <div>
        <div className={s.rowLabel}>{label}</div>
        {hint && <div className="faint" style={{ fontSize: 13 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
