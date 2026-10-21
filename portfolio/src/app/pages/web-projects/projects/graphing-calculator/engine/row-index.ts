/** A change to the function-row list that shifts the indices other state points at. */
export type RowOp = { remove: number } | { from: number; to: number };

/** Where the row that was at `i` sits after `op`; `null` when `op` removed it. */
export function remapIndex(i: number, op: RowOp): number | null {
  if ('remove' in op) {
    if (i === op.remove) return null;
    return i > op.remove ? i - 1 : i;
  }
  const { from, to } = op;
  if (i === from) return to;
  if (from < to && i > from && i <= to) return i - 1;
  if (from > to && i >= to && i < from) return i + 1;
  return i;
}
