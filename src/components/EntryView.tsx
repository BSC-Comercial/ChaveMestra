import { useState } from 'react';
import { ENTRY_TYPES, folderPath, type Entry, type Folder } from '../lib/vault';
import { ageInDays, formatDate, StrengthMeter } from './common';

type CopyFn = (text: string, label: string) => void;

function Row({ label, value, secret, onCopy, href }: { label: string; value: string; secret?: boolean; onCopy: CopyFn; href?: string }) {
  const [show, setShow] = useState(false);
  if (!value) return null;
  return (
    <div className="field-row">
      <span className="field-label">{label}</span>
      <span className={`field-value mono ${secret && !show ? 'masked' : ''}`}>
        {secret && !show ? '••••••••••••' : href ? <a href={href} target="_blank" rel="noopener noreferrer">{value}</a> : value}
      </span>
      <span className="field-actions">
        {secret && (
          <button type="button" className="icon-btn small" onClick={() => setShow(!show)} title={show ? 'Ocultar' : 'Mostrar'}>
            {show ? '🙈' : '👁️'}
          </button>
        )}
        <button type="button" className="icon-btn small" onClick={() => onCopy(value, label)} title={`Copiar ${label.toLowerCase()}`}>
          📋
        </button>
      </span>
    </div>
  );
}

function safeHref(url: string) {
  const withScheme = /^[a-z]+:\/\//i.test(url) ? url : `https://${url}`;
  return /^https?:\/\//i.test(withScheme) ? withScheme : undefined;
}

/** Comando pronto para colar no terminal. */
function connectCommand(e: Entry) {
  if (!e.host) return null;
  if (e.type === 'ssh') {
    const user = e.username ? `${e.username}@` : '';
    const port = e.port && e.port !== '22' ? ` -p ${e.port}` : '';
    return `ssh ${user}${e.host}${port}`;
  }
  if (e.type === 'rdp') return `mstsc /v:${e.host}${e.port && e.port !== '3389' ? `:${e.port}` : ''}`;
  return null;
}

interface Props {
  entry: Entry;
  folders: Folder[];
  onCopy: CopyFn;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
}

export function EntryView({ entry: e, folders, onCopy, onEdit, onDelete, onToggleFavorite, onBack }: Props) {
  const [showHistory, setShowHistory] = useState(false);
  const t = ENTRY_TYPES[e.type];
  const cmd = connectCommand(e);
  const age = ageInDays(e.passwordChangedAt);

  return (
    <article className="detail">
      <button type="button" className="btn ghost only-mobile back" onClick={onBack}>
        ← Voltar
      </button>
      <header className="detail-head">
        <span className="big-icon">{t.icon}</span>
        <div className="grow">
          <h2>{e.title || 'Sem título'}</h2>
          <p className="muted small">
            {t.label} · {folderPath(folders, e.folderId)}
          </p>
        </div>
        <button type="button" className="icon-btn" onClick={onToggleFavorite} title="Favorito">
          {e.favorite ? '⭐' : '☆'}
        </button>
      </header>

      <section className="fields">
        <Row label="Host" value={e.host} onCopy={onCopy} />
        <Row label="Porta" value={e.port} onCopy={onCopy} />
        <Row label="URL" value={e.url} onCopy={onCopy} href={safeHref(e.url)} />
        <Row label="Usuário" value={e.username} onCopy={onCopy} />
        <Row label="Senha" value={e.password} secret onCopy={onCopy} />
        {e.password && (
          <div className="field-row sub">
            <span className="field-label" />
            <div className="grow">
              <StrengthMeter password={e.password} />
              <small className={age > 180 ? 'warn' : 'muted'}>
                Senha alterada há {age} {age === 1 ? 'dia' : 'dias'}
                {age > 180 && ' — considere trocar'}
              </small>
            </div>
          </div>
        )}
        {e.customFields.map((c) => (
          <Row key={c.id} label={c.label || 'Campo'} value={c.value} secret={c.secret} onCopy={onCopy} />
        ))}
        {cmd && <Row label="Conectar" value={cmd} onCopy={onCopy} />}
      </section>

      {e.notes && (
        <section>
          <h3>Notas</h3>
          <div className="notes">{e.notes}</div>
        </section>
      )}

      {e.tags.length > 0 && (
        <div className="tags">
          {e.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {e.passwordHistory.length > 0 && (
        <section>
          <button type="button" className="link" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? '▾' : '▸'} Histórico de senhas ({e.passwordHistory.length})
          </button>
          {showHistory && (
            <div className="fields">
              {e.passwordHistory.map((h, i) => (
                <Row key={i} label={`Até ${formatDate(h.changedAt)}`} value={h.password} secret onCopy={onCopy} />
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="detail-foot">
        <small className="muted">
          Criado {formatDate(e.createdAt)} · Atualizado {formatDate(e.updatedAt)}
        </small>
        <div className="row-gap">
          <button type="button" className="btn danger ghost" onClick={onDelete}>
            Excluir
          </button>
          <button type="button" className="btn primary" onClick={onEdit}>
            Editar
          </button>
        </div>
      </footer>
    </article>
  );
}
