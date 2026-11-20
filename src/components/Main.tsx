import { useCallback, useMemo, useRef, useState } from 'react';
import type { SyncState } from '../App';
import type { Theme } from '../hooks';
import { copySecret } from '../lib/clipboard';
import { descendantIds, ENTRY_TYPES, folderPath, matchesSearch, newEntry, removeItems, uid, type Entry, type Vault } from '../lib/vault';
import { ThemeToggle } from './common';
import { EntryEditor } from './EntryEditor';
import { EntryView } from './EntryView';
import { GeneratorModal } from './GeneratorModal';
import { SettingsModal, type CloudControls } from './SettingsModal';
import { Sidebar, type Filter } from './Sidebar';

interface Props {
  vault: Vault;
  update: (fn: (v: Vault) => Vault) => void;
  onLock: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  onExport: () => void;
  onImport: (f: File) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  saveError: string | null;
  sync: SyncState;
  cloud: CloudControls | null;
}

const SYNC_BADGE: Record<SyncState['status'], { icon: string; text: string }> = {
  off: { icon: '💾', text: 'Salvo só neste aparelho' },
  synced: { icon: '☁️', text: 'Sincronizado com o Google Drive' },
  syncing: { icon: '🔄', text: 'Sincronizando…' },
  pending: { icon: '🔄', text: 'Alterações aguardando envio' },
  offline: { icon: '📴', text: 'Sem internet: salvo neste aparelho, envia quando voltar' },
  error: { icon: '⚠️', text: 'Erro na sincronização' },
};

export function Main(p: Props) {
  const { vault, update } = p;
  const [filter, setFilter] = useState<Filter>({ kind: 'all' });
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ entry: Entry; isNew: boolean } | null>(null);
  const [showGen, setShowGen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const seconds = vault.settings.clipboardSeconds;
  const copy = useCallback(
    async (text: string, label: string) => {
      try {
        await copySecret(text, seconds);
        notify(`${label} copiado · limpa em ${seconds}s`);
      } catch {
        notify('Não foi possível copiar');
      }
    },
    [seconds, notify],
  );

  // Com busca ativa, procura no cofre inteiro, ignorando a pasta selecionada.
  const visible = useMemo(() => {
    let list = vault.entries;
    if (search.trim()) list = list.filter((e) => matchesSearch(e, search, vault.folders));
    else if (filter.kind === 'favorites') list = list.filter((e) => e.favorite);
    else if (filter.kind === 'folder') {
      const ids = descendantIds(vault.folders, filter.id);
      list = list.filter((e) => ids.has(e.folderId));
    }
    return [...list].sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.title.localeCompare(b.title, 'pt-BR'));
  }, [vault, filter, search]);

  const selected = vault.entries.find((e) => e.id === selectedId) ?? null;
  const filterTitle = search.trim()
    ? `Resultados para “${search.trim()}”`
    : filter.kind === 'all'
      ? 'Todos'
      : filter.kind === 'favorites'
        ? 'Favoritos'
        : folderPath(vault.folders, filter.id);

  function startNew() {
    const folderId = filter.kind === 'folder' ? filter.id : vault.folders[0]?.id;
    if (!folderId) return notify('Crie uma pasta primeiro');
    setEditing({ entry: newEntry(folderId), isNew: true });
  }

  function saveEntry(entry: Entry) {
    const now = new Date().toISOString();
    update((v) => {
      const old = v.entries.find((e) => e.id === entry.id);
      if (!old) return { ...v, entries: [...v.entries, { ...entry, createdAt: now, updatedAt: now, passwordChangedAt: now }] };
      const changed = old.password !== entry.password;
      const next: Entry = {
        ...entry,
        updatedAt: now,
        passwordChangedAt: changed ? now : old.passwordChangedAt,
        passwordHistory:
          changed && old.password
            ? [{ password: old.password, changedAt: now }, ...old.passwordHistory].slice(0, 20)
            : old.passwordHistory,
      };
      return { ...v, entries: v.entries.map((e) => (e.id === entry.id ? next : e)) };
    });
    setEditing(null);
    setSelectedId(entry.id);
    notify('Salvo 🔐');
  }

  function deleteEntry(entry: Entry) {
    if (!confirm(`Excluir “${entry.title}”? Isso não pode ser desfeito.`)) return;
    update((v) => removeItems(v, [entry.id]));
    setSelectedId(null);
    notify('Registro excluído');
  }

  function addFolder(parentId: string | null) {
    const name = prompt(parentId ? `Nova subpasta em “${folderPath(vault.folders, parentId)}”:` : 'Nome da nova pasta:')?.trim();
    if (!name) return;
    const id = uid();
    update((v) => ({ ...v, folders: [...v.folders, { id, name, parentId, updatedAt: new Date().toISOString() }] }));
    setFilter({ kind: 'folder', id });
  }

  function renameFolder(id: string) {
    const current = vault.folders.find((f) => f.id === id);
    const name = prompt('Novo nome da pasta:', current?.name)?.trim();
    if (!name) return;
    const updatedAt = new Date().toISOString();
    update((v) => ({ ...v, folders: v.folders.map((f) => (f.id === id ? { ...f, name, updatedAt } : f)) }));
  }

  function deleteFolder(id: string) {
    const ids = descendantIds(vault.folders, id);
    if (ids.size > 1 || vault.entries.some((e) => ids.has(e.folderId))) {
      alert('Esta pasta não está vazia. Mova ou exclua os registros e subpastas antes.');
      return;
    }
    if (!confirm(`Excluir a pasta “${folderPath(vault.folders, id)}”?`)) return;
    update((v) => removeItems(v, [id]));
    if (filter.kind === 'folder' && filter.id === id) setFilter({ kind: 'all' });
  }

  const hasDetail = !!(editing || selected);
  const badge = SYNC_BADGE[p.sync.status];
  const badgeText = p.sync.status === 'error' ? `${badge.text}: ${p.sync.message}` : badge.text;

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="icon-btn only-mobile" onClick={() => setDrawer(true)} aria-label="Pastas">
          ☰
        </button>
        <div className="brand">
          <span>🔐</span>
          <span className="brand-name">ChaveMestra</span>
        </div>
        <input
          className="search"
          type="search"
          placeholder="🔍 Buscar por nome, IP, usuário, notas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="actions">
          <button type="button" className="btn primary" onClick={startNew}>
            + <span className="hide-sm">Novo</span>
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowGen(true)} title="Gerador de senhas">
            🎲
          </button>
          <button
            type="button"
            className={`icon-btn sync-${p.sync.status}`}
            onClick={() => (p.sync.status === 'off' ? setShowSettings(true) : p.cloud?.onSyncNow())}
            title={badgeText}
            aria-label={badgeText}
          >
            {badge.icon}
          </button>
          <button type="button" className="icon-btn" onClick={() => setShowSettings(true)} title="Configurações">
            ⚙️
          </button>
          <ThemeToggle theme={p.theme} onToggle={p.onToggleTheme} />
          <button type="button" className="icon-btn" onClick={p.onLock} title="Travar cofre">
            🔒
          </button>
        </div>
      </header>

      {p.saveError && <div className="banner error">{p.saveError}</div>}
      {p.sync.status === 'error' && <div className="banner warn">⚠️ {badgeText}</div>}

      <div className={`workspace ${hasDetail ? 'has-detail' : ''}`}>
        {drawer && <div className="scrim" onClick={() => setDrawer(false)} />}
        <aside className={`sidebar ${drawer ? 'open' : ''}`}>
          <Sidebar
            folders={vault.folders}
            entries={vault.entries}
            filter={filter}
            onSelect={(f) => {
              setFilter(f);
              setSearch('');
              setDrawer(false);
            }}
            onAddFolder={addFolder}
            onRenameFolder={renameFolder}
            onDeleteFolder={deleteFolder}
          />
        </aside>

        <section className="list-pane">
          <div className="list-head">
            <strong className="truncate">{filterTitle}</strong>
            <small className="muted">{visible.length}</small>
          </div>
          {visible.length === 0 ? (
            <div className="empty">
              {search ? 'Nada encontrado.' : 'Nenhum registro aqui ainda.'}
              {!search && (
                <button type="button" className="btn ghost" onClick={startNew}>
                  + Adicionar o primeiro
                </button>
              )}
            </div>
          ) : (
            <ul className="entry-list">
              {visible.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className={`entry-item ${e.id === selectedId && !editing ? 'active' : ''}`}
                    onClick={() => {
                      setEditing(null);
                      setSelectedId(e.id);
                    }}
                  >
                    <span className="entry-icon">{ENTRY_TYPES[e.type].icon}</span>
                    <span className="entry-text">
                      <span className="truncate entry-title">
                        {e.favorite && '⭐ '}
                        {e.title}
                      </span>
                      <span className="truncate muted small">
                        {[e.username, e.host || e.url].filter(Boolean).join(' @ ') || ENTRY_TYPES[e.type].label}
                      </span>
                      {(search || filter.kind !== 'folder') && (
                        <span className="truncate muted tiny">{folderPath(vault.folders, e.folderId)}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="detail-pane">
          {editing ? (
            <EntryEditor
              key={editing.entry.id}
              entry={editing.entry}
              isNew={editing.isNew}
              folders={vault.folders}
              onSave={saveEntry}
              onCancel={() => setEditing(null)}
            />
          ) : selected ? (
            <EntryView
              entry={selected}
              folders={vault.folders}
              onCopy={copy}
              onEdit={() => setEditing({ entry: selected, isNew: false })}
              onDelete={() => deleteEntry(selected)}
              onToggleFavorite={() =>
                update((v) => ({
                  ...v,
                  entries: v.entries.map((e) =>
                    e.id === selected.id ? { ...e, favorite: !e.favorite, updatedAt: new Date().toISOString() } : e,
                  ),
                }))
              }
              onBack={() => setSelectedId(null)}
            />
          ) : (
            <div className="empty big">
              <span className="logo">🔐</span>
              <p>Selecione um registro ou crie um novo.</p>
            </div>
          )}
        </section>
      </div>

      {toast && <div className="toast">{toast}</div>}
      {showGen && <GeneratorModal onClose={() => setShowGen(false)} onCopy={(pw) => copy(pw, 'Senha')} />}
      {showSettings && (
        <SettingsModal
          settings={vault.settings}
          onChangeSettings={(settings) => update((v) => ({ ...v, settings }))}
          onExport={p.onExport}
          onImport={p.onImport}
          onChangePassword={p.onChangePassword}
          cloud={p.cloud}
          syncText={badgeText}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
