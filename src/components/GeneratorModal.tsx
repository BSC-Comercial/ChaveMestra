import { useEffect, useState } from 'react';
import { DEFAULT_GENERATOR, generatePassword, type GeneratorOptions } from '../lib/generator';
import { Modal, StrengthMeter } from './common';

interface Props {
  onClose: () => void;
  onUse?: (password: string) => void;
  onCopy?: (password: string) => void;
}

const OPTIONS: { key: keyof Omit<GeneratorOptions, 'length'>; label: string }[] = [
  { key: 'lower', label: 'Minúsculas (a-z)' },
  { key: 'upper', label: 'Maiúsculas (A-Z)' },
  { key: 'digits', label: 'Números (0-9)' },
  { key: 'symbols', label: 'Símbolos (!@#…)' },
  { key: 'avoidAmbiguous', label: 'Evitar parecidos (l, 1, O, 0)' },
];

export function GeneratorModal({ onClose, onUse, onCopy }: Props) {
  const [opts, setOpts] = useState<GeneratorOptions>(DEFAULT_GENERATOR);
  const [pw, setPw] = useState('');

  useEffect(() => setPw(generatePassword(opts)), [opts]);

  return (
    <Modal title="🎲 Gerador de senhas" onClose={onClose}>
      <div className="generated mono">{pw || '—'}</div>
      <StrengthMeter password={pw} />
      <label>
        Tamanho: <strong>{opts.length}</strong>
        <input type="range" min={8} max={64} value={opts.length} onChange={(e) => setOpts({ ...opts, length: +e.target.value })} />
      </label>
      {OPTIONS.map((o) => (
        <label key={o.key} className="check">
          <input type="checkbox" checked={opts[o.key]} onChange={(e) => setOpts({ ...opts, [o.key]: e.target.checked })} />
          <span>{o.label}</span>
        </label>
      ))}
      <div className="row-gap end">
        <button type="button" className="btn ghost" onClick={() => setPw(generatePassword(opts))}>
          ↻ Gerar outra
        </button>
        {onCopy && (
          <button type="button" className="btn" onClick={() => onCopy(pw)} disabled={!pw}>
            📋 Copiar
          </button>
        )}
        {onUse && (
          <button type="button" className="btn primary" onClick={() => onUse(pw)} disabled={!pw}>
            Usar esta senha
          </button>
        )}
      </div>
    </Modal>
  );
}
