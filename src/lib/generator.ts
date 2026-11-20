export interface GeneratorOptions {
  length: number;
  lower: boolean;
  upper: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

export const DEFAULT_GENERATOR: GeneratorOptions = {
  length: 20,
  lower: true,
  upper: true,
  digits: true,
  symbols: true,
  avoidAmbiguous: true,
};

const SETS = {
  lower: 'abcdefghijklmnopqrstuvwxyz',
  upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  digits: '0123456789',
  symbols: '!@#$%&*-_=+?.:;',
};
const AMBIGUOUS = /[Il1O0o]/g;

/** Inteiro aleatório em [0, max) sem viés, usando o gerador criptográfico do navegador. */
function randomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return buf[0] % max;
}

export function generatePassword(opts: GeneratorOptions): string {
  const sets = (Object.keys(SETS) as (keyof typeof SETS)[])
    .filter((k) => opts[k])
    .map((k) => (opts.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, '') : SETS[k]));
  if (sets.length === 0) return '';
  const all = sets.join('');
  const length = Math.max(opts.length, sets.length);
  // Garante ao menos um caractere de cada tipo escolhido, depois embaralha.
  const chars = sets.map((s) => s[randomInt(s.length)]);
  while (chars.length < length) chars.push(all[randomInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

export interface Strength {
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  bits: number;
}

const LABELS = ['Muito fraca', 'Fraca', 'Média', 'Forte', 'Muito forte'];

/** Estimativa simples de força (entropia aproximada). */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: '—', bits: 0 };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/[0-9]/.test(pw)) pool += 10;
  if (/[^a-zA-Z0-9]/.test(pw)) pool += 33;
  const unique = new Set(pw).size;
  // Repetição de caracteres reduz bastante a força real.
  const effectiveLength = Math.min(pw.length, unique * 2);
  const bits = Math.round(effectiveLength * Math.log2(pool || 1));
  const score = bits < 28 ? 0 : bits < 45 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, label: LABELS[score], bits };
}
