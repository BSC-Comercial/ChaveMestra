import { useCallback, useEffect, useRef, useState } from 'react';
import {
  decryptVault,
  deriveKey,
  encryptVault,
  isVaultFile,
  newKdfParams,
  WrongPasswordError,
  type KdfParams,
  type VaultFile,
} from './lib/crypto';
import { createEmptyVault, mergeVaults, normalizeVault, type Vault } from './lib/vault';
import { localVault } from './lib/storage';
import * as gdrive from './lib/gdrive';
import { clearClipboardNow } from './lib/clipboard';
import { useAutoLock, useTheme } from './hooks';
import { Setup } from './components/Setup';
import { Unlock } from './components/Unlock';
import { Main } from './components/Main';

interface Session {
  key: CryptoKey;
  kdf: KdfParams;
  vault: Vault;
}

type Phase = 'loading' | 'setup' | 'locked' | 'unlocked';

export type SyncState =
  | { status: 'off' }
  | { status: 'synced'; at: Date }
  | { status: 'syncing' }
  | { status: 'pending' }
  | { status: 'offline' }
  | { status: 'error'; message: string };

const PUSH_DELAY_MS = 1500;
const PULL_EVERY_MS = 60_000;

/** Baixa a versão do Google Drive para a cópia local, se não houver alterações locais pendentes. */
async function refreshFromCloud(): Promise<void> {
  if (!(await gdrive.accountName())) return;
  const meta = await localVault.loadMeta();
  const local = await localVault.load();
  if (local && meta.dirty) return; // alterações locais serão mescladas depois de destravar
  const remote = await gdrive.downloadVault();
  if (remote && remote.etag !== meta.etag) {
    await localVault.save(remote.file);
    await localVault.saveMeta({ etag: remote.etag, dirty: false });
  }
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [phase, setPhase] = useState<Phase>('loading');
  const [file, setFile] = useState<VaultFile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncState>({ status: 'off' });
  const [saveError, setSaveError] = useState<string | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const queue = useRef(Promise.resolve());
  const pushTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  /** Executa tarefas de gravação uma de cada vez, na ordem. */
  const enqueue = useCallback((task: () => Promise<void>) => {
    queue.current = queue.current.then(task, task);
    return queue.current;
  }, []);

  const reloadLocal = useCallback(async () => {
    try {
      await refreshFromCloud();
    } catch {
      /* sem internet: usa a cópia local */
    }
    const f = await localVault.load();
    setFile(f);
    return f;
  }, []);

  useEffect(() => {
    (async () => {
      gdrive.preloadGoogle();
      if (gdrive.gdriveEnabled) {
        try {
          setAccount(await gdrive.accountName());
        } catch {
          /* login indisponível agora */
        }
      }
      const f = await reloadLocal();
      setPhase(f ? 'locked' : 'setup');
    })().catch(() => setPhase('setup'));
  }, [reloadLocal]);

  // ---------- Sincronização ----------

  const syncNow = useCallback(
    () =>
      enqueue(async () => {
        const s = sessionRef.current;
        if (!s || !account) return;
        if (!navigator.onLine) return setSync({ status: 'offline' });
        setSync({ status: 'syncing' });
        try {
          for (let attempt = 0; attempt < 3; attempt++) {
            const meta = await localVault.loadMeta();
            const remote = await gdrive.downloadVault();
            let dirty = meta.dirty;
            if (remote && remote.etag !== meta.etag) {
              let remoteVault: Vault;
              try {
                remoteVault = normalizeVault(await decryptVault(remote.file, s.key));
              } catch (e) {
                if (e instanceof WrongPasswordError)
                  throw new Error('O cofre no Google Drive usa outra senha mestra. Trave e abra de novo.');
                throw e;
              }
              const cur = sessionRef.current!;
              const merged = mergeVaults(cur.vault, remoteVault);
              const next = { ...cur, vault: merged };
              sessionRef.current = next;
              setSession(next);
              // Se a mesclagem não trouxe nada nosso de novo, basta adotar a versão remota.
              if (!dirty) {
                await localVault.save(await encryptVault(merged, next.key, next.kdf));
                await localVault.saveMeta({ etag: remote.etag, dirty: false });
                break;
              }
              dirty = true;
            }
            if (!dirty && remote) break;
            const cur = sessionRef.current!;
            const f = await encryptVault(cur.vault, cur.key, cur.kdf);
            await localVault.save(f);
            try {
              const etag = await gdrive.uploadVault(f, remote?.etag ?? null);
              await localVault.saveMeta({ etag, dirty: false });
              setFile(f);
              break;
            } catch (e) {
              if (!(e instanceof gdrive.ConflictError) || attempt === 2) throw e;
              // Outro aparelho gravou nesse meio-tempo: mescla de novo.
            }
          }
          setSync({ status: 'synced', at: new Date() });
        } catch (e) {
          setSync(
            navigator.onLine ? { status: 'error', message: (e as Error).message } : { status: 'offline' },
          );
        }
      }),
    [account, enqueue],
  );

  const schedulePush = useCallback(() => {
    if (!account) return;
    setSync({ status: 'pending' });
    clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => void syncNow(), PUSH_DELAY_MS);
  }, [account, syncNow]);

  useEffect(() => {
    if (phase !== 'unlocked' || !account) {
      setSync({ status: 'off' });
      return;
    }
    void syncNow();
    const onWake = () => document.visibilityState === 'visible' && void syncNow();
    const id = setInterval(() => void syncNow(), PULL_EVERY_MS);
    window.addEventListener('online', onWake);
    document.addEventListener('visibilitychange', onWake);
    return () => {
      clearInterval(id);
      window.removeEventListener('online', onWake);
      document.removeEventListener('visibilitychange', onWake);
    };
  }, [phase, account, syncNow]);

  // ---------- Sessão ----------

  const startSession = (s: Session) => {
    sessionRef.current = s;
    setSession(s);
    setPhase('unlocked');
  };

  const lock = useCallback(() => {
    sessionRef.current = null;
    setSession(null);
    clearClipboardNow();
    setPhase((p) => (p === 'unlocked' ? 'locked' : p));
    // Na próxima abertura, já usa a versão mais nova do Google Drive.
    void queue.current.then(reloadLocal);
  }, [reloadLocal]);

  useAutoLock(phase === 'unlocked', session?.vault.settings.autoLockMinutes ?? 5, lock);

  /** Grava a versão atual da sessão (sempre a mais recente, nunca uma cópia antiga). */
  const persist = useCallback(
    () =>
      enqueue(async () => {
        const s = sessionRef.current;
        if (!s) return;
        try {
          const f = await encryptVault(s.vault, s.key, s.kdf);
          await localVault.save(f);
          const meta = await localVault.loadMeta();
          await localVault.saveMeta({ ...meta, dirty: true });
          setFile(f);
          setSaveError(null);
        } catch (e) {
          setSaveError(`Falha ao salvar: ${(e as Error).message}`);
        }
      }),
    [enqueue],
  );

  const update = useCallback(
    (fn: (v: Vault) => Vault) => {
      const s = sessionRef.current;
      if (!s) return;
      const next = { ...s, vault: fn(s.vault) };
      sessionRef.current = next;
      setSession(next);
      void persist();
      schedulePush();
    },
    [persist, schedulePush],
  );

  async function create(password: string) {
    const kdf = newKdfParams();
    sessionRef.current = { key: await deriveKey(password, kdf), kdf, vault: createEmptyVault() };
    await localVault.saveMeta({ etag: null, dirty: true });
    await persist();
    startSession(sessionRef.current);
  }

  async function unlock(password: string) {
    if (!file) return;
    const key = await deriveKey(password, file.kdf);
    const vault = normalizeVault(await decryptVault(file, key));
    startSession({ key, kdf: file.kdf, vault });
  }

  async function changePassword(current: string, next: string) {
    if (!sessionRef.current || !file) return;
    await decryptVault(file, await deriveKey(current, file.kdf)); // confirma a senha atual
    await syncNow(); // traz o que houver de outros aparelhos antes de trocar a chave
    const kdf = newKdfParams();
    const key = await deriveKey(next, kdf);
    const s = sessionRef.current;
    if (!s) return;
    sessionRef.current = { ...s, kdf, key };
    setSession(sessionRef.current);
    await persist();
    await syncNow();
  }

  function exportBackup() {
    if (!file) return;
    const blob = new Blob([JSON.stringify(file)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `chavemestra-backup-${new Date().toISOString().slice(0, 10)}.chavemestra`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importBackup(f: File) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await f.text());
    } catch {
      throw new Error('Arquivo não é um backup do ChaveMestra');
    }
    if (!isVaultFile(parsed)) throw new Error('Arquivo não é um backup do ChaveMestra');
    const backup = parsed;
    await enqueue(async () => {
      await localVault.save(backup);
      const meta = await localVault.loadMeta();
      // Marcado como alterado: ao destravar, o backup substitui a versão do Google Drive.
      await localVault.saveMeta({ ...meta, dirty: true });
    });
    setFile(backup);
    sessionRef.current = null;
    setSession(null);
    setPhase('locked');
  }

  async function erase() {
    await localVault.clear();
    const f = await reloadLocal();
    setPhase(f ? 'locked' : 'setup');
  }

  async function connect() {
    await gdrive.signIn();
    setAccount(await gdrive.accountName());
  }

  async function disconnect() {
    await queue.current;
    await gdrive.signOut();
    setAccount(null);
  }

  if (phase === 'loading') return <div className="center-screen muted">Carregando…</div>;
  if (phase === 'setup')
    return (
      <Setup
        onCreate={create}
        onImport={importBackup}
        theme={theme}
        onToggleTheme={toggleTheme}
        cloud={gdrive.gdriveEnabled ? { account, onConnect: connect } : null}
      />
    );
  if (phase === 'locked' || !session)
    return <Unlock onUnlock={unlock} onErase={erase} theme={theme} onToggleTheme={toggleTheme} account={account} />;

  return (
    <Main
      vault={session.vault}
      update={update}
      onLock={lock}
      theme={theme}
      onToggleTheme={toggleTheme}
      onExport={exportBackup}
      onImport={importBackup}
      onChangePassword={changePassword}
      saveError={saveError}
      sync={sync}
      cloud={
        gdrive.gdriveEnabled
          ? { account, onConnect: connect, onDisconnect: disconnect, onSyncNow: () => void syncNow() }
          : null
      }
    />
  );
}
