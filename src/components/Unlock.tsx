import { useState, type FormEvent } from 'react';
import type { Theme } from '../hooks';
import { WrongPasswordError } from '../lib/crypto';
import { PasswordInput, ThemeToggle } from './common';

interface Props {
  onUnlock: (password: string) => Promise<void>;
  onErase: () => Promise<void>;
  theme: Theme;
  onToggleTheme: () => void;
  account: string | null;
}

export function Unlock({ onUnlock, onErase, theme, onToggleTheme, account }: Props) {
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgot, setForgot] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onUnlock(pw);
    } catch (err) {
      setError(err instanceof WrongPasswordError ? 'Senha mestra incorreta.' : (err as Error).message);
      setBusy(false);
    }
  }

  async function erase() {
    const typed = prompt('Isso APAGA o cofre deste aparelho para sempre.\nDigite APAGAR para confirmar:');
    if (typed === 'APAGAR') await onErase();
  }

  return (
    <div className="center-screen">
      <div className="corner">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <form className="card auth-card" onSubmit={submit}>
        <div className="logo">🔒</div>
        <h1>ChaveMestra</h1>
        <p className="muted">Cofre travado. Digite sua senha mestra.</p>
        {account && <p className="hint muted center">☁️ Sincronizado com o Google Drive ({account})</p>}
        <label>
          Senha mestra
          <PasswordInput value={pw} onChange={setPw} autoFocus autoComplete="current-password" />
        </label>
        {error && <p className="hint error">{error}</p>}
        <button className="btn primary block" disabled={!pw || busy}>
          {busy ? 'Abrindo…' : 'Desbloquear'}
        </button>
        <button type="button" className="link" onClick={() => setForgot(!forgot)}>
          Esqueci a senha mestra
        </button>
        {forgot && (
          <div className="callout">
            <p>
              Por segurança, <strong>não existe recuperação</strong>: nem o ChaveMestra consegue abrir o cofre sem a
              senha. Se você tiver um backup com outra senha, pode apagar este cofre e importá-lo.
            </p>
            <button type="button" className="btn danger" onClick={erase}>
              Apagar cofre deste aparelho
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
