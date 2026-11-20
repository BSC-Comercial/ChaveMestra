import { describe, expect, it } from 'vitest';
import { decryptVault, deriveKey, encryptVault, newKdfParams, WrongPasswordError } from './crypto';
import { generatePassword, passwordStrength } from './generator';

// Custo baixo só para o teste ficar rápido; o app usa 64 MiB.
const fastKdf = () => newKdfParams({ memoryKiB: 1024, iterations: 1, parallelism: 1 });

describe('criptografia do cofre', () => {
  it('criptografa e descriptografa com a mesma senha', async () => {
    const kdf = fastKdf();
    const key = await deriveKey('senha-mestra-teste', kdf);
    const data = { segredo: 'root:Abc123!', lista: [1, 2, 3] };
    const file = await encryptVault(data, key, kdf);
    expect(file.data).not.toContain('Abc123');
    expect(await decryptVault(file, key)).toEqual(data);
  });

  it('recusa senha errada', async () => {
    const kdf = fastKdf();
    const file = await encryptVault({ a: 1 }, await deriveKey('certa', kdf), kdf);
    await expect(decryptVault(file, await deriveKey('errada', kdf))).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detecta arquivo adulterado', async () => {
    const kdf = fastKdf();
    const key = await deriveKey('x', kdf);
    const file = await encryptVault({ a: 1 }, key, kdf);
    const tampered = { ...file, kdf: { ...file.kdf, iterations: 2 } };
    await expect(decryptVault(tampered, key)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('usa IV novo a cada salvamento', async () => {
    const kdf = fastKdf();
    const key = await deriveKey('x', kdf);
    const a = await encryptVault({ a: 1 }, key, kdf);
    const b = await encryptVault({ a: 1 }, key, kdf);
    expect(a.cipher.iv).not.toBe(b.cipher.iv);
  });
});

describe('gerador de senhas', () => {
  it('respeita tamanho e tipos', () => {
    const pw = generatePassword({ length: 32, lower: true, upper: true, digits: true, symbols: false, avoidAmbiguous: true });
    expect(pw).toHaveLength(32);
    expect(pw).toMatch(/[a-z]/);
    expect(pw).toMatch(/[A-Z]/);
    expect(pw).toMatch(/[0-9]/);
    expect(pw).not.toMatch(/[^a-zA-Z0-9]/);
    expect(pw).not.toMatch(/[Il1O0o]/);
  });

  it('classifica força', () => {
    expect(passwordStrength('123456').score).toBeLessThanOrEqual(1);
    expect(passwordStrength(generatePassword({ length: 24, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: false })).score).toBe(4);
  });
});
