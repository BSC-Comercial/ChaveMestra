export type EntryType = 'ssh' | 'rdp' | 'web' | 'database' | 'email' | 'generic';
type LocationField = 'host' | 'port' | 'url';

export const ENTRY_TYPES: Record<EntryType, { label: string; icon: string; defaultPort: string; fields: LocationField[] }> = {
  ssh: { label: 'Servidor SSH', icon: '🖥️', defaultPort: '22', fields: ['host', 'port'] },
  rdp: { label: 'Windows (RDP)', icon: '🪟', defaultPort: '3389', fields: ['host', 'port'] },
  web: { label: 'Site / Painel web', icon: '🌐', defaultPort: '', fields: ['url'] },
  database: { label: 'Banco de dados', icon: '🗄️', defaultPort: '', fields: ['host', 'port'] },
  email: { label: 'E-mail', icon: '✉️', defaultPort: '', fields: ['url'] },
  generic: { label: 'Genérico', icon: '🔑', defaultPort: '', fields: ['host', 'port', 'url'] },
};

export interface CustomField {
  id: string;
  label: string;
  value: string;
  secret: boolean;
}

export interface PasswordHistoryItem {
  password: string;
  changedAt: string;
}

export interface Entry {
  id: string;
  folderId: string;
  type: EntryType;
  title: string;
  host: string;
  port: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  tags: string[];
  customFields: CustomField[];
  favorite: boolean;
  passwordHistory: PasswordHistoryItem[];
  passwordChangedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
}

/** Marca de exclusão: avisa os outros aparelhos que o item foi apagado. */
export interface Tombstone {
  id: string;
  deletedAt: string;
}

export interface VaultSettings {
  autoLockMinutes: number;
  clipboardSeconds: number;
}

export interface Vault {
  version: 1;
  folders: Folder[];
  entries: Entry[];
  tombstones: Tombstone[];
  settings: VaultSettings;
}

export const DEFAULT_SETTINGS: VaultSettings = { autoLockMinutes: 5, clipboardSeconds: 20 };

export const uid = () => crypto.randomUUID();

export function createEmptyVault(): Vault {
  const now = new Date().toISOString();
  return {
    version: 1,
    folders: [
      { id: uid(), name: 'Pessoal', parentId: null, updatedAt: now },
      { id: uid(), name: 'Clientes', parentId: null, updatedAt: now },
    ],
    entries: [],
    tombstones: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Remove registros/pastas deixando marca de exclusão para a sincronização. */
export function removeItems(v: Vault, ids: string[]): Vault {
  const gone = new Set(ids);
  const deletedAt = new Date().toISOString();
  return {
    ...v,
    folders: v.folders.filter((f) => !gone.has(f.id)),
    entries: v.entries.filter((e) => !gone.has(e.id)),
    tombstones: [...v.tombstones.filter((t) => !gone.has(t.id)), ...ids.map((id) => ({ id, deletedAt }))],
  };
}

/**
 * Junta duas versões do cofre (ex.: PC e celular). Para cada item vale a edição mais
 * recente; exclusões vencem edições mais antigas que elas.
 */
export function mergeVaults(local: Vault, remote: Vault): Vault {
  const deleted = new Map<string, string>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    const cur = deleted.get(t.id);
    if (!cur || t.deletedAt > cur) deleted.set(t.id, t.deletedAt);
  }
  const pick = <T extends { id: string; updatedAt: string }>(a: T[], b: T[]) => {
    const byId = new Map<string, T>();
    for (const item of [...a, ...b]) {
      const cur = byId.get(item.id);
      if (!cur || item.updatedAt > cur.updatedAt) byId.set(item.id, item);
    }
    return [...byId.values()].filter((item) => {
      const d = deleted.get(item.id);
      return !d || item.updatedAt > d;
    });
  };
  const folders = pick(local.folders, remote.folders);
  const folderIds = new Set(folders.map((f) => f.id));
  const fallback = folders.find((f) => f.parentId === null)?.id ?? folders[0]?.id;
  return {
    version: 1,
    // Subpasta cuja pasta-mãe foi apagada em outro aparelho sobe para a raiz.
    folders: folders.map((f) => (f.parentId && !folderIds.has(f.parentId) ? { ...f, parentId: null } : f)),
    // Registro cuja pasta foi apagada em outro aparelho vai para a primeira pasta.
    entries: pick(local.entries, remote.entries).map((e) =>
      folderIds.has(e.folderId) || !fallback ? e : { ...e, folderId: fallback },
    ),
    tombstones: [...deleted].map(([id, deletedAt]) => ({ id, deletedAt })),
    settings: local.settings,
  };
}

export function newEntry(folderId: string, type: EntryType = 'ssh'): Entry {
  const now = new Date().toISOString();
  return {
    id: uid(),
    folderId,
    type,
    title: '',
    host: '',
    port: ENTRY_TYPES[type].defaultPort,
    url: '',
    username: '',
    password: '',
    notes: '',
    tags: [],
    customFields: [],
    favorite: false,
    passwordHistory: [],
    passwordChangedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

/** Valida o conteúdo descriptografado e completa campos que versões antigas não tinham. */
export function normalizeVault(data: unknown): Vault {
  const v = data as Partial<Vault>;
  if (!v || !Array.isArray(v.folders) || !Array.isArray(v.entries)) {
    throw new Error('Conteúdo do cofre inválido');
  }
  const blank = newEntry('');
  const epoch = new Date(0).toISOString();
  return {
    version: 1,
    folders: v.folders.map((f) => ({ ...f, updatedAt: f.updatedAt ?? epoch })),
    entries: v.entries.map((e) => ({ ...blank, ...e })),
    tombstones: Array.isArray(v.tombstones) ? v.tombstones : [],
    settings: { ...DEFAULT_SETTINGS, ...v.settings },
  };
}

/** A pasta e todas as subpastas dela. */
export function descendantIds(folders: Folder[], id: string): Set<string> {
  const ids = new Set([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && ids.has(f.parentId) && !ids.has(f.id)) {
        ids.add(f.id);
        grew = true;
      }
    }
  }
  return ids;
}

export function folderPath(folders: Folder[], id: string): string {
  const parts: string[] = [];
  let cur = folders.find((f) => f.id === id);
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? folders.find((f) => f.id === cur!.parentId) : undefined;
  }
  return parts.join(' / ');
}

function fold(s: string) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Busca em tudo, menos nos valores secretos. */
export function matchesSearch(e: Entry, query: string, folders: Folder[]): boolean {
  const haystack = fold(
    [
      e.title,
      e.host,
      e.url,
      e.username,
      e.notes,
      e.tags.join(' '),
      folderPath(folders, e.folderId),
      ...e.customFields.map((c) => (c.secret ? c.label : `${c.label} ${c.value}`)),
    ].join(' '),
  );
  return fold(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.includes(term));
}
