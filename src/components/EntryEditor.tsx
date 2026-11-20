import { useState, type FormEvent } from 'react';
import { ENTRY_TYPES, folderPath, uid, type Entry, type EntryType, type Folder } from '../lib/vault';
import { PasswordInput, StrengthMeter } from './common';
import { GeneratorModal } from './GeneratorModal';

interface Props {
  entry: Entry;
  isNew: boolean;
  folders: Folder[];
  onSave: (e: Entry) => void;
  onCancel: () => void;
}

export function EntryEditor({ entry, isNew, folders, onSave, onCancel }: Props) {
  const [e, setE] = useState<Entry>(entry);
  const [tagText, setTagText] = useState(entry.tags.join(', '));
  const [showGen, setShowGen] = useState(false);
  const set = <K extends keyof Entry>(k: K, v: Entry[K]) => setE((prev) => ({ ...prev, [k]: v }));
  const fields = ENTRY_TYPES[e.type].fields;

  function changeType(type: EntryType) {
    setE((prev) => {
      // Troca a porta só se ela ainda era a padrão do tipo anterior.
      const keepPort = prev.port && prev.port !== ENTRY_TYPES[prev.type].defaultPort;
      return { ...prev, type, port: keepPort ? prev.port : ENTRY_TYPES[type].defaultPort };
    });
  }

  function setCustom(id: string, patch: Partial<Entry['customFields'][number]>) {
    set(
      'customFields',
      e.customFields.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    );
  }

  function submit(ev: FormEvent) {
    ev.preventDefault();
    if (!e.title.trim()) return;
    const tags = [...new Set(tagText.split(',').map((t) => t.trim()).filter(Boolean))];
    onSave({ ...e, title: e.title.trim(), tags, customFields: e.customFields.filter((c) => c.label || c.value) });
  }

  const sortedFolders = [...folders].sort((a, b) =>
    folderPath(folders, a.id).localeCompare(folderPath(folders, b.id), 'pt-BR'),
  );

  return (
    <form className="detail editor" onSubmit={submit}>
      <header className="detail-head">
        <h2 className="grow">{isNew ? 'Novo registro' : 'Editar registro'}</h2>
      </header>

      <div className="grid-2">
        <label>
          Tipo
          <select value={e.type} onChange={(ev) => changeType(ev.target.value as EntryType)}>
            {(Object.keys(ENTRY_TYPES) as EntryType[]).map((t) => (
              <option key={t} value={t}>
                {ENTRY_TYPES[t].icon} {ENTRY_TYPES[t].label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Pasta
          <select value={e.folderId} onChange={(ev) => set('folderId', ev.target.value)}>
            {sortedFolders.map((f) => (
              <option key={f.id} value={f.id}>
                {folderPath(folders, f.id)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Título *
        <input value={e.title} onChange={(ev) => set('title', ev.target.value)} placeholder="Ex.: Servidor Web — Cliente Alfa" autoFocus required />
      </label>

      {fields.includes('host') && (
        <div className="grid-host">
          <label>
            Host / IP
            <input className="mono" value={e.host} onChange={(ev) => set('host', ev.target.value)} placeholder="192.168.0.10 ou srv.cliente.com" spellCheck={false} />
          </label>
          <label>
            Porta
            <input className="mono" value={e.port} onChange={(ev) => set('port', ev.target.value)} inputMode="numeric" />
          </label>
        </div>
      )}
      {fields.includes('url') && (
        <label>
          URL
          <input className="mono" value={e.url} onChange={(ev) => set('url', ev.target.value)} placeholder="https://painel.cliente.com" spellCheck={false} />
        </label>
      )}

      <label>
        Usuário
        <input className="mono" value={e.username} onChange={(ev) => set('username', ev.target.value)} autoComplete="off" spellCheck={false} />
      </label>
      <label>
        Senha
        <PasswordInput value={e.password} onChange={(v) => set('password', v)}>
          <button type="button" className="icon-btn" onClick={() => setShowGen(true)} title="Gerar senha forte">
            🎲
          </button>
        </PasswordInput>
      </label>
      <StrengthMeter password={e.password} />

      <fieldset>
        <legend>Campos extras</legend>
        {e.customFields.map((c) => (
          <div key={c.id} className="custom-row">
            <input value={c.label} onChange={(ev) => setCustom(c.id, { label: ev.target.value })} placeholder="Nome (ex.: ID AnyDesk)" />
            <input
              className="mono"
              type={c.secret ? 'password' : 'text'}
              value={c.value}
              onChange={(ev) => setCustom(c.id, { value: ev.target.value })}
              placeholder="Valor"
              autoComplete="off"
            />
            <label className="check compact" title="Ocultar valor">
              <input type="checkbox" checked={c.secret} onChange={(ev) => setCustom(c.id, { secret: ev.target.checked })} />
              🔒
            </label>
            <button type="button" className="icon-btn small" onClick={() => set('customFields', e.customFields.filter((x) => x.id !== c.id))} title="Remover">
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          className="btn ghost small"
          onClick={() => set('customFields', [...e.customFields, { id: uid(), label: '', value: '', secret: false }])}
        >
          + Adicionar campo
        </button>
      </fieldset>

      <label>
        Notas
        <textarea
          rows={5}
          value={e.notes}
          onChange={(ev) => set('notes', ev.target.value)}
          placeholder="Ex.: Só acessa via VPN. Backup roda às 2h. Falar com João antes de reiniciar."
        />
      </label>
      <label>
        Tags <small className="muted">(separadas por vírgula)</small>
        <input value={tagText} onChange={(ev) => setTagText(ev.target.value)} placeholder="produção, vpn" />
      </label>
      <label className="check">
        <input type="checkbox" checked={e.favorite} onChange={(ev) => set('favorite', ev.target.checked)} />
        <span>⭐ Favorito</span>
      </label>

      <footer className="detail-foot">
        <span />
        <div className="row-gap">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn primary" disabled={!e.title.trim()}>
            Salvar
          </button>
        </div>
      </footer>

      {showGen && (
        <GeneratorModal
          onClose={() => setShowGen(false)}
          onUse={(pw) => {
            set('password', pw);
            setShowGen(false);
          }}
        />
      )}
    </form>
  );
}
