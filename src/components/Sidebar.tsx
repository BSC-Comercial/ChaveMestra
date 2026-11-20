import type { Entry, Folder } from '../lib/vault';
import { descendantIds } from '../lib/vault';

export type Filter = { kind: 'all' } | { kind: 'favorites' } | { kind: 'folder'; id: string };

interface Props {
  folders: Folder[];
  entries: Entry[];
  filter: Filter;
  onSelect: (f: Filter) => void;
  onAddFolder: (parentId: string | null) => void;
  onRenameFolder: (id: string) => void;
  onDeleteFolder: (id: string) => void;
}

export function Sidebar(p: Props) {
  const count = (id: string) => {
    const ids = descendantIds(p.folders, id);
    return p.entries.filter((e) => ids.has(e.folderId)).length;
  };
  const isActive = (f: Filter) =>
    f.kind === p.filter.kind && (f.kind !== 'folder' || (p.filter.kind === 'folder' && p.filter.id === f.id));

  function renderLevel(parentId: string | null, depth: number) {
    return p.folders
      .filter((f) => f.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .map((f) => (
        <li key={f.id}>
          <div
            className={`nav-item ${isActive({ kind: 'folder', id: f.id }) ? 'active' : ''}`}
            style={{ paddingLeft: 12 + depth * 16 }}
          >
            <button type="button" className="nav-label" onClick={() => p.onSelect({ kind: 'folder', id: f.id })}>
              <span>{depth === 0 ? '📁' : '🏢'}</span>
              <span className="truncate">{f.name}</span>
              <span className="count">{count(f.id)}</span>
            </button>
            <span className="nav-actions">
              <button type="button" title="Nova subpasta" onClick={() => p.onAddFolder(f.id)}>
                ＋
              </button>
              <button type="button" title="Renomear" onClick={() => p.onRenameFolder(f.id)}>
                ✏️
              </button>
              <button type="button" title="Excluir pasta" onClick={() => p.onDeleteFolder(f.id)}>
                🗑️
              </button>
            </span>
          </div>
          <ul>{renderLevel(f.id, depth + 1)}</ul>
        </li>
      ));
  }

  return (
    <nav className="nav">
      <ul>
        <li>
          <div className={`nav-item ${isActive({ kind: 'all' }) ? 'active' : ''}`}>
            <button type="button" className="nav-label" onClick={() => p.onSelect({ kind: 'all' })}>
              <span>🗂️</span>
              <span className="truncate">Todos</span>
              <span className="count">{p.entries.length}</span>
            </button>
          </div>
        </li>
        <li>
          <div className={`nav-item ${isActive({ kind: 'favorites' }) ? 'active' : ''}`}>
            <button type="button" className="nav-label" onClick={() => p.onSelect({ kind: 'favorites' })}>
              <span>⭐</span>
              <span className="truncate">Favoritos</span>
              <span className="count">{p.entries.filter((e) => e.favorite).length}</span>
            </button>
          </div>
        </li>
      </ul>
      <div className="nav-section">
        <span>Pastas</span>
        <button type="button" className="icon-btn small" title="Nova pasta" onClick={() => p.onAddFolder(null)}>
          ＋
        </button>
      </div>
      <ul>{renderLevel(null, 0)}</ul>
    </nav>
  );
}
