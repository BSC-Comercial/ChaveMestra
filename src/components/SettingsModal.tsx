import { useRef, useState, type FormEvent } from 'react';
import { WrongPasswordError } from '../lib/crypto';
import { passwordStrength } from '../lib/generator';
import type { VaultSettings } from '../lib/vault';
import { Modal, PasswordInput, StrengthMeter } from './common';

export interface CloudControls {
  account: string | null;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onSyncNow: () => void;
}

interface Props {
  cloud: CloudControls | null;
  syncText: string;
  settings: VaultSettings;
  onChangeSettings: (s: VaultSettings) => void;
  onExport: () => void;
  onImport: (f: File) => Promise<void>;
  onChangePassword: (current: string, next: string) => Promise<void>;
  onClose: () => void;
}

export function SettingsModal(p: Props) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function connect() {
    try {
      await p.cloud!.onConnect();
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    }
  }

  const canChange = cur && next.length >= 10 && passwordStrength(next).score >= 2 && next === confirm && !busy;

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (!canChange) return;
    setBusy(true);
    try {
      await p.onChangePassword(cur, next);
      setCur('');
      setNext('');
      setConfirm('');
      setMsg({ kind: 'ok', text: 'Senha mestra alterada.' });
    } catch (err) {
      setMsg({ kind: 'error', text: err instanceof WrongPasswordError ? 'Senha atual incorreta.' : (err as Error).message });
    }
    setBusy(false);
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    if (!window.confirm('Importar SUBSTITUI o cofre atual deste aparelho pelo backup. Continuar?')) return;
    try {
      await p.onImport(f);
    } catch (err) {
      setMsg({ kind: 'error', text: (err as Error).message });
    }
  }

  return (
    <Modal title="⚙️ Configurações" onClose={p.onClose}>
      <section>
        <h3>Sincronização (Google Drive)</h3>
        {!p.cloud ? (
          <p className="muted small">
            Ainda não configurada: falta o ID do cliente Google em <code>src/config.ts</code>.
          </p>
        ) : p.cloud.account ? (
          <>
            <p className="small">
              ☁️ Conectado como <strong>{p.cloud.account}</strong>
              <br />
              <span className="muted">{p.syncText}</span>
            </p>
            <div className="row-gap">
              <button type="button" className="btn" onClick={p.cloud.onSyncNow}>
                🔄 Sincronizar agora
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  window.confirm('Desconectar o Google Drive neste aparelho? O cofre continua salvo aqui e na nuvem.') &&
                  p.cloud!.onDisconnect()
                }
              >
                Desconectar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted small">
              Conecte para usar o mesmo cofre no PC e no celular. O arquivo fica na pasta oculta do app no seu Google
              Drive, sempre criptografado. Uma janela do Google vai abrir para você escolher a conta e confirmar.
            </p>
            <button type="button" className="btn primary" onClick={() => connect()}>
              ☁️ Conectar Google Drive
            </button>
          </>
        )}
      </section>

      <section>
        <h3>Segurança</h3>
        <div className="grid-2">
          <label>
            Travar após inatividade
            <select
              value={p.settings.autoLockMinutes}
              onChange={(e) => p.onChangeSettings({ ...p.settings, autoLockMinutes: +e.target.value })}
            >
              {[1, 2, 5, 10, 15, 30].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </label>
          <label>
            Limpar área de transferência
            <select
              value={p.settings.clipboardSeconds}
              onChange={(e) => p.onChangeSettings({ ...p.settings, clipboardSeconds: +e.target.value })}
            >
              {[10, 20, 30, 60, 120].map((s) => (
                <option key={s} value={s}>
                  {s} s
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section>
        <h3>Backup</h3>
        <p className="muted small">O backup é o arquivo criptografado: só abre com a senha mestra usada quando ele foi gerado.</p>
        <div className="row-gap">
          <button type="button" className="btn" onClick={p.onExport}>
            ⬇️ Exportar backup
          </button>
          <button type="button" className="btn ghost" onClick={() => fileInput.current?.click()}>
            ⬆️ Importar backup
          </button>
          <input ref={fileInput} type="file" accept=".chavemestra,application/json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </div>
      </section>

      <form onSubmit={changePassword}>
        <h3>Alterar senha mestra</h3>
        <label>
          Senha atual
          <PasswordInput value={cur} onChange={setCur} autoComplete="current-password" />
        </label>
        <label>
          Nova senha
          <PasswordInput value={next} onChange={setNext} autoComplete="new-password" />
        </label>
        <StrengthMeter password={next} />
        <label>
          Confirme a nova senha
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </label>
        {confirm && next !== confirm && <p className="hint warn">As senhas não conferem.</p>}
        <button className="btn primary" disabled={!canChange}>
          {busy ? 'Alterando…' : 'Alterar senha mestra'}
        </button>
      </form>

      {msg && <p className={`hint ${msg.kind === 'ok' ? 'ok' : 'error'}`}>{msg.text}</p>}
    </Modal>
  );
}
