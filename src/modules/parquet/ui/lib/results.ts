/**
 * Rapport du parquet pour l'écran Résultats commun : par pose touchée, lames posées et coupes exactes sur la
 * portée (une pièce : ses lames seulement), paquets à commander pour toute la pose (les chutes resservent dans
 * toute la pose, docs/NAVIGATION.md §7).
 */
import { poseBeyond } from '../../../../core/coverage/scope';
import type { Id } from '../../../../state/model';
import type { PoseReport, ResultInput } from '../../../types';
import type { Board } from '../../core/board';
import type { BoardUse, LaidPiece, ParquetResult } from '../../core/types';
import { marginOf } from '../../state/module';
import { layoutsOf, parquetData } from '../../state/poses';
import { errorText, warningText } from './messages';

const fr = (v: number) => v.toLocaleString('fr-FR');
const plural = (n: number, one: string, many: string) => `${fr(n)} ${n > 1 ? many : one}`;

/** Poses du parquet touchées par la portée, dans l'ordre du projet. */
export function scopeLayouts(input: Pick<ResultInput, 'project' | 'scope'>): Id[] {
  const { project, scope } = input;
  return layoutsOf(project)
    .filter((l) =>
      scope.kind === 'pose' ? l.id === scope.pose : scope.kind === 'room' ? l.rooms.includes(scope.room) : true,
    )
    .map((l) => l.id);
}

/** Pièces posées d'une pose dans la portée (une pièce du plan : celles de cette pièce). */
export function scopeLaid(pieces: readonly LaidPiece[], input: Pick<ResultInput, 'scope'>): LaidPiece[] {
  const s = input.scope;
  return s.kind === 'room' ? pieces.filter((p) => p.room === s.room) : [...pieces];
}

export function parquetReport(input: ResultInput<ParquetResult>): PoseReport[] {
  const { project, result, libraries } = input;
  const data = parquetData(project);
  if (!data) return [];
  const boards = (libraries.boards ?? []) as readonly Board[];
  const layouts = layoutsOf(project);
  const margin = marginOf(data) / 100;
  return scopeLayouts(input).flatMap((id): PoseReport[] => {
    const lr = result.layouts.find((x) => x.id === id);
    const l = layouts.find((x) => x.id === id);
    if (!lr || !l) return [];
    const alerts = [...lr.errors.map(errorText), ...new Set(lr.warnings.map(warningText))];
    if (lr.errors.length) return [{ pose: id, figures: [], order: [], orderNote: null, alerts, ok: false }];
    const laid = scopeLaid(lr.pieces, input);
    const cut = laid.filter((p) => p.cutType !== 'full').length;
    const reused = laid.filter((p) => 'offcut' in p.source).length;
    const board = boards.find((b) => b.id === l.boardId);
    const counts = { A: 0, B: 0, plain: 0 };
    for (const b of lr.boards) counts[b.variant ?? 'plain']++;
    const order = board
      ? (Object.entries(counts) as ['A' | 'B' | 'plain', number][])
          .filter(([, n]) => n > 0)
          .map(([v, n]) => {
            const packs = Math.ceil((n * (1 + margin)) / board.boardsPerPack);
            return `${plural(packs, 'paquet', 'paquets')} ${board.name}${v === 'plain' ? '' : ` (lames ${v})`} : ${plural(n, 'lame', 'lames')} + ${Math.round(margin * 100)} %`;
          })
      : [];
    return [
      {
        pose: id,
        figures: [
          { label: 'Lames posées', value: fr(laid.length) },
          { label: 'Lames coupées', value: fr(cut), status: 'cut' },
          { label: 'Dans les chutes', value: fr(reused), status: 'reuse' },
          { label: 'Perte de la pose', value: `${fr(Math.round(lossPct(lr.pieces, lr.boards) * 10) / 10)} %` },
        ],
        order,
        orderNote: poseBeyond(project, id, input.scope) ? 'Pour toute la pose, y compris hors de cette pièce.' : null,
        alerts,
        ok: true,
      },
    ];
  });
}

/** Résultat restreint à une portée : ses poses, et pour une pièce ses seules lames. */
export function scopedResult(result: ParquetResult, input: Pick<ResultInput, 'project' | 'scope'>): ParquetResult {
  const ids = new Set(scopeLayouts(input));
  return {
    ...result,
    layouts: result.layouts
      .filter((l) => ids.has(l.id))
      .map((l) => (input.scope.kind === 'room' ? { ...l, pieces: scopeLaid(l.pieces, input) } : l)),
  };
}

/** Part de la longueur des lames neuves qui ne finit pas posée (chutes trop courtes, traits de scie), %. */
function lossPct(pieces: readonly LaidPiece[], boards: readonly BoardUse[]): number {
  const bought = boards.reduce((t, b) => t + b.length, 0);
  if (!bought) return 0;
  const used = pieces.reduce((t, p) => t + p.length, 0);
  return Math.max(0, (1 - used / bought) * 100);
}
