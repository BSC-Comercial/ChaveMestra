import { useRef, useState, type FormEvent } from 'react';
import type { Theme } from '../hooks';
import { passwordStrength } from '../lib/generator';
import { PasswordInput, StrengthMeter, ThemeToggle } from './common';

const MIN_LENGTH = 10;

interface Props {
  onCreate: (password: string) => Promise<void>;
  onImport: (file: File) => Promise<void>;
  theme: Theme;
  onToggleTheme: () => void;
  cloud: { account: string | null; onConnect: () => Promise<void> } | null;
}

export function Setup({ onCreate, onImport, theme, onToggleTheme, cloud }: Props) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const strong = passwordStrength(pw).score >= 2;
  const problem =
    pw.length < MIN_LENGTH
      ? `Use pelo menos ${MIN_LENGTH} caracteres.`
      : !strong
        ? 'Senha fraca: misture palavras, números e símbolos.'
        : confirm && confirm !== pw
          ? 'As senhas não conferem.'
          : null;
  const canSubmit = !problem && confirm === pw && understood && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    try {
      await onCreate(pw);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function connect() {
    try {
      await cloud!.onConnect();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function importFile(f: File | undefined) {
    if (!f) return;
    try {
      await onImport(f);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div className="center-screen">
      <div className="corner">
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
      <form className="card auth-card" onSubmit={submit}>
        <div className="logo">🔐</div>
        <h1>ChaveMestra</h1>
        <p className="muted">Crie seu cofre. Tudo é criptografado aqui no seu aparelho com a senha mestra.</p>

        {cloud && !cloud.account && (
          <div className="callout">
            <p>
              <strong>Já usa o ChaveMestra em outro aparelho?</strong> Entre com sua conta Google para baixar o cofre
              do Google Drive.
            </p>
            <button type="button" className="btn primary" onClick={() => connect()}>
              ☁️ Entrar com Google
            </button>
          </div>
        )}
        {cloud?.account && (
          <p className="hint ok">
            ☁️ Conectado como {cloud.account}. Se não houver cofre no Drive ainda, o novo será salvo lá.
          </p>
        )}

        <label>
          Senha mestra
          <PasswordInput value={pw} onChange={setPw} autoFocus autoComplete="new-password" />
        </label>
        <StrengthMeter password={pw} />
        <label>
          Confirme a senha mestra
          <PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" />
        </label>
        {pw && problem && <p className="hint warn">{problem}</p>}

        <div className="callout">
          <strong>💡 Dica:</strong> uma frase com 4 ou mais palavras é forte e fácil de lembrar, ex.:{' '}
          <em>cavalo-azul-pula-janela-42</em>
        </div>

        <label className="check">
          <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
          <span>
            Entendo que <strong>se eu esquecer a senha mestra, não há como recuperar</strong> o cofre.
          </span>
        </label>

        {error && <p className="hint error">{error}</p>}

        <button className="btn primary block" disabled={!canSubmit}>
          {busy ? 'Criando cofre…' : 'Criar cofre'}
        </button>
        <button type="button" className="btn ghost block" onClick={() => fileInput.current?.click()}>
          Já tenho um backup — importar
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".chavemestra,application/json"
          hidden
          onChange={(e) => importFile(e.target.files?.[0])}
        />
      </form>
    </div>
  );
}
