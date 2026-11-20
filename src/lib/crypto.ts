import { argon2id } from 'hash-wasm';
import { fromBase64, toBase64 } from './base64';

export interface KdfParams {
  alg: 'argon2id';
  memoryKiB: number;
  iterations: number;
  parallelism: number;
  salt: string;
}

/** Formato do arquivo do cofre. Tudo que importa fica dentro de `data`, criptografado. */
export interface VaultFile {
  format: 'chavemestra';
  version: 1;
  kdf: KdfParams;
  cipher: { alg: 'AES-256-GCM'; iv: string };
  data: string;
  savedAt: string;
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Senha mestra incorreta');
  }
}

// 64 MiB e 3 passadas: ~0,5–1 s num PC comum, caro o bastante para atrasar força bruta.
const DEFAULT_COST = { memoryKiB: 64 * 1024, iterations: 3, parallelism: 1 };

export function newKdfParams(cost = DEFAULT_COST): KdfParams {
  return { alg: 'argon2id', ...cost, salt: toBase64(crypto.getRandomValues(new Uint8Array(16))) };
}

/** Transforma a senha mestra numa chave AES. A chave não pode ser exportada da memória. */
export async function deriveKey(password: string, kdf: KdfParams): Promise<CryptoKey> {
  const raw = await argon2id({
    password: password.normalize('NFC'),
    salt: fromBase64(kdf.salt),
    memorySize: kdf.memoryKiB,
    iterations: kdf.iterations,
    parallelism: kdf.parallelism,
    hashLength: 32,
    outputType: 'binary',
  });
  const bytes = new Uint8Array(raw);
  raw.fill(0);
  try {
    return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
  } finally {
    bytes.fill(0);
  }
}

// O cabeçalho entra como dado autenticado: qualquer alteração nele invalida o arquivo.
function header(kdf: KdfParams) {
  return new TextEncoder().encode(
    `chavemestra/v1/${kdf.alg}/${kdf.memoryKiB}/${kdf.iterations}/${kdf.parallelism}/${kdf.salt}`,
  );
}

export async function encryptVault(data: unknown, key: CryptoKey, kdf: KdfParams): Promise<VaultFile> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(data));
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: header(kdf) }, key, plain);
  return {
    format: 'chavemestra',
    version: 1,
    kdf,
    cipher: { alg: 'AES-256-GCM', iv: toBase64(iv) },
    data: toBase64(new Uint8Array(cipher)),
    savedAt: new Date().toISOString(),
  };
}

export async function decryptVault(file: VaultFile, key: CryptoKey): Promise<unknown> {
  let plain: ArrayBuffer;
  try {
    plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: fromBase64(file.cipher.iv), additionalData: header(file.kdf) },
      key,
      fromBase64(file.data),
    );
  } catch {
    throw new WrongPasswordError();
  }
  return JSON.parse(new TextDecoder().decode(plain));
}

export function isVaultFile(x: unknown): x is VaultFile {
  const f = x as VaultFile;
  return (
    !!f &&
    f.format === 'chavemestra' &&
    f.version === 1 &&
    f.kdf?.alg === 'argon2id' &&
    typeof f.kdf.salt === 'string' &&
    f.cipher?.alg === 'AES-256-GCM' &&
    typeof f.cipher.iv === 'string' &&
    typeof f.data === 'string'
  );
}
