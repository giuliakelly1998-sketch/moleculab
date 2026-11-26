import { useNavigate, Link } from 'react-router-dom';
import { useAppData } from '../../state/AppDataContext';
import { useMolecule } from '../../state/MoleculeContext';
import { CopyButton, EmptyState, Icon, PageHeader } from '../../components/ui';
import { downloadText, toCsv } from '../../utils/exporters';
import s from '../explorer/Explorer.module.css';

export default function FavoritesPage() {
  const { favorites, removeFavorite, history, clearHistory } = useAppData();
  const m = useMolecule();
  const nav = useNavigate();

  const open = (f: { cid?: number; smiles?: string; title: string }) => {
    if (f.cid) m.openCid(f.cid, f.title);
    else if (f.smiles) m.search(f.smiles, 'smiles');
    nav('/explorer');
  };

  return (
    <div>
      <PageHeader
        title="Favoritos"
        description="Moléculas salvas e pesquisas recentes, guardadas apenas neste navegador."
        actions={
          favorites.length > 0 && (
            <>
              <button className="btn btn-sm" onClick={() => downloadText('moleculab_favoritos.json', JSON.stringify(favorites, null, 2), 'application/json')}>
                <Icon name="download" size={14} /> JSON
              </button>
              <button className="btn btn-sm" onClick={() => downloadText('moleculab_favoritos.csv', toCsv([['titulo', 'cid', 'formula', 'smiles', 'salvo_em'], ...favorites.map((f) => [f.title, f.cid ?? '', f.formula ?? '', f.smiles ?? '', f.savedAt])]), 'text/csv')}>
                <Icon name="download" size={14} /> CSV
              </button>
            </>
          )
        }
      />
      {favorites.length === 0 ? (
        <EmptyState title="Nenhuma molécula favorita" actions={<Link className="btn" to="/explorer">Ir ao Explorer</Link>}>
          Use a estrela no painel da molécula para salvá-la aqui.
        </EmptyState>
      ) : (
        <section className={`panel ${s.candidates}`} style={{ marginTop: 0 }}>
          <ul>
            {favorites.map((f) => (
              <li key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button onClick={() => open(f)} style={{ flex: 1 }}>
                  <span className={s.candTitle}>{f.title}</span>
                  <span className="mono faint">{f.formula}</span>
                  <span className="mono faint">{f.cid ? `CID ${f.cid}` : 'local'}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{new Date(f.savedAt).toLocaleDateString('pt-BR')}</span>
                </button>
                {f.smiles && <CopyButton text={f.smiles} what="SMILES" />}
                <button className="btn btn-ghost btn-sm" onClick={() => removeFavorite(f.key)} aria-label={`Remover ${f.title}`}>
                  <Icon name="trash" size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 0 10px' }}>
        <h2 style={{ fontSize: 16 }}>Pesquisas recentes</h2>
        {history.length > 0 && (
          <button className="btn btn-sm btn-ghost" onClick={clearHistory}>
            Limpar histórico
          </button>
        )}
      </div>
      {history.length === 0 ? (
        <p className="faint">Nenhuma pesquisa registrada.</p>
      ) : (
        <section className={`panel ${s.candidates}`} style={{ marginTop: 0 }}>
          <ul>
            {history.map((h) => (
              <li key={h.at + h.text}>
                <button onClick={() => nav(`/explorer?q=${encodeURIComponent(h.text)}${h.mode !== 'auto' ? `&mode=${h.mode}` : ''}`)}>
                  <span className={s.candTitle}>{h.title ?? h.text}</span>
                  <span className="mono faint">{h.text !== h.title ? h.text : ''}</span>
                  <span className="faint">{h.mode === 'auto' ? '' : h.mode}</span>
                  <span className="faint" style={{ fontSize: 12 }}>{new Date(h.at).toLocaleString('pt-BR')}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
