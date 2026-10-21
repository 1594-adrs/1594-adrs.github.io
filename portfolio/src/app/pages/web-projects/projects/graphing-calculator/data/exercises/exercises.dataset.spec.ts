import type { Exercise } from './exercise.types';
import { EXERCISE_CHUNKS } from './index';
import { KNOWN_FAILURES } from './known-failures';
import { runExercise, type ExerciseRun } from './run-exercise';

interface Row {
  ex: Exercise;
  run: ExerciseRun;
}

// Runs at collection time: `it` vs `it.todo` depends on each exercise's status.
const chunks: Array<[string, Row[]]> = await Promise.all(
  Object.entries(EXERCISE_CHUNKS).map(async ([name, load]): Promise<[string, Row[]]> => [
    name,
    (await load()).map((ex) => ({ ex, run: runExercise(ex) })),
  ]),
);
const rows = chunks.flatMap(([, r]) => r);

function count(keys: string[]): Array<[string, number]> {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].sort((p, q) => q[1] - p[1] || p[0].localeCompare(q[0]));
}

function summary(): string {
  const fmt = (pairs: Array<[string, number]>) => pairs.map(([k, n]) => `${k} ${n}`).join(' · ');
  const lines = [`Exercise dataset: ${rows.length} — ${fmt(count(rows.map((r) => r.run.status)))}`];
  for (const [source] of count(rows.map((r) => r.ex.source))) {
    const own = rows.filter((r) => r.ex.source === source);
    lines.push(`  ${source} (${own.length}): ${fmt(count(own.map((r) => r.run.status)))}`);
  }
  for (const [kind] of count(rows.map((r) => r.ex.op.kind))) {
    const own = rows.filter((r) => r.ex.op.kind === kind);
    lines.push(`  op ${kind} (${own.length}): ${fmt(count(own.map((r) => r.run.status)))}`);
  }
  const features = count(rows.flatMap((r) => (r.run.feature ? [r.run.feature] : [])));
  lines.push(
    'Unsupported features:',
    ...features.map(([f, n]) => `  ${String(n).padStart(5)}  ${f}`),
  );
  return lines.join('\n');
}

describe('exercise dataset', () => {
  afterAll(() => console.info(summary()));

  it('has unique ids and KNOWN_FAILURES only lists existing ids', () => {
    const ids = rows.map((r) => r.ex.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
    const known = new Set(ids);
    expect(Object.keys(KNOWN_FAILURES).filter((id) => !known.has(id))).toEqual([]);
  });

  for (const [chunk, chunkRows] of chunks) {
    describe(chunk, () => {
      for (const { ex, run } of chunkRows) {
        if (run.status === 'unsupported') {
          it.todo(`${ex.id} [unsupported: ${run.feature}]`);
          continue;
        }
        it(ex.id, () => {
          const known = Object.hasOwn(KNOWN_FAILURES, ex.id) ? KNOWN_FAILURES[ex.id] : undefined;
          const passed = run.status === 'ok' || run.status === 'ran';
          if (passed && known) {
            throw new Error(`${ex.id} now passes: remove it from KNOWN_FAILURES`);
          }
          if (!passed && known !== run.status) {
            throw new Error(
              `${ex.id} ${run.status}${known ? ` (KNOWN_FAILURES says ${known})` : ''}: ` +
                `${run.message ?? ''} curves=${JSON.stringify(ex.curves)} op=${JSON.stringify(ex.op)}`,
            );
          }
        });
      }
    });
  }
});
