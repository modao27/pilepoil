/** Un calcul qui échoue se voit : l'éditeur garde le résultat d'avant et le signale (`failed`), puis se rétablit. */
import { describe, expect, it, vi } from 'vitest';
import { BOARD_TEMPLATES } from '../../src/modules/parquet/core/board';
import { computeParquet } from '../../src/modules/parquet/core/compute';
import { toSpec } from '../../src/modules/parquet/state/module';
import { ParquetEditorState } from '../../src/modules/parquet/ui/editorState.svelte';
import { app } from '../../src/ui/lib/app.svelte';
import type { ComputeClient } from '../../src/workers/client';
import { parquetProject } from './parquetHelpers';
import { rect } from './planFixtures';

describe('calcul échoué', () => {
  it('éditeur parquet : résultat d’avant gardé, `failed` levé puis rabaissé', async () => {
    const p = parquetProject({ rooms: [rect('a', 4000, 3000)], passages: [] }, [{ id: 'L1', rooms: ['a'] }]);
    app.libraries = { boards: BOARD_TEMPLATES };
    const r = toSpec(p, app.libraries);
    if ('errors' in r) throw new Error('attendu : une entrée');
    const good = computeParquet(r.spec);
    const compute = vi
      .fn()
      .mockResolvedValueOnce(good)
      .mockRejectedValueOnce(new Error('moteur'))
      .mockResolvedValue(good);
    app.live = { compute } as unknown as ComputeClient;
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const ed = new ParquetEditorState(p);
    await ed.recompute();
    expect([ed.failed, ed.result]).toEqual([false, good]);
    await ed.recompute();
    expect(ed.failed).toBe(true);
    expect(ed.result).toBe(good);
    await ed.recompute();
    expect(ed.failed).toBe(false);
  });
});
