import { describe, expect, it } from 'vitest';
import { createEmptyVault, mergeVaults, newEntry, removeItems, type Entry, type Vault } from './vault';

const at = (min: number) => new Date(Date.UTC(2026, 0, 1, 0, min)).toISOString();
const entry = (v: Vault, title: string, min: number): Entry => ({ ...newEntry(v.folders[0].id), title, updatedAt: at(min) });

describe('mesclagem entre aparelhos', () => {
  it('mantém registros novos dos dois lados', () => {
    const base = createEmptyVault();
    const pc = { ...base, entries: [entry(base, 'do PC', 1)] };
    const cel = { ...base, entries: [entry(base, 'do celular', 2)] };
    expect(mergeVaults(pc, cel).entries.map((e) => e.title).sort()).toEqual(['do PC', 'do celular']);
  });

  it('vale a edição mais recente', () => {
    const base = createEmptyVault();
    const e = entry(base, 'antigo', 1);
    const pc = { ...base, entries: [e] };
    const cel = { ...base, entries: [{ ...e, title: 'novo', updatedAt: at(5) }] };
    expect(mergeVaults(pc, cel).entries[0].title).toBe('novo');
    expect(mergeVaults(cel, pc).entries[0].title).toBe('novo');
  });

  it('exclusão não ressuscita', () => {
    const base = createEmptyVault();
    const e = entry(base, 'x', 1);
    const pc = removeItems({ ...base, entries: [e] }, [e.id]);
    const cel = { ...base, entries: [e] };
    expect(mergeVaults(cel, pc).entries).toHaveLength(0);
  });

  it('edição posterior à exclusão vence', () => {
    const base = createEmptyVault();
    const e = entry(base, 'x', 1);
    const pc = { ...base, entries: [], tombstones: [{ id: e.id, deletedAt: at(2) }] };
    const cel = { ...base, entries: [{ ...e, updatedAt: at(3) }] };
    expect(mergeVaults(pc, cel).entries).toHaveLength(1);
  });

  it('registro de pasta apagada vai para outra pasta', () => {
    const base = createEmptyVault();
    const folder = base.folders[1];
    const e = { ...entry(base, 'x', 5), folderId: folder.id };
    const pc = removeItems(base, [folder.id]);
    const cel = { ...base, entries: [e] };
    const merged = mergeVaults(pc, cel);
    expect(merged.folders.some((f) => f.id === folder.id)).toBe(false);
    expect(merged.entries[0].folderId).toBe(base.folders[0].id);
  });
});
